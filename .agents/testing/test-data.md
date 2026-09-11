# Test Data Rules

Use synthetic, minimal, purpose-built data. Never copy credentials, production records, personal data, or private customer content into tests, fixtures, screenshots, or logs.

Make time, randomness, network calls, and external providers controllable. Reset state between tests. Name fixtures by behavior, not incidental implementation details.

When a defect is fixed, add a regression test if practical. Keep fixtures close to the test unless they are a shared, stable contract. Review snapshots as code; avoid broad snapshots that hide behavior changes.
