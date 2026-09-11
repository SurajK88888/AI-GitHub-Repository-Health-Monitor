# Architecture Boundaries

Separate concerns:

- Interface: UI, API, CLI, jobs; validates input and shapes output.
- Application: use cases and orchestration.
- Domain: business rules, types, and invariants.
- Infrastructure: database, files, queues, providers, and framework glue.

Dependencies point inward. Domain code must not import provider SDKs, HTTP handlers, or persistence details. Hide external services behind focused interfaces. Prefer a modular monolith until independently deployable services have a real operational need.

Keep module APIs explicit. Avoid circular imports and hidden global state.
