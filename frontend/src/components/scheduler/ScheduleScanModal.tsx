"use client";

import { useState, useEffect, useId, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { Repository, RepositoryScheduleConfig } from "@/lib/types";
import { TimeSelectorClock } from "./TimeSelectorClock";

export interface ScheduleScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  repository: Repository;
  onScheduleUpdated: (updated: Repository) => void;
  repositories?: Repository[];
  onSelectRepository?: (repo: Repository) => void;
}

const FREQUENCY_OPTIONS = [
  {
    key: "DAILY",
    label: "Daily",
    desc: "Runs every day at the chosen time",
    icon: "☀️",
  },
  {
    key: "WEEKLY",
    label: "Weekly",
    desc: "Runs once a week on the chosen day",
    icon: "📅",
  },
  {
    key: "MONTHLY",
    label: "Monthly",
    desc: "Runs once a month on the chosen date",
    icon: "🗓️",
  },
] as const;

const DAYS_OF_WEEK = [
  { key: "MON", label: "Mon" },
  { key: "TUE", label: "Tue" },
  { key: "WED", label: "Wed" },
  { key: "THU", label: "Thu" },
  { key: "FRI", label: "Fri" },
  { key: "SAT", label: "Sat" },
  { key: "SUN", label: "Sun" },
];

