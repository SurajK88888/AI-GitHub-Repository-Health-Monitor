"use client";

import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import Link from "next/link";

const FEATURES = [
  {
    icon: "⬡",
    title: "Health Scoring",
    desc: "Automated 0–100 scores across 8 categories",
    color: "bg-brand-50 text-brand-600",
  },
  {
    icon: "🔍",
    title: "Security Scans",
    desc: "Deep code quality & vulnerability analysis",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: "⚡",
    title: "AI Remediation",
    desc: "Auto-generated fix PRs via Gemini AI",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: "🔔",
    title: "Smart Alerts",
    desc: "Score degradation & critical finding alerts",
    color: "bg-emerald-50 text-emerald-600",
  },
];

const STATS = [
  { value: "0–100", label: "Health Score Range" },
  { value: "8",     label: "Analysis Categories" },
  { value: "AI",    label: "Powered Remediation" },
  { value: "Real-time", label: "Scan Monitoring" },
];

export default function HomePage() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";

  return (
    <div className="min-h-screen" style={{ background: "#f7f7fb" }}>
      {/* Top nav */}
      <nav
        style={{
          background: "rgba(255,255,255,0.95)",
          borderBottom: "1px solid #e5e7eb",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#8b5cf6,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "white", fontSize: 14 }}>⬡</span>
            </div>
            <span style={{ fontWeight: 700, color: "#111827", fontSize: 15 }}>Health Monitor</span>
          </div>
          <Link href={isAuthenticated ? "/dashboard" : "/auth/signin"}>
            <button
              style={{
                background: "linear-gradient(135deg,#8b5cf6,#6366f1)",
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(139,92,246,0.3)",
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isAuthenticated ? "Go to Dashboard →" : "Sign in with GitHub →"}
            </button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 24px 48px" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ maxWidth: 680 }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#ede9fe",
              color: "#6d28d9",
              padding: "4px 12px",
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 20,
              border: "1px solid #ddd6fe",
            }}
          >
            ⚡ AI-Powered Repository Analysis
          </div>

          <h1
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: 800,
              color: "#111827",
              lineHeight: 1.15,
              marginBottom: 20,
            }}
          >
            GitHub Repository
            <br />
            <span style={{ background: "linear-gradient(135deg,#8b5cf6,#6366f1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Health Monitor
            </span>
          </h1>

          <p style={{ fontSize: 16, color: "#6b7280", lineHeight: 1.7, marginBottom: 32, maxWidth: 540 }}>
            Automated 0–100 health scoring for your GitHub repositories. Get security findings, AI-powered remediation actions, and trend analysis — all in one dashboard.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href={isAuthenticated ? "/dashboard" : "/auth/signin"}>
              <button
                style={{
                  background: "linear-gradient(135deg,#8b5cf6,#6366f1)",
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(139,92,246,0.35)",
                }}
              >
                {isAuthenticated ? "Go to Dashboard →" : "Get Started — Sign in with GitHub"}
              </button>
            </Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              <button
                style={{
                  background: "white",
                  color: "#374151",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: "12px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                View on GitHub
              </button>
            </a>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginTop: 60,
          }}
        >
          {STATS.map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "white",
                borderRadius: 12,
                padding: "20px 24px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <p style={{ fontSize: 22, fontWeight: 800, color: "#8b5cf6" }}>{stat.value}</p>
              <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features grid */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 24 }}
        >
          Everything you need to monitor repository health
        </motion.h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              whileHover={{ y: -4, boxShadow: "0 12px 24px rgba(139,92,246,0.1)" }}
              style={{
                background: "white",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                cursor: "default",
                transition: "box-shadow 0.2s ease",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  marginBottom: 14,
                  background: "#f5f3ff",
                }}
              >
                {f.icon}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
