"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

/**
 * LandingSections
 * 7 below-the-fold luxury glassmorphic sections tailored specifically
 * to the AI GitHub Repository Health Monitor application.
 */

// Scroll reveal animation variant
const sectionVariant: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

export function LandingSections() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  // Accordion state for Section 6 (FAQ)
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenFaq((prev) => (prev === idx ? null : idx));
  };

  return (
    <div
      className="relative z-20 w-full font-sans select-none"
      style={{
        background: "#090D11",
        color: "#FFFFFF",
      }}
    >
      {/* ── Top Border Divider: Clean transition from Video Hero ── */}
      <div className="w-full h-px bg-white/[0.08]" />

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: SOCIAL PROOF BAR (Immediate Below-the-Fold)
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="w-full border-t border-b border-white/[0.08] py-12 px-6 sm:px-8">
        <motion.div
          variants={sectionVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="max-w-[1280px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-8"
        >
          {/* Left/Top Label */}
          <span
            className="text-[12px] font-semibold uppercase tracking-[0.12em] whitespace-nowrap"
            style={{ color: "rgba(255, 255, 255, 0.45)" }}
          >
            TRUSTED BY MODERN ENGINEERING TEAMS & OPEN-SOURCE LEADERS
          </span>

          {/* Center: 5 Monochromatic Developer Partner Logos */}
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 opacity-60 hover:opacity-100 transition-opacity">
            {/* GitHub Logo */}
            <div className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span className="font-semibold text-[15px] tracking-tight">GitHub</span>
            </div>

            {/* Docker Logo */}
            <div className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.186V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.186V9.006a.185.185 0 00-.184-.186H8.1a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.186V9.006a.185.185 0 00-.185-.186H5.136a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185m-2.928 0h2.12a.185.185 0 00.185-.186V9.006a.185.185 0 00-.185-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.184.185M23.79 9.89c-.527-.406-1.56-.632-2.585-.56-.16-1.464-1.12-2.484-2.434-2.585l-.26-.016a.443.443 0 00-.422.316c-.463 1.543-.284 3.01.536 4.39-1.077.567-2.61.64-3.792.203H1.722c-.672 0-1.238.455-1.42 1.085-.75 2.628-.013 6.09 2.508 8.165 2.11 1.737 5.08 2.222 8.01 2.222 6.574 0 11.83-3.834 12.87-10.378.077-.487.1-.986.1-1.492 0-.498-.027-.992-.09-1.45z" />
              </svg>
              <span className="font-semibold text-[15px] tracking-tight">Docker</span>
            </div>

            {/* Next.js Logo */}
            <div className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <span className="font-bold text-[18px] tracking-tighter">Next.js</span>
            </div>

            {/* FastAPI Logo */}
            <div className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <span className="w-5 h-5 rounded-full border border-white/60 flex items-center justify-center text-[10px] font-bold">⚡</span>
              <span className="font-semibold text-[15px] tracking-tight">FastAPI</span>
            </div>

            {/* PostgreSQL Logo */}
            <div className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <span className="text-[16px]">🐘</span>
              <span className="font-semibold text-[15px] tracking-tight">PostgreSQL</span>
            </div>
          </div>

          {/* Far Right: Glass Pill Badge with Rise & Shine */}
          <div className="glass-rise-card group overflow-hidden flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-md shadow-sm hover:border-white/30 hover:bg-white/[0.08] cursor-default">
            <div className="glass-shine-layer" />
            <span className="text-amber-400 text-sm">★</span>
            <span className="text-xs font-semibold text-white">4.9/5 Health Rating</span>
            <span className="text-xs text-white/40">•</span>
            <span className="text-xs text-white/70">1,200+ Repos Monitored</span>
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: PROBLEM & SOLUTION (Comparison Split)
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-6 sm:px-8 py-28">
        <motion.div
          variants={sectionVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="text-center max-w-[780px] mx-auto mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-5">
            The Maintenance Dilemma
          </div>
          <h2
            className="font-normal text-white leading-[1.1] tracking-[-0.03em]"
            style={{ fontSize: "clamp(2.25rem, 4vw, 3.5rem)" }}
          >
            Maintaining repository health shouldn&apos;t feel like another full-time job.
          </h2>
          <p className="text-[16px] text-white/65 mt-5 leading-relaxed max-w-[620px] mx-auto">
            Engineering velocity slows down when technical debt accumulates in silence. Traditional static tools flood developers with noisy logs while critical vulnerabilities slip through.
          </p>
        </motion.div>

        {/* 2-Column Asymmetric Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Left Card: The Old Way / Pain Point with Rise & Shine */}
          <motion.div
            variants={sectionVariant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="glass-rise-card group relative rounded-[24px] p-8 sm:p-10 flex flex-col justify-between overflow-hidden"
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            <div className="glass-shine-layer" />
            <div>
              <div className="flex items-center justify-between mb-8">
                <span className="text-[18px] font-semibold text-white/90">
                  Manual Audits &amp; Fragmented Tools
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/80 shadow-[0_0_8px_rgba(248,113,113,0.5)]" />
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-3.5">
                  <span className="w-5 h-5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                    ✕
                  </span>
                  <div>
                    <h4 className="text-[15px] font-semibold text-white/90">Silent Credential Leaks</h4>
                    <p className="text-[13px] text-white/60 mt-1 leading-normal">
                      AWS tokens, private keys, and GitHub PATs slip into commits unnoticed until an audit or incident occurs.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <span className="w-5 h-5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                    ✕
                  </span>
                  <div>
                    <h4 className="text-[15px] font-semibold text-white/90">Invisible CI Flakiness</h4>
                    <p className="text-[13px] text-white/60 mt-1 leading-normal">
                      Failing actions runs and unmonitored pass rates (&lt;50%) degrade developer trust and stall deployments.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <span className="w-5 h-5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                    ✕
                  </span>
                  <div>
                    <h4 className="text-[15px] font-semibold text-white/90">No Single Score of Truth</h4>
                    <p className="text-[13px] text-white/60 mt-1 leading-normal">
                      Disconnected metrics across security, PR backlogs, and dependencies leave leaders with zero actionable clarity.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/[0.06] text-xs text-white/40">
              Result: High cognitive load, reactive firefighting, and security blind spots.
            </div>
          </motion.div>

          {/* Right Card: The Solution / Health Monitor with Rise & Shine */}
          <motion.div
            variants={sectionVariant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="glass-rise-card group rounded-[24px] p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden"
            style={{
              background: "rgba(15, 23, 30, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.22)",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="glass-shine-layer" />
            {/* Subtle radial glow */}
            <div
              className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
              style={{
                background: "radial-gradient(circle at top right, rgba(139, 92, 246, 0.18), transparent 70%)",
              }}
            />

            <div>
              <div className="flex items-center justify-between mb-8">
                <span className="text-[18px] font-semibold text-white">
                  Continuous Autonomous Health Intelligence
                </span>
                <span className="px-2.5 py-1 rounded-full bg-brand-500/20 border border-brand-400/40 text-brand-300 text-[11px] font-semibold uppercase tracking-wider">
                  The Solution
                </span>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-3.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                    ✓
                  </span>
                  <div>
                    <h4 className="text-[15px] font-semibold text-white">Deterministic 0–100 Health Score</h4>
                    <p className="text-[13px] text-white/65 mt-1 leading-normal">
                      Algorithmic scoring across 8 categories (Security, Code Quality, Dependencies, Issues, PRs, Docs, Activity, Config).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                    ✓
                  </span>
                  <div>
                    <h4 className="text-[15px] font-semibold text-white">AI-Assisted Remediation PRs</h4>
                    <p className="text-[13px] text-white/65 mt-1 leading-normal">
                      Contextual explanations of score drops and auto-generated pull requests that you can review and merge in one click.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                    ✓
                  </span>
                  <div>
                    <h4 className="text-[15px] font-semibold text-white">Automated Cadence &amp; Webhook Triggers</h4>
                    <p className="text-[13px] text-white/65 mt-1 leading-normal">
                      Configurable cron schedules (Daily, Weekly, Monthly) plus real-time event triggers on repository push and PR merges.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/[0.12] flex items-center justify-between">
              <span className="text-xs text-brand-300 font-medium">
                ★ 100% Explainable &amp; Reproducible
              </span>
              <Link href={isAuthenticated ? "/dashboard" : "/auth/signin"}>
                <span className="text-xs font-semibold text-white hover:text-brand-300 transition-colors flex items-center gap-1 cursor-pointer">
                  See live score engine <span>→</span>
                </span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: FEATURES & BENEFITS (Bento Grid)
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-6 sm:px-8 py-24">
        <motion.div
          variants={sectionVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="mb-14"
        >
          <div className="text-brand-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Core Capabilities
          </div>
          <h2
            className="text-white font-normal leading-[1.1] tracking-[-0.03em] max-w-[700px]"
            style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)" }}
          >
            Engineered for Code Quality, Built for Developer Speed
          </h2>
          <p className="text-[15px] text-white/65 mt-4 max-w-[580px]">
            Every metric translates into a tangible engineering outcome. No opaque black boxes—every deduction is backed by concrete evidence.
          </p>
        </motion.div>

        {/* 3-Column Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Wide (col-span-2) with Rise & Shine */}
          <motion.div
            variants={sectionVariant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="glass-rise-card group lg:col-span-2 rounded-[24px] p-8 sm:p-9 relative overflow-hidden"
            style={{
              background: "rgba(15, 23, 30, 0.55)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="glass-shine-layer" />
            <div className="flex items-center gap-3 mb-5">
              <span className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-lg text-purple-400">
                🛡️
              </span>
              <span className="text-xs uppercase tracking-wider text-purple-300 font-semibold">
                Security Engine
              </span>
            </div>
            <h3 className="text-[22px] font-semibold text-white mb-3">
              Zero-Trust Secret Scanning &amp; CVE Vulnerability Caps
            </h3>
            <p className="text-[14px] text-white/65 leading-relaxed max-w-[620px] mb-6">
              Scans repository file contents for unencrypted RSA/OpenSSH private keys, AWS access keys, GitHub PATs, and Slack tokens. Integrates open Dependabot CVE/GHSA alerts with automatic score capping (&le;30.0 for critical risks) to protect your production workloads.
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                AWS Token Pattern Detection
              </span>
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                Dependabot GHSA Sync
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                Automatic Credential Masking
              </span>
            </div>
          </motion.div>

          {/* Card 2: Standard (col-span-1) with Rise & Shine */}
          <motion.div
            variants={sectionVariant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="glass-rise-card group lg:col-span-1 rounded-[24px] p-8 sm:p-9 relative overflow-hidden flex flex-col justify-between"
            style={{
              background: "rgba(15, 23, 30, 0.55)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="glass-shine-layer" />
            <div>
              <div className="flex items-center gap-3 mb-5">
                <span className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-lg text-blue-400">
                  📈
                </span>
                <span className="text-xs uppercase tracking-wider text-blue-300 font-semibold">
                  Scale-Aware
                </span>
              </div>
              <h3 className="text-[20px] font-semibold text-white mb-3">
                Team-Scaled Backlog Velocity
              </h3>
              <p className="text-[13.5px] text-white/65 leading-relaxed">
                Evaluates open issues and PRs proportionally based on active contributor velocity. Avoids penalizing growing multi-contributor teams with false backlog alarms.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.08] text-xs font-mono text-white/50">
              max(50, active_contributors * 15)
            </div>
          </motion.div>

          {/* Card 3: Standard (col-span-1) with Rise & Shine */}
          <motion.div
            variants={sectionVariant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="glass-rise-card group lg:col-span-1 rounded-[24px] p-8 sm:p-9 relative overflow-hidden flex flex-col justify-between"
            style={{
              background: "rgba(15, 23, 30, 0.55)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="glass-shine-layer" />
            <div>
              <div className="flex items-center gap-3 mb-5">
                <span className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-lg text-amber-400">
                  ⚙️
                </span>
                <span className="text-xs uppercase tracking-wider text-amber-300 font-semibold">
                  CI/CD Reliability
                </span>
              </div>
              <h3 className="text-[20px] font-semibold text-white mb-3">
                Workflow Run Pass-Rate Tracking
              </h3>
              <p className="text-[13.5px] text-white/65 leading-relaxed">
                Tracks GitHub Actions runs, flagging recent test failures (-20 pts), low execution pass rates (&lt;50%), and unforced PR review policies on default branches.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-white/[0.08] text-xs font-mono text-white/50">
              Branch Protection + Review Enforcement
            </div>
          </motion.div>

          {/* Card 4: Wide (col-span-2) with Rise & Shine */}
          <motion.div
            variants={sectionVariant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="glass-rise-card group lg:col-span-2 rounded-[24px] p-8 sm:p-9 relative overflow-hidden"
            style={{
              background: "rgba(15, 23, 30, 0.55)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="glass-shine-layer" />
            <div className="flex items-center gap-3 mb-5">
              <span className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-lg text-emerald-400">
                ⚡
              </span>
              <span className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">
                AI Remediation
              </span>
            </div>
            <h3 className="text-[22px] font-semibold text-white mb-3">
              Context-Aware Explanations &amp; Automated Fix PRs
            </h3>
            <p className="text-[14px] text-white/65 leading-relaxed max-w-[620px] mb-6">
              Leverages high-speed LLM reasoning (Groq / Gemini) to explain root causes of score degradation, prioritize technical debt, generate concise manifest descriptions, and stage safe pull requests that require human review before merging.
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                Audited Actions Log
              </span>
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                Zero Source Code Exposure
              </span>
              <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
                Interactive Architecture Visualizer
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4: HOW IT WORKS (3-Step Process)
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-6 sm:px-8 py-24">
        <motion.div
          variants={sectionVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="text-center max-w-[680px] mx-auto mb-20"
        >
          <div className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Workflow Engine
          </div>
          <h2
            className="text-white font-normal leading-[1.1] tracking-[-0.03em]"
            style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)" }}
          >
            From Code Entropy to 100/100 Health in 3 Steps
          </h2>
          <p className="text-[15px] text-white/65 mt-4">
            Zero configuration files to write. Connect your GitHub account and receive your comprehensive repository assessment in under a minute.
          </p>
        </motion.div>

        {/* 3 Step Cards with Progressive Timeline & Hover Rise/Shine */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Subtle connecting progress line behind cards */}
          <div
            className="hidden md:block absolute top-[68px] left-[15%] right-[15%] h-[1px] pointer-events-none"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2) 20%, rgba(255,255,255,0.2) 80%, transparent)",
            }}
          />

          {/* Step 1 with Rise & Shine */}
          <motion.div
            variants={sectionVariant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="glass-rise-card group rounded-[24px] p-8 relative overflow-hidden"
            style={{
              background: "rgba(15, 23, 30, 0.55)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="glass-shine-layer" />
            <div className="text-[3.5rem] font-extralight text-white/20 leading-none mb-6 tabular-nums">
              01
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 text-base mb-5">
              🔗
            </div>
            <h3 className="text-[19px] font-semibold text-white mb-2.5">
              Connect GitHub App
            </h3>
            <p className="text-[13.5px] text-white/65 leading-relaxed">
              Install the GitHub App in under 30 seconds. Uses least-privilege token access—never requiring personal access tokens or storing raw credentials.
            </p>
          </motion.div>

          {/* Step 2 with Rise & Shine */}
          <motion.div
            variants={sectionVariant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="glass-rise-card group rounded-[24px] p-8 relative overflow-hidden"
            style={{
              background: "rgba(15, 23, 30, 0.55)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="glass-shine-layer" />
            <div className="text-[3.5rem] font-extralight text-white/20 leading-none mb-6 tabular-nums">
              02
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-300 text-base mb-5">
              📊
            </div>
            <h3 className="text-[19px] font-semibold text-white mb-2.5">
              Automated Deterministic Scan
            </h3>
            <p className="text-[13.5px] text-white/65 leading-relaxed">
              Calculates health scores across 8 categories instantly. Evaluates branch protection, secret presence, CVEs, CI flakiness, and issue velocity.
            </p>
          </motion.div>

          {/* Step 3 with Rise & Shine */}
          <motion.div
            variants={sectionVariant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="glass-rise-card group rounded-[24px] p-8 relative overflow-hidden"
            style={{
              background: "rgba(15, 23, 30, 0.55)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="glass-shine-layer" />
            <div className="text-[3.5rem] font-extralight text-white/20 leading-none mb-6 tabular-nums">
              03
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 text-base mb-5">
              ✨
            </div>
            <h3 className="text-[19px] font-semibold text-white mb-2.5">
              Review &amp; Auto-Remediate
            </h3>
            <p className="text-[13.5px] text-white/65 leading-relaxed">
              Inspect exact mathematical score breakdowns, set recurring scan schedules (Daily/Weekly), and approve AI-generated fix PRs with full audit safety.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5: TESTIMONIALS & CASE STUDIES
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-6 sm:px-8 py-24">
        {/* Featured Case Study Banner with Rise & Shine */}
        <motion.div
          variants={sectionVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="glass-rise-card group rounded-[28px] p-8 sm:p-12 mb-12 relative overflow-hidden flex flex-col lg:flex-row items-center gap-10"
          style={{
            background: "rgba(15, 23, 30, 0.75)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <div className="glass-shine-layer" />
          {/* Left metric / graphic */}
          <div className="w-full lg:w-5/12 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-white/10 pb-8 lg:pb-0 lg:pr-10 relative z-10">
            <span className="text-xs uppercase tracking-wider text-amber-400 font-semibold mb-2">
              Featured Case Study
            </span>
            <div className="flex items-baseline gap-4 my-2">
              <span className="text-5xl font-extrabold text-white tracking-tight">42</span>
              <span className="text-2xl text-white/40">→</span>
              <span className="text-5xl font-extrabold text-emerald-400 tracking-tight">96</span>
              <span className="text-xs text-emerald-300 font-mono bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                +54 PTS
              </span>
            </div>
            <p className="text-xs text-white/60 mt-2 font-mono">
              Production microservices repository health progression over 14 days
            </p>
          </div>

          {/* Right quote */}
          <div className="w-full lg:w-7/12 relative z-10">
            <p className="text-[18px] sm:text-[20px] font-normal text-white leading-relaxed italic">
              &ldquo;We plugged the Health Monitor into our core repositories and immediately caught 3 committed staging keys and two flaky CI workflows. The AI-suggested fix PRs cut our resolution time from days to minutes.&rdquo;
            </p>
            <div className="flex items-center gap-4 mt-6">
              <div className="w-12 h-12 rounded-full bg-purple-600/30 border border-purple-400/40 flex items-center justify-center font-bold text-white text-sm">
                DK
              </div>
              <div>
                <h4 className="text-[15px] font-semibold text-white">David Kim</h4>
                <p className="text-[13px] text-white/60">VP of Engineering at CloudScale Architecture</p>
              </div>
              <span className="ml-auto px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                ✓ Verified Customer
              </span>
            </div>
          </div>
        </motion.div>

        {/* 3 Testimonial Cards with Rise & Shine */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Testimonial 1 */}
          <motion.div
            variants={sectionVariant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="glass-rise-card group relative rounded-[24px] p-7 flex flex-col justify-between overflow-hidden"
            style={{
              background: "rgba(15, 23, 30, 0.55)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="glass-shine-layer" />
            <div className="relative z-10">
              <div className="flex items-center gap-1 text-amber-400 text-sm mb-4">
                {"★★★★★".split("").map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </div>
              <p className="text-[14px] text-white/80 leading-relaxed italic mb-6">
                &ldquo;The scale-aware PR and issue backlog scoring is genius. It understands our team size instead of screaming about backlog count. The scheduled UTC scans keep us honest.&rdquo;
              </p>
            </div>
            <div className="flex items-center gap-3 pt-4 border-t border-white/[0.08] relative z-10">
              <div className="w-10 h-10 rounded-full bg-brand-500/20 border border-brand-400/30 flex items-center justify-center text-xs font-bold text-white">
                SL
              </div>
              <div>
                <h5 className="text-[13.5px] font-semibold text-white leading-tight">Sarah Lin</h5>
                <p className="text-[11.5px] text-white/50">Staff DevSecOps Lead</p>
              </div>
              <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Verified
              </span>
            </div>
          </motion.div>

          {/* Testimonial 2 */}
          <motion.div
            variants={sectionVariant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="glass-rise-card group relative rounded-[24px] p-7 flex flex-col justify-between overflow-hidden"
            style={{
              background: "rgba(15, 23, 30, 0.55)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="glass-shine-layer" />
            <div className="relative z-10">
              <div className="flex items-center gap-1 text-amber-400 text-sm mb-4">
                {"★★★★★".split("").map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </div>
              <p className="text-[14px] text-white/80 leading-relaxed italic mb-6">
                &ldquo;Finally, an engineering tool that doesn&apos;t require pasting raw PATs. The GitHub App integration is clean, and the automated AI description generator fixed 20 neglected repos in one afternoon.&rdquo;
              </p>
            </div>
            <div className="flex items-center gap-3 pt-4 border-t border-white/[0.08] relative z-10">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-xs font-bold text-white">
                MV
              </div>
              <div>
                <h5 className="text-[13.5px] font-semibold text-white leading-tight">Marcus Vance</h5>
                <p className="text-[11.5px] text-white/50">Head of Infrastructure</p>
              </div>
              <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Verified
              </span>
            </div>
          </motion.div>

          {/* Testimonial 3 */}
          <motion.div
            variants={sectionVariant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="glass-rise-card group relative rounded-[24px] p-7 flex flex-col justify-between overflow-hidden"
            style={{
              background: "rgba(15, 23, 30, 0.55)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="glass-shine-layer" />
            <div className="relative z-10">
              <div className="flex items-center gap-1 text-amber-400 text-sm mb-4">
                {"★★★★★".split("").map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </div>
              <p className="text-[14px] text-white/80 leading-relaxed italic mb-6">
                &ldquo;The interactive Calculation Details modal provides complete transparency into deductions. No guessing why a score dropped. It has become our engineering team&apos;s standard sprint health check.&rdquo;
              </p>
            </div>
            <div className="flex items-center gap-3 pt-4 border-t border-white/[0.08] relative z-10">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-xs font-bold text-white">
                ER
              </div>
              <div>
                <h5 className="text-[13.5px] font-semibold text-white leading-tight">Elena Rostova</h5>
                <p className="text-[11.5px] text-white/50">Principal Engineer</p>
              </div>
              <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Verified
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 6: FAQ ACCORDION SECTION
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-6 sm:px-8 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column (40% -> lg:col-span-5): Sticky Header & Card */}
          <motion.div
            variants={sectionVariant}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="lg:col-span-5 lg:sticky lg:top-24"
          >
            <div className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
              FAQ &amp; Security Standards
            </div>
            <h2
              className="text-white font-normal leading-[1.15] tracking-[-0.03em] mb-4"
              style={{ fontSize: "clamp(2rem, 3.2vw, 2.75rem)" }}
            >
              Everything You Need to Know
            </h2>
            <p className="text-[14.5px] text-white/65 leading-relaxed mb-8">
              Engineered with enterprise security boundaries, least-privilege permissions, and complete audit logging from day one.
            </p>

            {/* Glass concierge / support card with Rise & Shine */}
            <div
              className="glass-rise-card group relative rounded-[20px] p-6 overflow-hidden"
              style={{
                background: "rgba(15, 23, 30, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              <div className="glass-shine-layer" />
              <div className="relative z-10">
                <h4 className="text-[16px] font-semibold text-white mb-2">
                  Need customized enterprise weights?
                </h4>
                <p className="text-[13px] text-white/60 leading-relaxed mb-4">
                  Workspace administrators can customize category weights and configure webhook schedules across private or organization repos.
                </p>
                <Link href={isAuthenticated ? "/repositories" : "/auth/signin"}>
                  <span className="text-xs font-semibold text-brand-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer">
                    <span>Explore Repository Settings</span>
                    <span>→</span>
                  </span>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Right Column (60% -> lg:col-span-7): 6 Interactive Accordion Items */}
          <div className="lg:col-span-7 space-y-4">
            {[
              {
                q: "How does the 0–100 repository health score calculation work?",
                a: "The score is derived from 8 weighted categories: Security (20%), Code Quality (20%), Dependencies (15%), Documentation (10%), Issues (10%), Pull Requests (10%), Activity (10%), and Configuration (5%). Deductions are deterministic, bounded, and explainable in the Calculation Details modal.",
              },
              {
                q: "Does the Health Monitor expose our private proprietary source code to AI?",
                a: "Never. Our security guardrails strictly exclude source code files (.py, .ts, .tsx, .go, etc.) from AI prompts. The AI layer evaluates only safe metadata, issue patterns, and project manifests (e.g. README.md, package.json), ensuring zero source code exposure.",
              },
              {
                q: "How do automated scan schedules and webhooks work?",
                a: "You can configure automated scans on a Daily, Weekly, or Monthly cadence at specific UTC execution times. Background ARQ/Redis workers execute scans idempotently. Additionally, GitHub webhooks trigger lightweight targeted incremental checks upon code push or PR merges.",
              },
              {
                q: "Can the AI create pull requests autonomously without human approval?",
                a: "No. The AI recommends fixes and generates remediations, but destructive or modifying actions strictly require user approval. Every AI action is logged in the audit trail, ensuring complete developer governance.",
              },
              {
                q: "How does this differ from traditional static analysis (SAST) tools?",
                a: "Traditional SAST tools generate noisy, isolated reports. The Health Monitor combines security scanning, CI workflow pass rates, dependency vulnerabilities, team velocity, and branch protections into an executive health score paired with actionable remediation PRs.",
              },
              {
                q: "What GitHub permissions does the Health Monitor require?",
                a: "The system connects securely via a GitHub App using least-privilege permissions. It never requests personal access tokens (PATs), never requires write access to repository source code without explicit consent, and supports instant installation revocation.",
              },
            ].map((faq, idx) => (
              <motion.div
                key={idx}
                variants={sectionVariant}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-40px" }}
                className="rounded-[18px] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.04] overflow-hidden transition-all duration-300"
                style={{
                  background: openFaq === idx ? "rgba(15, 23, 30, 0.7)" : "rgba(255, 255, 255, 0.02)",
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span className="text-[15px] sm:text-[16px] font-semibold text-white/90">
                    {faq.q}
                  </span>
                  <span className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 text-sm flex-shrink-0 transition-transform duration-200">
                    {openFaq === idx ? "−" : "+"}
                  </span>
                </button>

                <AnimatePresence>
                  {openFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="px-5 sm:px-6 pb-6 pt-1 text-[13.5px] text-white/65 leading-relaxed border-t border-white/[0.05]">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 7: FINAL CTA BANNER & COMPREHENSIVE FOOTER
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-[1280px] mx-auto px-6 sm:px-8 pt-12 pb-24">
        {/* Large Framed Final CTA Banner with Rise & Shine */}
        <motion.div
          variants={sectionVariant}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="glass-rise-card group rounded-[32px] p-10 sm:p-20 text-center relative overflow-hidden border border-white/20 mb-28"
          style={{
            background: "linear-gradient(160deg, rgba(20, 16, 40, 0.9) 0%, rgba(10, 14, 22, 0.95) 100%)",
            boxShadow: "0 30px 100px rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          <div className="glass-shine-layer" />
          {/* Ambient Glows */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(139, 92, 246, 0.25), transparent 70%)",
            }}
          />

          <div className="relative z-10 max-w-[700px] mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-brand-400/30 bg-brand-500/10 text-brand-300 text-xs font-semibold mb-6">
              ⚡ Production-Ready Repository Health
            </div>

            <h2
              className="text-white font-bold leading-[1.08] tracking-[-0.03em] mb-5"
              style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}
            >
              Your Repositories Deserve 100/100 Health.
            </h2>

            <p className="text-[16px] text-white/70 leading-relaxed mb-8 max-w-[540px] mx-auto">
              Connect your GitHub account in 60 seconds. Automated deterministic scoring, vulnerability detection, and AI remediation for public and private repositories.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href={isAuthenticated ? "/dashboard" : "/auth/signin"}>
                <button
                  type="button"
                  className="px-8 py-4 rounded-full bg-[#FFFFFF] text-[#0F171E] font-semibold text-[15px] hover:bg-white hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.45)] active:scale-[0.98] transition-all duration-200 shadow-lg cursor-pointer"
                >
                  {isAuthenticated ? "Go to Dashboard →" : "Start Monitoring Free"}
                </button>
              </Link>

              <Link href="/repositories">
                <button
                  type="button"
                  className="px-8 py-4 rounded-full border border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40 hover:-translate-y-0.5 text-white font-semibold text-[15px] transition-all duration-200 cursor-pointer backdrop-blur-md"
                >
                  View Sample Reports
                </button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ── 4-Column Clean Footer ── */}
        <footer className="border-t border-white/[0.08] pt-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-16">
            {/* Col 1: Brand & Mission (lg:col-span-4) */}
            <div className="lg:col-span-4">
              <Link href="/" className="flex items-center gap-3 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icon.svg"
                  alt="Health Monitor Logo"
                  width={30}
                  height={30}
                  className="w-[30px] h-[30px] rounded-lg shadow-sm"
                />
                <span className="font-bold text-[18px] text-white tracking-tight">
                  Health Monitor
                </span>
              </Link>
              <p className="text-[13.5px] text-white/60 leading-relaxed max-w-[320px] mb-6">
                Automated 0–100 repository health scoring, deterministic vulnerability scans, and AI-assisted remediation for modern engineering teams.
              </p>
              <div className="text-xs text-white/40">
                Built with Next.js 15, FastAPI, PostgreSQL &amp; Redis.
              </div>
            </div>

            {/* Col 2: Product (lg:col-span-2) */}
            <div className="lg:col-span-2 space-y-3">
              <h5 className="text-[13px] font-semibold text-white uppercase tracking-wider mb-2">
                Product
              </h5>
              <div className="flex flex-col space-y-2.5 text-[13.5px] text-white/65">
                <Link href="/#features" className="hover:text-white transition-colors">Health Scoring</Link>
                <Link href="/repositories" className="hover:text-white transition-colors">Security Scanning</Link>
                <Link href="/dashboard" className="hover:text-white transition-colors">AI Remediation</Link>
                <Link href="/dashboard" className="hover:text-white transition-colors">Auto-Scheduler</Link>
                <Link href="/repositories" className="hover:text-white transition-colors">Tech Stack Visualizer</Link>
              </div>
            </div>

            {/* Col 3: Resources (lg:col-span-3) */}
            <div className="lg:col-span-3 space-y-3">
              <h5 className="text-[13px] font-semibold text-white uppercase tracking-wider mb-2">
                Platform
              </h5>
              <div className="flex flex-col space-y-2.5 text-[13.5px] text-white/65">
                <Link href="/repositories" className="hover:text-white transition-colors">Repository Insights</Link>
                <Link href="/findings" className="hover:text-white transition-colors">Findings Center</Link>
                <Link href="/notifications" className="hover:text-white transition-colors">Alert Dispatcher</Link>
                <Link href="/settings" className="hover:text-white transition-colors">Workspace Settings</Link>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  GitHub App Integration ↗
                </a>
              </div>
            </div>

            {/* Col 4: Trust & Security (lg:col-span-3) */}
            <div className="lg:col-span-3 space-y-3">
              <h5 className="text-[13px] font-semibold text-white uppercase tracking-wider mb-2">
                Security &amp; Governance
              </h5>
              <div className="flex flex-col space-y-2.5 text-[13.5px] text-white/65">
                <span className="text-white/80">Least-Privilege GitHub App</span>
                <span className="text-white/80">Zero Source Code Exposure</span>
                <span className="text-white/80">Audited AI Action Logging</span>
                <span className="text-white/80">Deterministic Scoring Caps</span>
                <span className="text-white/80">Isolated Tenant Scopes</span>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Copyright & Social Links */}
          <div className="pt-8 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50">
            <div>
              &copy; 2026 AI GitHub Repository Health Monitor. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <Link href="/#features" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/#features" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors flex items-center gap-1"
              >
                <span>GitHub</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
