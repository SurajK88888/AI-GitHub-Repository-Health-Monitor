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

export default function NotificationsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [localRead, setLocalRead] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  const path = showUnreadOnly
    ? "/notifications?is_read=false&limit=50"
    : "/notifications?limit=50";

  const { data, loading, error, refetch } = useFetch<Paginated<Notification>>(path);
  const notifications = data?.items ?? [];

  const markRead = useCallback(async (id: string) => {
    setLocalRead((s) => new Set([...s, id]));
    try {
      await api.post("/notifications/mark-read", { notification_ids: [id] });
    } catch {
      // Optimistic — don't revert for single mark-read
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setMarkingAll(true);
    try {
      await api.post("/notifications/mark-all-read");
      refetch();
    } finally {
      setMarkingAll(false);
    }
  }, [refetch]);

  if (status === "loading") return null;

  const unreadCount = notifications.filter(
    (n) => !n.is_read && !localRead.has(n.id),
  ).length;

  return (
    <DashboardLayout
      title="Notifications"
      subtitle={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUnreadOnly((v) => !v)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
              showUnreadOnly
                ? "bg-brand-50 text-brand-700 border-brand-300"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-800",
            )}
          >
            {showUnreadOnly ? "All" : "Unread only"}
          </button>
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
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="🔔"
          title={showUnreadOnly ? "No unread notifications" : "No notifications yet"}
          description="You're all caught up!"
        />
      ) : (
        <AnimatePresence>
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="space-y-2"
          >
            {notifications.map((n) => {
              const isRead = n.is_read || localRead.has(n.id);
              return (
                <motion.div key={n.id} variants={item} layout>
                  <MotionCard
                    className={cn(
                      "p-4 transition-colors",
                      !isRead && "border-brand-200 bg-brand-50/20",
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
                          <p className={cn("text-sm font-semibold", isRead ? "text-gray-500" : "text-gray-900")}>
                            {n.title}
                          </p>
                          <SeverityBadge severity={n.severity} className="shrink-0" />
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{n.message}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                          <span className="text-xs text-gray-400 font-medium">{n.type.replace(/_/g, " ")}</span>
                        </div>
                      </div>

                      {/* Mark read */}
                      {!isRead && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="shrink-0 text-sm text-gray-400 hover:text-brand-600 transition-colors p-1"
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
