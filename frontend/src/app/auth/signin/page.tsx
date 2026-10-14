"use client";

import { Suspense, useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GlobalNavbar } from "@/components/navbar";

function SignInContent() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const error = params.get("error");
  const [loading, setLoading] = useState(false);
  const { status } = useSession();
  const router = useRouter();

  // If already signed in, redirect to dashboard
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  // Only block render if actively redirecting away (already authenticated)
  if (status === "authenticated") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid #e5e7eb", borderTopColor: "#8b5cf6", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signIn("github", { callbackUrl });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 400, margin: "0 auto" }}>
      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        style={{
          background: "white",
          borderRadius: 20,
          padding: 36,
          border: "1px solid #e5e7eb",
          boxShadow: "0 10px 40px rgba(0,0,0,0.06)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px rgba(139,92,246,0.4)",
              marginBottom: 16,
              fontSize: 22,
              color: "white",
            }}
          >
            ⬡
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
            Health Monitor
          </h1>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>
            Sign in to monitor your repositories
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: "10px 14px",
              borderRadius: 10,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            {error === "OAuthSignin" || error === "OAuthCallback"
              ? "GitHub authentication failed. Please try again."
              : "Authentication error. Please try again."}
          </div>
        )}

        {/* Features */}
        <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { icon: "⬡", label: "Automated 0–100 health scoring" },
            { icon: "🔍", label: "Security & code quality analysis" },
            { icon: "⚡", label: "AI-powered fix pull requests" },
            { icon: "🔔", label: "Smart alerts & notifications" },
          ].map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + i * 0.06 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                color: "#6b7280",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: "#f5f3ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {f.icon}
              </div>
              {f.label}
            </motion.div>
          ))}
        </div>

        {/* Button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            background: loading ? "#c4b5fd" : "linear-gradient(135deg,#8b5cf6,#6366f1)",
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "12px",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            boxShadow: loading ? "none" : "0 4px 14px rgba(139,92,246,0.35)",
            transition: "all 0.2s ease",
          }}
        >
          {loading ? (
            <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          ) : (
            <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: "currentColor" }}>
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
          )}
          {loading ? "Connecting…" : "Continue with GitHub"}
        </button>
        {/* Switch Account Helper */}
        {/*
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <a
            href="https://github.com/logout"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: "#6b7280", textDecoration: "underline" }}
          >
            Want to use a different GitHub account? Sign out of GitHub first ↗
          </a>
        </div>
        */}

        <p style={{ textAlign: "center", fontSize: 11, color: "#d1d5db", marginTop: 14 }}>
          By signing in, you agree to our terms of service
        </p>
      </motion.div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f7fb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        paddingTop: 84, // ← add this (60px navbar + 24px breathing room)
      }}
    >
      <GlobalNavbar />
      <Suspense
        fallback={
          <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            Loading…
          </div>
        }
      >
        <SignInContent />
      </Suspense>
    </div>
  );
}
