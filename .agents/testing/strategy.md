# Testing Strategy

Test behavior at the cheapest layer that gives confidence:

- Unit: domain logic and edge cases.
- Integration: boundaries with databases, files, queues, or providers.
- Contract: public API or event compatibility.
- End-to-end: critical user journeys only.

For each change, test normal, invalid, boundary, authorization, and failure paths as relevant. Prefer deterministic fixtures and isolated tests. Do not depend on production data or live third-party systems unless explicitly authorized.

Fix the cause of flaky tests; do not normalize retries as proof of correctness.
