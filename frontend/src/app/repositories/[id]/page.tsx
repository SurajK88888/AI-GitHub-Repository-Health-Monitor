/**
 * /repositories/[id] — Repository detail page.
 * Shows: health score ring, category breakdown bars, scan history button,
 * and tabbed sections: Findings | Recommendations | AI Actions
 */

"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MotionCard } from "@/components/ui/MotionCard";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { ScoreBandBadge, SeverityBadge, AIActionStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TechStackVisualizer } from "@/components/repository/TechStackVisualizer";
import { ScheduleScanModal, ScheduleButtonWithInfo } from "@/components/scheduler";
import {

  Spinner,
  SkeletonCard,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui/Spinner";
import { useFetch, usePoll } from "@/lib/hooks";
import { timeAgo, scoreBandHex, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type {
  Repository,
  HealthScore,
  Paginated,
  Finding,
  Recommendation,
  AIAction,
  AIAnalysis,
  Scan,
} from "@/lib/types";

// ── Category Definitions & Calculation Details ───────────────────────────

interface CategoryDeduction {
  check: string;
  deduction: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  condition: string;
}

interface CategoryDetail {
  key: string;
  label: string;
  weight: number;
  icon: string;
  shortDesc: string;
  summary: string;
  calculationLogic: {
    baseScore: number;
    deductions: CategoryDeduction[];
  };
  capsAndOverrides?: string;
  engineFile: string;
}

const CATEGORY_DETAILS: Record<string, CategoryDetail> = {
  DOCUMENTATION: {
    key: "DOCUMENTATION",
    label: "Documentation",
    weight: 10,
    icon: "📄",
    shortDesc: "README, open-source license, contributing guide & code of conduct.",
    summary:
      "Evaluates repository onboarding documentation, licensing clarity, and contributor guidelines to ensure developers can easily understand and contribute.",
    calculationLogic: {
      baseScore: 100,
      deductions: [
        {
          check: "Missing README",
          deduction: "-30 pts",
          severity: "HIGH",
          condition: "No README file found at the root of the repository.",
        },
        {
          check: "Short README Content",
          deduction: "-15 pts",
          severity: "MEDIUM",
          condition: "README exists but contains fewer than 100 characters.",
        },
        {
          check: "Missing Open-Source License",
          deduction: "-25 pts",
          severity: "HIGH",
          condition: "No recognized LICENSE file committed in the repository.",
        },
        {
          check: "Missing Contributing Guide",
          deduction: "-10 pts",
          severity: "LOW",
          condition: "No CONTRIBUTING.md found to guide community contributions.",
        },
        {
          check: "Missing Code of Conduct",
          deduction: "-5 pts",
          severity: "LOW",
          condition: "No CODE_OF_CONDUCT.md file defined for community standards.",
        },
      ],
    },
    capsAndOverrides:
      "Score is clamped between 0 and 100. Open HIGH severity findings cap the category score at ≤ 60.",
    engineFile: "collectors/documentation.py",
  },
  SECURITY: {
    key: "SECURITY",
    label: "Security",
    weight: 20,
    icon: "🛡️",
    shortDesc: "Secret leaks, automated vulnerability alerts, and security policies.",
    summary:
      "Scans the codebase for high-risk security vulnerabilities, leaked API tokens or credentials, automated Dependabot integration, and disclosure policies.",
    calculationLogic: {
      baseScore: 100,
      deductions: [
        {
          check: "Committed Secret / Key File",
          deduction: "-50 pts / incident",
          severity: "CRITICAL",
          condition:
            "Committed private keys (.pem, .key, id_rsa) or environment files (.env).",
        },
        {
          check: "Inline Hardcoded Secrets / Token Leaks",
          deduction: "-50 pts / incident",
          severity: "CRITICAL",
          condition:
            "Unencrypted private key blocks, AWS access keys (AKIA...), GitHub tokens (ghp_...), or Slack tokens scanned in file contents.",
        },
        {
          check: "Missing Dependabot Configuration",
          deduction: "-15 pts",
          severity: "LOW",
          condition: "No .github/dependabot.yml found for automated vulnerability updates.",
        },
        {
          check: "Missing Security Policy",
          deduction: "-10 pts",
          severity: "MEDIUM",
          condition: "No SECURITY.md file explaining responsible disclosure procedures.",
        },
      ],
    },
    capsAndOverrides:
      "CRITICAL finding presence automatically caps the Security category score at ≤ 30.0 and caps the entire repository health score at ≤ 50.0.",
    engineFile: "collectors/security.py",
  },
  CODE_QUALITY: {
    key: "CODE_QUALITY",
    label: "Code Quality",
    weight: 20,
    icon: "🧪",
    shortDesc: "CI/CD automated pipelines, testing suites, and linter configurations.",
    summary:
      "Assesses engineering discipline: presence of automated CI/CD workflows, workflow execution health, test coverage indicators, and automated code style formatters.",
    calculationLogic: {
      baseScore: 100,
      deductions: [
        {
          check: "No Source Code / Empty Repository",
          deduction: "Set to 0 pts",
          severity: "HIGH",
          condition:
            "Repository contains no recognizable programming files or manifests. Quality tools cannot be evaluated.",
        },
        {
          check: "Missing CI/CD Workflows",
          deduction: "-30 pts",
          severity: "HIGH",
          condition: "No active GitHub Actions workflows located in .github/workflows/.",
        },
        {
          check: "Recent CI Workflow Run Failed",
          deduction: "-20 pts",
          severity: "HIGH",
          condition:
            "The most recent completed GitHub Actions workflow run failed or timed out.",
        },
        {
          check: "Low CI Execution Pass Rate (<50%)",
          deduction: "-10 pts",
          severity: "MEDIUM",
          condition:
            "Fewer than 50% of recent completed GitHub Actions workflow runs succeeded.",
        },
        {
          check: "No Automated Tests Detected",
          deduction: "-30 pts",
          severity: "HIGH",
          condition:
            "No test directories (tests/, __tests__/, spec/) or test files found in tree.",
        },
        {
          check: "Missing Linter / Formatter Configuration",
          deduction: "-15 pts",
          severity: "LOW",
          condition:
            "No linter configs (.eslintrc, prettier.config, pyproject.toml, .flake8, etc.) detected.",
        },
      ],
    },
    capsAndOverrides:
      "Empty repository triggers an overall repository score safety cap at ≤ 30.0 (CRITICAL band). Open HIGH severity findings cap the category score at ≤ 60.",
    engineFile: "collectors/code_quality.py",
  },
  DEPENDENCIES: {
    key: "DEPENDENCIES",
    label: "Dependencies",
    weight: 15,
    icon: "📦",
    shortDesc: "Package manifests, lockfiles, and deterministic reproducible builds.",
    summary:
      "Evaluates package manager adoption, dependency declarations, active CVE / Dependabot vulnerability alerts, and lockfile synchronization.",
    calculationLogic: {
      baseScore: 100,
      deductions: [
        {
          check: "Critical Dependency Vulnerability Alert",
          deduction: "-25 to -40 pts",
          severity: "CRITICAL",
          condition:
            "Active open CRITICAL severity Dependabot / CVE vulnerability alerts found in project dependencies.",
        },
        {
          check: "High Dependency Vulnerability Alert",
          deduction: "-15 to -25 pts",
          severity: "HIGH",
          condition:
            "Active open HIGH severity Dependabot / CVE vulnerability alerts found in project dependencies.",
        },
        {
          check: "Medium / Low Dependency Vulnerability Alert",
          deduction: "-5 to -15 pts",
          severity: "MEDIUM",
          condition:
            "Active open medium or low severity Dependabot vulnerability alerts in project dependencies.",
        },
        {
          check: "Missing Committed Lockfile",
          deduction: "-20 pts / manifest",
          severity: "MEDIUM",
          condition:
            "Manifest (package.json, Pipfile, go.mod, Cargo.toml) exists without corresponding lockfile.",
        },
        {
          check: "Empty Repository / No Manifests",
          deduction: "Set to 0 pts",
          severity: "INFO",
          condition:
            "No recognized dependency manifests found in an empty repository with no code.",
        },
        {
          check: "No Manifests in Codebase",
          deduction: "0 pts",
          severity: "INFO",
          condition:
            "No manifests detected on repository with code (permissible for zero-dependency scripts).",
        },
      ],
    },
    capsAndOverrides:
      "CRITICAL vulnerability alerts cap Dependencies score at ≤ 30.0; HIGH alerts cap score at ≤ 60.0. Clamped between 0 and 100.",
    engineFile: "collectors/dependencies.py",
  },
  ISSUES: {
    key: "ISSUES",
    label: "Issues",
    weight: 10,
    icon: "🐛",
    shortDesc: "Issue resolution velocity, stale backlog, and scale-aware triage.",
    summary:
      "Measures maintainer responsiveness and issue turnaround times by evaluating aging tickets and team capacity-adjusted backlog volume.",
    calculationLogic: {
      baseScore: 100,
      deductions: [
        {
          check: "Stale Issues (No activity for 90+ days)",
          deduction: "-3 pts / issue (max -30 pts)",
          severity: "MEDIUM",
          condition:
            "Open issues with no comments or updates for over 90 days (HIGH if ≥10, MEDIUM if ≥3, LOW if <3).",
        },
        {
          check: "Large Unmaintained Issue Backlog",
          deduction: "-20 pts",
          severity: "MEDIUM",
          condition:
            "Open issues exceed capacity threshold (max(50, active_contributors × 15)) with ≥40% (or ≥10) stale.",
        },
        {
          check: "Large Active Issue Backlog",
          deduction: "-10 pts",
          severity: "LOW",
          condition:
            "Open issues exceed capacity threshold but issues are actively triaged and maintained (<40% stale).",
        },
        {
          check: "No Issue Templates Found",
          deduction: "0 pts",
          severity: "INFO",
          condition:
            "No .github/ISSUE_TEMPLATE found to guide reporters in providing structured context.",
        },
      ],
    },
    capsAndOverrides:
      "A clean issue backlog (0 open issues) receives a perfect 100 score. Clamped between 0.0 and 100.0.",
    engineFile: "collectors/issues.py",
  },
  PULL_REQUESTS: {
    key: "PULL_REQUESTS",
    label: "Pull Requests",
    weight: 10,
    icon: "🔀",
    shortDesc: "PR review throughput, merge latency, and scale-aware review velocity.",
    summary:
      "Tracks review bottlenecks, pull request turnaround time, stale non-draft PRs, and team-scaled review throughput.",
    calculationLogic: {
      baseScore: 100,
      deductions: [
        {
          check: "Stale Non-Draft Pull Requests",
          deduction: "-5 pts / PR (max -30 pts)",
          severity: "MEDIUM",
          condition:
            "Non-draft PRs without any activity or review updates for over 30 days (HIGH if ≥5, MEDIUM if ≥2, LOW if 1).",
        },
        {
          check: "Large Unmaintained PR Backlog",
          deduction: "-15 pts",
          severity: "MEDIUM",
          condition:
            "Open PRs exceed capacity threshold (max(20, active_contributors × 5)) with ≥30% (or ≥4) stale.",
        },
        {
          check: "High Open PR Volume",
          deduction: "-5 pts",
          severity: "LOW",
          condition:
            "Open PRs exceed capacity threshold but PR velocity is actively moving (<30% stale).",
        },
        {
          check: "No Pull Request Template Found",
          deduction: "0 pts",
          severity: "INFO",
          condition:
            "No .github/pull_request_template.md found to standardize PR descriptions.",
        },
      ],
    },
    capsAndOverrides:
      "0 open PRs receives a default 100 score (no review bottleneck). Clamped between 0.0 and 100.0.",
    engineFile: "collectors/pull_requests.py",
  },
  ACTIVITY: {
    key: "ACTIVITY",
    label: "Activity",
    weight: 10,
    icon: "📈",
    shortDesc: "Commit frequency, maintenance recency, and contributor distribution.",
    summary:
      "Measures project momentum and vitality: frequency of recent commits, date of last code push, and active contributors in the last 30 days.",
    calculationLogic: {
      baseScore: 100,
      deductions: [
        {
          check: "Dormant / Inactive Repository (>90 days)",
          deduction: "-40 pts",
          severity: "HIGH",
          condition: "No commits detected in the repository in the last 90+ days.",
        },
        {
          check: "Low Recent Activity (>30 days)",
          deduction: "-15 pts",
          severity: "LOW",
          condition: "No commits detected in the repository in the last 30 to 90 days.",
        },
        {
          check: "Zero Commits in 30 Days Window",
          deduction: "-10 pts",
          severity: "INFO",
          condition:
            "No commits recorded in the 30-day window while repository has prior commit history.",
        },
      ],
    },
    capsAndOverrides:
      "Clamped at minimum 0.0, maximum 100.0. Open HIGH severity findings cap the category score at ≤ 60.",
    engineFile: "collectors/activity.py",
  },
  CONFIGURATION: {
    key: "CONFIGURATION",
    label: "Configuration",
    weight: 5,
    icon: "⚙️",
    shortDesc: "Branch protection rules, code review enforcement, and repository metadata.",
    summary:
      "Checks repository setup: default branch protection rules, required PR code reviews, CI status check enforcement, and metadata discoverability.",
    calculationLogic: {
      baseScore: 100,
      deductions: [
        {
          check: "No Branch Protection on Default Branch",
          deduction: "-10 pts",
          severity: "LOW",
          condition:
            "Default branch has no branch protection rules enabled on a repository with source code.",
        },
        {
          check: "Branch Protection Without Required PR Reviews",
          deduction: "-5 pts",
          severity: "LOW",
          condition:
            "Branch protection is enabled on default branch, but code reviews are not required before merging.",
        },
        {
          check: "Branch Protection Without Required CI Status Checks",
          deduction: "0 pts",
          severity: "INFO",
          condition:
            "Branch protection is active, but automated CI checks are not enforced before merging.",
        },
        {
          check: "Missing Repository Description",
          deduction: "-15 pts",
          severity: "LOW",
          condition: "Repository metadata lacks a description for discoverability.",
        },
        {
          check: "Missing .github/ Configuration Directory",
          deduction: "-10 pts",
          severity: "LOW",
          condition:
            "No .github/ directory found for workflows, templates, or Dependabot.",
        },
        {
          check: "No Repository Topics Set",
          deduction: "0 pts",
          severity: "INFO",
          condition: "No topics configured to improve discoverability on GitHub.",
        },
        {
          check: "Non-Standard Default Branch Name",
          deduction: "0 pts",
          severity: "INFO",
          condition:
            "Default branch name differs from modern conventions (main, trunk, develop).",
        },
      ],
    },
    capsAndOverrides: "Clamped at minimum 0.0, maximum 100.0.",
    engineFile: "collectors/configuration.py",
  },
};

// ── Category score bar ────────────────────────────────────────────────────

interface CategoryBarProps {
  label: string;
  categoryKey: string;
  score: number;
  color: string;
  shortDesc: string;
  onOpenInfo: (key: string) => void;
}

function CategoryBar({
  label,
  categoryKey,
  score,
  color,
  shortDesc,
  onOpenInfo,
}: CategoryBarProps) {
  return (
    <div className="space-y-1.5 p-2 rounded-xl hover:bg-white/[0.04] transition-colors">
      <div className="flex justify-between items-start text-xs">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-medium">{label}</span>
            <button
              type="button"
              onClick={() => onOpenInfo(categoryKey)}
              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/[0.06] text-white/70 hover:bg-white/[0.12] hover:text-white text-[10px] font-bold transition-all border border-white/[0.12] cursor-pointer shrink-0"
              title={`View ${label} details & calculation logic`}
              aria-label={`View ${label} details`}
            >
              i
            </button>
          </div>
          <p className="text-[11px] text-white/45 mt-0.5 leading-snug line-clamp-1">
            {shortDesc}
          </p>
        </div>
        <span className="font-bold text-sm shrink-0" style={{ color }}>
          {Math.round(score)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1], delay: 0.1 }}
        />
      </div>
    </div>
  );
}


