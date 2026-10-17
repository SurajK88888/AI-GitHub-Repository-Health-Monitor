/**
 * Shared utility helpers.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ScoreBand, FindingSeverity, NotificationSeverity } from "./types";

/** Tailwind class merger */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an ISO timestamp to a human-readable relative time */
export function timeAgo(isoString: string | null | undefined): string {
  if (!isoString) return "Never";
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

/** Format an ISO timestamp to a readable date */
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Map a ScoreBand → Tailwind color token */
export function scoreBandColor(band: ScoreBand): string {
  switch (band) {
    case "EXCELLENT":     return "text-score-excellent";
    case "GOOD":          return "text-score-good";
    case "NEEDS_ATTENTION": return "text-score-attention";
    case "POOR":          return "text-score-poor";
    case "CRITICAL":      return "text-score-critical";
  }
}

/** Map a ScoreBand → hex color for SVG/Canvas */
export function scoreBandHex(band: ScoreBand): string {
  switch (band) {
    case "EXCELLENT":     return "#34d399";
    case "GOOD":          return "#60a5fa";
    case "NEEDS_ATTENTION": return "#fbbf24";
    case "POOR":          return "#f87171";
    case "CRITICAL":      return "#f43f5e";
  }
}

/** Map a score number → ScoreBand */
export function scoreToband(score: number): ScoreBand {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "NEEDS_ATTENTION";
  if (score >= 40) return "POOR";
  return "CRITICAL";
}

/** Map FindingSeverity → Tailwind color token */
export function severityColor(severity: FindingSeverity | NotificationSeverity): string {
  switch (severity) {
    case "CRITICAL": return "text-severity-critical";
    case "HIGH":     return "text-severity-high";
    case "MEDIUM":   return "text-severity-medium";
    case "LOW":      return "text-severity-low";
    case "INFO":
    case "INFORMATIONAL": return "text-severity-info";
  }
}

/** Map FindingSeverity → hex color */
export function severityHex(severity: FindingSeverity | NotificationSeverity): string {
  switch (severity) {
    case "CRITICAL": return "#f43f5e";
    case "HIGH":     return "#fb923c";
    case "MEDIUM":   return "#fbbf24";
    case "LOW":      return "#34d399";
    case "INFO":
    case "INFORMATIONAL": return "#60a5fa";
  }
}

/** Map FindingSeverity → background Tailwind classes */
export function severityBg(severity: FindingSeverity | NotificationSeverity): string {
  switch (severity) {
    case "CRITICAL": return "bg-red-500/10 text-red-400 border-red-500/20";
    case "HIGH":     return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case "MEDIUM":   return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    case "LOW":      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "INFO":
    case "INFORMATIONAL": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  }
}

/** Clamp a number between min and max */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Generate a stable short ID for display */
export function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

/** Truncate a string to maxLen characters */
export function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
}
