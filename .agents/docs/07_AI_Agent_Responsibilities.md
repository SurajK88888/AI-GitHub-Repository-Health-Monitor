# 07 — AI Agent Responsibilities

**Version:** 1.0.0  
**Status:** Approved  
**Project:** AI GitHub Repository Health Monitor

## 1. Purpose

Define clear responsibilities for AI agents/tools used to design, implement, test, review, and maintain the project.

The project uses a **multi-agent development workflow**. Each agent has a specialized responsibility to reduce context drift, duplicated work, and architectural inconsistency.

## 2. Core Rule

No agent may independently change architecture, database contracts, API contracts, security rules, or shared interfaces without following the approved project documentation.

The files:

```text
01_Project_Requirements.md
02_System_Architecture.md
03_Database_Design.md
04_Repository_Health_Scoring.md
05_Automation_Workflow.md
06_Security_Architecture.md
```

are the current source of truth.

## 3. Architecture Agent

**Responsibility:**
- Maintain system architecture.
- Define module boundaries and service responsibilities.
- Review major technical decisions.
- Prevent unnecessary coupling.
- Ensure SaaS-ready design.

**Must not:** Implement unrelated application features without architectural approval.

## 4. Frontend Agent

**Stack:** Next.js + React + TypeScript + Tailwind.

**Responsibility:**
- Build dashboard, repository views, findings, scores, recommendations, notifications, and settings.
- Implement responsive and accessible UI.
- Consume documented APIs only.
- Keep business logic out of UI.
- Maintain consistent design system.

**Must not:** Calculate authoritative health scores or bypass backend authorization.

## 5. Backend Agent

**Stack:** Python + FastAPI + Pydantic + SQLAlchemy.

**Responsibility:**
- Implement APIs and business logic.
- Enforce authentication, authorization, workspace isolation, and validation.
- Implement service/repository layers.
- Integrate PostgreSQL and Redis.
- Maintain API contracts and error handling.

**Must not:** Put heavy background processing inside request handlers.

## 6. GitHub Integration Agent

**Responsibility:**
- Implement GitHub App integration.
- Handle installations, repositories, permissions, API access, webhooks, pagination, rate limits, and GitHub-specific errors.
- Normalize GitHub data for internal services.

All GitHub-specific logic remains isolated behind a service boundary.

## 7. Analysis & Scoring Agent

**Responsibility:**
- Implement deterministic repository analyzers.
- Generate metrics and findings.
- Implement the centralized 0–100 scoring engine.
- Apply configurable category weights.
- Preserve historical score integrity.

AI must not silently replace deterministic scoring logic.

## 8. AI Agent / AI Integration Agent

**Responsibility:**
- Implement provider-agnostic AI interfaces.
- Generate explanations, summaries, prioritization, and recommendations.
- Validate structured AI outputs.
- Implement prompt/version management.
- Apply AI security rules and prompt-injection defenses.

AI failures must not prevent deterministic scoring.

## 9. Automation Agent

**Responsibility:**
- Implement Redis queues and background workers.
- Handle webhook jobs, scans, AI analysis, notifications, retries, deduplication, timeouts, and scheduling.
- Ensure jobs are idempotent and observable.

## 10. Security Agent

**Responsibility:**
- Review authentication, authorization, secrets, webhook security, tenant isolation, API security, AI security, and approved actions.
- Identify vulnerabilities before release.
- Verify security controls across all services.

## 11. Testing & Review Agent

**Responsibility:**
- Create unit, integration, API, security, worker, and end-to-end tests.
- Validate architecture and acceptance criteria.
- Detect regressions and contract violations.
- Review code quality and maintainability.

## 12. Agent Coordination Rules

Every agent must:

1. Read relevant approved documentation before implementation.
2. Follow existing naming, schemas, contracts, and architecture.
3. Make additive changes where possible.
4. Avoid unrelated refactoring.
5. Update documentation when an approved architectural change occurs.
6. Run relevant tests after changes.
7. Report changed files, implementation status, tests, and known issues.

**Final principle:** AI agents accelerate development; they do not override project architecture, security, or human approval requirements.