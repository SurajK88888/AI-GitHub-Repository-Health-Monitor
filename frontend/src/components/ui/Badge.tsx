"use client";

import { cn } from "@/lib/utils";
import type { ScoreBand, FindingSeverity, ScanStatus, AIActionStatus } from "@/lib/types";

// ── Severity badge ────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  CRITICAL:      "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  HIGH:          "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  MEDIUM:        "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  LOW:           "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  INFO:          "bg-white/[0.05] text-white/60 border border-white/[0.10]",
  INFORMATIONAL: "bg-white/[0.05] text-white/60 border border-white/[0.10]",
};

const SEVERITY_DOT: Record<FindingSeverity, string> = {
  CRITICAL:      "bg-red-500",
  HIGH:          "bg-orange-500",
  MEDIUM:        "bg-amber-500",
  LOW:           "bg-blue-500",
  INFO:          "bg-gray-400",
  INFORMATIONAL: "bg-gray-400",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: FindingSeverity;
  className?: string;
}) {
  const label = severity === "INFORMATIONAL" ? "INFO" : severity;
  return (
    <span className={cn("badge", SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.INFO, className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", SEVERITY_DOT[severity] ?? SEVERITY_DOT.INFO)} />
      {label}
    </span>
  );
}

// ── Score band badge ──────────────────────────────────────────────────────────

const BAND_STYLES: Record<ScoreBand, string> = {
  EXCELLENT:       "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  GOOD:            "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  NEEDS_ATTENTION: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  POOR:            "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  CRITICAL:        "bg-rose-500/10 text-rose-400 border border-rose-500/20",
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
  QUEUED:     "bg-white/[0.05] text-white/60 border border-white/[0.10]",
  RUNNING:    "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  COMPLETED:  "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  FAILED:     "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  CANCELLED:  "bg-white/[0.05] text-white/40 border border-white/[0.10]",
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
  PENDING:   "bg-white/[0.05] text-white/60 border border-white/[0.10]",
  APPROVED:  "bg-sky-500/10 text-sky-400 border border-sky-500/20",
  EXECUTING: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  COMPLETED: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  FAILED:    "bg-rose-500/10 text-rose-400 border border-rose-500/20",
};

const ACTION_STATUS_LABELS: Record<AIActionStatus, string> = {
  PENDING:   "Pending",
  APPROVED:  "Approved",
  EXECUTING: "Processing...",
  COMPLETED: "Successful",
  FAILED:    "Failed",
};

export function AIActionStatusBadge({
  status,
  className,
}: {
  status: AIActionStatus;
  className?: string;
}) {
  return (
    <span className={cn("badge inline-flex items-center gap-1.5", ACTION_STATUS_STYLES[status], className)}>
      {status === "EXECUTING" && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      )}
      {status === "COMPLETED" && (
        <span className="text-[11px] font-bold">✓</span>
      )}
      {status === "FAILED" && (
        <span className="text-[11px] font-bold">✕</span>
      )}
      {ACTION_STATUS_LABELS[status] || status}
    </span>
  );
}
