"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Repository } from "@/lib/types";

export interface ScheduleButtonWithInfoProps {
  repository: Repository;
  onOpenScheduleModal: (repo: Repository) => void;
  className?: string;
  size?: "sm" | "md";
  compact?: boolean;
}

export function ScheduleButtonWithInfo({
  repository,
  onOpenScheduleModal,
  className = "",
  size = "sm",
  compact = false,
}: ScheduleButtonWithInfoProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  // Handle hover debounce
  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHovered(true);
    }, 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setHovered(false);
    }, 180);
  };

  const isConfigured = Boolean(repository.scan_schedule_enabled);
  const frequency = repository.scan_schedule_frequency || "DAILY";
  const timeUtc = repository.scan_schedule_time || "02:00";
  const day = repository.scan_schedule_day;

  // Format local time
  let localTimeStr = "";
  try {
    const [h, m] = timeUtc.split(":").map(Number);
    const now = new Date();
    const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h || 0, m || 0));
    localTimeStr = utcDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    localTimeStr = "";
  }

  // Format next scan timestamp
  let nextScanFormatted = "";
  if (repository.next_scheduled_scan_at) {
    try {
      nextScanFormatted = new Date(repository.next_scheduled_scan_at).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      nextScanFormatted = "";
    }
  }

  let freqLabel = "Every day";
  if (frequency === "WEEKLY") {
    freqLabel = `Weekly on ${day || "Mon"}`;
  } else if (frequency === "MONTHLY") {
    freqLabel = `Monthly on day ${day || "1"}`;
  }

  const showPopover = open || hovered;

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={containerRef}>
      {/* Split Button Container: Main Action + Info Tag Trigger */}
      <div
        className={`inline-flex items-center rounded-lg border transition-all ${
          isConfigured
            ? "border-brand-200 bg-white hover:border-brand-300 shadow-2xs"
            : "border-gray-200 bg-white hover:border-gray-300 shadow-2xs"
        }`}
      >
        {/* Main Schedule Button */}
        <button
          type="button"
          onClick={() => onOpenScheduleModal(repository)}
          className={`inline-flex items-center gap-1.5 font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer ${
            size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"
          }`}
          title="Configure automated recurring AI scan schedule"
        >
          <span className="text-xs">⏱️</span>
          <span>
            {isConfigured
              ? compact
                ? `Auto-scan: ${frequency}`
                : `Auto-scan: ${frequency}`
              : compact
              ? "Schedule"
              : "Schedule Auto-Scan"}
          </span>
        </button>

        {/* Info Tag Split Divider */}
        <span className="w-px h-3.5 bg-gray-200 self-center" />

        {/* Info Tag Icon Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`flex items-center justify-center transition-colors cursor-pointer ${
            size === "sm" ? "px-2 py-1.5" : "px-2.5 py-2"
          } ${
            showPopover
              ? "bg-brand-50 text-brand-700"
              : isConfigured
              ? "text-brand-600 hover:bg-brand-50"
              : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          }`}
          aria-label="View schedule information"
          title="View schedule details"
        >
          <span
            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
              isConfigured
                ? "bg-brand-100 text-brand-700"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            ℹ
          </span>
        </button>
      </div>

      {/* Floating Info Popover */}
      <AnimatePresence>
        {showPopover && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="absolute bottom-full mb-2 left-0 sm:left-auto sm:right-0 z-50 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-3.5 text-left text-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <span>⏱️</span>
                <span>Auto-Scan Schedule</span>
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isConfigured
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-gray-100 text-gray-600 border border-gray-200"
                }`}
              >
                {isConfigured ? "Active" : "Not Scheduled"}
              </span>
            </div>

            {/* Popover Content */}
            {isConfigured ? (
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                    Execution Frequency & Time
                  </span>
                  <div className="font-semibold text-gray-800 mt-0.5">
                    {freqLabel} at {timeUtc} UTC
                  </div>
                  {localTimeStr && (
                    <div className="text-[11px] text-gray-500 font-medium mt-0.5 flex items-center gap-1">
                      <span>📍 Local time:</span>
                      <strong className="text-gray-700">{localTimeStr}</strong>
                    </div>
                  )}
                </div>

                {nextScanFormatted && (
                  <div className="pt-1.5 border-t border-gray-50">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                      Next Scheduled Scan
                    </span>
                    <div className="font-semibold text-brand-600 mt-0.5 flex items-center gap-1">
                      <span>🗓️</span>
                      <span>{nextScanFormatted}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-500 space-y-1.5 py-1">
                <p className="font-semibold text-gray-800">Not scheduled yet</p>
                <p className="text-[11px] leading-relaxed text-gray-500">
                  AI automated scans are currently off for this repository. Click below to schedule recurring scans.
                </p>
              </div>
            )}

            {/* Popover Action Button */}
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setHovered(false);
                  onOpenScheduleModal(repository);
                }}
                className="text-xs font-bold text-brand-600 hover:text-brand-800 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>{isConfigured ? "Edit Schedule" : "Configure Schedule"}</span>
                <span>→</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
