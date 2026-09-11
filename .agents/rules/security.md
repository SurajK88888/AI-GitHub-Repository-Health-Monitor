# Security Rules

Never commit, print, or copy secrets. Use environment variables or the approved secret manager; maintain a redacted `.env.example` when configuration changes.

Apply least privilege, authentication, authorization, and input validation at trust boundaries. Use parameterized database access and trusted dependency sources. Pin or lock dependencies where the ecosystem supports it.

Avoid sensitive data in logs, errors, URLs, telemetry, and tests. Review permission changes, deserialization, file handling, redirects, uploads, and external calls with extra care. Escalate uncertain security impact rather than guessing.
