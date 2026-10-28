"use client";

import { useState } from "react";
import Link from "next/link";
import { useFetch, usePoll } from "@/lib/hooks";
import { timeAgo } from "@/lib/utils";
import { SeverityBadge, ScanStatusBadge } from "@/components/ui/Badge";
import { Skeleton, EmptyState } from "@/components/ui/Spinner";
import { ScheduleScanModal } from "@/components/scheduler/ScheduleScanModal";
import type {
  Repository,
  Paginated,
  Finding,
  Scan,
  Notification,
  AIAction,
} from "@/lib/types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Metric card component matching Image 2 ─────────────────────────────────────

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-[16px] p-5 transition-all flex items-center gap-4 hover:border-white/[0.15]">
      <div className="w-12 h-12 rounded-[12px] bg-white/[0.05] border border-white/[0.10] text-[#F59E0B] flex items-center justify-center text-xl flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[28px] font-medium text-white tracking-tight leading-none mb-1">
          {value}
        </p>
        <p className="text-xs font-normal text-white/45 truncate">
          {label}
        </p>
      </div>
    </div>
  );
}

// ── Widget: Overview (Top 4 Metrics from real data) ───────────────────────────

export function OverviewScoresWidget() {
  const { data: repos, loading: rl } = useFetch<Paginated<Repository>>("/repositories?limit=100");
  const { data: findings, loading: fl } = useFetch<Paginated<Finding>>("/findings?limit=1");
  const { data: actions, loading: al } = useFetch<Paginated<AIAction>>("/actions?limit=1");

  const repoList = repos?.items ?? [];
  const repoCount = repos?.total ?? 0;
  const findingCount = findings?.total ?? 0;
  const actionCount = actions?.total ?? 0;

  // Calculate average health score from actual repositories
  const scores = repoList
    .map((r) => r.latest_health_score?.overall_score)
    .filter((s): s is number => typeof s === "number");
  const avgScore = scores.length > 0
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
    : "—";

  if (rl && fl && al) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard label="Repositories" value={repoCount} icon="📖" />
      <MetricCard label="Avg Health" value={avgScore} icon="📈" />
      <MetricCard label="Open Findings" value={findingCount} icon="ℹ️" />
      <MetricCard label="AI Actions" value={actionCount} icon="✨" />
    </div>
  );
}

// ── Widget: Score Trend (Dynamic or Empty) ────────────────────────────────────

