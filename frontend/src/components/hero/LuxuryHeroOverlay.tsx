"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { useFetch } from "@/lib/hooks";
import type { Repository, Paginated, Finding, AIAction } from "@/lib/types";

/**
 * LuxuryHeroOverlay
 * Modern, luxury glassmorphic foreground Hero UI overlay and loading sequence.
 * Fully synchronized with live application data (repositories, health scores, schedules, alerts).
 * Sits at z-index: 10 directly on top of the background video canvas.
 */
export function LuxuryHeroOverlay() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  // ── Live Application Telemetry Synchronization ─────────────────────────────
  // Fetch actual repositories when authenticated
  const { data: reposData, loading: reposLoading } = useFetch<Paginated<Repository>>(
    isAuthenticated ? "/repositories?limit=50" : null
  );
  const repos = useMemo(() => reposData?.items ?? [], [reposData]);

  // Active repository state for multi-repo workspace inspection
  const [activeRepoIndex, setActiveRepoIndex] = useState(0);
  const safeIndex = Math.min(activeRepoIndex, Math.max(0, repos.length - 1));
  const activeRepo = repos[safeIndex] || null;

  // Fetch real critical findings count
  const findingsPath = isAuthenticated
    ? (activeRepo ? `/findings?repository_id=${activeRepo.id}&severity=CRITICAL&status=OPEN&limit=1` : "/findings?severity=CRITICAL&status=OPEN&limit=1")
    : null;
  const { data: findingsData } = useFetch<Paginated<Finding>>(findingsPath);
  const criticalCount = findingsData?.total ?? 0;

  // Fetch real pending AI actions count
  const actionsPath = isAuthenticated
    ? (activeRepo ? `/actions?repository_id=${activeRepo.id}&status=PENDING&limit=1` : "/actions?status=PENDING&limit=1")
    : null;
  const { data: actionsData } = useFetch<Paginated<AIAction>>(actionsPath);
  const actionCount = actionsData?.total ?? 0;

  // ── Outer Frame Measurement & Animation Controller ────────────────────────
  const [progress, setProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [frameDimensions, setFrameDimensions] = useState({ width: 0, height: 0 });
  const frameRef = useRef<HTMLDivElement>(null);

  // Measure outer frame to calculate the precision SVG path for perimeter trace
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const updateSize = () => {
      setFrameDimensions({
        width: el.offsetWidth,
        height: el.offsetHeight,
      });
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // State-driven initial page load animation sequence (0% -> 100%)
  const runSequence = () => {
    setProgress(0);
    setIsLoaded(false);

    const startTime = performance.now();
    const duration = 1800; // 1.8s smooth luxury sequence

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const rawProgress = Math.min(1, elapsed / duration);

      // Natural ease-out curve: swift climb through 0-85%, then controlled 85-100%
      const eased = Math.min(
        100,
        rawProgress < 0.75
          ? (rawProgress / 0.75) * 85
          : 85 + ((rawProgress - 0.75) / 0.25) * 15
      );

      setProgress(eased);

      if (rawProgress < 1) {
        requestAnimationFrame(tick);
      } else {
        setProgress(100);
        setIsLoaded(true);
      }
    };

    requestAnimationFrame(tick);
  };

  useEffect(() => {
    runSequence();
  }, []);

  // Frame Draw Progress: 0 at progress <= 90%, scales from 0 to 1 between 90% and 100%
  const frameDrawProgress = useMemo(() => {
    if (progress < 90) return 0;
    return Math.min(1, (progress - 90) / 10);
  }, [progress]);

  // Compute SVG perimeter path starting exactly from Top-Center
  const perimeterPath = useMemo(() => {
    const w = frameDimensions.width;
    const h = frameDimensions.height;
    if (w < 100 || h < 100) return "";

    const inset = 1;
    const r = 31; // 32px radius minus inset
    const x0 = inset;
    const y0 = inset;
    const x1 = w - inset;
    const y1 = h - inset;
    const midX = (x0 + x1) / 2;

    return `
      M ${midX} ${y0}
      L ${x1 - r} ${y0}
      A ${r} ${r} 0 0 1 ${x1} ${y0 + r}
      L ${x1} ${y1 - r}
      A ${r} ${r} 0 0 1 ${x1 - r} ${y1}
      L ${x0 + r} ${y1}
      A ${r} ${r} 0 0 1 ${x0} ${y1 - r}
      L ${x0} ${y0 + r}
      A ${r} ${r} 0 0 1 ${x0 + r} ${y0}
      L ${midX} ${y0}
    `;
  }, [frameDimensions]);

  // Cubic-bezier(0.22, 1, 0.36, 1) transition easing
  const luxuryEase = [0.22, 1, 0.36, 1] as const;

  const revealVariant = {
    hidden: { opacity: 0, y: 16 },
    visible: (customDelay: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        ease: luxuryEase,
        delay: customDelay,
      },
    }),
  };

  // ── Card Data Resolution ──────────────────────────────────────────────────
  const cardTitle = isAuthenticated
    ? (reposLoading
        ? "Loading repositories..."
        : (activeRepo ? activeRepo.name : "No Repositories Connected"))
    : "Connect Repository";

  const cardSubtitle = isAuthenticated
    ? (activeRepo
        ? `${activeRepo.full_name} · ${activeRepo.default_branch || "main"}`
        : "Connect a repository to start monitoring")
    : "Sign in with GitHub to evaluate repository health";

  const cardSchedule = isAuthenticated
    ? (activeRepo?.scan_schedule_enabled
        ? `${activeRepo.scan_schedule_frequency === "DAILY" ? "Daily" : activeRepo.scan_schedule_frequency === "WEEKLY" ? "Weekly" : "Monthly"} ${activeRepo.scan_schedule_time || "02:00"} UTC`
        : (activeRepo ? "On Demand" : "Not Configured"))
    : "Not Configured";

  const cardMonitoring = isAuthenticated
    ? (activeRepo
        ? (activeRepo.is_monitored ? "● Real-time" : "○ Paused")
        : "○ Inactive")
    : "○ Not Connected";

  const isRealtimeActive = Boolean(isAuthenticated && activeRepo?.is_monitored);

  // Score & Band calculations
  const healthScoreObj = activeRepo?.latest_health_score;
  const scoreValue = isAuthenticated && healthScoreObj
    ? Math.round(healthScoreObj.overall_score)
    : "—";

  const scoreBand = isAuthenticated
    ? (healthScoreObj?.score_band || (activeRepo ? "PENDING" : "NO DATA"))
    : "NOT SCANNED";

  const categoriesText = isAuthenticated && healthScoreObj
    ? `${healthScoreObj.categories?.length || 8}/8 categories`
    : "8 categories";

  const bandStyles: Record<string, string> = {
    EXCELLENT: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
    GOOD: "text-blue-400 bg-blue-500/15 border-blue-500/30",
    NEEDS_ATTENTION: "text-amber-400 bg-amber-500/15 border-amber-500/30",
    POOR: "text-orange-400 bg-orange-500/15 border-orange-500/30",
    CRITICAL: "text-red-400 bg-red-500/15 border-red-500/30",
    PENDING: "text-gray-300 bg-white/10 border-white/20",
    "NOT SCANNED": "text-gray-300 bg-white/10 border-white/20",
    "NO DATA": "text-gray-300 bg-white/10 border-white/20",
  };

  return (
    <div
      ref={frameRef}
      className="relative z-10 w-[calc(100vw-64px)] min-h-[calc(100vh-64px)] my-[32px] mx-auto rounded-[32px] border border-white/25 overflow-hidden flex flex-col justify-between p-6 sm:p-8 lg:p-10 select-none"
      style={{
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        boxShadow: "0 20px 80px rgba(0, 0, 0, 0.45)",
      }}
    >
      {/* ── SVG Perimeter Frame Draw Animation (traces from top-center at 90%-100%) ── */}
      {perimeterPath && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none rounded-[32px] overflow-visible"
          style={{ zIndex: 30 }}
        >
          <motion.path
            d={perimeterPath}
            fill="none"
            stroke="rgba(255, 255, 255, 0.75)"
            strokeWidth={1.5}
            strokeLinecap="round"
            pathLength={1}
            style={{
              strokeDasharray: 1,
              strokeDashoffset: 1 - frameDrawProgress,
            }}
          />
        </svg>
      )}

      {/* ── Progress State UI (0% to 99%) ── */}
      <AnimatePresence>
        {!isLoaded && (
          <motion.div
            key="loading-sequence"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 pointer-events-none z-20 p-6 sm:p-12 flex flex-col justify-between"
          >
            {/* Minimal top-left white progress bar (width: 60px, height: 2px) */}
            <div className="w-[60px] h-[2px] bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-75 ease-out"
                style={{ width: `${Math.round(progress)}%` }}
              />
            </div>

            {/* Large bottom-left percentage counter (font-size: 4rem, font-weight: 300) */}
            <div
              className="text-[4rem] font-light leading-none tracking-tight tabular-nums"
              style={{ color: "rgba(255, 255, 255, 0.7)" }}
            >
              {Math.round(progress)}%
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active Luxury UI Reveal (at 100%) ── */}
      <div
        className={`w-full h-full flex flex-col justify-between transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
      >
        {/* 1. Top Navbar */}
        <motion.header
          custom={0.05}
          initial="hidden"
          animate={isLoaded ? "visible" : "hidden"}
          variants={revealVariant}
          className="w-full flex items-center justify-between pb-4"
        >
          {/* Brand Left: App Logo from public folder (/icon.svg) + App Name */}
          <Link href="/" className="flex items-center gap-3 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt="Health Monitor Logo"
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg shadow-sm group-hover:scale-105 transition-transform duration-200"
            />
            <div className="leading-tight">
              <span className="text-white font-bold text-[18px] sm:text-[20px] tracking-tight block">
                Health Monitor
              </span>
              <span className="text-[10px] font-medium text-brand-300 tracking-wider uppercase block opacity-90">
                AI Repository Intelligence
              </span>
            </div>
          </Link>

          {/* Brand Right: Functional Nav Links + Working CTA Button */}
          <div className="flex items-center gap-4 sm:gap-7">
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/#features"
                className="text-[14px] text-white/80 hover:text-white transition-colors duration-200 cursor-pointer"
              >
                Features
              </Link>
              <Link
                href="/repositories"
                className="text-[14px] text-white/80 hover:text-white transition-colors duration-200 cursor-pointer"
              >
                Repositories
              </Link>
              <Link
                href="/dashboard"
                className="text-[14px] text-white/80 hover:text-white transition-colors duration-200 cursor-pointer"
              >
                Dashboard
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[14px] text-white/80 hover:text-white transition-colors duration-200 cursor-pointer flex items-center gap-1"
              >
                <span>GitHub</span>
                <span className="text-xs opacity-70">↗</span>
              </a>
            </nav>

            {/* Working Primary CTA Button */}
            <Link href={isAuthenticated ? "/dashboard" : "/auth/signin"}>
              <button
                type="button"
                className="bg-[#FFFFFF] text-[#111111] rounded-[9999px] px-6 py-2.5 text-[14px] font-semibold hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-sm cursor-pointer whitespace-nowrap"
              >
                {isAuthenticated ? "Dashboard →" : "Get Started"}
              </button>
            </Link>
          </div>
        </motion.header>

        {/* 2. Middle Content Grid: Left Content (60%) + Right Interactive Card (40%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end my-auto py-4 sm:py-6">
          {/* Left Column (60% width -> lg:col-span-7) */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            {/* Left Hero Headline: Stacked display text for this application */}
            <motion.div
              custom={0.2}
              initial="hidden"
              animate={isLoaded ? "visible" : "hidden"}
              variants={revealVariant}
            >
              <h1
                className="leading-[1.05] tracking-[-0.03em] font-normal"
                style={{ fontSize: "clamp(2.75rem, 5.2vw, 5rem)" }}
              >
                <span className="block text-white">GitHub</span>
                <span
                  className="block"
                  style={{ color: "rgba(255, 255, 255, 0.55)" }}
                >
                  Repository
                </span>
                <span className="block text-white">Health Monitor</span>
              </h1>
            </motion.div>

            {/* Bottom-Left Footer Info: Two horizontal blocks */}
            <motion.div
              custom={0.35}
              initial="hidden"
              animate={isLoaded ? "visible" : "hidden"}
              variants={revealVariant}
              className="flex flex-col sm:flex-row items-start sm:items-end gap-6 sm:gap-10 mt-6 sm:mt-8"
            >
              {/* Block 1: Application description paragraph */}
              <p
                className="text-[14px] leading-relaxed max-w-[280px]"
                style={{ color: "rgba(255, 255, 255, 0.75)" }}
              >
                Automated 0–100 health scoring, vulnerability detection, and
                AI-assisted remediation pull requests for all your GitHub
                repositories.
              </p>

              {/* Block 2: Telemetry social proof badge with rise + glow hover */}
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-full border border-transparent hover:border-amber-400/40 hover:bg-amber-500/10 hover:-translate-y-1 transition-all duration-300 cursor-default">
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-amber-500/15 border border-amber-500/30 text-[#F59E0B] shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                  {/* Amber Star SVG */}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="#F59E0B"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-[24px] font-bold text-white leading-none">
                    4.9
                  </div>
                  <div
                    className="text-[13px] leading-tight mt-1"
                    style={{ color: "rgba(255, 255, 255, 0.7)" }}
                  >
                    from 1,200+ repo scans
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column (40% width -> lg:col-span-5): Glassmorphic Repository Card with Rise + Shine Hover */}
          <div className="lg:col-span-5 flex justify-start lg:justify-end">
            <motion.div
              custom={0.5}
              initial="hidden"
              animate={isLoaded ? "visible" : "hidden"}
              variants={revealVariant}
              className="group relative w-full max-w-[380px] rounded-[24px] p-6 sm:p-7 glass-rise-card overflow-hidden"
              style={{
                background: "rgba(15, 23, 30, 0.65)",
                backdropFilter: "blur(40px)",
                WebkitBackdropFilter: "blur(40px)",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                boxShadow: "0 24px 50px rgba(0, 0, 0, 0.45)",
              }}
            >
              {/* Subtle White Gradient Shine / Sheen on Hover */}
              <div className="glass-shine-layer" />
              {/* Card Header: Repository Title + Multi-Repo Switcher + Link */}
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[21px] font-semibold text-white leading-[1.25] truncate">
                      {cardTitle}
                    </h3>
                    {/* Multi-repo pager when user has several repositories */}
                    {repos.length > 1 && (
                      <div className="flex items-center gap-1 text-[11px] font-mono text-white/70 bg-white/10 border border-white/15 px-2 py-0.5 rounded-full flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setActiveRepoIndex((prev) => (prev > 0 ? prev - 1 : repos.length - 1));
                          }}
                          className="hover:text-white px-0.5 cursor-pointer font-bold transition-colors"
                          title="Previous repository"
                        >
                          ‹
                        </button>
                        <span>{safeIndex + 1}/{repos.length}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setActiveRepoIndex((prev) => (prev < repos.length - 1 ? prev + 1 : 0));
                          }}
                          className="hover:text-white px-0.5 cursor-pointer font-bold transition-colors"
                          title="Next repository"
                        >
                          ›
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[12px] text-white/60 mt-0.5 truncate">
                    {cardSubtitle}
                  </p>
                </div>

                <Link
                  href={isAuthenticated ? (activeRepo ? `/repositories/${activeRepo.id}` : "/repositories") : "/auth/signin"}
                  aria-label={isAuthenticated ? (activeRepo ? "View Repository Details" : "View Repositories") : "Sign in with GitHub"}
                  className="w-9 h-9 flex-shrink-0 rounded-full border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors duration-200 cursor-pointer"
                  title={isAuthenticated ? (activeRepo ? `View ${activeRepo.name} details` : "View Repositories") : "Sign in to connect repositories"}
                >
                  {/* Diagonal Arrow Icon */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="7" y1="17" x2="17" y2="7" />
                    <polyline points="7 7 17 7 17 17" />
                  </svg>
                </Link>
              </div>

              {/* Status Row: 2-column grid showing key findings & AI readiness */}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-[10px]"
                  style={{
                    background: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  {/* Shield Security Icon */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={!isAuthenticated ? "#9CA3AF" : (criticalCount > 0 ? "#EF4444" : "#10B981")}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span className="text-[12px] font-medium text-white truncate">
                    {!isAuthenticated
                      ? "Security & CVEs"
                      : (criticalCount > 0
                        ? `${criticalCount} Critical Alert${criticalCount > 1 ? "s" : ""}`
                        : "0 Critical Alerts")}
                  </span>
                </div>

                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-[10px]"
                  style={{
                    background: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  {/* AI Lightning Bolt Icon */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#A78BFA"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span className="text-[12px] font-medium text-white truncate">
                    {!isAuthenticated
                      ? "AI PR Remediation"
                      : (actionCount > 0 ? `${actionCount} AI Fixes Ready` : "AI Fixes Ready")}
                  </span>
                </div>
              </div>

              {/* Metadata Row: 2-column separated by divider */}
              <div className="grid grid-cols-2 py-3 border-y border-white/10 text-[12px] mb-5">
                <div className="pr-2 text-white/70 truncate">
                  Schedule:{" "}
                  <span className="text-white font-medium block sm:inline">
                    {cardSchedule}
                  </span>
                </div>
                <div className="pl-3 border-l border-white/15 text-white/70 truncate">
                  Monitoring:{" "}
                  <span
                    className={`${isRealtimeActive ? "text-emerald-400" : "text-gray-400"
                      } font-medium block sm:inline`}
                  >
                    {cardMonitoring}
                  </span>
                </div>
              </div>

              {/* Health Score & Status Band Row */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-baseline">
                  <span className="text-[26px] font-bold text-white leading-none">
                    {scoreValue}
                  </span>
                  <span
                    className="text-[14px] ml-1.5"
                    style={{ color: "rgba(255, 255, 255, 0.6)" }}
                  >
                    /100
                  </span>
                  <span
                    className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ml-2.5 uppercase tracking-wide ${bandStyles[scoreBand] ?? bandStyles.EXCELLENT
                      }`}
                  >
                    {scoreBand}
                  </span>
                </div>
                <span
                  className="text-[12px] font-mono"
                  style={{ color: "rgba(255, 255, 255, 0.65)" }}
                >
                  {categoriesText}
                </span>
              </div>

              {/* Working Action Button with Glow Sheen + Rise */}
              <Link
                href={isAuthenticated ? (activeRepo ? "/dashboard" : "/repositories") : "/auth/signin"}
                className="block w-full relative z-10"
              >
                <button
                  type="button"
                  className="w-full py-3.5 rounded-[9999px] bg-[#FFFFFF] text-[#0F171E] font-semibold text-[14px] hover:bg-white hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(255,255,255,0.4)] active:scale-[0.98] transition-all duration-200 shadow-md cursor-pointer text-center"
                >
                  {isAuthenticated
                    ? (activeRepo ? "Go to Dashboard →" : "Connect a Repository →")
                    : "Get Started — Sign in with GitHub"}
                </button>
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Subtle replay button for developer / user review */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={runSequence}
            className="text-[11px] text-white/40 hover:text-white/80 transition-colors flex items-center gap-1.5 cursor-pointer bg-white/5 hover:bg-white/10 px-3 py-1 rounded-full border border-white/10"
            title="Replay Entrance Sequence"
          >
            <span>↻</span>
            <span>Replay sequence</span>
          </button>
        </div>
      </div>
    </div>
  );
}
