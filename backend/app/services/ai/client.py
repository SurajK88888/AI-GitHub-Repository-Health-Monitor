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

import json
import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
_DEFAULT_MODEL = "gemini-1.5-flash"
_REQUEST_TIMEOUT = 30.0  # seconds


class GeminiClientError(Exception):
    """Raised when the Gemini API call fails for any reason."""


async def call_gemini(
    *,
    system_instruction: str,
    user_prompt: str,
    model: str = _DEFAULT_MODEL,
) -> dict[str, Any]:
    """Call the Gemini generateContent endpoint and return the parsed JSON response.

    Args:
        system_instruction: System-level behaviour instruction.
        user_prompt: The user-facing prompt text.
        model: Gemini model identifier (defaults to ``gemini-1.5-flash``).

    Returns:
        Parsed dict from the model's text output (expected to be valid JSON).

    Raises:
        GeminiClientError: If the API key is missing, the HTTP request fails,
            or the model output cannot be parsed as JSON.
    """
    settings = get_settings()
    api_key = settings.google_ai_api_key
    if not api_key:
        raise GeminiClientError(
            "google_ai_api_key is not configured — AI analysis skipped"
        )

    url = f"{_GEMINI_BASE_URL}/{model}:generateContent"
    payload = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2,
            "maxOutputTokens": 1024,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            response = await client.post(
                url,
                json=payload,
                params={"key": api_key},
                headers={"Content-Type": "application/json"},
            )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        # Log status only — never log body which may echo back sensitive data
        raise GeminiClientError(
            f"Gemini API returned HTTP {exc.response.status_code}"
        ) from exc
    except httpx.RequestError as exc:
        raise GeminiClientError(f"Gemini request error: {type(exc).__name__}") from exc

    # Extract text from Gemini response envelope
    try:
        data = response.json()
        text_output: str = (
            data["candidates"][0]["content"]["parts"][0]["text"]
        )
        return dict(json.loads(text_output))
    except (KeyError, IndexError, json.JSONDecodeError) as exc:
        raise GeminiClientError(
            f"Could not parse Gemini response: {type(exc).__name__}"
        ) from exc
