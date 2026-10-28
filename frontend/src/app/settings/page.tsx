/**
 * /settings — Comprehensive Settings & Mission Control Hub.
 * Manages Profile, Health Scoring Weights Engine, AI Automation Policies,
 * Notifications, GitHub App Integration, and Appearance/Widgets.
 */

"use client";

export const dynamic = "force-dynamic";

import { useSession, signOut } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MotionCard } from "@/components/ui/MotionCard";
import { Button } from "@/components/ui/Button";
import { Skeleton, ErrorState } from "@/components/ui/Spinner";
import { useFetch } from "@/lib/hooks";
import { api } from "@/lib/api";
import { useWidgetController } from "@/components/widgets/controller";
import type { ScoringConfiguration, Installation, Repository } from "@/lib/types";

// ── Notification Types ────────────────────────────────────────────────────

interface NotificationPreference {
  critical_finding: boolean;
  score_degradation: boolean;
  scan_failed: boolean;
  scan_completed: boolean;
  action_completed: boolean;
  action_failed: boolean;
}

type PrefKey = keyof NotificationPreference;

interface PrefGroup {
  id: string;
  title: string;
  icon: string;
  description: string;
  keys: PrefKey[];
}

const PREF_GROUPS: PrefGroup[] = [
  {
    id: "security",
    title: "Security & Vulnerability Alerts",
    icon: "🛡️",
    description: "High-priority alerts for critical vulnerabilities and secrets",
    keys: ["critical_finding"],
  },
  {
    id: "drift",
    title: "Health Score Drift",
    icon: "📉",
    description: "Notifications when repository health scores degrade suddenly",
    keys: ["score_degradation"],
  },
  {
    id: "scans",
    title: "Automated Scan Lifecycle",
    icon: "⏱️",
    description: "Status updates when automated scans complete or encounter errors",
    keys: ["scan_completed", "scan_failed"],
  },
  {
    id: "ai_actions",
    title: "AI Remediation Actions",
    icon: "⚡",
    description: "Notifications when automated pull requests are opened or fail",
    keys: ["action_completed", "action_failed"],
  },
];

const PREF_LABELS: Record<PrefKey, { label: string; description: string }> = {
  critical_finding: {
    label: "Critical Findings Detected",
    description: "Triggered immediately when leaked secrets or critical CVEs are detected",
  },
  score_degradation: {
    label: "Score Degradation (10+ pts)",
    description: "Triggered when a repository health score drops by 10 points or more",
  },
  scan_completed: {
    label: "Scan Finished Successfully",
    description: "Confirmation when a manual or scheduled scan completes successfully",
  },
  scan_failed: {
    label: "Scan Execution Failed",
    description: "Alert when a scan encounters API rate limits, timeouts, or tree fetch errors",
  },
  action_completed: {
    label: "AI Remediation PR Opened",
    description: "Alert when an approved AI remediation action commits code and creates a pull request",
  },
  action_failed: {
    label: "AI Remediation Action Failed",
    description: "Alert when a remediation branch or pull request fails to generate",
  },
};

// ── Tab Navigation Keys ───────────────────────────────────────────────────

type TabKey = "general" | "scoring" | "ai" | "notifications" | "github" | "appearance";

interface TabItem {
  id: TabKey;
  label: string;
  icon: string;
  badge?: string;
}

const SETTINGS_TABS: TabItem[] = [
  { id: "general", label: "General & Profile", icon: "👤" },
  { id: "scoring", label: "Scoring Weights", icon: "⚖️", badge: "Engine" },
  { id: "ai", label: "AI & Automation", icon: "🤖" },
  { id: "notifications", label: "Notifications", icon: "🔔" },
  { id: "github", label: "GitHub App", icon: "🔗" },
  { id: "appearance", label: "Appearance", icon: "🎨" },
];

// ── Default Doc 04 Weights ────────────────────────────────────────────────

const DEFAULT_CATEGORY_WEIGHTS: Record<string, number> = {
  SECURITY: 20.0,
  CODE_QUALITY: 20.0,
  DEPENDENCIES: 15.0,
  DOCUMENTATION: 10.0,
  ISSUES: 10.0,
  PULL_REQUESTS: 10.0,
  ACTIVITY: 10.0,
  CONFIGURATION: 5.0,
};

const CATEGORY_META: Record<
  string,
  { label: string; icon: string; desc: string; color: string }
