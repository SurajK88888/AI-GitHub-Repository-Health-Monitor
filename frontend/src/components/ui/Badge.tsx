"use client";

import { cn } from "@/lib/utils";
import type { ScoreBand, FindingSeverity, ScanStatus, AIActionStatus } from "@/lib/types";

// ── Severity badge ────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  CRITICAL: "bg-red-50 text-red-700 border border-red-200",
  HIGH:     "bg-orange-50 text-orange-700 border border-orange-200",
  MEDIUM:   "bg-amber-50 text-amber-700 border border-amber-200",
  LOW:      "bg-blue-50 text-blue-700 border border-blue-200",
  INFO:     "bg-gray-100 text-gray-600 border border-gray-200",
};

const SEVERITY_DOT: Record<FindingSeverity, string> = {
  CRITICAL: "bg-red-500",
  HIGH:     "bg-orange-500",
  MEDIUM:   "bg-amber-500",
  LOW:      "bg-blue-500",
  INFO:     "bg-gray-400",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: FindingSeverity;
  className?: string;
}) {
  return (
    <span className={cn("badge", SEVERITY_STYLES[severity], className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", SEVERITY_DOT[severity])} />
      {severity}
    </span>
  );
}

// ── Score band badge ──────────────────────────────────────────────────────────

const BAND_STYLES: Record<ScoreBand, string> = {
  EXCELLENT:       "bg-emerald-50 text-emerald-700 border border-emerald-200",
  GOOD:            "bg-blue-50 text-blue-700 border border-blue-200",
  NEEDS_ATTENTION: "bg-amber-50 text-amber-700 border border-amber-200",
  POOR:            "bg-orange-50 text-orange-700 border border-orange-200",
  CRITICAL:        "bg-red-50 text-red-700 border border-red-200",
};

const BAND_LABELS: Record<ScoreBand, string> = {
  EXCELLENT:       "Excellent",
  GOOD:            "Good",
  NEEDS_ATTENTION: "Needs Attention",
  POOR:            "Poor",
  CRITICAL:        "Critical",
};

export function ScoreBandBadge({
  band,
  className,
}: {
  band: ScoreBand;
  className?: string;
}) {
  return (
    <span className={cn("badge", BAND_STYLES[band], className)}>
      {BAND_LABELS[band]}
    </span>
  );
}

// ── Scan status badge ─────────────────────────────────────────────────────────

const SCAN_STATUS_STYLES: Record<ScanStatus, string> = {
  QUEUED:     "bg-gray-100 text-gray-600 border border-gray-200",
  RUNNING:    "bg-brand-50 text-brand-700 border border-brand-200",
  COMPLETED:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  FAILED:     "bg-red-50 text-red-700 border border-red-200",
  CANCELLED:  "bg-gray-100 text-gray-500 border border-gray-200",
};

export function ScanStatusBadge({
  status,
  className,
}: {
  status: ScanStatus;
  className?: string;
}) {
  return (
    <span className={cn("badge", SCAN_STATUS_STYLES[status], className)}>
      {status === "RUNNING" && (
        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
      )}
      {status}
    </span>
  );
}

// ── AI Action status badge ────────────────────────────────────────────────────

const ACTION_STATUS_STYLES: Record<AIActionStatus, string> = {
  PENDING:   "bg-gray-100 text-gray-600 border border-gray-200",
  APPROVED:  "bg-blue-50 text-blue-700 border border-blue-200",
  EXECUTING: "bg-brand-50 text-brand-700 border border-brand-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  FAILED:    "bg-red-50 text-red-700 border border-red-200",
};

export function AIActionStatusBadge({
  status,
  className,
}: {
  status: AIActionStatus;
  className?: string;
}) {
  return (
    <span className={cn("badge", ACTION_STATUS_STYLES[status], className)}>
      {status === "EXECUTING" && (
        <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
      )}
      {status}
    </span>
  );
}
