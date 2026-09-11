## Core API Schema Conventions
- JSON over HTTPS
- UUIDs for internal resource IDs
- ISO-8601 UTC timestamps
- Pydantic models on the FastAPI side
- snake_case field names
- Pagination for collection endpoints
- Consistent error format
- Never expose tokens, secrets, or sensitive GitHub credentials
- request_id included for traceability
## 1. Common Schemas
{
  "request_id": "uuid",
  "timestamp": "2026-09-09T18:00:00Z"
}
Pagination:
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 100,
  "has_next": true
}
Error:
{
  "code": "RESOURCE_NOT_FOUND",
  "message": "Repository not found.",
  "details": null,
  "request_id": "uuid"
}
## 2. Repository Schemas
Create/monitor repository request
{
  "github_repository_id": 123456789,
  "monitoring_enabled": true
}
Repository response
{
  "id": "uuid",
  "github_repository_id": 123456789,
  "owner_login": "SurajK88888",
  "name": "example-repository",
  "full_name": "SurajK88888/example-repository",
  "description": "Example project",
  "default_branch": "main",
  "private": false,
  "archived": false,
  "fork": false,
  "html_url": "https://github.com/...",
  "monitoring_enabled": true,
  "last_scanned_at": "2026-09-09T18:00:00Z",
  "created_at": "2026-09-01T10:00:00Z",
  "updated_at": "2026-09-09T18:00:00Z"
}
## 3. Scan Schemas
Create scan request
{
  "scan_type": "FULL",
  "reason": "manual_scan"
}
Allowed:
FULL
INCREMENTAL
TARGETED
Scan response
{
  "id": "uuid",
  "repository_id": "uuid",
  "scan_type": "FULL",
  "trigger_type": "MANUAL",
  "status": "QUEUED",
  "created_at": "2026-09-09T18:00:00Z",
  "started_at": null,
  "completed_at": null,
  "error_message": null
}
## 4. Finding Schemas
Finding response
{
  "id": "uuid",
  "repository_id": "uuid",
  "category": "SECURITY",
  "severity": "HIGH",
  "title": "Vulnerable dependency detected",
  "description": "A dependency contains a known vulnerability.",
  "evidence": {},
  "detection_source": "PROGRAMMATIC",
  "status": "OPEN",
  "fingerprint": "hash",
  "first_seen_at": "2026-09-09T18:00:00Z",
  "last_seen_at": "2026-09-09T18:00:00Z"
}
## 5. Health Score Schemas
Health response
{
  "overall_score": 82.5,
  "score_band": "GOOD",
  "scan_id": "uuid",
  "configuration_version": 1,
  "categories": [
    {
      "category": "SECURITY",
      "raw_score": 90,
      "weight": 20,
      "weighted_score": 18
    }
  ],
  "previous_score": 79.2,
  "score_delta": 3.3,
  "calculated_at": "2026-09-09T18:00:00Z"
}
The backend remains the single source of truth for scoring.
## 6. Scoring Configuration Request
{
  "name": "Default Configuration",
  "weights": {
    "SECURITY": 20,
    "CODE_QUALITY": 20,
    "DEPENDENCIES": 15,
    "DOCUMENTATION": 10,
    "ISSUES": 10,
    "PULL_REQUESTS": 10,
    "ACTIVITY": 10,
    "CONFIGURATION": 5
  }
}
Backend validation must ensure the total weight equals 100.
## 7. AI Recommendation Schemas
Recommendation response
{
  "id": "uuid",
  "repository_id": "uuid",
  "finding_id": "uuid",
  "title": "Update vulnerable dependency",
  "description": "Upgrade the affected dependency to a secure version.",
  "priority": "HIGH",
  "recommended_action": {
    "action_type": "UPDATE_DEPENDENCY",
    "parameters": {}
  },
  "status": "PENDING",
  "created_at": "2026-09-09T18:00:00Z"
}
## 8. Approve AI Action
Request
{
  "confirmation": true
}
Response
{
  "action_id": "uuid",
  "recommendation_id": "uuid",
  "status": "APPROVED",
  "approval_required": false,
  "approved_at": "2026-09-09T18:10:00Z"
}
Execution should happen asynchronously through the automation system.
## 9. Notification Schema
{
  "id": "uuid",
  "type": "CRITICAL_FINDING",
  "title": "Critical security finding",
  "message": "A critical issue was detected.",
  "severity": "CRITICAL",
  "resource_type": "repository",
  "resource_id": "uuid",
  "is_read": false,
  "created_at": "2026-09-09T18:00:00Z",
  "read_at": null
}
## 10. Webhook Internal Event Schema
The external GitHub payload should be normalized before entering internal processing:
{
  "event_id": "github-delivery-id",
  "event_type": "PUSH",
  "installation_id": 123456,
  "repository_id": 123456789,
  "action": null,
  "sender": "github-user",
  "delivery_timestamp": "2026-09-09T18:00:00Z",
  "payload_reference": "internal-reference"
}
Do not pass the complete raw webhook payload throughout the application unnecessarily.
## 11. AI Analysis Response
{
  "id": "uuid",
  "repository_id": "uuid",
  "scan_id": "uuid",
  "analysis_type": "REPOSITORY_SUMMARY",
  "provider": "provider_name",
  "model": "model_name",
  "prompt_version": "v1.0",
  "status": "COMPLETED",
  "result": {
    "summary": "...",
    "key_risks": [],
    "recommendations": []
  },
  "created_at": "2026-09-09T18:00:00Z"
}

## Important Architecture Rule
These schemas should be implemented as Pydantic request/response models, not duplicated manually across routes.
Recommended structure:
backend/
└── app/
    ├── schemas/
    │   ├── common.py
    │   ├── repository.py
    │   ├── scan.py
    │   ├── finding.py
    │   ├── scoring.py
    │   ├── recommendation.py
    │   ├── ai.py
    │   ├── notification.py
    │   └── webhook.py
    ├── api/
    ├── services/
    ├── repositories/
    └── workers/