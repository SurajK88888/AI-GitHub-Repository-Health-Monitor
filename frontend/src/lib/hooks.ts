/**
 * Client-side React hooks for data fetching, dashboard persistence, and
 * notification polling.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "./api";
import type { WidgetConfig } from "./types";

// ── Generic fetcher hook ──────────────────────────────────────────────────

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useFetch<T>(path: string | null): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetch_ = useCallback(() => {
    if (!path) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    api
      .get<T>(path)
      .then((result) => {
        setData(result);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          setError(err.message);
        } else if (err instanceof Error) {
          setError(err.message);
        } else {
          setError("An unexpected error occurred");
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [path]);

  useEffect(() => {
    fetch_();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}

// ── Poll hook (for scan status, notification count, etc.) ────────────────

export function usePoll<T>(
  path: string | null,
  intervalMs: number,
): UseFetchResult<T> {
  const result = useFetch<T>(path);

  useEffect(() => {
    if (!path) return;
    const id = setInterval(result.refetch, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, intervalMs]);

  return result;
}

// ── Dashboard layout persistence ─────────────────────────────────────────

const LAYOUT_KEY = "dashboard_widget_order";

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "overview-scores",    title: "Health Overview",       size: "xl" },
  { id: "score-trend",        title: "Score Trend",           size: "md" },
  { id: "critical-findings",  title: "Critical Findings",     size: "md" },
  { id: "top-repos",          title: "Top Repositories",      size: "md" },
  { id: "recent-scans",       title: "Recent Scans",          size: "md" },
  { id: "notifications",      title: "Latest Notifications",  size: "md" },
  { id: "quick-actions",      title: "Quick Actions",         size: "md" },
  { id: "activity-feed",      title: "Activity Feed",         size: "md" },
];

export function useDashboardLayout() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAYOUT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as WidgetConfig[];
        // Merge to ensure new widgets introduced in updates are included
        const existingIds = new Set(parsed.map((w) => w.id));
        const newWidgets = DEFAULT_WIDGETS.filter((w) => !existingIds.has(w.id));
        setWidgets([...parsed, ...newWidgets]);
      }
    } catch {
      // Fall back to defaults
    }
    setLoaded(true);
  }, []);

  const saveWidgets = useCallback((updated: WidgetConfig[]) => {
    setWidgets(updated);
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(updated));
    } catch {
      // Storage not available
    }
  }, []);

  const resetLayout = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
    try {
      localStorage.removeItem(LAYOUT_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { widgets, saveWidgets, resetLayout, loaded };
}

// ── Debounce ─────────────────────────────────────────────────────────────

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
