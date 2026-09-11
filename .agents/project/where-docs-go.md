# Where Project Documents Go

For every new repository, place project-specific documents in the repository root's `docs/` directory:

```text
docs/
  product/       brief, requirements, user flows
  architecture/  system design and diagrams
  decisions/     ADRs
  api/           contracts and examples
  data/          schemas and migration notes
  operations/    runbooks, deploy, incident notes
  tasks/         active plans and handoffs
```

Copy `templates/` files into the matching `docs/` subfolder. Keep `.agents/` reusable and generic; it should only point to project docs, never become the project knowledge base.
