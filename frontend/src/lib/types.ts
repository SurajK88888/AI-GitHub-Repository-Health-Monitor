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

export type FindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO" | "INFORMATIONAL";

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
  has_no_code?: boolean;
  // Auto-scan schedule fields
  scan_schedule_enabled?: boolean;
  scan_schedule_frequency?: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  scan_schedule_time?: string | null;
  scan_schedule_day?: string | null;
  next_scheduled_scan_at?: string | null;
}

export interface RepositoryScheduleConfig {
  repository_id?: string | null;
  enabled: boolean;
  frequency?: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  time?: string | null;
  day?: string | null;
  next_scheduled_scan_at?: string | null;
  applied_count?: number | null;
}


export interface HealthScoreCategory {
  category: string;
  raw_score: number;
  weight?: number;
  weighted_score?: number;
}

export interface HealthScore {
  id?: string;
  repository_id?: string;
  scan_id?: string;
  overall_score: number;
  score_band: ScoreBand;
  documentation_score?: number;
  security_score?: number;
  code_quality_score?: number;
  dependency_score?: number;
  issues_score?: number;
  pull_requests_score?: number;
  activity_score?: number;
  configuration_score?: number;
  categories?: HealthScoreCategory[];
  previous_score?: number | null;
  score_delta?: number | null;
  calculated_at: string;
  config_version?: number;
}

export interface HealthScoreHistory {
  items: HealthScore[];
  total: number;
}

export interface Scan {
  id: string;
  repository_id: string;
  repository_name?: string | null;
  status: ScanStatus;
  triggered_by?: string | null;
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
  status?: string;
  resource: string | null;
  evidence: Record<string, unknown> | string | null;
  fingerprint: string;
  created_at: string;
}

export interface Recommendation {
  id: string;
  repository_id: string;
  scan_id?: string;
  finding_id: string | null;
  title: string;
  description: string;
  action_type?: string;
  recommended_action?: {
    action_type: string;
    parameters?: Record<string, unknown>;
  } | null;
  priority: string | number;
  status: RecommendationStatus;
  created_at: string;
}

export interface AIAction {
  id: string;
  workspace_id?: string;
  recommendation_id?: string | null;
  repository_id: string;
  action_type: string;
  status: AIActionStatus;
  approval_required?: boolean;
  approved_at?: string | null;
  pr_url?: string | null;
  branch_name?: string | null;
  result?: {
    pull_request_url?: string;
    branch_name?: string;
    target_file?: string;
    commit_message?: string;
    [key: string]: unknown;
  } | null;
  approved_by?: string | null;
  executed_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  created_at: string;
}

export interface AIAnalysis {
  id: string;
  repository_id: string;
  scan_id?: string | null;
  analysis_type: string;
  provider: string;
  model: string;
  prompt_version: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  result?: {
    summary?: string;
    key_risks?: string[];
    recommendations?: Array<{
      title: string;
      priority: string;
      category: string;
    }>;
    tech_stack?: Array<{
      name: string;
      layer: "client" | "backend" | "data" | "devops";
      purpose: string;
      confidence?: "high" | "medium" | "low";
    }>;
  } | null;
  created_at: string;
  completed_at?: string | null;
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


// ── Workspace & Configurations ───────────────────────────────────────────

export interface ScoringConfiguration {
  id: string;
  name: string;
  is_default: boolean;
  version: number;
  weights: Record<string, number>;
  created_at: string;
}

export interface Installation {
  id: string;
  workspace_id: string;
  github_installation_id: number;
  github_account_login: string;
  account_type: string;
  status: string;
}
