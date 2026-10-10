/**
 * API client — thin wrapper around fetch that attaches the NextAuth session
 * cookie and handles JSON parsing + error normalisation.
 *
 * Usage:
 *   import { api } from "@/lib/api";
 *   const repos = await api.get<Repository[]>("/repositories");
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Module-level token store ────────────────────────────────────────────────
// Populated by AuthProvider once the NextAuth JWT is available on the client.
// This lets every api.* call attach the Bearer token without threading it
// through every call site.

let _apiToken: string | null = null;

/** Store the JWT for use by all subsequent api.* calls. */
export function setApiToken(token: string | null): void {
  _apiToken = token;
}

/** Read the currently-stored JWT (primarily for debugging). */
export function getApiToken(): string | null {
  return _apiToken;
}

// ── HTTP request helper ──────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Prefer an explicitly-supplied token; fall back to the module-level store.
  const effectiveToken = token ?? _apiToken;
  if (effectiveToken) {
    headers["Authorization"] = `Bearer ${effectiveToken}`;
  }

  const res = await fetch(`${BACKEND_URL}/api/v1${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let code = "UNKNOWN_ERROR";
    let message = res.statusText;
    try {
      const body = await res.json();
      code = body.code ?? code;
      message = body.message ?? body.detail ?? message;
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, token?: string) =>
    request<T>(path, { method: "GET" }, token),

  post: <T>(path: string, body?: unknown, token?: string) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, token),

  put: <T>(path: string, body?: unknown, token?: string) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }, token),

  patch: <T>(path: string, body?: unknown, token?: string) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }, token),

  delete: <T>(path: string, token?: string) =>
    request<T>(path, { method: "DELETE" }, token),
};
