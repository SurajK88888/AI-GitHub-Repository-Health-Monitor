/**
 * Shared TypeScript types mirroring the backend Pydantic schemas.
 * Keep these in sync with the backend /api/v1 response shapes.
 */

// ── Enums ─────────────────────────────────────────────────────────────────

export type ScoreBand =
  | "EXCELLENT"
  | "GOOD"
  | "NEEDS_ATTENTION"
  | "POOR"
  | "CRITICAL";

export type FindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type ScanStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type AIActionStatus =
  | "PENDING"
  | "APPROVED"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED";

export type RecommendationStatus =
  | "PENDING"
  | "APPROVED"
  | "COMPLETED"
  | "FAILED";

export type NotificationType =
  | "CRITICAL_FINDING"
  | "SCORE_DEGRADATION"
  | "SCAN_FAILED"
  | "SCAN_COMPLETED"
  | "ACTION_COMPLETED"
  | "ACTION_FAILED";

export type NotificationSeverity =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "INFO";

// ── Core Entities ─────────────────────────────────────────────────────────

export interface Repository {
  id: string;
  workspace_id: string;
  github_repo_id: number;
  full_name: string;
  name: string;
  description: string | null;
  url: string;
  private: boolean;
  default_branch: string;
  language: string | null;
  is_monitored: boolean;
  last_scanned_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined from latest scan/health
  latest_health_score?: HealthScore | null;
}

export interface HealthScore {
  id: string;
  repository_id: string;
  scan_id: string;
  overall_score: number;
  score_band: ScoreBand;
  documentation_score: number;
  security_score: number;
  code_quality_score: number;
  dependency_score: number;
  issues_score: number;
  pull_requests_score: number;
  activity_score: number;
  configuration_score: number;
  calculated_at: string;
  config_version: number;
}

export interface HealthScoreHistory {
  items: HealthScore[];
  total: number;
}

export interface Scan {
  id: string;
  repository_id: string;
  status: ScanStatus;
  triggered_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Finding {
  id: string;
  scan_id: string;
  repository_id: string;
  category: string;
  rule_id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  resource: string | null;
  evidence: string | null;
  fingerprint: string;
  created_at: string;
}

export interface Recommendation {
  id: string;
  repository_id: string;
  scan_id: string;
  finding_id: string | null;
  title: string;
  description: string;
  action_type: string;
  priority: number;
  status: RecommendationStatus;
  created_at: string;
}

export interface AIAction {
  id: string;
  recommendation_id: string;
  repository_id: string;
  action_type: string;
  status: AIActionStatus;
  pr_url: string | null;
  branch_name: string | null;
  approved_by: string | null;
  executed_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  workspace_id: string;
  repository_id: string | null;
  scan_id: string | null;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface NotificationUnreadCount {
  count: number;
}

// ── Paginated wrappers ────────────────────────────────────────────────────

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

// ── Scan Metrics ──────────────────────────────────────────────────────────

export interface ScanMetric {
  id: string;
  scan_id: string;
  name: string;
  value: number;
  unit: string | null;
  category: string | null;
}

// ── Dashboard layout (client-side only) ──────────────────────────────────

export interface WidgetConfig {
  id: string;
  title: string;
  size: "sm" | "md" | "lg" | "xl";
}
