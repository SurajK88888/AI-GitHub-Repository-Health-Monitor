"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ThemeMode, WidgetPosition } from "./types";

const THEME_STORAGE_KEY = "gh_health_theme_mode";
const POSITION_STORAGE_KEY = "gh_health_theme_widget_position";

export function ThemeToggleWidget() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<ThemeMode>("light");
  const [isCompact, setIsCompact] = useState(false);

  // Position state (null = use default top navbar placement)
  const [position, setPosition] = useState<WidgetPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const widgetRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialLeft: number;
    initialTop: number;
  }>({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0 });

  // 1. Apply theme to document root
  const applyTheme = useCallback((targetMode: ThemeMode) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    let effectiveDark = false;
    if (targetMode === "dark") {
      effectiveDark = true;
    } else if (targetMode === "light") {
      effectiveDark = false;
    } else if (targetMode === "system") {
      effectiveDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    if (effectiveDark) {
      root.classList.add("dark");
      root.classList.remove("light");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      root.style.colorScheme = "light";
    }
  }, []);

  // 2. Initialize from localStorage / OS preferences
  useEffect(() => {
    setMounted(true);

    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      const initialMode = savedTheme || "light";
      setMode(initialMode);
      applyTheme(initialMode);
    } catch {
      applyTheme("light");
    }

    try {
      const savedPos = localStorage.getItem(POSITION_STORAGE_KEY);
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const maxX = Math.max(0, window.innerWidth - 180);
          const maxY = Math.max(0, window.innerHeight - 50);
          setPosition({
            x: Math.min(Math.max(8, parsed.x), maxX),
            y: Math.min(Math.max(8, parsed.y), maxY),
          });
        }
      }
    } catch {
      // Ignore localStorage errors
    }

    const handleResetPositions = () => {
      setPosition(null);
    };
    window.addEventListener("gh_health_reset_widget_positions", handleResetPositions);
    return () => window.removeEventListener("gh_health_reset_widget_positions", handleResetPositions);
  }, [applyTheme]);

  // 3. Listen to system color scheme changes when in 'system' mode
  useEffect(() => {
    if (mode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyTheme("system");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mode, applyTheme]);

  // 4. Update mode and persist
  const handleSelectMode = (newMode: ThemeMode) => {
    setMode(newMode);
    applyTheme(newMode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch {
      // silent
    }
  };

  // 5. Drag handling using Pointer Capture
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    const widget = widgetRef.current;
    if (!widget) return;

    const rect = widget.getBoundingClientRect();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
    };

    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const widget = widgetRef.current;
    if (!widget) return;

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    const rawX = dragStartRef.current.initialLeft + deltaX;
    const rawY = dragStartRef.current.initialTop + deltaY;

    const widgetWidth = widget.offsetWidth || 180;
    const widgetHeight = widget.offsetHeight || 44;
    const maxX = Math.max(8, window.innerWidth - widgetWidth - 8);
    const maxY = Math.max(8, window.innerHeight - widgetHeight - 8);

    const clampedX = Math.min(Math.max(8, rawX), maxX);
    const clampedY = Math.min(Math.max(8, rawY), maxY);

    setPosition({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // silent
    }

    if (position) {
      try {
        localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position));
      } catch {
        // silent
      }
    }
  };

  const handleResetPosition = () => {
    setPosition(null);
    try {
      localStorage.removeItem(POSITION_STORAGE_KEY);
    } catch {
      // silent
    }
  };

  if (!mounted) return null;

  // Positioning style:
  // If dragged, use explicit coordinates.
  // If default, placed nicely at top navbar region beside the ClockWidget.
  const widgetStyle: React.CSSProperties = position
    ? {
        position: "fixed",
        top: `${position.y}px`,
        left: `${position.x}px`,
        right: "auto",
        zIndex: 9999,
        touchAction: "none",
      }
    : {
        position: "fixed",
        top: "10px",
        right: "285px",
        zIndex: 9999,
        touchAction: "none",
      };

  return (
    <div
      ref={widgetRef}
      style={widgetStyle}
      className={[
        "select-none transition-shadow duration-200",
        isDragging ? "cursor-grabbing scale-[1.02] shadow-2xl ring-2 ring-brand-400" : "shadow-lg",
      ].join(" ")}
      role="region"
      aria-label="Theme toggle widget"
    >
      <div className="relative group bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200/90 dark:border-gray-800 rounded-2xl shadow-[0_8px_30px_rgba(139,92,246,0.12)] p-1.5 flex items-center gap-1.5">
        
        {/* ── Drag Handle ── */}
        <div
          ref={dragHandleRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex items-center px-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-brand-500 transition-colors"
          title="Drag to move theme toggle anywhere on screen"
        >
          <span className="font-bold tracking-tighter text-xs leading-none">
            ⋮⋮
          </span>
        </div>

        {/* ── Mode Selection Buttons ── */}
        {!isCompact ? (
          <div className="flex items-center bg-gray-100/90 dark:bg-gray-800/90 p-0.5 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
            {/* Bright (Light) Mode */}
            <button
              onClick={() => handleSelectMode("light")}
              className={[
                "relative flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg transition-all",
                mode === "light"
                  ? "bg-white text-amber-600 shadow-sm dark:bg-gray-700 dark:text-amber-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
              ].join(" ")}
              title="Bright (Light) Mode"
            >
              <span className="text-[13px] leading-none">☀️</span>
              <span className="hidden sm:inline text-[11px]">Bright</span>
            </button>

            {/* Dark Mode */}
            <button
              onClick={() => handleSelectMode("dark")}
              className={[
                "relative flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg transition-all",
                mode === "dark"
                  ? "bg-white text-brand-600 shadow-sm dark:bg-gray-700 dark:text-brand-300"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
              ].join(" ")}
              title="Dark Mode"
            >
              <span className="text-[13px] leading-none">🌙</span>
              <span className="hidden sm:inline text-[11px]">Dark</span>
            </button>

            {/* Auto (System) Mode */}
            <button
              onClick={() => handleSelectMode("system")}
              className={[
                "relative flex items-center gap-1 px-1.5 py-1 text-xs font-semibold rounded-lg transition-all",
                mode === "system"
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-300"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200",
              ].join(" ")}
              title="Auto / System Mode"
            >
              <span className="text-[12px] leading-none">💻</span>
              <span className="hidden sm:inline text-[11px]">Auto</span>
            </button>
          </div>
        ) : (
          /* Compact view: single circular icon button */
          <button
            onClick={() => {
              const next: ThemeMode = mode === "light" ? "dark" : mode === "dark" ? "system" : "light";
              handleSelectMode(next);
            }}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-sm hover:scale-105 active:scale-95 transition-all"
            title={`Current: ${mode} mode. Click to cycle`}
          >
            {mode === "light" && "☀️"}
            {mode === "dark" && "🌙"}
            {mode === "system" && "💻"}
          </button>
        )}

        {/* ── Extra Actions (Reset Position & Minimize) ── */}
        <div className="flex items-center gap-0.5 pl-0.5">
          {position && (
            <button
              onClick={handleResetPosition}
              className="p-1 text-gray-400 hover:text-brand-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              title="Reset position back to navbar"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}

          <button
            onClick={() => setIsCompact((v) => !v)}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            title={isCompact ? "Expand options" : "Compact toggle"}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isCompact ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

      </div>
    </div>
  );
}
