"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DraggableDashboard } from "@/components/dashboard/DraggableDashboard";
import { useDashboardLayout } from "@/lib/hooks";
import { api } from "@/lib/api";
import {
  OverviewScoresWidget,
  CriticalFindingsWidget,
  RecentScansWidget,
  ScoreTrendWidget,
  TopReposWidget,
  NotificationsWidget,
  QuickActionsWidget,
  ActivityFeedWidget,
} from "@/components/dashboard/Widgets";

function renderWidget(id: string) {
  switch (id) {
    case "overview":
    case "overview-scores":
      return <OverviewScoresWidget />;
    case "critical":
    case "critical-findings":
      return <CriticalFindingsWidget />;
    case "scans":
    case "recent-scans":
      return <RecentScansWidget />;
    case "trend":
    case "score-trend":
      return <ScoreTrendWidget />;
    case "repos":
    case "top-repos":
      return <TopReposWidget />;
    case "notifications":
      return <NotificationsWidget />;
    case "quick-actions":
      return <QuickActionsWidget />;
    case "activity":
    case "activity-feed":
      return <ActivityFeedWidget />;
    default:
      return null;
  }
}

const WIDGET_TITLES: Record<string, string> = {
  overview: "Health Overview",
  "overview-scores": "Health Overview",
  critical: "Critical Findings",
  "critical-findings": "Critical Findings",
  scans: "Recent Scans",
  "recent-scans": "Recent Scans",
  trend: "Score Trend",
  "score-trend": "Score Trend",
  repos: "Top Repositories",
  "top-repos": "Top Repositories",
  notifications: "Latest Notifications",
  "quick-actions": "Quick Actions",
  activity: "Activity Feed",
  "activity-feed": "Activity Feed",
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { widgets, saveWidgets } = useDashboardLayout();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <DashboardLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-brand-500 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (status === "unauthenticated") {
    return (
      <DashboardLayout title="Sign In Required">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-2xl mb-4 border border-purple-100">
            🔒
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Access your repository dashboard</h2>
          <p className="text-sm text-gray-500 max-w-sm mb-6">
            Sign in with your GitHub account to view automated health scores, security findings, and AI recommendations.
          </p>
          <Link href="/auth/signin">
            <button className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold text-sm shadow-brand-sm transition-colors">
              Sign in with GitHub →
            </button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post("/installations/discover");
      window.location.reload();
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  const firstName = session?.user?.name ? session.user.name.split(" ")[0] : "there";

  return (
    <DashboardLayout
      title={`Good morning, ${firstName} 👋`}
      subtitle="Here's your repository health overview"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg border border-gray-200 transition-colors shadow-sm disabled:opacity-60"
          >
            <span>⚡</span>
            <span>{syncing ? "Syncing..." : "Sync GitHub"}</span>
          </button>
          <Link href="/repositories">
            <button className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors shadow-brand-sm">
              <span className="text-base font-bold leading-none">+</span>
              <span>New Scan</span>
            </button>
          </Link>
        </div>
      }
    >
      <DraggableDashboard
        widgets={widgets}
        onReorder={saveWidgets}
        renderWidget={(widget) => renderWidget(widget.id)}
        getTitle={(id) => WIDGET_TITLES[id] ?? id}
      />
    </DashboardLayout>
  );
}
