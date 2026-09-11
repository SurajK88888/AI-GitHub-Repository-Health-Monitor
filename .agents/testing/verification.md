# Verification Rules

Run the narrowest meaningful checks while building, then required repository checks before delivery.

Typical order:
1. Formatter and lint.
2. Type or static analysis.
3. Changed unit and integration tests.
4. Broader suite or build when risk and time warrant it.
5. Manual accessibility or UI check for user-facing changes.

Record the exact commands and results in the handoff or `memory/session.md`. If a check is unavailable, explain the blocker and its impact. A green check proves only the scope it exercised.
