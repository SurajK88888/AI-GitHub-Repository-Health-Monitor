/**
 * /findings — Global findings browser with severity filter.
 */

"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MotionCard } from "@/components/ui/MotionCard";
import { SeverityBadge } from "@/components/ui/Badge";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { useFetch } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { Finding, FindingSeverity, Paginated } from "@/lib/types";

const SEVERITIES: (FindingSeverity | "ALL")[] = [
  "ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO",
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, x: -12 },
  show:  { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 300, damping: 28 } },
};

export default function FindingsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [severity, setSeverity] = useState<FindingSeverity | "ALL">("ALL");

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  const querySeverity = severity === "INFO" ? "INFORMATIONAL" : severity;
  const path = severity === "ALL"
    ? "/findings?limit=50"
    : `/findings?severity=${querySeverity}&limit=50`;

  const { data, loading, error, refetch } = useFetch<Paginated<Finding>>(path);
  const findings = data?.items ?? [];

  if (status === "loading") return null;

  return (
    <DashboardLayout
      title="Findings"
      subtitle={`${data?.total ?? 0} total findings`}
      actions={
        <Button variant="ghost" size="sm" onClick={refetch}>
          ↺ Refresh
        </Button>
      }
    >
      {/* Severity filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SEVERITIES.map((s) => (
          <button
            key={s}
            onClick={() => setSeverity(s)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200",
              severity === s
                ? "bg-brand-50 text-brand-700 border-brand-300 shadow-sm"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-800",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : findings.length === 0 ? (
        <EmptyState
          title="No findings"
          description={severity !== "ALL" ? `No ${severity} severity findings` : "All clean!"}
          icon="✅"
        />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={severity}
            variants={stagger}
            initial="hidden"
            animate="show"
            className="space-y-2"
          >
            {findings.map((f) => (
              <motion.div key={f.id} variants={item}>
                <MotionCard className="p-4">
                  <div className="flex items-start gap-4">
                    <SeverityBadge severity={f.severity} className="shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                        <span className="shrink-0 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md font-medium">
                          {f.category}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{f.description}</p>
                      {f.resource && (
                        <p className="text-xs text-brand-600 mt-1.5 font-mono truncate font-medium">
                          📍 {f.resource}
                        </p>
                      )}
                      {f.evidence && (
                        <pre className="mt-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-2.5 overflow-x-auto max-h-24">
                          {typeof f.evidence === "string" ? f.evidence : JSON.stringify(f.evidence, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </MotionCard>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </DashboardLayout>
  );
}
