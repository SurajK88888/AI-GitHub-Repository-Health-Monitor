/**
 * /repositories — Repository list with health scores, monitoring toggle,
 * and trigger-scan capability.
 */

"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MotionCard } from "@/components/ui/MotionCard";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { ScoreBandBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner, SkeletonCard, EmptyState, ErrorState } from "@/components/ui/Spinner";
import { useFetch } from "@/lib/hooks";
import { timeAgo } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Repository, Paginated } from "@/lib/types";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show:  { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 28 } },
};

export default function RepositoriesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState<{ id: string; msg: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  const { data, loading, error, refetch } =
    useFetch<Paginated<Repository>>("/repositories?limit=50");

  const repos = data?.items ?? [];

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await api.post<{
        installations_synced: number;
        repositories_synced: number;
        accounts?: string[];
      }>("/installations/discover");
      setSyncResult(
        `Synced ${res.repositories_synced} repositories across ${res.installations_synced} account(s)!`
      );
      await refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      setSyncResult(`Sync failed: ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  const triggerScan = useCallback(
    async (repoId: string) => {
      setScanningId(repoId);
      setScanMsg(null);
      try {
        await api.post(`/repositories/${repoId}/scans`);
        setScanMsg({ id: repoId, msg: "Scan queued!" });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to start scan";
        setScanMsg({ id: repoId, msg });
      } finally {
        setScanningId(null);
      }
    },
    [],
  );

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <DashboardLayout
      title="Repositories"
      subtitle={`${data?.total ?? 0} repositories monitored`}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            loading={syncing}
            onClick={handleSync}
          >
            ⚡ Sync with GitHub
          </Button>
        </div>
      }
    >
      {syncResult && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 text-xs font-semibold flex items-center justify-between">
          <span>{syncResult}</span>
          <button
            onClick={() => setSyncResult(null)}
            className="text-purple-500 hover:text-purple-700 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading && repos.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} className="h-52" />
          ))}
        </div>
      ) : repos.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No repositories yet"
          description="Sync your GitHub account to import installed repositories, or install the GitHub App."
          action={
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
              <Button
                variant="primary"
                size="sm"
                loading={syncing}
                onClick={handleSync}
              >
                ⚡ Sync Repositories from GitHub
              </Button>
              <a
                href="https://github.com/apps/ai-github-repo-health-monitor/installations/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" size="sm">
                  Install GitHub App ↗
                </Button>
              </a>
            </div>
          }
        />
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
        >
          {repos.map((repo) => (
            <motion.div key={repo.id} variants={item}>
              <MotionCard className="h-full">
                <div className="p-5 flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <Link href={`/repositories/${repo.id}`}>
                        <h2 className="text-base font-bold text-gray-900 hover:text-brand-600 transition-colors truncate">
                          {repo.name}
                        </h2>
                      </Link>
                      <p className="text-xs text-gray-400 truncate">{repo.full_name}</p>
                    </div>
                    {repo.latest_health_score && (
                      <ScoreRing
                        score={repo.latest_health_score.overall_score}
                        band={repo.latest_health_score.score_band}
                        size={64}
                        strokeWidth={6}
                      />
                    )}
                  </div>

                  {/* Description */}
                  {repo.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {repo.description}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-4">
                    {repo.language && (
                      <span className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 border border-brand-200 font-medium">
                        {repo.language}
                      </span>
                    )}
                    <span>{repo.private ? "🔒 Private" : "🌐 Public"}</span>
                    <span>⎇ {repo.default_branch}</span>
                  </div>

                  {/* Score band + last scan */}
                  <div className="flex items-center gap-2 mb-4">
                    {repo.latest_health_score ? (
                      <ScoreBandBadge band={repo.latest_health_score.score_band} />
                    ) : (
                      <span className="text-xs text-gray-400">Not scanned yet</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {repo.last_scanned_at
                        ? `Scanned ${timeAgo(repo.last_scanned_at)}`
                        : "—"}
                    </span>
                  </div>

                  {/* Feedback message */}
                  <AnimatePresence>
                    {scanMsg?.id === repo.id && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-xs font-semibold text-emerald-600 mb-2"
                      >
                        {scanMsg.msg}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* Actions */}
                  <div className="mt-auto flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      loading={scanningId === repo.id}
                      onClick={() => triggerScan(repo.id)}
                    >
                      Scan Now
                    </Button>
                    <Link href={`/repositories/${repo.id}`}>
                      <Button variant="secondary" size="sm">
                        Details →
                      </Button>
                    </Link>
                  </div>
                </div>
              </MotionCard>
            </motion.div>
          ))}
        </motion.div>
      )}
    </DashboardLayout>
  );
}