> = {
  SECURITY: {
    label: "Security",
    icon: "🛡️",
    desc: "Secrets, private keys, Dependabot, and responsible disclosure policies",
    color: "from-red-500 to-rose-600",
  },
  CODE_QUALITY: {
    label: "Code Quality",
    icon: "🧪",
    desc: "CI/CD execution pass rate, automated test suites, and linter configs",
    color: "from-amber-500 to-yellow-600",
  },
  DEPENDENCIES: {
    label: "Dependencies",
    icon: "📦",
    desc: "Package manifests, committed lockfiles, and active CVE vulnerability alerts",
    color: "from-emerald-500 to-teal-600",
  },
  DOCUMENTATION: {
    label: "Documentation",
    icon: "📄",
    desc: "README depth, open-source licensing, contributing guidelines, and code of conduct",
    color: "from-blue-500 to-indigo-600",
  },
  ISSUES: {
    label: "Issues",
    icon: "🐛",
    desc: "Triage turnaround velocity, stale issue ratios, and scale-aware backlog volume",
    color: "from-purple-500 to-violet-600",
  },
  PULL_REQUESTS: {
    label: "Pull Requests",
    icon: "🔀",
    desc: "PR review throughput, merge latency, stale non-draft PRs, and review capacity",
    color: "from-fuchsia-500 to-pink-600",
  },
  ACTIVITY: {
    label: "Activity",
    icon: "📈",
    desc: "Commit recency, push frequency in 30 days, and active contributor momentum",
    color: "from-cyan-500 to-blue-600",
  },
  CONFIGURATION: {
    label: "Configuration",
    icon: "⚙️",
    desc: "Default branch protection, peer code review enforcement, and repository metadata",
    color: "from-slate-400 to-gray-600",
  },
};

// ── Reusable Toggle Component ─────────────────────────────────────────────

