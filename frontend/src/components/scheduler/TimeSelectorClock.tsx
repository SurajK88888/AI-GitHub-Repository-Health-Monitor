"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface TimeSelectorClockProps {
  value: string; // "HH:MM" in 24h UTC format
  onChange: (time: string) => void;
}

const COMMON_PRESETS = [
  { label: "00:00 UTC", time: "00:00", desc: "Midnight" },
  { label: "02:00 UTC", time: "02:00", desc: "Early Night" },
  { label: "06:00 UTC", time: "06:00", desc: "Morning" },
  { label: "09:00 UTC", time: "09:00", desc: "Workday Start" },
  { label: "12:00 UTC", time: "12:00", desc: "Noon" },
  { label: "15:00 UTC", time: "15:00", desc: "Afternoon" },
  { label: "18:00 UTC", time: "18:00", desc: "Evening" },
  { label: "21:00 UTC", time: "21:00", desc: "Late Night" },
];

const EXTENDED_MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

// Convert local hour & minute to 24-hour UTC "HH:MM"
function convertLocalToUtc(localHour: number, localMinute: number): string {
  try {
    const now = new Date();
    const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), localHour, localMinute);
    const utcH = String(localDate.getUTCHours()).padStart(2, "0");
    const utcM = String(localDate.getUTCMinutes()).padStart(2, "0");
    return `${utcH}:${utcM}`;
  } catch {
    return "00:00";
  }
}

