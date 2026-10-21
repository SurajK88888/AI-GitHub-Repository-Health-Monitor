"""Versioned prompt templates for Gemini AI analysis.

All prompts are versioned so changes are auditable and historical
``AIAnalysis`` records remain reproducible.

Security invariant: prompts MUST NOT include secrets, credentials,
raw source code, or repository tokens. Only sanitized summaries, metrics,
and finding metadata are sent to the AI provider.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

PROMPT_VERSION = "1.0.0"

# System instruction sent with every request
SYSTEM_INSTRUCTION = (
    "You are a software engineering advisor reviewing repository health data. "
    "You receive structured health metrics and findings — never raw source code. "
    "Provide a concise, actionable analysis. "
    "Respond with valid JSON only. Do not include markdown fences or extra text."
)

# JSON output schema description embedded in the user prompt
_SCHEMA_DESCRIPTION = """
Return a JSON object with exactly these keys:
{
  "summary": "<2-4 sentence plain-language summary of the repository health>",
  "key_risks": ["<risk 1>", "<risk 2>", ...],
  "recommendations": [
    {
      "title": "<short action title>",
      "description": "<what to do and why, 1-3 sentences>",
      "priority": "<CRITICAL|HIGH|MEDIUM|LOW>",
      "category": "<SECURITY|CODE_QUALITY|DEPENDENCIES|DOCUMENTATION|ISSUES|PULL_REQUESTS|ACTIVITY|CONFIGURATION>",
      "action_type": "<CREATE_SECURITY_POLICY|ENABLE_DEPENDABOT|ADD_CI_WORKFLOW|CREATE_README|CREATE_CONTRIBUTING|MANUAL_REVIEW>"
    }
  ],
  "tech_stack": [
    {
      "name": "<e.g. Next.js, React, FastAPI, PostgreSQL, Redis, Docker, GitHub Actions>",
      "layer": "<client|backend|data|devops>",
      "purpose": "<1 sentence concise explanation of its role in the project>",
      "confidence": "<high|medium|low>"
    }
  ]
}
Limit to a maximum of 5 key_risks, 5 recommendations, and up to 10 tech_stack components across client, backend, data, and devops layers.
"""


def build_analysis_prompt(
    *,
    repo_full_name: str,
    overall_score: float,
    score_band: str,
    previous_score: float | None,
    category_scores: Sequence[Mapping[str, Any]],
    top_findings: Sequence[Mapping[str, Any]],
    architecture_cues: list[str] | None = None,
) -> str:
    """Build the user-facing prompt for a repository health analysis.

    Args:
        repo_full_name: ``owner/repo`` string.
        overall_score: Computed overall health score 0–100.
        score_band: Score band label (e.g. ``"GOOD"``).
        previous_score: Previous overall score or None if first scan.
        category_scores: List of dicts with ``category``, ``raw_score``, ``weight``.
        top_findings: List of sanitized finding dicts (max 10, no raw content).
        architecture_cues: Optional list of sanitized file/manifest cues for tech stack detection.

    Returns:
        Formatted prompt string ready to send to Gemini.
    """
    delta_str = ""
    if previous_score is not None:
        delta = round(overall_score - previous_score, 2)
        direction = "improved by" if delta >= 0 else "declined by"
        delta_str = f"  Score {direction} {abs(delta):.2f} points from previous scan ({previous_score:.2f}).\n"

    cat_lines = "\n".join(
        f"  - {c['category']}: raw={c['raw_score']:.1f} weight={c['weight']:.0f}%"
        for c in category_scores
    )

    finding_lines = "\n".join(
        f"  [{f.get('severity', '?')}] {f.get('category', '?')}: {f.get('title', '?')}"
        for f in top_findings
    )
    if not finding_lines:
        finding_lines = "  (no open findings)"

    cues_section = ""
    if architecture_cues:
        cues_text = "\n".join(f"  - {cue}" for cue in architecture_cues)
        cues_section = f"\nDetected Architecture & Tech Stack Indicators:\n{cues_text}\n"

    return (
        f"Repository: {repo_full_name}\n"
        f"Overall Health Score: {overall_score:.2f} / 100 ({score_band})\n"
        f"{delta_str}"
        f"\nCategory breakdown:\n{cat_lines}\n"
        f"\nTop open findings (severity, category, title):\n{finding_lines}\n"
        f"{cues_section}"
        f"\n{_SCHEMA_DESCRIPTION}"
    )