function Toggle({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      type="button"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => !disabled && onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
        disabled
          ? "opacity-50 cursor-not-allowed bg-gray-700"
          : enabled
          ? "bg-brand-500"
          : "bg-gray-700/80"
      }`}
    >
      <motion.span
        layout
        className="inline-block w-4 h-4 rounded-full bg-white shadow-sm"
        animate={{ x: enabled ? 24 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
      />
    </button>
  );
}

// ── Settings Page Inner Component ─────────────────────────────────────────

function SettingsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active Tab state
  const tabParam = searchParams.get("tab") as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(tabParam || "general");

  // Keep tab in sync with URL without full page reload
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  };

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  // ── Notification State ──────────────────────────────────────────────────
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<NotificationPreference | null>(null);

  const { data: prefs, loading: loadingPrefs, error: prefsError } =
    useFetch<NotificationPreference>("/notifications/preferences");

  useEffect(() => {
    if (prefs && !localPrefs) {
      setLocalPrefs(prefs);
    }
  }, [prefs, localPrefs]);

  const togglePref = useCallback((key: PrefKey) => {
    setLocalPrefs((p) => (p ? { ...p, [key]: !p[key] } : p));
  }, []);

  const setAllPrefs = useCallback((enabled: boolean) => {
    setLocalPrefs((p) => {
      if (!p) return p;
      const updated = { ...p };
      for (const k of Object.keys(updated) as PrefKey[]) {
        updated[k] = enabled;
      }
      return updated;
    });
  }, []);

  const savePreferences = useCallback(async () => {
    if (!localPrefs) return;
    setSavingPrefs(true);
    try {
      await api.put("/notifications/preferences", localPrefs);
      setSavedPrefs(true);
      setTimeout(() => setSavedPrefs(false), 3000);
    } finally {
      setSavingPrefs(false);
    }
  }, [localPrefs]);

  // ── Scoring Configuration State ─────────────────────────────────────────
  const [scoringWeights, setScoringWeights] = useState<Record<string, number>>(DEFAULT_CATEGORY_WEIGHTS);
  const [configVersion, setConfigVersion] = useState<number>(1);
  const [savingScoring, setSavingScoring] = useState(false);
  const [savedScoring, setSavedScoring] = useState(false);
  const [scoringError, setScoringError] = useState<string | null>(null);

  const { data: scoringConfig, loading: loadingScoring } =
    useFetch<ScoringConfiguration>("/workspaces/scoring-config");

  useEffect(() => {
    if (scoringConfig?.weights) {
      setScoringWeights(scoringConfig.weights);
      setConfigVersion(scoringConfig.version);
    }
  }, [scoringConfig]);

  const totalWeightSum = useMemo(() => {
    const sum = Object.values(scoringWeights).reduce((a, b) => a + Number(b || 0), 0);
    return Math.round(sum * 10) / 10;
  }, [scoringWeights]);

  const isWeightValid = useMemo(() => {
    return Math.abs(totalWeightSum - 100.0) < 0.05;
  }, [totalWeightSum]);

  const handleWeightChange = (category: string, value: number) => {
    setScoringWeights((prev) => ({
      ...prev,
      [category]: Math.max(0, Math.min(100, Math.round(value * 10) / 10)),
    }));
  };

  const handleAutoNormalize = () => {
    const currentSum = Object.values(scoringWeights).reduce((a, b) => a + Number(b || 0), 0);
    if (currentSum <= 0) {
      setScoringWeights(DEFAULT_CATEGORY_WEIGHTS);
      return;
    }
    const normalized: Record<string, number> = {};
    let cumulative = 0;
    const entries = Object.entries(scoringWeights);
    entries.forEach(([cat, val], idx) => {
      if (idx === entries.length - 1) {
        normalized[cat] = Math.max(0, Math.round((100.0 - cumulative) * 10) / 10);
      } else {
        const share = Math.round(((val / currentSum) * 100.0) * 10) / 10;
        normalized[cat] = share;
        cumulative += share;
      }
    });
    setScoringWeights(normalized);
  };

  const handleResetScoringDefaults = () => {
    setScoringWeights(DEFAULT_CATEGORY_WEIGHTS);
  };

  const saveScoringConfig = async () => {
    if (!isWeightValid) {
      setScoringError(`Category weights must sum to exactly 100.0% (currently ${totalWeightSum}%).`);
      return;
    }
    setSavingScoring(true);
    setScoringError(null);
    try {
      const res = await api.post<ScoringConfiguration>("/workspaces/scoring-config", {
        name: `Workspace Weights v${configVersion + 1}`,
        weights: scoringWeights,
      });
      setConfigVersion(res.version);
      setSavedScoring(true);
      setTimeout(() => setSavedScoring(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update scoring configuration";
      setScoringError(msg);
    } finally {
      setSavingScoring(false);
    }
  };

  // ── GitHub Installations & Discovery ────────────────────────────────────
  const { data: installations, loading: loadingInst, refetch: refetchInstallations } =
    useFetch<Installation[]>("/installations");
  const [syncingRepos, setSyncingRepos] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSyncRepositories = async () => {
    setSyncingRepos(true);
    setSyncResult(null);
    try {
      const res = await api.post<{ installations_synced: number; repositories_synced: number }>(
        "/installations/discover",
        {}
      );
      setSyncResult(
        `Successfully synced ${res.repositories_synced} repositories across ${res.installations_synced} installation(s)!`
      );
      await refetchInstallations();
      setTimeout(() => setSyncResult(null), 5000);
    } catch (err: unknown) {
      setSyncResult(err instanceof Error ? err.message : "Failed to sync repositories from GitHub");
    } finally {
      setSyncingRepos(false);
    }
  };

  // ── Repositories for Workspace Stats ────────────────────────────────────
  const { data: repos } = useFetch<Repository[]>("/repositories");

  // ── AI & Automation Settings (Local Policy) ─────────────────────────────
  const [aiMode, setAiMode] = useState<"manual" | "semi_auto">("manual");
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(80);
  const [savedAiPolicy, setSavedAiPolicy] = useState(false);

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("gh_health_ai_remediation_mode");
      if (savedMode === "semi_auto" || savedMode === "manual") setAiMode(savedMode);
      const savedThresh = localStorage.getItem("gh_health_ai_confidence_threshold");
      if (savedThresh) setConfidenceThreshold(Number(savedThresh) || 80);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const saveAiPolicy = () => {
    try {
      localStorage.setItem("gh_health_ai_remediation_mode", aiMode);
      localStorage.setItem("gh_health_ai_confidence_threshold", String(confidenceThreshold));
      setSavedAiPolicy(true);
      setTimeout(() => setSavedAiPolicy(false), 3000);
    } catch {
      // Ignore localStorage errors
    }
  };

  // ── Appearance & Widgets Controller ─────────────────────────────────────
  const widgetCtrl = useWidgetController();
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("dark");
  const [userTz, setUserTz] = useState<string>("UTC");

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setUserTz(tz);
      const savedTheme = localStorage.getItem("gh_health_theme_mode") as "light" | "dark" | "system" | null;
      if (savedTheme) setThemeMode(savedTheme);
    } catch {
      // Ignore
    }
  }, []);

  const handleSetTheme = (mode: "light" | "dark" | "system") => {
    setThemeMode(mode);
    try {
      localStorage.setItem("gh_health_theme_mode", mode);
      const root = document.documentElement;
      let isDark = mode === "dark";
      if (mode === "system") {
        isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
      if (isDark) {
        root.classList.add("dark");
        root.classList.remove("light");
        root.style.colorScheme = "dark";
      } else {
        root.classList.remove("dark");
        root.classList.add("light");
        root.style.colorScheme = "light";
      }
      window.dispatchEvent(new CustomEvent("gh_health_theme_changed", { detail: mode }));
    } catch {
      // Ignore
    }
  };

  if (status === "loading") {
    return (
      <DashboardLayout title="Settings" subtitle="Manage your preferences">
        <div className="space-y-4 max-w-4xl">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </DashboardLayout>
    );
  }

  // Derive user display attributes safely
  const userLogin = (session?.user as { login?: string })?.login || (session as { login?: string })?.login;
  const userEmail = session?.user?.email || (userLogin ? `${userLogin}@users.noreply.github.com` : "Connected via OAuth");
  const userName = session?.user?.name || userLogin || "GitHub User";

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Workspace configuration, scoring rules, AI policies, and alerts"
    >
      <div className="space-y-6 max-w-5xl">
        {/* ── Sub-navigation Tabs ─────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 p-1.5 bg-[#0F171E]/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-x-auto scrollbar-none">
          {SETTINGS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 select-none whitespace-nowrap ${
                  isActive
                    ? "text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="settings-tab-active-pill"
                    className="absolute inset-0 bg-brand-500/20 border border-brand-500/40 rounded-xl"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 text-sm">{tab.icon}</span>
                <span className="relative z-10">{tab.label}</span>
                {tab.badge && (
                  <span className="relative z-10 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-brand-500/30 text-brand-300 border border-brand-500/30">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Panels ─────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 1: GENERAL & PROFILE                                        */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "general" && (
            <motion.div
              key="general"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Profile Card */}
              <MotionCard className="p-7">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-5">
                    {session?.user?.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={session.user.image}
                        alt="Avatar"
                        className="w-16 h-16 rounded-2xl border-2 border-brand-400/40 object-cover shadow-lg"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-brand flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                        {userName[0]?.toUpperCase() ?? "U"}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-xl font-bold text-white">{userName}</h2>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          👑 Workspace Owner
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                        <span>{userEmail}</span>
                        {userLogin && (
                          <a
                            href={`https://github.com/${userLogin}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                          >
                            @{userLogin} ↗
                          </a>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-2">
                        <span>Authentication: GitHub OAuth (HMAC-SHA256 Token)</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
                    >
                      Sign Out
                    </Button>
                  </div>
                </div>
              </MotionCard>

              {/* Workspace Snapshot Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MotionCard className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Monitored Repos
                    </span>
                    <span className="text-lg">📁</span>
                  </div>
                  <p className="text-2xl font-extrabold text-white mt-2">
                    {repos?.length ?? "..."}
                  </p>
                  <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <span>●</span> Real-time monitoring active
                  </p>
                </MotionCard>

                <MotionCard className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Scoring Engine
                    </span>
                    <span className="text-lg">⚖️</span>
                  </div>
                  <p className="text-2xl font-extrabold text-white mt-2">
                    v{configVersion}
                  </p>
                  <p className="text-xs text-brand-300 mt-1">Doc 04 Deterministic formula</p>
                </MotionCard>

                <MotionCard className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      AI Provider
                    </span>
                    <span className="text-lg">🤖</span>
                  </div>
                  <p className="text-xl font-bold text-white mt-2 truncate">
                    Gemini 2.5 Flash
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Groq fail-safe fallback</p>
                </MotionCard>

                <MotionCard className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      GitHub App
                    </span>
                    <span className="text-lg">🔗</span>
                  </div>
                  <p className="text-xl font-bold text-white mt-2">
                    {installations && installations.length > 0 ? "Connected" : "Linked"}
                  </p>
                  <p className="text-xs text-emerald-400 mt-1">Webhook Verified</p>
                </MotionCard>
              </div>

              {/* Workspace Identity Details */}
              <MotionCard className="p-6">
                <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                  Workspace Environment
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                    <p className="text-gray-400">Workspace Identifier</p>
                    <p className="font-mono text-gray-200 text-xs truncate">
                      {session?.user?.id ? `ws-${session.user.id.slice(0, 8)}` : "default-workspace"}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                    <p className="text-gray-400">Timezone Context</p>
                    <p className="font-mono text-gray-200 text-xs">
                      {userTz} (Local Browser)
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                    <p className="text-gray-400">Audit Trail Logging</p>
                    <p className="text-emerald-400 font-semibold">
                      ✓ Active (Security, Scans & Remediation PRs)
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                    <p className="text-gray-400">Data Retention & Privacy</p>
                    <p className="text-gray-300">
                      AST structure stored locally. No raw code retained.
                    </p>
                  </div>
                </div>
              </MotionCard>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 2: SCORING ENGINE WEIGHTS                                  */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "scoring" && (
            <motion.div
              key="scoring"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <MotionCard className="p-6">
                <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-base font-bold text-white">
                        Health Scoring Engine Weights
                      </h2>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                        Version {configVersion}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 max-w-xl">
                      Customize how much each category impacts overall repository health scores.
                      Weights are versioned and immutable so past historical scores remain 100% reproducible.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetScoringDefaults}
                      className="text-xs text-gray-300 hover:text-white border border-white/[0.10]"
                    >
                      ↺ Defaults
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleAutoNormalize}
                      className="text-xs text-brand-300 hover:text-brand-200 border border-brand-500/30 bg-brand-500/10"
                    >
                      ⚖️ Auto-Normalize
                    </Button>
                  </div>
                </div>

                {/* Real-time Weight Sum Validation Bar */}
                <div className={`p-4 rounded-2xl border mb-6 transition-colors duration-200 ${
                  isWeightValid
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                }`}>
                  <div className="flex items-center justify-between text-xs font-semibold mb-2">
                    <span className="flex items-center gap-2">
                      {isWeightValid ? "✓ Total Category Weights:" : "⚠️ Total Weights Must Equal 100%:"}
                      <span className="text-sm font-bold font-mono">{totalWeightSum}%</span>
                    </span>
                    <span className="text-[11px] opacity-80">
                      {isWeightValid ? "Ready to save" : `Difference: ${Math.round((100 - totalWeightSum) * 10) / 10}%`}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden flex">
                    {Object.keys(DEFAULT_CATEGORY_WEIGHTS).map((cat) => {
                      const val = scoringWeights[cat] || 0;
                      if (val <= 0) return null;
                      return (
                        <div
                          key={cat}
                          style={{ width: `${val}%` }}
                          title={`${cat}: ${val}%`}
                          className={`h-full bg-gradient-to-r ${CATEGORY_META[cat]?.color || "from-gray-500 to-gray-600"}`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Scoring Error Message */}
                {scoringError && (
                  <div className="p-3 mb-5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                    {scoringError}
                  </div>
                )}

                {/* Category Sliders Grid */}
                {loadingScoring ? (
                  <div className="space-y-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 rounded-2xl" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.keys(DEFAULT_CATEGORY_WEIGHTS).map((catKey) => {
                      const meta = CATEGORY_META[catKey] || {
                        label: catKey,
                        icon: "📌",
                        desc: "",
                        color: "from-gray-500 to-gray-600",
                      };
                      const weightVal = scoringWeights[catKey] ?? DEFAULT_CATEGORY_WEIGHTS[catKey];

                      return (
                        <div
                          key={catKey}
                          className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.15] transition-all"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{meta.icon}</span>
                              <span className="text-xs font-bold text-white tracking-wide">
                                {meta.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={weightVal}
                                onChange={(e) =>
                                  handleWeightChange(catKey, parseFloat(e.target.value) || 0)
                                }
                                className="w-14 px-2 py-0.5 rounded-lg bg-black/40 border border-white/[0.12] text-xs font-mono font-bold text-right text-white focus:outline-none focus:border-brand-400"
                              />
                              <span className="text-xs font-mono text-gray-400">%</span>
                            </div>
                          </div>

                          <p className="text-[11px] text-gray-400 line-clamp-1 mb-3">
                            {meta.desc}
                          </p>

                          {/* Slider */}
                          <input
                            type="range"
                            min={0}
                            max={50}
                            step={0.5}
                            value={weightVal}
                            onChange={(e) =>
                              handleWeightChange(catKey, parseFloat(e.target.value) || 0)
                            }
                            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-700/80 accent-brand-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Save Footer */}
                <div className="pt-6 mt-6 border-t border-white/[0.08] flex items-center justify-between flex-wrap gap-4">
                  <div className="text-xs text-gray-400">
                    Changes apply immediately to newly executed repository scans.
                  </div>
                  <div className="flex items-center gap-3">
                    {savedScoring && (
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                        ✓ Configuration saved as v{configVersion}!
                      </span>
                    )}
                    <Button
                      variant="primary"
                      size="md"
                      loading={savingScoring}
                      disabled={!isWeightValid}
                      onClick={saveScoringConfig}
                    >
                      Save Scoring Weights
                    </Button>
                  </div>
                </div>
              </MotionCard>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 3: AI ENGINE & AUTOMATION POLICIES                         */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "ai" && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* AI Architecture & Privacy Card */}
              <MotionCard className="p-6">
                <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                  <span>🤖</span> AI Intelligence Provider & Model Context
                </h2>
                <p className="text-xs text-gray-400 mb-6">
                  The health monitor uses high-velocity LLMs to summarize risks, detect full-stack architectures,
                  and generate precision remediation pull requests.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      Primary Model
                    </p>
                    <p className="text-sm font-bold text-white mt-1">
                      Gemini 2.5 Flash
                    </p>
                    <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                      <span>●</span> Google GenAI Active
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      Fail-Safe Fallback
                    </p>
                    <p className="text-sm font-bold text-white mt-1">
                      Groq Llama 3.3 70B
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Automatic rate-limit switch
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      Prompt Schema
                    </p>
                    <p className="text-sm font-bold text-white mt-1">
                      v1.0.0 Sanitized AST
                    </p>
                    <p className="text-[11px] text-indigo-400 mt-1">
                      Zero credentials leak policy
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-200">
                  <p className="font-semibold text-indigo-100 mb-1 flex items-center gap-1.5">
                    <span>🔒</span> Zero Source Code Exposure Guarantee
                  </p>
                  <p className="text-[11px] opacity-85 leading-relaxed">
                    The health monitor NEVER transmits raw private source code files, environment variables, or secrets
                    to external AI APIs. Only sanitized AST structures, dependency manifest versions, and metric counters
                    are sent to maintain complete privacy and compliance.
                  </p>
                </div>
              </MotionCard>

              {/* Remediation Execution Policy */}
              <MotionCard className="p-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
                  Remediation Automation Policy
                </h3>
                <p className="text-xs text-gray-400 mb-5">
                  Control how AI-generated fixes (e.g. adding missing SECURITY.md or Dependabot workflows) are applied to your code repositories.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Option 1: Manual */}
                  <div
                    onClick={() => setAiMode("manual")}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                      aiMode === "manual"
                        ? "bg-brand-500/10 border-brand-500/50 shadow-md ring-1 ring-brand-500/30"
                        : "bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white flex items-center gap-2">
                        <span>🛡️</span> Manual Approval Required
                      </span>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        aiMode === "manual" ? "border-brand-400 bg-brand-500" : "border-gray-600"
                      }`}>
                        {aiMode === "manual" && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      All AI recommendations require an engineer to review and click &ldquo;Approve &amp; Open PR&rdquo;.
                      Zero automated branches are created without explicit confirmation.
                    </p>
                    <span className="inline-block mt-3 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      Recommended for Production
                    </span>
                  </div>

                  {/* Option 2: Semi-Autonomous */}
                  <div
                    onClick={() => setAiMode("semi_auto")}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                      aiMode === "semi_auto"
                        ? "bg-brand-500/10 border-brand-500/50 shadow-md ring-1 ring-brand-500/30"
                        : "bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white flex items-center gap-2">
                        <span>⚡</span> Semi-Autonomous Fixes
                      </span>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        aiMode === "semi_auto" ? "border-brand-400 bg-brand-500" : "border-gray-600"
                      }`}>
                        {aiMode === "semi_auto" && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Automatically creates remediation branches and opens draft Pull Requests on GitHub for verified low-risk standard fixes (SECURITY.md, dependabot.yml, .gitignore).
                    </p>
                    <span className="inline-block mt-3 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      Draft PRs Only (Never Merged Directly)
                    </span>
                  </div>
                </div>

                {/* Confidence Threshold */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">
                      Minimum AI Confidence Threshold
                    </span>
                    <span className="font-mono font-bold text-brand-300">
                      {confidenceThreshold}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={95}
                    step={5}
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-700/80 accent-brand-500"
                  />
                  <p className="text-[11px] text-gray-400">
                    Remediation recommendations below this confidence rating will be discarded to prevent false suggestions.
                  </p>
                </div>

                <div className="pt-5 mt-5 border-t border-white/[0.08] flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    Policy is persisted for the current workspace.
                  </span>
                  <div className="flex items-center gap-3">
                    {savedAiPolicy && (
                      <span className="text-xs font-semibold text-emerald-400">
                        ✓ AI policy updated!
                      </span>
                    )}
                    <Button variant="primary" size="md" onClick={saveAiPolicy}>
                      Save AI Policies
                    </Button>
                  </div>
                </div>
              </MotionCard>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 4: NOTIFICATIONS & ALERTS                                  */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "notifications" && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <MotionCard className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                  <div>
                    <h2 className="text-base font-bold text-white">
                      Alert Dispatch Rules
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Configure which events dispatch in-app notifications and real-time alerts.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAllPrefs(true)}
                      className="text-xs text-gray-300 hover:text-white border border-white/[0.10]"
                    >
                      Enable All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAllPrefs(false)}
                      className="text-xs text-gray-300 hover:text-white border border-white/[0.10]"
                    >
                      Disable All
                    </Button>
                  </div>
                </div>

                {prefsError ? (
                  <ErrorState message={prefsError} />
                ) : loadingPrefs || !localPrefs ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-2xl" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {PREF_GROUPS.map((group) => (
                      <div
                        key={group.id}
                        className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-4"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{group.icon}</span>
                          <div>
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                              {group.title}
                            </h3>
                            <p className="text-[11px] text-gray-400">{group.description}</p>
                          </div>
                        </div>

                        <div className="space-y-3 pt-2">
                          {group.keys.map((key) => (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-4 p-3 rounded-xl bg-black/20 border border-white/[0.04]"
                            >
                              <div>
                                <p className="text-xs font-medium text-white">
                                  {PREF_LABELS[key]?.label || key}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  {PREF_LABELS[key]?.description}
                                </p>
                              </div>
                              <Toggle
                                enabled={localPrefs[key]}
                                onChange={() => togglePref(key)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-6 mt-6 border-t border-white/[0.08] flex items-center justify-between flex-wrap gap-4">
                  <span className="text-xs text-gray-400">
                    Preferences are synced to your user profile in real-time.
                  </span>
                  <div className="flex items-center gap-3">
                    {savedPrefs && (
                      <span className="text-xs font-semibold text-emerald-400">
                        ✓ Notification preferences saved!
                      </span>
                    )}
                    <Button
                      variant="primary"
                      size="md"
                      loading={savingPrefs}
                      onClick={savePreferences}
                    >
                      Save Preferences
                    </Button>
                  </div>
                </div>
              </MotionCard>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 5: GITHUB INTEGRATION                                      */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "github" && (
            <motion.div
              key="github"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <MotionCard className="p-6">
                <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <span>🔗</span> Connected GitHub App Installation
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Health Monitor integrates via an authorized GitHub App installation to securely fetch repo metadata and open remediation PRs.
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    loading={syncingRepos}
                    onClick={handleSyncRepositories}
                    className="text-xs"
                  >
                    🔄 Re-sync Repositories
                  </Button>
                </div>

                {syncResult && (
                  <div className="p-3 mb-5 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs">
                    {syncResult}
                  </div>
                )}

                {loadingInst ? (
                  <Skeleton className="h-32 rounded-2xl" />
                ) : installations && installations.length > 0 ? (
                  <div className="space-y-4">
                    {installations.map((inst) => (
                      <div
                        key={inst.id}
                        className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between flex-wrap gap-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-xl font-bold text-white">
                            🐙
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-white">
                                @{inst.github_account_login}
                              </h3>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                {inst.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5 font-mono">
                              Installation ID: #{inst.github_installation_id} • Type: {inst.account_type}
                            </p>
                          </div>
                        </div>

                        <a
                          href={`https://github.com/settings/installations/${inst.github_installation_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-gray-200 bg-white/[0.05] hover:bg-white/[0.10] border border-white/[0.12] transition-colors"
                        >
                          Manage on GitHub ↗
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                    <p className="text-sm font-semibold text-gray-200">
                      No GitHub App installation found in database.
                    </p>
                    <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                      Click the Re-sync button above to automatically discover and link installations matching your GitHub account.
                    </p>
                  </div>
                )}

                {/* Granted Permissions Checklist */}
                <div className="mt-6 pt-6 border-t border-white/[0.08]">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">
                    Active GitHub App Permissions
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    {[
                      { name: "Repository Contents", access: "Read", desc: "File trees, manifests, READMEs" },
                      { name: "Pull Requests", access: "Read & Write", desc: "PR stats & automated fixes" },
                      { name: "Issues & Discussions", access: "Read", desc: "Ticket backlog age analysis" },
                      { name: "Actions & Workflows", access: "Read", desc: "CI run pass rate checking" },
                      { name: "Dependabot Alerts", access: "Read", desc: "Security vulnerability detection" },
                      { name: "Webhook Events", access: "Subscribed", desc: "Real-time push & PR updates" },
                    ].map((perm) => (
                      <div
                        key={perm.name}
                        className="p-3.5 rounded-xl bg-black/20 border border-white/[0.04]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{perm.name}</span>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold">
                            {perm.access}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">{perm.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </MotionCard>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 6: APPEARANCE & WIDGETS                                    */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "appearance" && (
            <motion.div
              key="appearance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Theme Preference */}
              <MotionCard className="p-6">
                <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                  <span>🎨</span> Theme & Interface Style
                </h2>
                <p className="text-xs text-gray-400 mb-5">
                  Select your visual theme preference for dashboard charts, metrics, and navigation.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { id: "dark", label: "Dark Mode", icon: "🌙", desc: "Deep space aesthetic (Default)" },
                    { id: "light", label: "Bright Mode", icon: "☀️", desc: "Crisp light background" },
                    { id: "system", label: "System Sync", icon: "💻", desc: "Matches operating system" },
                  ].map((t) => (
                    <div
                      key={t.id}
                      onClick={() => handleSetTheme(t.id as "light" | "dark" | "system")}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        themeMode === t.id
                          ? "bg-brand-500/10 border-brand-500/50 shadow-md ring-1 ring-brand-500/30"
                          : "bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{t.icon}</span> {t.label}
                        </span>
                        {themeMode === t.id && (
                          <span className="text-xs text-brand-400 font-bold">✓</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{t.desc}</p>
                    </div>
                  ))}
                </div>
              </MotionCard>

              {/* Floating Widgets Controller */}
              <MotionCard className="p-6">
                <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Floating Desktop Widgets
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Toggle draggable desktop utility widgets (System Clock &amp; Theme Switcher).
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => widgetCtrl.resetAllPositions()}
                    className="text-xs text-gray-300 hover:text-white border border-white/[0.10]"
                  >
                    ↺ Reset Widget Positions
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                    <div>
                      <p className="text-xs font-bold text-white">Enable All Floating Widgets</p>
                      <p className="text-[11px] text-gray-400">
                        Master switch controlling visibility of draggable accessories
                      </p>
                    </div>
                    <Toggle
                      enabled={widgetCtrl.settings.masterEnabled}
                      onChange={(val) => widgetCtrl.setMasterEnabled(val)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                    <div>
                      <p className="text-xs font-bold text-white">🕒 System Clock Widget</p>
                      <p className="text-[11px] text-gray-400">
                        Draggable clock with UTC/local time conversion &amp; timezone explorer
                      </p>
                    </div>
                    <Toggle
                      enabled={widgetCtrl.isWidgetVisible("clock")}
                      disabled={!widgetCtrl.settings.masterEnabled}
                      onChange={(val) => widgetCtrl.setWidgetVisible("clock", val)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                    <div>
                      <p className="text-xs font-bold text-white">🌓 Theme Switcher Widget</p>
                      <p className="text-[11px] text-gray-400">
                        Draggable floating toggle for quick bright/dark mode transitions
                      </p>
                    </div>
                    <Toggle
                      enabled={widgetCtrl.isWidgetVisible("themeToggle")}
                      disabled={!widgetCtrl.settings.masterEnabled}
                      onChange={(val) => widgetCtrl.setWidgetVisible("themeToggle", val)}
                    />
                  </div>
                </div>
              </MotionCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout title="Settings" subtitle="Loading preferences...">
          <div className="p-8">
            <Skeleton className="h-64 rounded-3xl" />
          </div>
        </DashboardLayout>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