// Format timezone offset string e.g. "UTC+05:30"
function getTimezoneOffsetString(): string {
  try {
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? "+" : "-";
    const absMin = Math.abs(offsetMin);
    const hours = Math.floor(absMin / 60);
    const mins = absMin % 60;
    return `UTC${sign}${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  } catch {
    return "UTC";
  }
}

export function TimeSelectorClock({ value, onChange }: TimeSelectorClockProps) {
  const [showClockDial, setShowClockDial] = useState(true);
  const [clockMode, setClockMode] = useState<"hours" | "minutes">("hours");
  // Toggle between UTC and Local Time view
  const [timeViewMode, setTimeViewMode] = useState<"UTC" | "LOCAL">("UTC");
  // Toggle between 12-hour and 24-hour format display
  const [hourFormat, setHourFormat] = useState<"12h" | "24h">("24h");

  // Local time info tag popover state
  const [showLocalInfo, setShowLocalInfo] = useState(false);
  const [hoverLocalInfo, setHoverLocalInfo] = useState(false);
  const localInfoRef = useRef<HTMLDivElement>(null);

  // Click outside to dismiss local time info
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (localInfoRef.current && !localInfoRef.current.contains(event.target as Node)) {
        setShowLocalInfo(false);
      }
    }
    if (showLocalInfo) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showLocalInfo]);

  // Parse UTC hour & minute
  const { utcHour, utcMinute } = useMemo(() => {
    const parts = value.split(":");
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return {
      utcHour: Math.max(0, Math.min(23, h)),
      utcMinute: Math.max(0, Math.min(59, m)),
    };
  }, [value]);

  // Convert to local time numbers & formatted string
  const localTimeInfo = useMemo(() => {
    try {
      const now = new Date();
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, utcMinute));
      const formatted = d.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
      const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return {
        localHour: d.getHours(),
        localMinute: d.getMinutes(),
        localTime: formatted,
        timezone: tzName,
      };
    } catch {
      return {
        localHour: utcHour,
        localMinute: utcMinute,
        localTime: "",
        timezone: "",
      };
    }
  }, [utcHour, utcMinute]);

  const offsetStr = useMemo(() => getTimezoneOffsetString(), []);

  // Compute active display numbers depending on active view mode (UTC vs LOCAL)
  const isLocalMode = timeViewMode === "LOCAL";
  const displayHour = isLocalMode ? localTimeInfo.localHour : utcHour;
  const displayMinute = isLocalMode ? localTimeInfo.localMinute : utcMinute;
  const displayHour12 = displayHour % 12 === 0 ? 12 : displayHour % 12;
  const isDisplayPM = displayHour >= 12;

  // Update time based on current view mode
  const updateActiveTime = (newH: number, newM: number) => {
    const clampedH = Math.max(0, Math.min(23, newH));
    const clampedM = Math.max(0, Math.min(59, newM));

    if (isLocalMode) {
      // Convert local time back to UTC before passing to onChange
      const utcString = convertLocalToUtc(clampedH, clampedM);
      onChange(utcString);
    } else {
      const hStr = String(clampedH).padStart(2, "0");
      const mStr = String(clampedM).padStart(2, "0");
      onChange(`${hStr}:${mStr}`);
    }
  };

  const handleHourClick = (h12Target: number) => {
    const target24 = isDisplayPM ? (h12Target === 12 ? 12 : h12Target + 12) : h12Target === 12 ? 0 : h12Target;
    updateActiveTime(target24, displayMinute);
  };

  const toggleAmPm = (targetPM: boolean) => {
    if (targetPM === isDisplayPM) return;
    const newH = targetPM ? (displayHour < 12 ? displayHour + 12 : displayHour) : (displayHour >= 12 ? displayHour - 12 : displayHour);
    updateActiveTime(newH, displayMinute);
  };

  const adjustHour = (delta: number) => {
    const newH = (displayHour + delta + 24) % 24;
    updateActiveTime(newH, displayMinute);
  };

  const adjustMinute = (delta: number) => {
    const newM = (displayMinute + delta + 60) % 60;
    updateActiveTime(displayHour, newM);
  };

  // Clock Hand angles calculated from active display time
  const hourAngle = ((displayHour % 12) + displayMinute / 60) * 30; // 360 / 12 = 30 deg/hr
  const minuteAngle = displayMinute * 6; // 360 / 60 = 6 deg/min

  // Circular dial hour markers (12 numbers)
  const dialHours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <div className="space-y-3">
      {/* 1. Quick Presets Pills */}
      <div>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_PRESETS.map((preset) => {
            const isSelected = value === preset.time;
            return (
              <button
                key={preset.time}
                type="button"
                onClick={() => onChange(preset.time)}
                className={`px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-brand-500 text-white border-brand-500 font-semibold shadow-2xs"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50 bg-white"
                }`}
                title={`${preset.desc} (${preset.time} UTC)`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Interactive Time Bar with UTC/Local Mode Toggle, Steppers & Clock Open/Close */}
      <div className="p-3 bg-gray-50/90 rounded-xl border border-gray-200 space-y-2.5">
        {/* Top Row: Mode Toggle + Digital Time Display on Left, 12h / 24h Format Toggle on Complete Right */}
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* UTC vs Local Time Mode Toggle Button */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setTimeViewMode("UTC")}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  timeViewMode === "UTC"
                    ? "bg-brand-500 text-white shadow-2xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
                title="Show and configure clock in UTC"
              >
                <span>🌐</span>
                <span>UTC</span>
              </button>
              <button
                type="button"
                onClick={() => setTimeViewMode("LOCAL")}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                  timeViewMode === "LOCAL"
                    ? "bg-brand-500 text-white shadow-2xs"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
                title="Show and configure clock in your local timezone"
              >
                <span>📍</span>
                <span>Local</span>
              </button>
            </div>

            {/* Digital Time display with Stepper */}
            <div className="flex items-center bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-2xs font-mono text-sm font-bold text-gray-900">
              <span>{String(hourFormat === "12h" ? displayHour12 : displayHour).padStart(2, "0")}</span>
              <span className="mx-0.5 text-brand-600 animate-pulse">:</span>
              <span>{String(displayMinute).padStart(2, "0")}</span>
              {hourFormat === "12h" && (
                <button
                  type="button"
                  onClick={() => toggleAmPm(!isDisplayPM)}
                  className="ml-1 text-[10px] font-sans font-extrabold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 hover:bg-brand-100 hover:text-brand-700 transition-colors cursor-pointer"
                  title="Click to toggle AM/PM"
                >
                  {isDisplayPM ? "PM" : "AM"}
                </button>
              )}
              <span
                className={`ml-1.5 text-[10px] font-sans font-extrabold uppercase px-1.5 py-0.5 rounded ${
                  isLocalMode
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}
              >
                {isLocalMode ? "Local" : "UTC"}
              </span>
            </div>
          </div>

          {/* 12h / 24h format toggle button on complete right side */}
          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shadow-2xs ml-auto">
            <button
              type="button"
              onClick={() => setHourFormat("12h")}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                hourFormat === "12h"
                  ? "bg-brand-500 text-white shadow-2xs"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              title="12-hour format (AM/PM)"
            >
              12h
            </button>
            <button
              type="button"
              onClick={() => setHourFormat("24h")}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                hourFormat === "24h"
                  ? "bg-brand-500 text-white shadow-2xs"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
              title="24-hour format (00-23)"
            >
              24h
            </button>
          </div>
        </div>

        {/* Bottom Row: Quick Increment Steppers on Left, Hide/Open Clock Dial on Right */}
        <div className="flex items-center justify-between gap-2.5 flex-wrap pt-0.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => adjustHour(-1)}
              className="h-8 px-2.5 min-w-[38px] flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-95"
              title="-1 Hour"
            >
              -1h
            </button>
            <button
              type="button"
              onClick={() => adjustHour(1)}
              className="h-8 px-2.5 min-w-[38px] flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-95"
              title="+1 Hour"
            >
              +1h
            </button>
            <button
              type="button"
              onClick={() => adjustMinute(-15)}
              className="h-8 px-3 min-w-[48px] flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-95"
              title="-15 Minutes"
            >
              -15m
            </button>
            <button
              type="button"
              onClick={() => adjustMinute(15)}
              className="h-8 px-3 min-w-[48px] flex items-center justify-center rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer active:scale-95"
              title="+15 Minutes"
            >
              +15m
            </button>
          </div>

          {/* Toggle Clock Dial button */}
          <button
            type="button"
            onClick={() => setShowClockDial(!showClockDial)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ml-auto ${
              showClockDial
                ? "bg-brand-500 text-white border-brand-500 shadow-2xs"
                : "bg-white text-brand-700 border-brand-300 hover:bg-brand-50"
            }`}
          >
            <span>🕒</span>
            <span>{showClockDial ? "Hide Clock Dial" : "Open Clock Dial"}</span>
          </button>
        </div>
      </div>

      {/* 3. Highlighted Local Time Area with Border, +2px Font Size, and Info Tag */}
      {localTimeInfo.localTime && (
        <div className="relative rounded-xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/70 via-purple-50/30 to-white p-2.5 px-3.5 shadow-2xs flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Title with icon & +2px font size (13px) */}
            <span className="text-[13px] font-bold text-indigo-950 flex items-center gap-1.5">
              <span>📍</span>
              <span>Local Time:</span>
            </span>

            {/* Info Tag for Local Time conversion */}
            <div className="relative inline-flex items-center" ref={localInfoRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLocalInfo((prev) => !prev);
                }}
                onMouseEnter={() => setHoverLocalInfo(true)}
                onMouseLeave={() => setHoverLocalInfo(false)}
                className="w-4 h-4 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[10px] font-bold flex items-center justify-center transition-colors cursor-pointer border border-indigo-200/70"
                aria-label="How is local time calculated?"
                title="Explain local time conversion"
              >
                ℹ
              </button>

              <AnimatePresence>
                {(showLocalInfo || hoverLocalInfo) && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    onMouseEnter={() => setHoverLocalInfo(true)}
                    onMouseLeave={() => setHoverLocalInfo(false)}
                    className="absolute left-0 bottom-full mb-2 z-50 w-72 p-3.5 bg-white rounded-xl shadow-xl border border-gray-200 text-gray-800 text-left text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                      <span>📍</span>
                      <span>Local Timezone Conversion</span>
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      Automatically calculated from your browser's system timezone (<strong>{localTimeInfo.timezone}</strong>, {offsetStr}).
                    </p>
                    <div className="mt-2 p-2 bg-indigo-50/80 rounded-lg text-[11px] text-indigo-950 border border-indigo-100/80 space-y-0.5">
                      <div>Scheduled UTC: <strong className="font-mono text-gray-900">{value} UTC</strong></div>
                      <div>Your Local Time: <strong className="font-mono text-indigo-900">{localTimeInfo.localTime}</strong></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Local time value with +2px font size (13px) */}
            <span className="text-[13px] font-extrabold text-indigo-950 font-mono tracking-tight bg-white px-2 py-0.5 rounded-md border border-indigo-100 shadow-2xs">
              {localTimeInfo.localTime}
            </span>

            {/* Timezone label */}
            <span className="text-[12px] font-semibold text-indigo-700/80">
              ({localTimeInfo.timezone.replace(/_/g, " ")})
            </span>
          </div>

          {/* Timezone offset pill */}
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-100/80 text-indigo-900 border border-indigo-200/70">
            {offsetStr}
          </span>
        </div>
      )}

      {/* 4. Interactive Analog Clock & Detailed Hour/Minute Selector */}
      <AnimatePresence>
        {showClockDial && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="p-4 rounded-xl border border-brand-100 bg-brand-50/40 space-y-4 overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              {/* Visual Analog Clock Face */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-36 h-36 shrink-0 bg-white rounded-full border-2 border-brand-300 shadow-md flex items-center justify-center select-none">
                  {/* Dial numbers */}
                  {dialHours.map((hNum, index) => {
                    const angleDeg = index * 30; // 0, 30, 60...
                    const angleRad = (angleDeg * Math.PI) / 180;
                    const radius = 54; // distance from center
                    const x = 72 + radius * Math.sin(angleRad) - 10;
                    const y = 72 - radius * Math.cos(angleRad) - 10;
                    const isCurrent = displayHour12 === hNum;

                    return (
                      <button
                        key={hNum}
                        type="button"
                        onClick={() => handleHourClick(hNum)}
                        style={{ left: `${x}px`, top: `${y}px` }}
                        className={`absolute w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-brand-500 text-white shadow-xs scale-110"
                            : "text-gray-700 hover:bg-brand-100"
                        }`}
                      >
                        {hNum}
                      </button>
                    );
                  })}

                  {/* Clock Hands SVG */}
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 144 144"
                  >
                    {/* Hour Hand */}
                    <line
                      x1="72"
                      y1="72"
                      x2="72"
                      y2="38"
                      stroke="#4f46e5"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      transform={`rotate(${hourAngle} 72 72)`}
                    />
                    {/* Minute Hand */}
                    <line
                      x1="72"
                      y1="72"
                      x2="72"
                      y2="22"
                      stroke="#06b6d4"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      transform={`rotate(${minuteAngle} 72 72)`}
                    />
                    {/* Center Pivot */}
                    <circle cx="72" cy="72" r="4.5" fill="#4f46e5" />
                    <circle cx="72" cy="72" r="2" fill="#ffffff" />
                  </svg>
                </div>

                {/* Clock face mode sublabel */}
                <span className="text-[11px] font-bold text-gray-500">
                  Dial reflects:{" "}
                  <strong className="text-brand-600">
                    {isLocalMode ? "Local Time" : "UTC Time"}
                  </strong>
                </span>
              </div>

              {/* Right Side: AM/PM + Mode Toggles + Rapid Selection Grids */}
              <div className="flex-1 space-y-3 w-full">
                {/* AM / PM Segmented Control */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-700">
                    Period ({isLocalMode ? "Local" : "UTC"}):
                  </span>
                  <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => toggleAmPm(false)}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                        !isDisplayPM
                          ? "bg-brand-500 text-white shadow-2xs"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      AM (00–11)
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAmPm(true)}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                        isDisplayPM
                          ? "bg-brand-500 text-white shadow-2xs"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      PM (12–23)
                    </button>
                  </div>
                </div>

                {/* Sub-mode selector (Hours / Minutes) */}
                <div className="flex items-center gap-1 border-b border-gray-200 pb-1.5">
                  <button
                    type="button"
                    onClick={() => setClockMode("hours")}
                    className={`text-xs font-bold px-2 py-1 rounded transition-colors cursor-pointer ${
                      clockMode === "hours"
                        ? "text-brand-600 bg-white border border-brand-200 shadow-2xs"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    Select Hour ({hourFormat === "12h" ? `${displayHour12} ${isDisplayPM ? "PM" : "AM"}` : `${displayHour}h`})
                  </button>
                  <button
                    type="button"
                    onClick={() => setClockMode("minutes")}
                    className={`text-xs font-bold px-2 py-1 rounded transition-colors cursor-pointer ${
                      clockMode === "minutes"
                        ? "text-brand-600 bg-white border border-brand-200 shadow-2xs"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    Select Minute (:{String(displayMinute).padStart(2, "0")})
                  </button>
                </div>

                {/* Grid for Hours */}
                {clockMode === "hours" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500 font-medium block">
                        Click any hour to set ({isLocalMode ? "Local" : "UTC"}):
                      </span>
                      {hourFormat === "12h" && (
                        <span className="text-[10px] font-semibold text-brand-600">
                          Period: {isDisplayPM ? "PM" : "AM"}
                        </span>
                      )}
                    </div>
                    {hourFormat === "12h" ? (
                      <div className="grid grid-cols-6 gap-1">
                        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h12) => {
                          const isSelected = displayHour12 === h12;
                          return (
                            <button
                              key={h12}
                              type="button"
                              onClick={() => handleHourClick(h12)}
                              className={`py-1 text-center rounded text-xs font-bold border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-brand-500 text-white border-brand-500 shadow-2xs"
                                  : "bg-white text-gray-700 border-gray-200 hover:bg-brand-50"
                              }`}
                            >
                              {String(h12).padStart(2, "0")} {isDisplayPM ? "PM" : "AM"}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-6 gap-1">
                        {Array.from({ length: 24 }, (_, i) => i).map((hVal) => {
                          const isSelected = displayHour === hVal;
                          return (
                            <button
                              key={hVal}
                              type="button"
                              onClick={() => updateActiveTime(hVal, displayMinute)}
                              className={`py-1 text-center rounded text-xs font-bold border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-brand-500 text-white border-brand-500 shadow-2xs"
                                  : "bg-white text-gray-700 border-gray-200 hover:bg-brand-50"
                              }`}
                            >
                              {String(hVal).padStart(2, "0")}h
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Grid for Minutes */}
                {clockMode === "minutes" && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-gray-500 font-medium block">
                      Click standard minute interval:
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      {EXTENDED_MINUTES.map((mStr) => {
                        const mVal = parseInt(mStr, 10);
                        const isSelected = displayMinute === mVal;
                        return (
                          <button
                            key={mStr}
                            type="button"
                            onClick={() => updateActiveTime(displayHour, mVal)}
                            className={`py-1 text-center rounded text-xs font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-cyan-600 text-white border-cyan-600 shadow-2xs"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-cyan-50"
                            }`}
                          >
                            :{mStr}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
