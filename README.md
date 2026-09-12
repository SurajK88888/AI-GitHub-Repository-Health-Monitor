# AI GitHub Repository Health Monitor

Automated health monitoring for GitHub repositories using deterministic analysis, configurable scoring, and AI-assisted recommendations.

## Quick Start (local development)

```bash
# 1. Copy env template and fill in values
cp .env.example .env

# 2. Start the full stack
docker compose up --build

# 3. API is available at http://localhost:8000
# 4. Frontend is available at http://localhost:3000
# 5. API docs at http://localhost:8000/docs
```

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, NextAuth.js |
| Backend | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2 (async) |
| Database | PostgreSQL 16 |
| Queue | Redis 7 + ARQ |
| GitHub | GitHub App (REST + GraphQL + Webhooks) |
| AI | Provider-agnostic abstraction (OpenAI / Anthropic / Google) |

## Project structure

```
backend/          FastAPI application, workers, and models
frontend/         Next.js application
.agents/          Agent playbook and project specifications
.agents/docs/     Project source of truth (01–12 specification docs)
.github/          CI/CD workflows
docker-compose.yml Local dev stack
.env.example      Environment variable template
```

## Backend development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

# Run migrations
alembic upgrade head

# Start API
uvicorn app.main:app --reload

# Run tests
pytest
```

## Frontend development

```bash
cd frontend
npm install
npm run dev
```

## Documentation

See `.agents/docs/` for the full specification:
- `01_Project_Requirements.md` — Product requirements
- `02_System_Architecture.md` — Architecture
- `03_Database_Design.md` — Database schema
- `04_Repository_Health_Scoring.md` — Scoring model
- `05_Automation_Workflow.md` — Scan automation
- `06_Security_Architecture.md` — Security controls
- `07_AI_Agent_Responsibilities.md` — Agent roles
- `08_API_Architecture.md` — API design
- `09_API_Schema_Conventions.md` — API schemas
- `10_Implementation_Governance.md` — Governance rules
- `11_Deployment_And_Production.md` — Deployment
- `12_Testing_And_Quality_Strategy.md` — Testing strategy
