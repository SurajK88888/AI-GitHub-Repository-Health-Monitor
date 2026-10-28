"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClockSettings, WidgetPosition } from "./types";
import {
  POPULAR_TIMEZONES,
  getTimezoneOffset,
  getAllSupportedTimezones,
} from "./timezones";

const SETTINGS_KEY = "gh_health_clock_widget_settings";
const POSITION_KEY = "gh_health_clock_widget_position";

const DEFAULT_SETTINGS: ClockSettings = {
  hourFormat: "12h",
  timezone: "local",
  showSeconds: true,
  showDate: true,
  isCompact: false,
};

export function ClockWidget() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());
  const [settings, setSettings] = useState<ClockSettings>(DEFAULT_SETTINGS);
  const [showTzPicker, setShowTzPicker] = useState(false);
  const [tzSearch, setTzSearch] = useState("");

  // Draggable position state (null means use CSS default top-right corner of navbar)
  const [position, setPosition] = useState<WidgetPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const widgetRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const tzDropdownRef = useRef<HTMLDivElement>(null);

  // Drag coordinates refs
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialLeft: number;
    initialTop: number;
  }>({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0 });

  // 1. Load settings & saved position from localStorage once mounted
  useEffect(() => {
    setMounted(true);
    setNow(new Date());

    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        setSettings((prev) => ({ ...prev, ...JSON.parse(savedSettings) }));
      }
    } catch {
      // Ignore localStorage errors
    }

    try {
      const savedPos = localStorage.getItem(POSITION_KEY);
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          // Clamp within viewport
          const maxX = Math.max(0, window.innerWidth - 180);
          const maxY = Math.max(0, window.innerHeight - 60);
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
  }, []);

  // 2. Save settings whenever changed
  const updateSettings = useCallback((newPartial: Partial<ClockSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newPartial };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      } catch {
        // silent
      }
      return updated;
    });
  }, []);

  // 3. High-precision real-time clock engine: synchronizes with exact second boundaries without lag
  useEffect(() => {
    if (!mounted) return;

    let intervalId: ReturnType<typeof setInterval>;
    let timeoutId: ReturnType<typeof setTimeout>;

    const syncClock = () => {
      setNow(new Date());
      const msUntilNextSecond = 1000 - (Date.now() % 1000);

      timeoutId = setTimeout(() => {
        setNow(new Date());
        intervalId = setInterval(() => {
          setNow(new Date());
        }, 1000);
      }, msUntilNextSecond);
    };

    syncClock();

    // Re-sync immediately on tab focus / visibilitychange to prevent any clock drift or sleep lag
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
        syncClock();
      }
    };

    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [mounted]);

  // 4. Close timezone picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tzDropdownRef.current && !tzDropdownRef.current.contains(e.target as Node)) {
        setShowTzPicker(false);
      }
    }
    if (showTzPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTzPicker]);

  // 5. Drag handling using Pointer Events with Pointer Capture
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

    // Viewport clamping
    const widgetWidth = widget.offsetWidth || 260;
    const widgetHeight = widget.offsetHeight || 60;
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
        localStorage.setItem(POSITION_KEY, JSON.stringify(position));
      } catch {
        // silent
      }
    }
  };

  // Reset to default top-right corner of the navbar
  const handleResetPosition = () => {
    setPosition(null);
    try {
      localStorage.removeItem(POSITION_KEY);
    } catch {
      // silent
    }
  };

  // 6. Time and Date formatting
  const tz = settings.timezone === "local" ? undefined : settings.timezone;

  const formattedTimeParts = useMemo(() => {
    try {
      const is12 = settings.hourFormat === "12h";
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour12: is12,
        hour: "2-digit",
        minute: "2-digit",
        second: settings.showSeconds ? "2-digit" : undefined,
      }).formatToParts(now);

      const hour = parts.find((p) => p.type === "hour")?.value || "00";
      const minute = parts.find((p) => p.type === "minute")?.value || "00";
      const second = parts.find((p) => p.type === "second")?.value;
      const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value?.toUpperCase();

      return { hour, minute, second, dayPeriod };
    } catch {
      return { hour: "--", minute: "--", second: "--", dayPeriod: "" };
    }
  }, [now, tz, settings.hourFormat, settings.showSeconds]);

  const formattedDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(now);
    } catch {
      return "";
    }
  }, [now, tz]);

  const timezoneOffset = useMemo(() => {
    return getTimezoneOffset(settings.timezone, now);
  }, [settings.timezone, now]);

  // List of all timezones filtered by search
  const filteredTimezones = useMemo(() => {
    const q = tzSearch.trim().toLowerCase();
    if (!q) return POPULAR_TIMEZONES;

    const all = getAllSupportedTimezones();
    const matchedIana = all
      .filter((name) => name.toLowerCase().includes(q))
      .slice(0, 30)
      .map((val) => ({
        value: val,
        label: val.replace(/_/g, " "),
        region: val.split("/")[0] || "Global",
      }));

    const popularMatches = POPULAR_TIMEZONES.filter(
      (p) => p.label.toLowerCase().includes(q) || p.value.toLowerCase().includes(q)
    );

    const map = new Map<string, { value: string; label: string; region: string }>();
    popularMatches.forEach((item) => map.set(item.value, item));
    matchedIana.forEach((item) => {
      if (!map.has(item.value)) map.set(item.value, item);
    });

    return Array.from(map.values());
  }, [tzSearch]);

  if (!mounted) {
    return null;
  }

  // Positioning style
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
        right: "16px",
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
      aria-label="Real-time system clock widget"
    >
      <div className="relative group bg-[#0F171E]/80 backdrop-blur-[20px] border border-white/[0.14] rounded-2xl shadow-2xl p-2.5 min-w-[240px] text-white">
        
        {/* ── Top Bar: Drag Handle, Status Indicator & Action Buttons ── */}
        <div
          ref={dragHandleRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/[0.08] cursor-grab active:cursor-grabbing text-white/40 hover:text-white/70"
          title="Drag to move clock anywhere on screen"
        >
          {/* Left: Drag grip & Live indicator */}
          <div className="flex items-center gap-1.5">
            <span className="text-white/30 font-bold tracking-tighter text-xs px-0.5 leading-none hover:text-white/70">
              ⋮⋮
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>

          {/* Right: Quick Controls (12H/24H toggle, Reset Position, Minimize) */}
          <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
            {/* 12H / 24H Toggle Button */}
            <button
              onClick={() =>
                updateSettings({
                  hourFormat: settings.hourFormat === "12h" ? "24h" : "12h",
                })
              }
              className={[
                "px-1.5 py-0.5 text-[10px] font-bold rounded tracking-wide transition-all",
                settings.hourFormat === "12h"
                  ? "bg-white/[0.12] text-white hover:bg-white/[0.18]"
                  : "bg-white/[0.06] text-white/70 hover:bg-white/[0.10]",
              ].join(" ")}
              title={`Click to switch to ${settings.hourFormat === "12h" ? "24-hour" : "12-hour"} format`}
            >
              {settings.hourFormat.toUpperCase()}
            </button>

            {/* Reset Position (visible when moved) */}
            {position && (
              <button
                onClick={handleResetPosition}
                className="p-1 text-gray-400 hover:text-brand-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                title="Reset to top-right navbar corner"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}

            {/* Compact Mode Toggle */}
            <button
              onClick={() => updateSettings({ isCompact: !settings.isCompact })}
              className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              title={settings.isCompact ? "Expand details" : "Collapse into compact view"}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {settings.isCompact ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* ── Main Clock Body: Digital Time Display ── */}
        <div className="flex items-baseline justify-between gap-3 px-1">
          <div className="flex items-baseline font-mono tracking-tight font-bold text-gray-900 dark:text-white tabular-nums">
            <span className="text-xl sm:text-2xl leading-none">
              {formattedTimeParts.hour}:{formattedTimeParts.minute}
            </span>
            {settings.showSeconds && formattedTimeParts.second && (
              <span className="text-sm sm:text-base text-brand-600 dark:text-brand-400 font-semibold ml-1 leading-none">
                :{formattedTimeParts.second}
              </span>
            )}
          </div>

          {/* AM / PM badge (for 12h format) */}
          {settings.hourFormat === "12h" && formattedTimeParts.dayPeriod && (
            <span className="px-1.5 py-0.5 text-[11px] font-bold tracking-wider text-white bg-white/[0.10] border border-white/[0.15] rounded-md">
              {formattedTimeParts.dayPeriod}
            </span>
          )}
        </div>

        {/* ── Expanded Section: Date & Timezone ── */}
        <AnimatePresence>
          {!settings.isCompact && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {/* Date line */}
              {settings.showDate && (
                <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-white/50 mt-1.5 px-1">
                  <span className="opacity-70">📅</span>
                  <span>{formattedDate}</span>
                </div>
              )}

              {/* Timezone pill button */}
              <div className="mt-2 pt-1.5 border-t border-white/[0.08] flex items-center justify-between text-[11px]">
                <button
                  onClick={() => setShowTzPicker((v) => !v)}
                  className="flex items-center gap-1.5 text-white/80 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.10] px-2.5 py-1 rounded-full transition-colors max-w-[200px] truncate"
                  title="Change timezone"
                >
                  <span className="text-xs">🌐</span>
                  <span className="font-medium truncate">
                    {settings.timezone === "local" ? "Local Time" : settings.timezone.split("/").pop()?.replace(/_/g, " ")}
                  </span>
                  {timezoneOffset && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                      {timezoneOffset}
                    </span>
                  )}
                  <span className="text-[9px] text-gray-400">▾</span>
                </button>

                {/* Seconds toggle */}
                <button
                  onClick={() => updateSettings({ showSeconds: !settings.showSeconds })}
                  className={[
                    "text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors",
                    settings.showSeconds
                      ? "text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/50"
                      : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                  ].join(" ")}
                  title="Toggle seconds display"
                >
                  {settings.showSeconds ? "Sec ON" : "Sec OFF"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Timezone Picker Modal / Popover ── */}
        <AnimatePresence>
          {showTzPicker && (
            <motion.div
              ref={tzDropdownRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 right-0 top-full mt-2 bg-[#0F161E]/95 backdrop-blur-[24px] border border-white/[0.14] rounded-2xl shadow-2xl p-2.5 z-50 max-h-72 flex flex-col text-white"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                  <span>🌍</span> Select Timezone
                </span>
                <button
                  onClick={() => setShowTzPicker(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs px-1"
                >
                  ✕
                </button>
              </div>

              {/* Search box */}
              <div className="mb-2">
                <input
                  type="text"
                  placeholder="Search city, country, or zone..."
                  value={tzSearch}
                  onChange={(e) => setTzSearch(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  autoFocus
                />
              </div>

              {/* Timezone List */}
              <div className="overflow-y-auto space-y-0.5 flex-1 max-h-44 pr-1 text-xs">
                {filteredTimezones.map((tzOpt) => {
                  const isSelected = settings.timezone === tzOpt.value;
                  const offset = getTimezoneOffset(tzOpt.value, now);

                  return (
                    <button
                      key={tzOpt.value}
                      onClick={() => {
                        updateSettings({ timezone: tzOpt.value });
                        setShowTzPicker(false);
                      }}
                      className={[
                        "w-full text-left px-2 py-1.5 rounded-lg flex items-center justify-between transition-colors",
                        isSelected
                          ? "bg-brand-50 text-brand-700 font-semibold dark:bg-brand-950/60 dark:text-brand-300"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800",
                      ].join(" ")}
                    >
                      <span className="truncate pr-2">{tzOpt.label}</span>
                      {offset && (
                        <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">
                          {offset}
                        </span>
                      )}
                    </button>
                  );
                })}

                {filteredTimezones.length === 0 && (
                  <p className="text-center text-gray-400 py-3 text-xs">
                    No matching timezones found
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
