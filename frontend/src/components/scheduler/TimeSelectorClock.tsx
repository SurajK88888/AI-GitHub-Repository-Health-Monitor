"use client";

import { useState, useMemo } from "react";
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

export function TimeSelectorClock({ value, onChange }: TimeSelectorClockProps) {
  const [showClockDial, setShowClockDial] = useState(true);
  const [clockMode, setClockMode] = useState<"hours" | "minutes">("hours");

  // Parse hour & minute
  const { hour, minute, hour12, isPM } = useMemo(() => {
    const parts = value.split(":");
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const isAfternoon = h >= 12;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return {
      hour: Math.max(0, Math.min(23, h)),
      minute: Math.max(0, Math.min(59, m)),
      hour12: h12,
      isPM: isAfternoon,
    };
  }, [value]);

  // Convert to local time string
  const localTimeInfo = useMemo(() => {
    try {
      const now = new Date();
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute));
      const formatted = d.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
      const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return { localTime: formatted, timezone: tzName };
    } catch {
      return { localTime: "", timezone: "" };
    }
  }, [hour, minute]);

  const updateTime = (newH: number, newM: number) => {
    const clampedH = Math.max(0, Math.min(23, newH));
    const clampedM = Math.max(0, Math.min(59, newM));
    const hStr = String(clampedH).padStart(2, "0");
    const mStr = String(clampedM).padStart(2, "0");
    onChange(`${hStr}:${mStr}`);
  };

  const handleHourClick = (h12Target: number) => {
    const target24 = isPM ? (h12Target === 12 ? 12 : h12Target + 12) : h12Target === 12 ? 0 : h12Target;
    updateTime(target24, minute);
  };

  const toggleAmPm = (targetPM: boolean) => {
    if (targetPM === isPM) return;
    const newH = targetPM ? (hour < 12 ? hour + 12 : hour) : (hour >= 12 ? hour - 12 : hour);
    updateTime(newH, minute);
  };

  const adjustHour = (delta: number) => {
    const newH = (hour + delta + 24) % 24;
    updateTime(newH, minute);
  };

  const adjustMinute = (delta: number) => {
    const newM = (minute + delta + 60) % 60;
    updateTime(hour, newM);
  };

  // Clock Hand angles
  const hourAngle = ((hour % 12) + minute / 60) * 30; // 360 / 12 = 30 deg/hr
  const minuteAngle = minute * 6; // 360 / 60 = 6 deg/min

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

      {/* 2. Interactive Time Bar & Clock Toggle Button */}
      <div className="p-3 bg-gray-50/90 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between gap-3">
        {/* Digital Time display with Stepper */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-2xs font-mono text-sm font-bold text-gray-900">
            <span>{String(hour).padStart(2, "0")}</span>
            <span className="mx-0.5 text-brand-600 animate-pulse">:</span>
            <span>{String(minute).padStart(2, "0")}</span>
            <span className="ml-1.5 text-[11px] font-sans font-semibold text-gray-500">
              UTC
            </span>
          </div>

          {/* Quick Increment buttons */}
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
        </div>

        {/* Toggle Clock Dial button */}
        <button
          type="button"
          onClick={() => setShowClockDial(!showClockDial)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
            showClockDial
              ? "bg-brand-500 text-white border-brand-500 shadow-2xs"
              : "bg-white text-brand-700 border-brand-300 hover:bg-brand-50"
          }`}
        >
          <span>🕒</span>
          <span>{showClockDial ? "Hide Clock Dial" : "Open Clock Dial"}</span>
        </button>
      </div>

      {/* 3. Local Time Conversion Feedback */}
      {localTimeInfo.localTime && (
        <div className="flex items-center gap-2 text-[11px] text-gray-600 px-1">
          <span className="text-brand-600 font-bold">📍 Local Time:</span>
          <span className="font-semibold text-gray-800">
            {localTimeInfo.localTime}
          </span>
          <span className="text-gray-400">
            ({localTimeInfo.timezone.replace(/_/g, " ")})
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
              <div className="relative w-36 h-36 shrink-0 bg-white rounded-full border-2 border-brand-300 shadow-md flex items-center justify-center select-none">
                {/* Dial numbers */}
                {dialHours.map((hNum, index) => {
                  const angleDeg = index * 30; // 0, 30, 60...
                  const angleRad = (angleDeg * Math.PI) / 180;
                  const radius = 54; // distance from center
                  const x = 72 + radius * Math.sin(angleRad) - 10;
                  const y = 72 - radius * Math.cos(angleRad) - 10;
                  const isCurrent = hour12 === hNum;

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

              {/* Right Side: AM/PM + Mode Toggles + Rapid Selection Grids */}
              <div className="flex-1 space-y-3 w-full">
                {/* AM / PM Segmented Control */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-700">
                    Period (UTC):
                  </span>
                  <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => toggleAmPm(false)}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                        !isPM
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
                        isPM
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
                    Select Hour ({hour}h)
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
                    Select Minute (:{String(minute).padStart(2, "0")})
                  </button>
                </div>

                {/* Grid for Hours */}
                {clockMode === "hours" && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-gray-500 font-medium block">
                      Click any hour to set:
                    </span>
                    <div className="grid grid-cols-6 gap-1">
                      {Array.from({ length: 24 }, (_, i) => i).map((hVal) => {
                        const isSelected = hour === hVal;
                        return (
                          <button
                            key={hVal}
                            type="button"
                            onClick={() => updateTime(hVal, minute)}
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
                        const isSelected = minute === mVal;
                        return (
                          <button
                            key={mStr}
                            type="button"
                            onClick={() => updateTime(hour, mVal)}
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
