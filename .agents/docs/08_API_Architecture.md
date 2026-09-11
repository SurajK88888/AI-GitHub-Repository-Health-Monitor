# 08 — API Architecture

**Version:** 1.0.0  
**Status:** Approved  
**Project:** AI GitHub Repository Health Monitor

## 1. Purpose

Define the backend API structure used by the Next.js frontend, GitHub integration, background workers, AI services, and notification system.

The API is implemented using **Python + FastAPI + Pydantic + SQLAlchemy**.

## 2. API Principles

- RESTful and resource-oriented design.
- JSON request/response format.
- Version APIs using `/api/v1`.
- Validate all external input.
- Enforce authentication and authorization server-side.
- Enforce workspace isolation on every protected resource.
- Use consistent response and error structures.
- Never expose secrets or internal credentials.
- Heavy operations must run asynchronously.
- API contracts must remain documented and versioned.

## 3. Core API Groups

```text id="bq3f7n"
Authentication
Workspaces & Members
GitHub Installations
Repositories
Scans
Findings
Health Scores
Recommendations
AI Analyses
Notifications
AI Actions
Audit Logs
Settings
Webhooks
```

Representative endpoints:

```text
GET    /api/v1/workspaces
GET    /api/v1/repositories
GET    /api/v1/repositories/{id}
POST   /api/v1/repositories/{id}/scans
GET    /api/v1/repositories/{id}/scans
GET    /api/v1/repositories/{id}/findings
GET    /api/v1/repositories/{id}/health
GET    /api/v1/repositories/{id}/health/history
GET    /api/v1/recommendations
POST   /api/v1/recommendations/{id}/approve
POST   /api/v1/ai-actions/{id}/execute
GET    /api/v1/notifications
POST   /api/v1/webhooks/github
```

Exact endpoints may evolve during implementation while preserving resource boundaries.

## 4. Scan API Behavior

Creating a scan must return quickly after validating the request and creating a `QUEUED` scan.

```text
Client
  ↓
POST /scans
  ↓
Validate + Authorize
  ↓
Create QUEUED Scan
  ↓
Enqueue Redis Job
  ↓
Return Scan ID
```

The frontend retrieves scan status through API endpoints rather than waiting for long-running requests.

## 5. Response Structure

Successful responses should use predictable structures containing relevant resource data, identifiers, timestamps, and pagination metadata where applicable.

Errors should provide a safe machine-readable structure such as:

```text
{
  code,
  message,
  details,
  request_id
}
```

Do not expose stack traces, secrets, SQL errors, provider credentials, or sensitive internal implementation details.

## 6. Authentication & Authorization

Every protected endpoint must verify:

```text
Authentication
    ↓
Workspace Membership
    ↓
Resource Ownership
    ↓
Role/Permission
    ↓
Operation
```

Repository-modifying operations additionally require explicit user approval.

## 7. GitHub Webhook API

`POST /api/v1/webhooks/github` is a dedicated integration endpoint.

Processing:

```text
Receive Event
→ Validate Signature
→ Validate Installation
→ Normalize Event
→ Idempotency Check
→ Queue Job
→ Return Success
```

No repository analysis occurs directly inside the webhook request.

## 8. Pagination, Filtering & Sorting

Collection endpoints should support consistent pagination and, where appropriate:

- Category filtering
- Severity filtering
- Status filtering
- Repository filtering
- Date ranges
- Sorting

Large datasets must not be returned in a single unrestricted response.

## 9. API & Service Boundaries

FastAPI routes handle transport concerns only.

```text
API Route
   ↓
Service Layer
   ↓
Domain/Business Logic
   ↓
Repository/Data Access
   ↓
PostgreSQL
```

GitHub, AI, notification, and queue integrations remain behind dedicated service interfaces.

## 10. API Documentation & Testing

FastAPI OpenAPI documentation must remain available for development.

Every endpoint requires appropriate unit/integration/API tests covering:

- Valid requests
- Validation failures
- Authentication
- Authorization
- Workspace isolation
- Not-found cases
- Service failures
- Idempotency where applicable

**Final rule:** API contracts are shared interfaces. Frontend, workers, and AI agents must consume them without bypassing the defined service boundaries.