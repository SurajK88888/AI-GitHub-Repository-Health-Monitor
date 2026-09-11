# Project Documentation Rules

Treat docs as part of the product. Write them for the next maintainer: purpose, owner, assumptions, source of truth, and last review date.

Start with `docs/product/brief.md`. Add an ADR for durable architectural choices, an API page for public contracts, and an operations page for deploy or recovery procedures. Create `docs/tasks/` plans for multi-step work; archive or delete them when obsolete.

Keep docs close to the change and link rather than duplicate. Do not put secrets, tokens, customer data, or unredacted logs in documentation.
