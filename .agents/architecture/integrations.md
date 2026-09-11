# Integration Design

Treat every external system as unreliable. Centralize each provider in an adapter with a small interface, timeout, retry policy, observability, and error mapping.

Validate data at ingress and egress. Make write operations idempotent where retries are possible. Verify webhook signatures and defend against replay. Store only required data; never log credentials or sensitive payloads.

Version public APIs deliberately. Document ownership, rate limits, failure behavior, and rollback plan in the relevant `docs/integrations/` page.
