"use client";

/**
 * AuthProvider
 *
 * Bridges NextAuth client-side session state with the FastAPI backend:
 *
 * 1. Watches `useSession()` status.
 * 2. When `status === "authenticated"`, fetches `/api/auth/token` (our
 *    server-side route) to obtain the raw encoded JWT.
 * 3. Calls `setApiToken(token)` so every `api.*` call automatically attaches
 *    `Authorization: Bearer <token>`.
 * 4. Calls `POST /api/v1/auth/session` exactly once per session to upsert the
 *    User and Workspace rows in the backend DB.
 * 5. Clears the stored token when the user signs out.
 */

import { useSession } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
import { setApiToken } from "@/lib/api";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [ready, setReady] = useState(false);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/auth/token")
        .then((res) => {
          if (!res.ok) throw new Error("Token fetch failed");
          return res.json();
        })
        .then(async ({ token }: { token?: string }) => {
          if (!token) {
            setReady(true);
            return;
          }

          // Make all subsequent api.* calls include the Bearer token.
          setApiToken(token);

          // Bootstrap the backend session once per client-side session.
          if (!bootstrappedRef.current) {
            bootstrappedRef.current = true;
            try {
              await fetch(`${BACKEND_URL}/api/v1/auth/session`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              });
            } catch (err) {
              console.warn("Backend session bootstrap failed:", err);
            }
          }
          setReady(true);
        })
        .catch((err) => {
          console.warn("Failed to fetch auth token:", err);
          setReady(true);
        });
    } else if (status === "unauthenticated") {
      setApiToken(null);
      bootstrappedRef.current = false;
      setReady(true);
    } else {
      setReady(false);
    }
  }, [status]);

  // While checking or loading token for authenticated user, show a brief spinner
  // to prevent child useFetch hooks from firing before the Bearer token is set!
  if (status === "authenticated" && !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f7fb]">
        <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-brand-500 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
