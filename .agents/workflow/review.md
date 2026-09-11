# Review Workflow

Review the final diff as a user, maintainer, and attacker.

Check:
- Requirements and edge cases are addressed.
- Error paths, validation, authorization, and sensitive data are safe.
- Contracts, migrations, configuration, and docs stay consistent.
- Tests cover the changed behavior and affected checks pass.
- No unrelated, generated, or secret-bearing files are included.

If verification cannot run, say why, assess the risk, and provide the exact next check. Never present an unrun check as passing.
