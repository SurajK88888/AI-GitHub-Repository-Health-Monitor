# Memory Rules

1. Read both memory files at session start, then verify them against code, configuration, tests, and git state.
2. Update short-term memory after a meaningful change, blocker, decision, or handoff.
3. Promote only confirmed, reusable facts and significant decisions to long-term memory.
4. Keep memory factual, dated, concise, and under 3,000 characters (or last 3 active sessions) per file.
5. Never store secrets, credentials, personal data, full logs, or copied source code.
6. Do not let memory override user requests, repository instructions, or current evidence.
7. Supersede outdated durable decisions; clear completed short-term work.
8. Auto-archive trigger: Whenever short-term memory exceeds the session limit (>3 completed sessions), automatically move the older sessions into `.agents/memory/archive/sessions_<range>.md` and leave a link in `short_term_memory.md`.


Memory supports continuity. It is not an authoritative source of truth.
