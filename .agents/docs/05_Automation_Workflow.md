# 05 — Automation Workflow

**Version:** 1.0.0  
**Status:** Approved  
**Project:** AI GitHub Repository Health Monitor

## 1. Purpose

Define how repository monitoring runs automatically and reliably using GitHub webhooks, scheduled scans, manual scans, background workers, retries, and notifications.

## 2. Automation Triggers

The system supports three scan triggers:

- **Webhook:** GitHub repository events trigger incremental analysis.
- **Scheduled:** Periodic full scans ensure repository state remains accurate.
- **Manual:** User can request a full, incremental, or targeted scan.

Webhook events may include pushes, pull requests, issues, releases, repository configuration changes, and security/dependency events where supported.

## 3. Webhook Flow

```text
GitHub Event
    ↓
Webhook Endpoint
    ↓
Signature Validation
    ↓
Event Normalization
    ↓
Idempotency Check
    ↓
Create/Update Job
    ↓
Redis Queue
    ↓
Background Worker
```

Webhook handlers must remain lightweight. They must never perform heavy repository analysis synchronously.

Invalid signatures are rejected. Duplicate webhook deliveries must not create duplicate processing jobs.

## 4. Scan Workflow

```text
Trigger
  ↓
Create Scan (QUEUED)
  ↓
Worker Claims Scan
  ↓
Fetch Required GitHub Data
  ↓
Run Deterministic Analyzers
  ↓
Generate Findings/Metrics
  ↓
Calculate Health Score
  ↓
Run AI Analysis
  ↓
Generate Recommendations
  ↓
Persist Results
  ↓
Create Notifications
  ↓
COMPLETED
```

If a failure occurs, the scan becomes **FAILED** with an error record.

## 5. Full vs Incremental Scans

**Full Scan:** Re-evaluates all configured health categories and refreshes the complete repository state.

**Incremental Scan:** Processes only data affected by the triggering event while preserving unaffected results.

The system must periodically perform full scans because webhook delivery can be delayed, duplicated, or missed.

## 6. Queue and Worker Rules

Redis is used for background job queuing.

Job types include:

- `REPOSITORY_SCAN`
- `WEBHOOK_PROCESS`
- `AI_ANALYSIS`
- `NOTIFICATION_SEND`
- `APPROVED_ACTION`

Workers must support:

- Retry with exponential backoff
- Maximum retry limits
- Job timeout
- Idempotent processing
- Duplicate-job prevention
- Failure tracking
- Graceful recovery

GitHub API rate limits must be monitored and respected.

## 7. AI and Action Safety

AI analysis occurs after deterministic analysis and scoring. AI failure must not prevent the numerical health score from being stored.

Repository-modifying actions require authenticated authorization and explicit user approval. Every action must be auditable.

## 8. Notifications and Observability

Important scan failures, critical findings, score changes, and approved-action results may generate in-app and email notifications.

Record structured logs, job status, execution duration, retry count, failures, and correlation IDs for debugging.

## 9. Architectural Rules

- No heavy processing inside API/webhook handlers.
- All background work must be queued.
- Jobs must be idempotent.
- Full scans must remain available as a consistency mechanism.
- Failed jobs must be observable and recoverable.
- Never bypass authentication or workspace isolation.
- Automation must not silently modify repositories.
- Preserve scan and score history for auditability.