# Repository Layout

Use a predictable root:

```text
src/          product code
tests/        automated tests
docs/         project-specific documentation
scripts/      repeatable developer tools
infra/        deploy and infrastructure definitions
.agents/      reusable agent playbook
```

Organize `src/` by domain or feature before technical layer when possible. Keep shared utilities small and dependency-light. Keep generated output, local data, coverage, and secrets out of version control.

Do not force this layout on an established repository; improve it incrementally and document exceptions in an ADR.
