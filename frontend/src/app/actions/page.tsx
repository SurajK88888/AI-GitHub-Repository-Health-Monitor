/**
 * /actions — Global AI Actions list with approve and execute controls.
 */

"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MotionCard } from "@/components/ui/MotionCard";
import { AIActionStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/Spinner";
import { useFetch } from "@/lib/hooks";
import { timeAgo, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { AIAction, Paginated, AIActionStatus } from "@/lib/types";

const STATUS_FILTERS: (AIActionStatus | "ALL")[] = [
  "ALL", "PENDING", "APPROVED", "EXECUTING", "COMPLETED", "FAILED",
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show:  { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 28 } },
};

export default function ActionsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [filter, setFilter] = useState<AIActionStatus | "ALL">("ALL");
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  const path =
    filter === "ALL"
      ? "/actions?limit=50"
      : `/actions?status=${filter}&limit=50`;

  const { data, loading, error, refetch } = useFetch<Paginated<AIAction>>(path);
  const actions = data?.items ?? [];

  const executeAction = useCallback(
    async (actionId: string) => {
      setExecutingId(actionId);
      setMsg(null);
      try {
        await api.post(`/actions/${actionId}/execute`);
        setMsg({ id: actionId, text: "Action queued for execution!" });
        refetch();
      } catch (err: unknown) {
        setMsg({
          id: actionId,
          text: err instanceof Error ? err.message : "Execution failed",
        });
      } finally {
        setExecutingId(null);
      }
    },
    [refetch],
  );

  if (status === "loading") return null;

  return (
    <DashboardLayout
      title="AI Actions"
      subtitle={`${data?.total ?? 0} total actions`}
      actions={
        <Button variant="ghost" size="sm" onClick={refetch}>
          ↺ Refresh
        </Button>
      }
    >
      {/* Status filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200",
              filter === s
                ? "bg-white text-[#090D11] border-white font-medium rounded-full shadow-sm"
                : "bg-white/[0.04] text-white/60 border-white/[0.12] hover:bg-white/[0.08] hover:text-white rounded-full",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : actions.length === 0 ? (
        <EmptyState
          icon="⚡"
          title="No AI actions"
          description="Approve recommendations on repository pages to create actions"
        />
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {actions.map((action) => (
            <motion.div key={action.id} variants={item}>
              <MotionCard className="p-5">
                <div className="flex items-start gap-4">
                  {/* Left: info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <AIActionStatusBadge status={action.status} />
                      <span className="text-sm font-medium text-white">
                        {action.action_type}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-white/40 mb-2">
                      <span>Repo: {action.repository_id.slice(0, 8).toUpperCase()}</span>
                      <span>Created {timeAgo(action.created_at)}</span>
                      {action.executed_at && (
                        <span>Executed {timeAgo(action.executed_at)}</span>
                      )}
                    </div>

                    {(action.result?.branch_name || action.branch_name) && (
                      <p className="text-xs font-mono text-gray-500">
                        ⎇ {action.result?.branch_name || action.branch_name}
                      </p>
                    )}

                    {(action.result?.pull_request_url || action.pr_url) && (
                      <a
                        href={action.result?.pull_request_url || action.pr_url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 hover:underline underline-offset-2 mt-1 font-medium"
                      >
                        View Pull Request ↗
                      </a>
                    )}

                    {action.error_message && (
                      <p className="text-xs text-red-600 mt-1 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
                        {action.error_message}
                      </p>
                    )}

                    {msg?.id === action.id && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs font-semibold text-emerald-600 mt-1"
                      >
                        {msg.text}
                      </motion.p>
                    )}
                  </div>

                  {/* Right: action */}
                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <Link href={`/repositories/${action.repository_id}`}>
                      <Button variant="ghost" size="sm">Repo →</Button>
                    </Link>
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
            </motion.div>
          ))}
        </motion.div>
      )}
    </DashboardLayout>
  );
}
