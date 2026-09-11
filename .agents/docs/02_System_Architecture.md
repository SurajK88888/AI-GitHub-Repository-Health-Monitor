# AI GitHub Repository Health Monitor
## System Architecture Specification
### Version 1.0.0

## 1. Architecture Goal

Design a modular, production-ready architecture for the AI GitHub Repository Health Monitor.

The architecture must support the current personal-use MVP while remaining SaaS-ready for multiple users, workspaces, and repositories.

The system must separate API handling, business logic, GitHub integration, scanning, scoring, AI processing, notifications, background jobs, and persistence.

Use an **asynchronous, event-driven architecture** for long-running operations such as repository scans and AI analysis.

---

## 2. High-Level Architecture

```text
                    ┌─────────────────────┐
                    │   Next.js Frontend  │
                    │ React + TypeScript   │
                    └──────────┬──────────┘
                               │ HTTPS
                               ▼
                    ┌─────────────────────┐
                    │     FastAPI API     │
                    │ Auth / REST / RBAC   │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
 ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
 │ Business Logic │   │ GitHub Service │   │ Notification   │
 │ / Services     │   │ + Webhooks     │   │ Service        │
 └───────┬────────┘   └───────┬────────┘   └────────────────┘
         │                     │
         ▼                     ▼
 ┌────────────────┐    ┌────────────────┐
 │ Job / Workflow │    │ GitHub APIs    │
 │ Queue          │    │ + Events       │
 └───────┬────────┘    └────────────────┘
         │
         ▼
 ┌──────────────────────────────────────┐
 │          Background Workers          │
 │ Scan / Analyze / Score / AI / Alerts │
 └───────────────┬──────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌───────────────┐  ┌──────────────────┐
│ PostgreSQL    │  │ Redis            │
│ Application   │  │ Queue / Cache    │
│ Data          │  │ / Locks          │
└───────────────┘  └──────────────────┘
```

---

## 3. Core Architectural Components

### Frontend

Next.js provides the user interface.

Responsibilities:

- Authentication UI
- GitHub connection flow
- Repository selection
- Health dashboard
- Findings
- Recommendations
- Scan history
- Notifications
- Settings

The frontend must never directly access GitHub credentials or privileged backend resources.

### API Layer

FastAPI is the primary application API.

Responsibilities:

- Authentication
- Authorization
- Request validation
- API endpoints
- Repository management
- Scan management
- Findings
- Scores
- Notifications
- User-approved actions

The API must remain stateless wherever possible.

### Application/Business Layer

Contains the core application rules.

Responsibilities:

- Repository monitoring logic
- Scan orchestration
- Finding lifecycle
- Health-score calculation
- Recommendation management
- Permission decisions
- Action approval

Business logic must not depend directly on HTTP or frontend code.

### GitHub Integration Layer

A dedicated GitHub service must encapsulate all GitHub-specific functionality.

Responsibilities:

- GitHub App authentication
- Installation management
- Repository discovery
- Repository metadata
- Issues
- Pull requests
- Commits/activity
- Releases
- Dependency/security information where available
- Webhook processing

GitHub-specific APIs must not be scattered throughout the application.

---

## 4. Scan Architecture

Scanning must be asynchronous.

```text
User / Webhook / Scheduler
          ↓
     Create Scan Job
          ↓
        Redis
          ↓
    Background Worker
          ↓
 ┌────────┼─────────┐
 ↓        ↓         ↓
Security Code    Dependency
 ↓        ↓         ↓
Documentation / Issues / PRs / Activity
          ↓
    Findings Engine
          ↓
    Scoring Engine
          ↓
      AI Analysis
          ↓
   Persist Results
          ↓
 Notifications
```

A scan must have a lifecycle such as:

```text
QUEUED → RUNNING → COMPLETED
                  ↘ FAILED
```

Scans must support retries and failure tracking.

---

## 5. Health Analysis Architecture

Separate detection from scoring.

```text
Repository Data
      ↓
Analysis Modules
      ↓
Findings
      ↓
Scoring Engine
      ↓
Category Scores
      ↓
Overall Score
```

Each analysis module should have a clear interface so additional analyzers can be added without modifying the entire system.

Example conceptual interface:

```text
Analyzer
 ├── SecurityAnalyzer
 ├── DependencyAnalyzer
 ├── CodeQualityAnalyzer
 ├── DocumentationAnalyzer
 ├── IssueAnalyzer
 ├── PullRequestAnalyzer
 ├── ActivityAnalyzer
 └── ConfigurationAnalyzer
```

---

## 6. AI Architecture

AI must be isolated behind a provider-independent interface.

```text
Application
     ↓
AI Service
     ↓
Provider Adapter
 ┌───┼────────┐
 ↓   ↓        ↓
OpenAI Claude Gemini
```

The core application must communicate with an internal AI service rather than directly with a specific LLM provider.

AI should primarily handle:

- Finding explanations
- Repository summaries
- Recommendation generation
- Contextual prioritization
- Score-change explanations

Deterministic analysis should remain the source of measurable repository facts.

AI failures must not prevent basic health scoring from completing.

---

## 7. Event-Driven Architecture

GitHub webhooks must be received by a dedicated endpoint.

```text
GitHub Event
     ↓
Webhook Endpoint
     ↓
Signature Validation
     ↓
Event Validation
     ↓
Create Background Job
     ↓
Worker
     ↓
Targeted Analysis
```

Webhook processing must be fast and must not perform heavy scanning inside the HTTP request.

Events must be idempotently processed to prevent duplicate jobs.

---

## 8. Scheduling Architecture

A scheduler must periodically identify monitored repositories requiring full scans.

```text
Scheduler
   ↓
Find Due Repositories
   ↓
Create Scan Jobs
   ↓
Redis Queue
   ↓
Workers
   ↓
Full Repository Scan
```

The scheduling mechanism must support future scaling to multiple workers without creating duplicate scans.

---

## 9. Data Flow

Primary application flow:

```text
User
 ↓
Next.js
 ↓
FastAPI
 ↓
PostgreSQL
```

Scan flow:

```text
GitHub
 ↓
GitHub Service
 ↓
Queue
 ↓
Worker
 ↓
Analyzers
 ↓
Scoring
 ↓
AI
 ↓
PostgreSQL
 ↓
Frontend
```

Notification flow:

```text
Finding / Score Change
        ↓
Notification Service
        ↓
┌───────┴────────┐
↓                ↓
In-App          Email
```

---

## 10. Deployment Architecture

Initial deployment should support:

```text
Frontend → Vercel
Backend  → Render/Railway
Database → Managed PostgreSQL
Redis    → Managed Redis
```

All services must be containerizable with Docker.

Production deployment must support independent scaling of API servers and background workers.

---

## 11. Architectural Rules

1. Do not place business logic inside frontend components.
2. Do not place heavy processing inside API request handlers.
3. Do not directly call GitHub APIs throughout unrelated services.
4. Do not tightly couple AI logic to one LLM provider.
5. Do not allow AI to bypass authorization.
6. Do not calculate health scores inside UI code.
7. Do not store sensitive credentials in source code.
8. Use background jobs for scans and other long-running work.
9. Make webhook and job processing idempotent.
10. Design every major component for future SaaS multi-tenancy.
11. Preserve clear boundaries between detection, scoring, AI interpretation, and actions.
12. All repository-modifying actions must pass through authorization and explicit approval.

All subsequent architecture, database, API, automation, security, and implementation specifications must remain consistent with this architecture.