/**
 * /repositories/[id] — Repository detail page.
 * Shows: health score ring, category breakdown bars, scan history button,
 * and tabbed sections: Findings | Recommendations | AI Actions
 */

"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MotionCard } from "@/components/ui/MotionCard";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { ScoreBandBadge, SeverityBadge, AIActionStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Spinner,
  SkeletonCard,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui/Spinner";
import { useFetch } from "@/lib/hooks";
import { timeAgo, scoreBandHex, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type {
  Repository,
  HealthScore,
  Paginated,
  Finding,
  Recommendation,
  AIAction,
} from "@/lib/types";

// ── Category score bar ────────────────────────────────────────────────────

interface CategoryBarProps {
  label: string;
  score: number;
  color: string;
}

function CategoryBar({ label, score, color }: CategoryBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="font-bold" style={{ color }}>
          {Math.round(score)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
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
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  const { data: repo, loading: repoLoading, error: repoError } =
    useFetch<Repository>(id ? `/repositories/${id}` : null);

  const { data: health, loading: healthLoading } =
    useFetch<HealthScore>(id ? `/repositories/${id}/health` : null);

  const { data: findingsData, loading: findingsLoading } =
    useFetch<Paginated<Finding>>(
      activeTab === "findings" && id
        ? `/repositories/${id}/findings?limit=20`
        : null,
    );

  const { data: recsData, loading: recsLoading } =
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

  const triggerScan = useCallback(async () => {
    if (!id) return;
    setScanning(true);
    setScanMsg(null);
    try {
      await api.post(`/repositories/${id}/scans`);
      setScanMsg("Scan queued successfully!");
    } catch (err: unknown) {
      setScanMsg(err instanceof Error ? err.message : "Failed to queue scan");
    } finally {
      setScanning(false);
    }
  }, [id]);

  const approveRec = useCallback(async (recId: string) => {
    setApprovingId(recId);
    try {
      await api.post(`/recommendations/${recId}/approve`);
    } finally {
      setApprovingId(null);
    }
  }, []);

  const executeAction = useCallback(async (actionId: string) => {
    setExecutingId(actionId);
    try {
      await api.post(`/actions/${actionId}/execute`);
      refetchActions();
    } finally {
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

  const TABS: { id: Tab; label: string }[] = [
    { id: "findings",        label: "Findings" },
    { id: "recommendations", label: "Recommendations" },
    { id: "actions",         label: "AI Actions" },
  ];

  return (
    <DashboardLayout
      title={repo.name}
      subtitle={repo.full_name}
      actions={
        <Button
          variant="primary"
          size="sm"
          loading={scanning}
          onClick={triggerScan}
        >
          Scan Now
        </Button>
      }
    >
      {scanMsg && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium"
        >
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
            ) : healthLoading ? (
              <div className="flex items-center justify-center h-40">
                <Spinner size="lg" />
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
                {[
                  { label: "Documentation",   score: hs.documentation_score },
                  { label: "Security",        score: hs.security_score },
                  { label: "Code Quality",    score: hs.code_quality_score },
                  { label: "Dependencies",    score: hs.dependency_score },
                  { label: "Issues",          score: hs.issues_score },
                  { label: "Pull Requests",   score: hs.pull_requests_score },
                  { label: "Activity",        score: hs.activity_score },
                  { label: "Configuration",   score: hs.configuration_score },
                ].map(({ label, score }) => (
                  <CategoryBar
                    key={label}
                    label={label}
                    score={score}
                    color={scoreBandHex(
                      score >= 90 ? "EXCELLENT" :
                      score >= 75 ? "GOOD" :
                      score >= 60 ? "NEEDS_ATTENTION" :
                      score >= 40 ? "POOR" : "CRITICAL"
                    )}
                  />
                ))}
              </div>
            ) : (
              <Skeleton className="h-48" />
            )}
          </div>
        </MotionCard>
      </div>

      {/* Tabs */}
      <div className="mb-5">
        <div className="flex gap-1 p-1 bg-white rounded-xl border border-gray-200 shadow-sm w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-4 py-2 text-sm font-semibold rounded-lg transition-all",
                activeTab === tab.id
                  ? "bg-brand-50 text-brand-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
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
                        <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{f.description}</p>
                        {f.resource && (
                          <p className="text-xs text-brand-600 mt-1 font-mono">{f.resource}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md font-medium">
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
                          <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
                          <span className="text-xs text-gray-500 px-1.5 py-0.5 rounded bg-gray-100 font-medium">
                            Priority {rec.priority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{rec.description}</p>
                        <p className="text-xs text-brand-600 mt-1 font-semibold">{rec.action_type}</p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full border font-semibold",
                          rec.status === "PENDING"   ? "bg-gray-100 text-gray-600 border-gray-200" :
                          rec.status === "APPROVED"  ? "bg-blue-50 text-blue-700 border-blue-200" :
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
                {(actionsData?.items ?? []).map((action) => (
                  <MotionCard key={action.id} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-gray-900">{action.action_type}</p>
                          <AIActionStatusBadge status={action.status} />
                        </div>
                        {action.branch_name && (
                          <p className="text-xs text-gray-500 font-mono">Branch: {action.branch_name}</p>
                        )}
                        {action.pr_url && (
                          <a
                            href={action.pr_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline font-medium"
                          >
                            View Pull Request ↗
                          </a>
                        )}
                        {action.error_message && (
                          <p className="text-xs text-red-600 mt-1">{action.error_message}</p>
                        )}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <p className="text-xs text-gray-400">{timeAgo(action.created_at)}</p>
                        {action.status === "APPROVED" && (
                          <Button
                            variant="primary"
                            size="sm"
                            loading={executingId === action.id}
                            onClick={() => executeAction(action.id)}
                          >
                            Execute
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
      </AnimatePresence>
    </DashboardLayout>
  );
}