function getOrdinalSuffix(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

export function ScheduleScanModal({
  isOpen,
  onClose,
  repository,
  onScheduleUpdated,
  repositories,
  onSelectRepository,
}: ScheduleScanModalProps) {
  const dayOfMonthId = useId();
  const applyAllId = useId();

  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("DAILY");
  const [time, setTime] = useState("02:00");
  const [day, setDay] = useState("MON");
  const [applyToAll, setApplyToAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  const [dayDropdownOpen, setDayDropdownOpen] = useState(false);
  const dayDropdownRef = useRef<HTMLDivElement>(null);
  const activeDayRef = useRef<HTMLButtonElement>(null);

  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const repoDropdownRef = useRef<HTMLDivElement>(null);
  const activeRepoRef = useRef<HTMLButtonElement>(null);

  const [showUtcInfo, setShowUtcInfo] = useState(false);
  const [hoverUtcInfo, setHoverUtcInfo] = useState(false);
  const utcInfoRef = useRef<HTMLDivElement>(null);

  // Close UTC info tag on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (utcInfoRef.current && !utcInfoRef.current.contains(event.target as Node)) {
        setShowUtcInfo(false);
      }
    }
    if (showUtcInfo) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showUtcInfo]);

  // Close day dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dayDropdownRef.current && !dayDropdownRef.current.contains(event.target as Node)) {
        setDayDropdownOpen(false);
      }
    }
    if (dayDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dayDropdownOpen]);

  // Scroll active day into view when dropdown opens
  useEffect(() => {
    if (dayDropdownOpen && activeDayRef.current) {
      activeDayRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [dayDropdownOpen]);

  // Close repo dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (repoDropdownRef.current && !repoDropdownRef.current.contains(event.target as Node)) {
        setRepoDropdownOpen(false);
      }
    }
    if (repoDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [repoDropdownOpen]);

  // Scroll active repo into view when dropdown opens
  useEffect(() => {
    if (repoDropdownOpen && activeRepoRef.current) {
      activeRepoRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [repoDropdownOpen]);

  // Sync state when opened
  useEffect(() => {
    if (isOpen) {
      setEnabled(repository.scan_schedule_enabled ?? false);
      setFrequency(repository.scan_schedule_frequency ?? "DAILY");
      setTime(repository.scan_schedule_time ?? "02:00");
      setDay(repository.scan_schedule_day ?? (repository.scan_schedule_frequency === "MONTHLY" ? "1" : "MON"));
      setApplyToAll(false);
      setMsg(null);
    }
  }, [isOpen, repository]);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await api.put<RepositoryScheduleConfig>(
        `/repositories/${repository.id}/schedule`,
        {
          enabled,
          frequency,
          time,
          day,
          apply_to_all: applyToAll,
        }
      );

      const updatedRepo: Repository = {
        ...repository,
        scan_schedule_enabled: res.enabled,
        scan_schedule_frequency: res.frequency,
        scan_schedule_time: res.time,
        scan_schedule_day: res.day,
        next_scheduled_scan_at: res.next_scheduled_scan_at,
      };

      onScheduleUpdated(updatedRepo);

      const successNotice = applyToAll && res.applied_count && res.applied_count > 1
        ? `Schedule configured and applied across ${res.applied_count} monitored repositories!`
        : enabled
        ? "Auto-scan schedule saved successfully!"
        : "Automated scan schedule disabled.";

      setMsg({ text: successNotice });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setMsg({
        text: err instanceof Error ? err.message : "Failed to save schedule settings",
        isError: true,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative z-20 px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-lg text-brand-600 shadow-2xs">
                ⏱️
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">
                  Auto-Scan Schedule
                </h3>
                {repositories && repositories.length > 1 ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-gray-500 font-medium">Repository:</span>
                    <div className="relative" ref={repoDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setRepoDropdownOpen(!repoDropdownOpen)}
                        className="flex items-center justify-between gap-2 px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50/80 hover:bg-brand-100/80 border border-brand-200 rounded-lg outline-hidden cursor-pointer transition-all shadow-2xs max-w-[280px]"
                        title={repository.full_name}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[12px] shrink-0">📦</span>
                          <span className="truncate text-brand-900">{repository.full_name}</span>
                        </div>
                        <span
                          className={`text-brand-500 text-[10px] shrink-0 transition-transform duration-200 ${
                            repoDropdownOpen ? "rotate-180" : ""
                          }`}
                        >
                          ▼
                        </span>
                      </button>

                      {/* Dropdown showing 7 repositories at a time */}
                      <AnimatePresence>
                        {repoDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.98 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 z-30 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
                          >
                            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                              <span className="font-semibold text-gray-700">Select Repository</span>
                              <span>{repositories.length} available</span>
                            </div>
                            <div className="max-h-[252px] overflow-y-auto divide-y divide-gray-50 py-0.5">
                              {repositories.map((r) => {
                                const isSelected = r.id === repository.id;
                                return (
                                  <button
                                    key={r.id}
                                    ref={isSelected ? activeRepoRef : undefined}
                                    type="button"
                                    onClick={() => {
                                      if (onSelectRepository) {
                                        onSelectRepository(r);
                                      }
                                      setRepoDropdownOpen(false);
                                    }}
                                    className={`w-full px-3 h-9 text-xs flex items-center justify-between text-left transition-colors cursor-pointer group ${
                                      isSelected
                                        ? "bg-brand-50 text-brand-700 font-bold"
                                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                                    title={r.full_name}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                      <span
                                        className={`text-[12px] shrink-0 ${
                                          isSelected ? "text-brand-600" : "text-gray-400 group-hover:text-gray-600"
                                        }`}
                                      >
                                        📦
                                      </span>
                                      <span className="truncate text-xs">
                                        {r.full_name}
                                      </span>
                                    </div>
                                    {isSelected && (
                                      <span className="text-brand-600 font-bold text-xs shrink-0">
                                        ✓
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    {repository.full_name}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {/* Status Callout / Feedback */}
            {msg && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl text-xs font-medium border ${
                  msg.isError
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                }`}
              >
                {msg.text}
              </motion.div>
            )}

            {/* Master Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/70">
              <div>
                <span className="font-semibold text-sm text-gray-900 block">
                  Enable Scheduled Auto-Scans
                </span>
                <span className="text-xs text-gray-500 block mt-0.5">
                  AI will automatically run scans and produce health reports on your schedule.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-hidden cursor-pointer ${
                  enabled ? "bg-brand-500" : "bg-gray-200"
                }`}
              >
                <motion.span
                  layout
                  className="inline-block w-4 h-4 rounded-full bg-white shadow-sm"
                  animate={{ x: enabled ? 24 : 4 }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              </button>
            </div>

            {/* Schedule Details (Visible when enabled) */}
            {enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 pt-1"
              >
                {/* Frequency selection */}
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-2">
                    Scan Frequency
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {FREQUENCY_OPTIONS.map((opt) => {
                      const isSelected = frequency === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setFrequency(opt.key);
                            if (opt.key === "MONTHLY" && day.length > 2) {
                              setDay("1");
                            } else if (opt.key === "WEEKLY" && !isNaN(Number(day))) {
                              setDay("MON");
                            }
                          }}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? "bg-brand-50/70 border-brand-500 ring-2 ring-brand-500/20 text-brand-900"
                              : "border-gray-200 hover:border-gray-300 bg-white text-gray-700"
                          }`}
                        >
                          <div className="text-base mb-1">{opt.icon}</div>
                          <div className="font-semibold text-xs">{opt.label}</div>
                          <div className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">
                            {opt.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Day selector for Weekly */}
                {frequency === "WEEKLY" && (
                  <div>
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-2">
                      Day of the Week
                    </label>
                    <div className="grid grid-cols-7 gap-1">
                      {DAYS_OF_WEEK.map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => setDay(d.key)}
                          className={`py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer text-center ${
                            day === d.key
                              ? "bg-brand-500 text-white border-brand-500 shadow-xs"
                              : "border-gray-200 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Day of Month selector for Monthly */}
                {frequency === "MONTHLY" && (
                  <div>
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-2">
                      Day of the Month
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative" ref={dayDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setDayDropdownOpen(!dayDropdownOpen)}
                          className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs border border-gray-200 rounded-xl bg-white text-gray-900 font-semibold hover:border-brand-400 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-hidden transition-all shadow-2xs cursor-pointer min-w-[200px]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🗓️</span>
                            <span>
                              {day}{getOrdinalSuffix(Number(day) || 1)} of every month
                            </span>
                          </div>
                          <span
                            className={`text-gray-400 text-[10px] transition-transform duration-200 ${
                              dayDropdownOpen ? "rotate-180" : ""
                            }`}
                          >
                            ▼
                          </span>
                        </button>

                        {/* Dropdown showing 5 options at a time */}
                        <AnimatePresence>
                          {dayDropdownOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -4, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -4, scale: 0.98 }}
                              transition={{ duration: 0.15 }}
                              className="absolute left-0 top-full mt-1.5 w-full min-w-[210px] z-30 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
                            >
                              <div className="max-h-[180px] overflow-y-auto divide-y divide-gray-50 py-1">
                                {Array.from({ length: 28 }, (_, i) => i + 1).map((val) => {
                                  const isSelected = String(val) === String(day);
                                  return (
                                    <button
                                      key={val}
                                      ref={isSelected ? activeDayRef : undefined}
                                      type="button"
                                      onClick={() => {
                                        setDay(String(val));
                                        setDayDropdownOpen(false);
                                      }}
                                      className={`w-full px-3.5 h-9 text-xs flex items-center justify-between text-left transition-colors cursor-pointer ${
                                        isSelected
                                          ? "bg-brand-50 text-brand-700 font-bold"
                                          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                      }`}
                                    >
                                      <span>
                                        {val}{getOrdinalSuffix(val)} of every month
                                      </span>
                                      {isSelected && (
                                        <span className="text-brand-600 font-bold text-xs">
                                          ✓
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <span className="text-xs text-gray-500">
                        (Capped at 28th to ensure compatibility with all months)
                      </span>
                    </div>
                  </div>
                )}

                {/* Execution Time (UTC) with functional clock & alternative time selectors */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block">
                        Execution Time (UTC)
                      </label>
                      <div className="relative inline-flex items-center" ref={utcInfoRef}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowUtcInfo((prev) => !prev);
                          }}
                          onMouseEnter={() => setHoverUtcInfo(true)}
                          onMouseLeave={() => setHoverUtcInfo(false)}
                          className="w-4 h-4 rounded-full bg-gray-100 hover:bg-brand-100 text-gray-500 hover:text-brand-700 text-[10px] font-bold flex items-center justify-center transition-colors cursor-pointer border border-gray-200"
                          aria-label="What is UTC time?"
                          title="Learn about UTC execution time"
                        >
                          ℹ
                        </button>
                        <AnimatePresence>
                          {(showUtcInfo || hoverUtcInfo) && (
                            <motion.div
                              initial={{ opacity: 0, y: 6, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 4, scale: 0.95 }}
                              transition={{ duration: 0.15 }}
                              onMouseEnter={() => setHoverUtcInfo(true)}
                              onMouseLeave={() => setHoverUtcInfo(false)}
                              className="absolute left-0 top-full mt-1.5 z-50 w-72 p-3.5 bg-white rounded-xl shadow-xl border border-gray-200 text-gray-800 text-xs text-left"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                                <span>🌐</span>
                                <span>Coordinated Universal Time (UTC)</span>
                              </div>
                              <p className="text-[11px] text-gray-600 leading-relaxed">
                                All recurring scans are scheduled and executed in standardized 24-hour UTC on backend background workers. This ensures consistent execution regardless of Daylight Saving Time (DST) or geographical timezone shifts.
                              </p>
                              <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-brand-600 font-semibold flex items-center gap-1">
                                <span>💡</span>
                                <span>Tip: Use the clock toggle to view and set this time in your own local timezone.</span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">
                      24h UTC standard
                    </span>
                  </div>
                  <TimeSelectorClock value={time} onChange={setTime} />
                </div>

                {/* Bulk Apply Option */}
                <div className="pt-2 border-t border-gray-100">
                  <label htmlFor={applyAllId} className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      id={applyAllId}
                      type="checkbox"
                      checked={applyToAll}
                      onChange={(e) => setApplyToAll(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-semibold text-gray-900 block">
                        Apply this schedule to all monitored repositories
                      </span>
                      <span className="text-[11px] text-gray-500 block leading-tight">
                        Enables and synchronizes this auto-scan schedule across all repositories currently monitored in your workspace.
                      </span>
                    </div>
                  </label>

                  {/* Info Tag when user selects apply to all */}
                  <AnimatePresence>
                    {applyToAll && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -4 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden mt-3"
                      >
                        <div className="p-3 rounded-xl bg-blue-50/90 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5 shadow-2xs">
                          <span className="text-base shrink-0 leading-none mt-0.5" aria-hidden="true">
                            ℹ️
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-blue-950">
                                Workspace-Wide Synchronization
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-200/80 text-blue-900 font-bold uppercase tracking-wider">
                                All Repositories
                              </span>
                            </div>
                            <p className="text-[11px] text-blue-800 leading-relaxed">
                              When enabled, saving will apply this exact scan frequency and execution time across <strong>all monitored repositories</strong> in your workspace. Existing schedules will be updated.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* Next scan indicator */}
            {enabled && repository.next_scheduled_scan_at && (
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                <span>🗓️</span>
                <span>
                  Next scan scheduled:{" "}
                  <strong className="font-semibold">
                    {new Date(repository.next_scheduled_scan_at).toLocaleString()}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-2.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleSave}
              disabled={saving}
              loading={saving}
            >
              {saving ? "Saving…" : "Save Schedule"}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
