"""Async Gemini REST client.

Uses ``httpx`` (already a project dependency) to call the Gemini
``generateContent`` endpoint directly.  This avoids the heavyweight
``google-generativeai`` SDK to keep the install footprint small.

Security invariants:
- API key is read from ``Settings.google_ai_api_key`` at call time.
- Keys must NEVER be logged or included in error messages.
- If the key is empty or the request fails, a ``GeminiClientError`` is raised.
  Callers (analyzer.py) catch this and record the failure as
  ``AIAnalysisStatus.FAILED`` without crashing the scan or scoring pipeline.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import re
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
_GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions"
_DEFAULT_MODEL = "gemini-2.5-flash"
_DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"
_REQUEST_TIMEOUT = 45.0  # seconds
_MAX_RETRIES = 5
_MIN_REQUEST_INTERVAL = 16.5  # seconds between AI calls to prevent RPM spikes

_ai_lock: asyncio.Lock | None = None
_last_call_timestamp: float = 0.0


def _get_ai_lock() -> asyncio.Lock:
    global _ai_lock
    if _ai_lock is None:
        _ai_lock = asyncio.Lock()
    return _ai_lock


async def _throttle_ai_request() -> None:
    """Ensure safe spacing between outbound AI calls across concurrent tasks."""
    global _last_call_timestamp
    try:
        loop = asyncio.get_running_loop()
        now = loop.time()
        elapsed = now - _last_call_timestamp
        if elapsed < _MIN_REQUEST_INTERVAL:
            await asyncio.sleep(_MIN_REQUEST_INTERVAL - elapsed)
        _last_call_timestamp = loop.time()
    except RuntimeError:
        pass


def _extract_retry_after(response: httpx.Response | None) -> float | None:
    """Extract retry delay in seconds from provider response headers or body."""
    if response is None:
        return None
    try:
        headers = getattr(response, "headers", None)
        if headers is not None:
            header_val = headers.get("retry-after")
            if header_val:
                try:
                    return float(header_val)
                except (ValueError, TypeError):
                    pass
            ms_val = headers.get("retry-after-ms")
            if ms_val:
                try:
                    return float(ms_val) / 1000.0
                except (ValueError, TypeError):
                    pass
    except Exception:
        logger.debug("Failed to parse retry headers", exc_info=True)
    try:
        body = response.json()
        error_msg = body.get("error", {}).get("message", "")
        match = re.search(r"try again in ([\d\.]+)\s*s", error_msg, re.IGNORECASE)
        if match:
            return float(match.group(1))
    except Exception:
        logger.debug("Failed to parse retry delay from response body", exc_info=True)
    return None


def _calculate_backoff(attempt: int, response: httpx.Response | None = None) -> float:
    """Calculate backoff duration in seconds with full jitter.

    Uses Retry-After if provided by the upstream API, otherwise computes
    exponential backoff: 2 * (2 ** attempt) + random jitter.
    """
    retry_after = _extract_retry_after(response)
    if retry_after is not None and retry_after > 0:
        return retry_after + random.uniform(0.5, 1.5)  # noqa: S311

    base = 3.0 * (2**attempt)
    jitter = random.uniform(0.5, 2.0)  # noqa: S311
    return float(base + jitter)


class AIClientError(Exception):
    """Raised when an AI API call fails for any reason."""


GeminiClientError = AIClientError  # Backward compatibility alias
GroqClientError = AIClientError  # Backward compatibility alias


async def call_gemini(
    *,
    system_instruction: str,
    user_prompt: str,
    model: str | None = None,
) -> dict[str, Any]:
    """Call the Gemini generateContent endpoint and return the parsed JSON response.

    Args:
        system_instruction: System-level behaviour instruction.
        user_prompt: The user-facing prompt text.
        model: Gemini model identifier (defaults to settings.ai_model or ``gemini-2.5-flash``).

    Returns:
        Parsed dict from the model's text output (expected to be valid JSON).

    Raises:
        GeminiClientError: If the API key is missing, the HTTP request fails,
            or the model output cannot be parsed as JSON.
    """
    settings = get_settings()
    api_key = settings.google_ai_api_key or settings.gemini_api_key
    if not api_key:
        raise GeminiClientError(
            "Google AI / Gemini API key is not configured — AI analysis skipped"
        )

    target_model = model or getattr(settings, "ai_model", _DEFAULT_MODEL) or _DEFAULT_MODEL
    url = f"{_GEMINI_BASE_URL}/{target_model}:generateContent"
    payload = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2,
            "maxOutputTokens": 2048,
        },
    }

    last_error: Exception | None = None
    response: httpx.Response | None = None

    for attempt in range(_MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
                response = await client.post(
                    url,
                    json=payload,
                    params={"key": api_key},
                    headers={"Content-Type": "application/json"},
                )
            if response.status_code in (503, 429) and attempt < _MAX_RETRIES - 1:
                backoff = _calculate_backoff(attempt, response)
                logger.info(
                    "Gemini API returned status %d on attempt %d/%d; retrying in %.1fs",
                    response.status_code,
                    attempt + 1,
                    _MAX_RETRIES,
                    backoff,
                )
                await asyncio.sleep(backoff)
                continue

            response.raise_for_status()
            break
        except httpx.HTTPStatusError as exc:
            last_error = exc
            if exc.response.status_code in (503, 429) and attempt < _MAX_RETRIES - 1:
                backoff = _calculate_backoff(attempt, exc.response)
                await asyncio.sleep(backoff)
                continue
            raise GeminiClientError(f"Gemini API returned HTTP {exc.response.status_code}") from exc
        except httpx.RequestError as exc:
            last_error = exc
            if attempt < _MAX_RETRIES - 1:
                backoff = _calculate_backoff(attempt)
                await asyncio.sleep(backoff)
                continue
            raise GeminiClientError(f"Gemini request error: {type(exc).__name__}") from exc

    if response is None:
        raise GeminiClientError(f"Gemini request failed after retries: {type(last_error).__name__}")

    try:
        data = response.json()
        text_output: str = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text_output, flags=re.DOTALL).strip()
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
        raise ValueError(f"Expected JSON object, got {type(parsed).__name__}")
    except (KeyError, IndexError, json.JSONDecodeError, ValueError) as exc:
        raise GeminiClientError(f"Could not parse Gemini response: {type(exc).__name__}") from exc


async def call_groq(
    *,
    system_instruction: str,
    user_prompt: str,
    model: str | None = None,
) -> dict[str, Any]:
    """Call Groq chat completions endpoint with JSON mode.

    Args:
        system_instruction: System-level instruction.
        user_prompt: The user prompt.
        model: Model identifier (defaults to settings.groq_model or llama-3.3-70b-versatile).

    Returns:
        Parsed dict response.

    Raises:
        AIClientError: If the key is missing or request fails.
    """
    settings = get_settings()
    api_key = settings.groq_api_key
    if not api_key:
        raise AIClientError("Groq API key is not configured — AI analysis skipped")

    target_model = (
        model or getattr(settings, "groq_model", _DEFAULT_GROQ_MODEL) or _DEFAULT_GROQ_MODEL
    )
    payload = {
        "model": target_model,
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
        "max_tokens": 2048,
    }

    last_error: Exception | None = None
    response: httpx.Response | None = None

    for attempt in range(_MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
                response = await client.post(
                    _GROQ_BASE_URL,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                )
            if response.status_code in (503, 429) and attempt < _MAX_RETRIES - 1:
                backoff = _calculate_backoff(attempt, response)
                logger.info(
                    "Groq API returned status %d on attempt %d/%d; retrying in %.1fs",
                    response.status_code,
                    attempt + 1,
                    _MAX_RETRIES,
                    backoff,
                )
                await asyncio.sleep(backoff)
                continue

            response.raise_for_status()
            break
        except httpx.HTTPStatusError as exc:
            last_error = exc
            if exc.response.status_code in (503, 429) and attempt < _MAX_RETRIES - 1:
                backoff = _calculate_backoff(attempt, exc.response)
                await asyncio.sleep(backoff)
                continue
            raise AIClientError(f"Groq API returned HTTP {exc.response.status_code}") from exc
        except httpx.RequestError as exc:
            last_error = exc
            if attempt < _MAX_RETRIES - 1:
                backoff = _calculate_backoff(attempt)
                await asyncio.sleep(backoff)
                continue
            raise AIClientError(f"Groq request error: {type(exc).__name__}") from exc

    if response is None:
        raise AIClientError(f"Groq request failed after retries: {type(last_error).__name__}")

    try:
        data = response.json()
        text_output: str = data["choices"][0]["message"]["content"].strip()
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text_output, flags=re.DOTALL).strip()
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
        raise ValueError(f"Expected JSON object, got {type(parsed).__name__}")
    except (KeyError, IndexError, json.JSONDecodeError, ValueError) as exc:
        raise AIClientError(f"Could not parse Groq response: {type(exc).__name__}") from exc


async def call_ai(
    *,
    system_instruction: str,
    user_prompt: str,
    provider: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    """Unified entry point that routes to the configured provider (google or groq)
    with concurrency serialization, pacing, and automatic fallback."""
    lock = _get_ai_lock()
    async with lock:
        await _throttle_ai_request()
        settings = get_settings()
        active_provider = provider or getattr(settings, "ai_provider", "google") or "google"
        if active_provider == "groq":
            try:
                return await call_groq(
                    system_instruction=system_instruction,
                    user_prompt=user_prompt,
                    model=model,
                )
            except AIClientError as exc:
                gemini_key = settings.google_ai_api_key or settings.gemini_api_key
                if gemini_key:
                    logger.warning(
                        "Groq call failed (%s); attempting automatic fallback to Google Gemini",
                        exc,
                    )
                    return await call_gemini(
                        system_instruction=system_instruction,
                        user_prompt=user_prompt,
                        model=None,
                    )
                raise

        return await call_gemini(
            system_instruction=system_instruction,
            user_prompt=user_prompt,
            model=model,
        )