// ── Tabs ─────────────────────────────────────────────────────────────────

type Tab = "findings" | "recommendations" | "actions";

export default function RepositoryDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [activeTab, setActiveTab] = useState<Tab>("findings");
  const [selectedCategoryInfo, setSelectedCategoryInfo] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [localRepo, setLocalRepo] = useState<Repository | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  const { data: repo, loading: repoLoading, error: repoError, refetch: refetchRepo } =
    useFetch<Repository>(id ? `/repositories/${id}` : null);

  useEffect(() => {
    if (repo) setLocalRepo(repo);
  }, [repo]);

  const activeRepo = localRepo ?? repo;

  const { data: health, loading: healthLoading, refetch: refetchHealth } =
    useFetch<HealthScore>(id ? `/repositories/${id}/health` : null);

  const { data: findingsData, loading: findingsLoading, refetch: refetchFindings } =
    useFetch<Paginated<Finding>>(
      id ? `/repositories/${id}/findings?limit=50` : null,
    );


  const { data: aiAnalysis, refetch: refetchAiAnalysis } =
    useFetch<AIAnalysis>(id ? `/repositories/${id}/ai-analysis` : null);

  const { data: recsData, loading: recsLoading, refetch: refetchRecs } =
    useFetch<Paginated<Recommendation>>(
      activeTab === "recommendations" && id
        ? `/repositories/${id}/recommendations?limit=20`
        : null,
    );

  const { data: actionsData, loading: actionsLoading, refetch: refetchActions } =
    useFetch<Paginated<AIAction>>(
      activeTab === "actions" && id
        ? `/repositories/${id}/actions?limit=20`
        : null,
    );

  // ── Scan polling: poll the active scan every 4 s until COMPLETED/FAILED ──
  const { data: liveScan } = usePoll<Scan>(
    activeScanId ? `/scans/${activeScanId}` : null,
    4000,
  );

  // When the polled scan reaches a terminal state, refetch all data
  useEffect(() => {
    if (!liveScan) return;
    const terminalStatuses = ["COMPLETED", "FAILED", "CANCELLED"];
    if (terminalStatuses.includes(liveScan.status)) {
      setActiveScanId(null); // stop polling
      if (liveScan.status === "COMPLETED") {
        setScanMsg("Scan complete! Health data updated.");
        refetchHealth();
        refetchFindings();
        refetchAiAnalysis();
      } else {
        setScanMsg(`Scan ${liveScan.status.toLowerCase()}.`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveScan?.status]);

  const triggerScan = useCallback(async () => {
    if (!id) return;
    setScanning(true);
    setScanMsg(null);
    try {
      const result = await api.post<{ id: string }>(`/repositories/${id}/scans`);
      setScanMsg("Scan queued — results will appear automatically…");
      // Start polling this scan ID
      if (result?.id) {
        setActiveScanId(result.id);
      }
    } catch (err: unknown) {
      setScanMsg(err instanceof Error ? err.message : "Failed to queue scan");
    } finally {
      setScanning(false);
    }
  }, [id]);

  const approveRec = useCallback(async (recId: string) => {
    setApprovingId(recId);
    try {
      await api.post(`/recommendations/${recId}/approve`, { confirmation: true });
      refetchRecs();
      refetchActions();
    } finally {
      setApprovingId(null);
    }
  }, [refetchRecs, refetchActions]);

  // ── Auto-poll AI actions every 2s while an action is executing ──
  const hasExecutingAction = useMemo(() => {
    return (
      Boolean(executingId) ||
      (actionsData?.items ?? []).some((a) => a.status === "EXECUTING")
    );
  }, [executingId, actionsData?.items]);

  useEffect(() => {
    if (!hasExecutingAction || activeTab !== "actions") return;
    const interval = setInterval(() => {
      refetchActions();
    }, 2000);
    return () => clearInterval(interval);
  }, [hasExecutingAction, activeTab, refetchActions]);

  // Clear executingId once the target action has completed or failed
  useEffect(() => {
    if (!executingId || !actionsData?.items) return;
    const target = actionsData.items.find((a) => a.id === executingId);
    if (target && (target.status === "COMPLETED" || target.status === "FAILED")) {
      setExecutingId(null);
    }
  }, [executingId, actionsData?.items]);

  const executeAction = useCallback(async (actionId: string) => {
    setExecutingId(actionId);
    try {
      await api.post(`/actions/${actionId}/execute`);
      await refetchActions();
    } catch (err: unknown) {
      console.error("Execute action error:", err);
      setExecutingId(null);
    }
  }, [refetchActions]);

  if (status === "loading" || repoLoading) {
    return (
      <DashboardLayout title="Repository">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <SkeletonCard className="h-64 lg:col-span-1" />
          <SkeletonCard className="h-64 lg:col-span-2" />
        </div>
      </DashboardLayout>
    );
  }

  if (repoError) {
    return (
      <DashboardLayout title="Repository">
        <ErrorState message={repoError} />
      </DashboardLayout>
    );
  }

  if (!repo) return null;

  const hs = health;

  const hasNoCode =
    Boolean(repo.has_no_code) ||
    Boolean(
      findingsData?.items?.some(
        (f) =>
          f.title.toLowerCase().includes("no source code") ||
          f.title.toLowerCase().includes("empty repository")
      )
    );

  const TABS: { id: Tab; label: string }[] = [
    { id: "findings", label: "Findings" },
    { id: "recommendations", label: "Recommendations" },
    { id: "actions", label: "AI Actions" },
  ];

  return (
    <DashboardLayout
      title={
        <div className="flex items-center gap-2.5 flex-wrap">
          {hasNoCode && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300 shadow-sm">
              <span>⚠️</span> Empty Repository
            </span>
          )}
          <span>{repo.name}</span>
        </div>
      }
      subtitle={activeRepo?.full_name ?? repo.full_name}
      actions={
        <div className="flex items-center gap-2">
          <ScheduleButtonWithInfo
            repository={activeRepo || repo}
            onOpenScheduleModal={() => setScheduleModalOpen(true)}
          />
          <Button
            variant="primary"
            size="sm"
            loading={scanning}
            onClick={triggerScan}
          >
            Scan Now
          </Button>
        </div>
      }
    >
      {hasNoCode && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 px-4 py-3.5 rounded-xl border border-yellow-300 bg-yellow-50 text-yellow-900 flex items-start gap-3 shadow-sm"
        >
          <span className="text-xl leading-none mt-0.5">⚠️</span>
          <div>
            <h4 className="text-sm font-bold text-yellow-900">
              Warning: No source code detected in this repository
            </h4>
            <p className="text-xs text-yellow-800 mt-1">
              This repository contains no recognizable programming language files or package manifests. Automated tests, CI/CD pipelines, and dependency management cannot be evaluated until source code is committed.
            </p>
          </div>
        </motion.div>
      )}

      {scanMsg && (

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mb-4 px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2",
            scanMsg.includes("complete")
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : scanMsg.includes("queued") || activeScanId
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-red-50 border-red-200 text-red-700"
          )}
        >
          {(scanMsg.includes("queued") || activeScanId) && (
            <Spinner size="sm" />
          )}
          {scanMsg}
        </motion.div>
      )}

      {/* Top row: score + category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Score card */}
        <MotionCard className="lg:col-span-1">
          <div className="p-6 flex flex-col items-center gap-4">
            {hs ? (
              <>
                <ScoreRing score={hs.overall_score} band={hs.score_band} size={140} strokeWidth={12} />
                <ScoreBandBadge band={hs.score_band} />
                <p className="text-xs text-gray-400">
                  Calculated {timeAgo(hs.calculated_at)}
                </p>
              </>
            ) : activeScanId || healthLoading ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <Spinner size="lg" />
                <p className="text-xs text-gray-500 font-medium">
                  {activeScanId ? "Scanning repository…" : "Loading…"}
                </p>
              </div>
            ) : (
              <EmptyState title="No health score yet" description="Run a scan to generate" icon="⬡" />
            )}
          </div>
        </MotionCard>

        {/* Category breakdown */}
        <MotionCard className="lg:col-span-2">
          <div className="p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-5">
              Category Breakdown
            </h3>
            {hs ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                {(() => {
                  const getCategoryScore = (catKey: string, fallback?: number) => {
                    if (fallback !== undefined && fallback !== null) return fallback;
                    const found = hs.categories?.find(
                      (c) => c.category?.toUpperCase() === catKey.toUpperCase()
                    );
                    return found ? found.raw_score : 0;
                  };
                  return [
                    { key: "DOCUMENTATION", label: "Documentation", score: getCategoryScore("DOCUMENTATION", hs.documentation_score) },
                    { key: "SECURITY", label: "Security", score: getCategoryScore("SECURITY", hs.security_score) },
                    { key: "CODE_QUALITY", label: "Code Quality", score: getCategoryScore("CODE_QUALITY", hs.code_quality_score) },
                    { key: "DEPENDENCIES", label: "Dependencies", score: getCategoryScore("DEPENDENCIES", hs.dependency_score) },
                    { key: "ISSUES", label: "Issues", score: getCategoryScore("ISSUES", hs.issues_score) },
                    { key: "PULL_REQUESTS", label: "Pull Requests", score: getCategoryScore("PULL_REQUESTS", hs.pull_requests_score) },
                    { key: "ACTIVITY", label: "Activity", score: getCategoryScore("ACTIVITY", hs.activity_score) },
                    { key: "CONFIGURATION", label: "Configuration", score: getCategoryScore("CONFIGURATION", hs.configuration_score) },
                  ].map(({ key, label, score }) => (
                    <CategoryBar
                      key={key}
                      categoryKey={key}
                      label={label}
                      score={score}
                      shortDesc={CATEGORY_DETAILS[key]?.shortDesc || ""}
                      onOpenInfo={(k) => setSelectedCategoryInfo(k)}
                      color={scoreBandHex(
                        score >= 90 ? "EXCELLENT" :
                          score >= 75 ? "GOOD" :
                            score >= 60 ? "NEEDS_ATTENTION" :
                              score >= 40 ? "POOR" : "CRITICAL"
                      )}
                    />
                  ));

                })()}
              </div>
            ) : activeScanId || healthLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-[14px] bg-white/[0.04] border border-white/[0.12] flex items-center justify-center text-xl mb-3">
                  📊
                </div>
                <h4 className="text-sm font-medium text-white mb-1">No category breakdown available</h4>
                <p className="text-xs text-white/45 max-w-sm">
                  Run a health scan to calculate category scores for documentation, security, code quality, and dependencies.
                </p>
              </div>
            )}
          </div>
        </MotionCard>
      </div>

      {/* Interactive Tech Stack Visualizer */}
      <TechStackVisualizer
        repo={repo}
        health={health}
        findings={findingsData?.items}
        hasNoCode={hasNoCode}
        aiAnalysis={aiAnalysis}
      />

      {/* AI Executive Summary & Risk Analysis */}

      {aiAnalysis?.result && (
        <MotionCard className="mb-6 p-6 border-indigo-100 bg-gradient-to-br from-white via-indigo-50/20 to-purple-50/10">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-xs">
                AI
              </span>
              <h3 className="text-sm font-medium text-white">
                Health Assessment
              </h3>
            </div>
            <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              {aiAnalysis.model}
            </span>
          </div>

          {aiAnalysis.result.summary && (
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              {aiAnalysis.result.summary}
            </p>
          )}

          {aiAnalysis.result.key_risks && aiAnalysis.result.key_risks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Key Identified Risks
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {aiAnalysis.result.key_risks.map((risk, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-white/80 border border-gray-100 text-xs text-gray-700 shadow-2xs"
                  >
                    <span className="text-amber-500 font-bold shrink-0">⚠</span>
                    <span>{risk}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </MotionCard>
      )}

      {/* Tabs */}
      <div className="mb-5">
        <div className="flex gap-1 p-1 bg-white/[0.04] rounded-full border border-white/[0.12] w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-4 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer",
                activeTab === tab.id
                  ? "bg-white text-[#090D11] shadow-sm font-semibold"
                  : "text-white/60 hover:text-white",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {/* Findings tab */}
        {activeTab === "findings" && (
          <motion.div
            key="findings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {findingsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
            ) : (findingsData?.items ?? []).length === 0 ? (
              <EmptyState title="No findings" icon="✅" description="Clean bill of health!" />
            ) : (
              <div className="space-y-2">
                {(findingsData?.items ?? []).map((f) => (
                  <MotionCard key={f.id} className="p-4">
                    <div className="flex items-start gap-4">
                      <SeverityBadge severity={f.severity} className="shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{f.title}</p>
                        <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{f.description}</p>
                        {f.resource && (
                          <p className="text-xs text-brand-600 mt-1 font-mono">{f.resource}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-white/70 bg-white/[0.06] border border-white/[0.10] px-2.5 py-0.5 rounded-full font-medium">
                        {f.category}
                      </span>
                    </div>
                  </MotionCard>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Recommendations tab */}
        {activeTab === "recommendations" && (
          <motion.div
            key="recommendations"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {recsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : (recsData?.items ?? []).length === 0 ? (
              <EmptyState title="No recommendations yet" icon="💡" />
            ) : (
              <div className="space-y-2">
                {(recsData?.items ?? []).map((rec) => (
                  <MotionCard key={rec.id} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-white">{rec.title}</p>
                          <span className="text-xs text-gray-500 px-1.5 py-0.5 rounded bg-gray-100 font-medium">
                            Priority {rec.priority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{rec.description}</p>
                        <p className="text-xs text-brand-600 mt-1 font-semibold">
                          {rec.recommended_action?.action_type || rec.action_type || "MANUAL_REVIEW"}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full border font-semibold",
                          rec.status === "PENDING" ? "bg-gray-100 text-gray-600 border-gray-200" :
                            rec.status === "APPROVED" ? "bg-blue-50 text-blue-700 border-blue-200" :
                              rec.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                "bg-red-50 text-red-700 border-red-200"
                        )}>
                          {rec.status}
                        </span>
                        {rec.status === "PENDING" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={approvingId === rec.id}
                            onClick={() => approveRec(rec.id)}
                          >
                            Approve
                          </Button>
                        )}
                      </div>
                    </div>
                  </MotionCard>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* AI Actions tab */}
        {activeTab === "actions" && (
          <motion.div
            key="actions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {actionsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : (actionsData?.items ?? []).length === 0 ? (
              <EmptyState title="No AI actions yet" icon="⚡" description="Approve recommendations to create actions" />
            ) : (
              <div className="space-y-2">
                {(actionsData?.items ?? []).map((action) => {
                  const isProcessing = action.status === "EXECUTING" || executingId === action.id;
                  const isCompleted = action.status === "COMPLETED";
                  const isFailed = action.status === "FAILED";
                  const prUrl = action.result?.pull_request_url || action.pr_url;
                  const branchName = action.result?.branch_name || action.branch_name;

                  return (
                    <MotionCard
                      key={action.id}
                      className={cn(
                        "p-4 transition-all duration-300",
                        isProcessing && "border-amber-500/40 bg-amber-500/[0.03]",
                        isCompleted && "border-emerald-500/20",
                        isFailed && "border-rose-500/20"
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-sm font-medium text-white">{action.action_type}</p>
                            <AIActionStatusBadge status={isProcessing ? "EXECUTING" : action.status} />
                          </div>

                          {branchName && (
                            <p className="text-xs text-white/50 font-mono mt-0.5">
                              ⎇ Branch: {branchName}
                            </p>
                          )}

                          {/* Real-time processing indicator */}
                          {isProcessing && (
                            <div className="mt-2.5 flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                              <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin shrink-0" />
                              <span className="text-xs">
                                Executing remediation on GitHub… Creating branch & opening Pull Request.
                              </span>
                            </div>
                          )}

                          {/* Completed / Successful result banner */}
                          {isCompleted && (
                            <div className="mt-2.5 flex items-center justify-between gap-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">🎉</span>
                                <span className="text-xs font-medium">Remediation successfully executed on GitHub!</span>
                              </div>
                              {prUrl && (
                                <a
                                  href={prUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-emerald-200 hover:text-white underline-offset-2 hover:underline font-semibold inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 transition-colors shrink-0"
                                >
                                  View Pull Request ↗
                                </a>
                              )}
                            </div>
                          )}

                          {/* Failed / Error result banner */}
                          {isFailed && (
                            <div className="mt-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 mb-1">
                                <span>⚠️</span>
                                <span>Execution failed on GitHub</span>
                              </div>
                              {action.error_message ? (
                                <p className="text-xs text-rose-200/90 font-mono break-words whitespace-pre-wrap mt-0.5">
                                  {action.error_message}
                                </p>
                              ) : (
                                <p className="text-xs text-rose-200/70">
                                  An unexpected error occurred during execution.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <p className="text-xs text-gray-400">{timeAgo(action.created_at)}</p>
                          {isProcessing ? (
                            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                              Processing…
                            </div>
                          ) : action.status === "APPROVED" ? (
                            <Button
                              variant="primary"
                              size="sm"
                              loading={executingId === action.id}
                              onClick={() => executeAction(action.id)}
                            >
                              Execute
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </MotionCard>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Calculation & Info Modal */}
      <AnimatePresence>
        {selectedCategoryInfo && CATEGORY_DETAILS[selectedCategoryInfo] && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
            onClick={() => setSelectedCategoryInfo(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const item = CATEGORY_DETAILS[selectedCategoryInfo];
                const catScore = (() => {
                  const found = hs?.categories?.find(
                    (c) => c.category?.toUpperCase() === item.key.toUpperCase()
                  );
                  return found ? found.raw_score : 0;
                })();
                return (
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/80">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-gray-900">
                              {item.label}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                              Weight: {item.weight}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Category Score:{" "}
                            <span className="font-bold text-gray-800">
                              {Math.round(catScore)} / 100
                            </span>
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedCategoryInfo(null)}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors text-sm font-semibold cursor-pointer"
                        aria-label="Close"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Scrollable Content Body */}
                    <div className="p-6 max-h-[62vh] overflow-y-auto space-y-5 text-xs text-gray-600">
                      {/* What this category does */}
                      <div>
                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                          What this category monitors & evaluates
                        </h4>
                        <p className="text-gray-700 text-xs leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                          {item.summary}
                        </p>
                      </div>

                      {/* Calculation logic */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                            How it is calculated (Backend Logic)
                          </h4>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Base: {item.calculationLogic.baseScore} pts
                          </span>
                        </div>
                        <div className="space-y-2">
                          {item.calculationLogic.deductions.map((rule, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-colors shadow-2xs"
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-semibold text-gray-900 text-xs">
                                  {rule.check}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={cn(
                                      "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                      rule.severity === "CRITICAL"
                                        ? "bg-red-50 text-red-700 border border-red-200"
                                        : rule.severity === "HIGH"
                                          ? "bg-orange-50 text-orange-700 border border-orange-200"
                                          : rule.severity === "MEDIUM"
                                            ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
                                            : rule.severity === "LOW"
                                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                                              : "bg-gray-100 text-gray-600 border border-gray-200"
                                    )}
                                  >
                                    {rule.severity}
                                  </span>
                                  <span className="font-bold text-red-600 text-xs">
                                    {rule.deduction}
                                  </span>
                                </div>
                              </div>
                              <p className="text-gray-500 text-[11px] leading-normal">
                                {rule.condition}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Safety caps */}
                      {item.capsAndOverrides && (
                        <div>
                          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                            Safety Caps & Overrides
                          </h4>
                          <p className="text-amber-900 bg-amber-50/90 p-3 rounded-xl border border-amber-200 text-xs leading-relaxed">
                            ⚠️ {item.capsAndOverrides}
                          </p>
                        </div>
                      )}

                      {/* Engine implementation reference */}
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                        <span>Backend Engine Collector:</span>
                        <code className="text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[10px]">
                          {item.engineFile}
                        </code>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedCategoryInfo(null)}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {activeRepo && (
        <ScheduleScanModal
          isOpen={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          repository={activeRepo}
          onScheduleUpdated={(updated) => {
            setLocalRepo(updated);
            refetchRepo();
          }}
        />
      )}
    </DashboardLayout>
  );
}