export function ScoreTrendWidget() {
  const { data: repos, loading } = useFetch<Paginated<Repository>>("/repositories?limit=10");
  const repoList = repos?.items ?? [];

  const scoredRepos = repoList.filter((r) => r.latest_health_score);

  const chartData = scoredRepos.length > 0
    ? scoredRepos.map((r) => ({
        date: r.name.length > 7 ? r.name.slice(0, 6) + "…" : r.name,
        score: Math.round(r.latest_health_score!.overall_score),
      }))
    : null;

  if (loading) {
    return <Skeleton className="h-44 rounded-xl" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-normal text-white/45">Health progression</span>
        <span className="text-xs font-medium text-white/55 bg-white/[0.05] border border-white/[0.10] px-2.5 py-0.5 rounded-full">
          {chartData ? "Across repositories" : "No scan history yet"}
        </span>
      </div>
      {chartData && chartData.length > 1 ? (
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgba(255, 255, 255, 0.40)" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11, fill: "rgba(255, 255, 255, 0.40)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#0F161E",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#FFFFFF",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#F59E0B"
                strokeWidth={2.5}
                fill="url(#scoreGrad)"
                dot={{ r: 4, fill: "#F59E0B", stroke: "#090D11", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "#FFFFFF", stroke: "#F59E0B", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-[14px] bg-white/[0.04] border border-white/[0.12] flex items-center justify-center text-xl mb-3">
            📊
          </div>
          <p className="text-sm font-medium text-white">No score trend available</p>
          <p className="text-xs text-white/45 mt-0.5">Run repository scans to generate health progression</p>
        </div>
      )}
    </div>
  );
}

// ── Widget: Critical Findings (Real Findings or Clean Empty State) ────────────

export function CriticalFindingsWidget() {
  const { data: findData, loading: fl } =
    useFetch<Paginated<Finding>>("/findings?severity=CRITICAL&limit=4");
  const findings = findData?.items ?? [];

  if (fl) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="w-2 h-2 rounded-full" />
            <Skeleton className="h-4 flex-1 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <EmptyState
        icon="✅"
        title="No critical findings"
        description="All monitored repositories have passed critical security checks."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-normal text-white/45">High priority risks</span>
        <Link href="/findings?severity=CRITICAL" className="text-xs text-[#F59E0B] font-medium hover:underline">
          View all →
        </Link>
      </div>
      <div className="space-y-2">
        {findings.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">{f.title}</p>
              {f.resource && (
                <p className="text-2xs text-white/40 font-mono truncate mt-0.5">{f.resource}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <SeverityBadge severity={f.severity} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Widget: Top Repos ─────────────────────────────────────────────────────────

export function TopReposWidget() {
  const { data, loading } = useFetch<Paginated<Repository>>("/repositories?limit=5");
  const repos = data?.items ?? [];

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2 w-20" />
            </div>
            <Skeleton className="w-10 h-6 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!repos.length) {
    return (
      <EmptyState
        icon="⬡"
        title="No repositories yet"
        description="Install the GitHub App to start monitoring repositories"
      />
    );
  }

  return (
    <div className="space-y-2">
      {repos.map((r) => (
        <Link key={r.id} href={`/repositories/${r.id}`}>
          <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer border border-transparent hover:border-white/[0.08]">
            <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.10] text-[#F59E0B] flex items-center justify-center text-sm flex-shrink-0">
              ⬡
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{r.name}</p>
              <p className="text-xs text-white/40 truncate">{r.full_name}</p>
            </div>
            {r.language && (
              <span className="text-xs font-medium text-white/70 bg-white/[0.06] border border-white/[0.10] px-2.5 py-0.5 rounded-full">
                {r.language}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Widget: Recent Scans ──────────────────────────────────────────────────────

export function RecentScansWidget() {
  const { data } = usePoll<Paginated<Scan>>("/scans?limit=5", 15_000);
  const scans = data?.items ?? [];

  if (!scans.length) {
    return <EmptyState icon="🔄" title="No recent scans" description="Trigger a scan to start" />;
  }

  return (
    <div className="space-y-2">
      {scans.map((s) => (
        <div key={s.id} className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-b-0">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">
              {s.repository_name || s.repository_id.slice(0, 8).toUpperCase()}
            </p>
            <p className="text-xs text-white/40">{timeAgo(s.started_at ?? s.created_at)}</p>
          </div>
          <ScanStatusBadge status={s.status} />
        </div>
      ))}
    </div>
  );
}

// ── Widget: Notifications ─────────────────────────────────────────────────────

export function NotificationsWidget() {
  const { data, loading } = useFetch<Paginated<Notification>>("/notifications?limit=5&page_size=5&is_read=false");
  const notifications = (data?.items ?? []).slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
      </div>
    );
  }

  if (!notifications.length) {
    return <EmptyState icon="✅" title="All caught up!" description="No unread notifications" />;
  }

  return (
    <div className="space-y-2">
      {notifications.map((n) => (
        <div key={n.id} className="flex items-start gap-2.5 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] mt-2 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{n.title}</p>
            <p className="text-xs text-white/40">{timeAgo(n.created_at)}</p>
          </div>
          <SeverityBadge severity={n.severity} className="flex-shrink-0 mt-0.5" />
        </div>
      ))}
      <Link href="/notifications">
        <p className="text-xs text-[#F59E0B] font-medium hover:underline mt-2">View all →</p>
      </Link>
    </div>
  );
}

// ── Widget: Quick Actions ─────────────────────────────────────────────────────

export function QuickActionsWidget() {
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const { data: reposData, refetch } = useFetch<Paginated<Repository>>("/repositories?limit=50");
  const repos = reposData?.items ?? [];

  const handleOpenSchedule = () => {
    if (repos.length > 0) {
      setSelectedRepo(repos[0]);
      setScheduleModalOpen(true);
    }
  };

  const actions: Array<{
    label: string;
    href?: string;
    onClick?: () => void;
    icon: string;
    color: string;
  }> = [
    { label: "Add Repository",   href: "/repositories",   icon: "+",  color: "bg-white text-[#090D11] hover:bg-white/90 font-medium shadow-sm" },
    { label: "Schedule Scans",   onClick: handleOpenSchedule, icon: "⏱️", color: "bg-white/[0.04] text-white/85 hover:bg-white/[0.08] border border-white/[0.10]" },
    { label: "View Findings",    href: "/findings",        icon: "🔍", color: "bg-white/[0.04] text-white/85 hover:bg-white/[0.08] border border-white/[0.10]" },
    { label: "Run AI Actions",   href: "/actions",         icon: "⚡", color: "bg-white/[0.04] text-white/85 hover:bg-white/[0.08] border border-white/[0.10]" },
    { label: "Notifications",    href: "/notifications",   icon: "🔔", color: "bg-white/[0.04] text-white/85 hover:bg-white/[0.08] border border-white/[0.10]" },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => {
          const content = (
            <div
              className={`flex items-center gap-2 px-3 py-2.5 rounded-[12px] text-sm font-medium cursor-pointer ${a.color} transition-all`}
            >
              <span>{a.icon}</span>
              <span className="text-xs">{a.label}</span>
            </div>
          );

          if (a.href) {
            return (
              <Link key={a.label} href={a.href}>
                {content}
              </Link>
            );
          }

          return (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className="text-left w-full cursor-pointer"
            >
              {content}
            </button>
          );
        })}
      </div>

      {scheduleModalOpen && selectedRepo && (
        <ScheduleScanModal
          isOpen={scheduleModalOpen}
          onClose={() => {
            setScheduleModalOpen(false);
            setSelectedRepo(null);
          }}
          repository={selectedRepo}
          repositories={repos}
          onSelectRepository={(r) => setSelectedRepo(r)}
          onScheduleUpdated={() => {
            refetch();
          }}
        />
      )}
    </>
  );
}

// ── Widget: Activity Feed ─────────────────────────────────────────────────────

export function ActivityFeedWidget() {
  const { data, loading } = useFetch<Paginated<Scan>>("/scans?limit=6");
  const scans = data?.items ?? [];

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!scans.length) {
    return <EmptyState icon="📋" title="No recent activity" />;
  }

  return (
    <div className="relative space-y-3">
      <div className="absolute left-3 top-2 bottom-2 w-px bg-white/[0.08]" />
      {scans.map((s) => (
        <div key={s.id} className="flex items-start gap-3 pl-1 relative">
          <div
            className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs flex-shrink-0 z-10 ${
              s.status === "COMPLETED" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
              s.status === "FAILED"    ? "border-rose-500/30 bg-rose-500/10 text-rose-400" :
              s.status === "RUNNING"   ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
              "border-white/[0.12] bg-white/[0.05] text-white/60"
            }`}
          >
            {s.status === "COMPLETED" ? "✓" : s.status === "FAILED" ? "✗" : "…"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white">
              Scan {s.status.toLowerCase()}
            </p>
            <p className="text-xs text-white/40">{timeAgo(s.started_at ?? s.created_at)}</p>
          </div>
          <ScanStatusBadge status={s.status} />
        </div>
      ))}
    </div>
  );
}
