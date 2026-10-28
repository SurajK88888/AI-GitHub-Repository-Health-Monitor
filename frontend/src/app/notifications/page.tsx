/**
 * /notifications — Notification center with mark-read and mark-all-read.
 */

"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MotionCard } from "@/components/ui/MotionCard";
import { SeverityBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/Spinner";
import { useFetch } from "@/lib/hooks";
import { timeAgo, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Notification, Paginated } from "@/lib/types";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, x: -16, scale: 0.98 },
  show:  { opacity: 1, x: 0, scale: 1, transition: { type: "spring" as const, stiffness: 300, damping: 28 } },
};

const TAGS: Array<{ key: "all" | "read" | "unread"; label: string }> = [
  { key: "all", label: "All" },
  { key: "read", label: "Read" },
  { key: "unread", label: "Unread" },
];

export default function NotificationsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "read" | "unread">("all");
  const [markingAll, setMarkingAll] = useState(false);
  const [localRead, setLocalRead] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  const path =
    filter === "unread"
      ? "/notifications?is_read=false&page_size=50&limit=50"
      : filter === "read"
      ? "/notifications?is_read=true&page_size=50&limit=50"
      : "/notifications?page_size=50&limit=50";

  const { data, loading, error, refetch } = useFetch<Paginated<Notification>>(path);
  const { data: countData, refetch: refetchCount } = useFetch<{ count: number }>("/notifications/unread-count");
  const notifications = data?.items ?? [];

  const markRead = useCallback(async (id: string) => {
    setLocalRead((s) => new Set([...s, id]));
    try {
      await api.post("/notifications/mark-read", { notification_ids: [id] });
      refetchCount();
    } catch {
      // Optimistic — don't revert for single mark-read
    }
  }, [refetchCount]);

  const markAllRead = useCallback(async () => {
    setMarkingAll(true);
    try {
      await api.post("/notifications/mark-all-read");
      refetch();
      refetchCount();
    } finally {
      setMarkingAll(false);
    }
  }, [refetch, refetchCount]);

  if (status === "loading") return null;

  const unreadCount =
    countData?.count !== undefined
      ? Math.max(0, countData.count - localRead.size)
      : notifications.filter((n) => !n.is_read && !localRead.has(n.id)).length;

  const displayedNotifications = notifications.filter((n) => {
    const isRead = n.is_read || localRead.has(n.id);
    if (filter === "unread") return !isRead;
    if (filter === "read") return isRead;
    return true;
  });

  return (
    <DashboardLayout
      title="Notifications"
      subtitle={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
      actions={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {TAGS.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200",
                  filter === t.key
                    ? "bg-white text-[#090D11] border-white font-medium rounded-full shadow-sm"
                    : "bg-white/[0.04] text-white/60 border-white/[0.12] hover:bg-white/[0.08] hover:text-white rounded-full",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              loading={markingAll}
              onClick={markAllRead}
            >
              Mark all read
            </Button>
          )}
        </div>
      }
    >
      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : displayedNotifications.length === 0 ? (
        <EmptyState
          icon="🔔"
          title={
            filter === "unread"
              ? "No unread notifications"
              : filter === "read"
              ? "No read notifications"
              : "No notifications yet"
          }
          description={
            filter === "unread"
              ? "You're all caught up!"
              : filter === "read"
              ? "No notifications have been marked as read."
              : "You're all caught up!"
          }
        />
      ) : (
        <AnimatePresence>
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="space-y-2"
          >
            {displayedNotifications.map((n) => {
              const isRead = n.is_read || localRead.has(n.id);
              return (
                <motion.div key={n.id} variants={item} layout>
                  <MotionCard
                    className={cn(
                      "p-4 transition-colors",
                      !isRead && "border-white/[0.20] bg-white/[0.08]",
                    )}
                  >
                    <div className="flex items-start gap-4">
                      {/* Unread dot */}
                      <div className="mt-1.5 shrink-0">
                        {!isRead ? (
                          <span className="w-2 h-2 rounded-full bg-brand-500 block" />
                        ) : (
                          <span className="w-2 h-2 block" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <p className={cn("text-sm font-semibold", isRead ? "text-white/40" : "text-white")}>
                            {n.title}
                          </p>
                          <SeverityBadge severity={n.severity} className="shrink-0" />
                        </div>
                        <p className="text-xs text-white/60 line-clamp-2">{n.message}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-white/40">{timeAgo(n.created_at)}</span>
                          <span className="text-xs text-gray-400 font-medium">{n.type.replace(/_/g, " ")}</span>
                        </div>
                      </div>

                      {/* Mark read */}
                      {!isRead && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="shrink-0 text-sm text-gray-400 hover:text-[#F59E0B] transition-colors p-1"
                          aria-label="Mark as read"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </MotionCard>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </DashboardLayout>
  );
}
