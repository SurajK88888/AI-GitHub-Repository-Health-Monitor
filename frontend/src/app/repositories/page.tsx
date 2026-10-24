/**
 * /repositories — Repository list with health scores, monitoring toggle,
 * and trigger-scan capability.
 */

"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense, useRef } from "react";
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
import { ScheduleScanModal, ScheduleButtonWithInfo } from "@/components/scheduler";
import { GenerateDescriptionModal } from "@/components/repository/GenerateDescriptionModal";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 28 } },
};


function RepositoriesContent() {
  const { status } = useSession();
  const router = useRouter();
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState<{ id: string; msg: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [selectedRepoForDescription, setSelectedRepoForDescription] = useState<Repository | null>(null);
  const [descriptionModalOpen, setDescriptionModalOpen] = useState(false);
  const searchParams = useSearchParams();
  const autoSyncedRef = useRef(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedRepoForSchedule, setSelectedRepoForSchedule] = useState<Repository | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  const searchParam = (searchParams.get("search") || searchParams.get("q") || "").trim();
  const path = searchParam
    ? `/repositories?limit=50&search=${encodeURIComponent(searchParam)}`
    : "/repositories?limit=50";

  const { data, loading, error, refetch } =
    useFetch<Paginated<Repository>>(path);

  const repos = (data?.items ?? []).filter((r) => {
    if (!searchParam) return true;
    const q = searchParam.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q);
  });

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

  // Automatically trigger sync when redirected back with ?installed=true
  useEffect(() => {
    if (searchParams.get("installed") === "true" && !autoSyncedRef.current) {
      autoSyncedRef.current = true;
      handleSync();
      router.replace("/repositories");
    }
  }, [searchParams, handleSync, router]);

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
      subtitle={
        searchParam
          ? `${repos.length} matching "${searchParam}"`
          : `${data?.total ?? 0} repositories monitored`
      }
      actions={
        <div className="flex items-center gap-2">
          {repos.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedRepoForSchedule(repos[0]);
                setScheduleModalOpen(true);
              }}
              className="flex items-center gap-1.5"
              title="Configure automated recurring AI scan schedule"
            >
              <span>⏱️</span>
              <span>Schedule Auto-Scans</span>
            </Button>
          )}
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
      {searchParam && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-brand-50 border border-brand-200 text-brand-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🔍</span>
            <span>
              Search filter active: &ldquo;<span className="font-bold">{searchParam}</span>&rdquo; ({repos.length} found)
            </span>
          </div>
          <button
            onClick={() => router.push("/repositories")}
            className="text-brand-600 hover:text-brand-800 font-bold ml-2 underline cursor-pointer"
          >
            Clear filter
          </button>
        </div>
      )}

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
          icon={searchParam ? "🔍" : "📦"}
          title={searchParam ? `No repositories matching "${searchParam}"` : "No repositories yet"}
          description={
            searchParam
              ? "No monitored repositories match your search criteria. Try another query or clear the filter."
              : "Sync your GitHub account to import installed repositories, or install the GitHub App."
          }
          action={
            searchParam ? (
              <div className="mt-4">
                <Button variant="secondary" size="sm" onClick={() => router.push("/repositories")}>
                  Clear Search Filter
                </Button>
              </div>
            ) : (
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
            )
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
                        <div className="flex items-center gap-2 flex-wrap">
                          {repo.has_no_code && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
                              <span>⚠️</span> Empty Repo
                            </span>
                          )}
                          <h2 className="text-base font-bold text-gray-900 hover:text-brand-600 transition-colors truncate">
                            {repo.name}
                          </h2>
                        </div>
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

                  {/* Description / AI Generator */}
                  {repo.description ? (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {repo.description}
                    </p>
                  ) : (
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRepoForDescription(repo);
                          setDescriptionModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50/90 text-purple-700 hover:bg-purple-100/90 border border-purple-200/80 transition-all cursor-pointer shadow-2xs group"
                        title="Generate repository description using AI"
                      >
                        <span className="text-xs group-hover:scale-110 transition-transform">✨</span>
                        <span>Generate with AI</span>
                      </button>
                    </div>
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
                  <div className="mt-auto flex items-center justify-between gap-1.5 pt-3 border-t border-gray-100/90 flex-wrap sm:flex-nowrap">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1 min-w-[76px] px-2.5 py-1.5 text-xs whitespace-nowrap"
                      loading={scanningId === repo.id}
                      onClick={() => triggerScan(repo.id)}
                    >
                      Scan Now
                    </Button>
                    <ScheduleButtonWithInfo
                      repository={repo}
                      compact
                      onOpenScheduleModal={(targetRepo) => {
                        setSelectedRepoForSchedule(targetRepo);
                        setScheduleModalOpen(true);
                      }}
                    />
                    <Link href={`/repositories/${repo.id}`} className="shrink-0">
                      <Button variant="secondary" size="sm" className="px-2.5 py-1.5 text-xs whitespace-nowrap">
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

      {selectedRepoForSchedule && (
        <ScheduleScanModal
          isOpen={scheduleModalOpen}
          onClose={() => {
            setScheduleModalOpen(false);
            setSelectedRepoForSchedule(null);
          }}
          repository={selectedRepoForSchedule}
          repositories={repos}
          onSelectRepository={(r) => setSelectedRepoForSchedule(r)}
          onScheduleUpdated={() => {
            refetch();
          }}
        />
      )}

      {selectedRepoForDescription && (
        <GenerateDescriptionModal
          isOpen={descriptionModalOpen}
          onClose={() => {
            setDescriptionModalOpen(false);
            setSelectedRepoForDescription(null);
          }}
          repository={selectedRepoForDescription}
          onDescriptionUpdated={(_repoId, _newDesc) => {
            refetch();
          }}
        />
      )}
    </DashboardLayout>
  );
}

export default function RepositoriesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7f7fb]">
          <Spinner size="lg" />
        </div>
      }
    >
      <RepositoriesContent />
    </Suspense>
  );
}