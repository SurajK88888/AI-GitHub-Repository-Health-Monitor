## before declaring anything complete, You will run the full CI suite locally: The CI on GitHub also checks these extra things:


# Backend — full CI equivalent
.venv\Scripts\python.exe -m ruff check app/ tests/
.venv\Scripts\python.exe -m mypy app --ignore-missing-imports
.venv\Scripts\python.exe -m pytest tests/ -v

# Frontend — full CI equivalent  
npm run lint
npm run type-check

You will run all 5 checks on your machine before saying "done" — not just tests. So by the time you push to GitHub, the CI will already be green and you won't need Copilot to fix anything.