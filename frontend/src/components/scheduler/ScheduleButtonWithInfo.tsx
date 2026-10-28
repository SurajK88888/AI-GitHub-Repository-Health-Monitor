"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  const [mounted, setMounted] = useState(false);
  const [placement, setPlacement] = useState<{
    vertical: "top" | "bottom";
    horizontal: "left" | "right";
  }>({ vertical: "top", horizontal: "left" });
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePlacement = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const popoverWidth = 288;

    // Vertical placement:
    // If space above is tight (< 230px, e.g. near sticky topbar), open downwards.
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    let vertical: "top" | "bottom" = "top";
    if (spaceAbove < 230) {
      vertical = "bottom";
    } else if (spaceBelow < 230) {
      vertical = "top";
    } else {
      vertical = spaceAbove < 260 && spaceBelow >= 260 ? "bottom" : "top";
    }

    // Horizontal placement:
    // If aligning left, right edge is rect.left + popoverWidth
    // If aligning right, left edge is rect.right - popoverWidth
    const overflowRightIfLeft = rect.left + popoverWidth > window.innerWidth - 16;
    const overflowLeftIfRight = rect.right - popoverWidth < 16;

    let horizontal: "left" | "right" = "left";
    if (overflowRightIfLeft && !overflowLeftIfRight) {
      horizontal = "right";
    } else if (!overflowRightIfLeft && overflowLeftIfRight) {
      horizontal = "left";
    } else if (overflowRightIfLeft && overflowLeftIfRight) {
      horizontal = window.innerWidth - rect.left >= rect.right ? "left" : "right";
    } else {
      // If aligning right would project into the sidebar area (< 250px from left screen edge),
      // keep it aligned to the left so it stays within the main card.
      if (rect.right - popoverWidth < 250) {
        horizontal = "left";
      } else {
        // If button is in the right 40% of the screen, align right edge with button
        horizontal = rect.left > window.innerWidth * 0.6 ? "right" : "left";
      }
    }

    setPlacement({ vertical, horizontal });

    // Calculate fixed viewport coordinates for portal rendering
    const newCoords: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    } = {};

    if (vertical === "top") {
      newCoords.bottom = Math.round(window.innerHeight - rect.top + 8);
    } else {
      newCoords.top = Math.round(rect.bottom + 8);
    }

    if (horizontal === "left") {
      newCoords.left = Math.round(
        Math.max(16, Math.min(rect.left, window.innerWidth - popoverWidth - 16))
      );
    } else {
      newCoords.right = Math.round(
        Math.max(16, Math.min(window.innerWidth - rect.right, window.innerWidth - popoverWidth - 16))
      );
    }

    setCoords(newCoords);
  };

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
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
    updatePlacement();
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      updatePlacement();
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

  // Recalculate placement when popover becomes visible and update on scroll/resize
  useEffect(() => {
    if (!showPopover) return;
    updatePlacement();

    const handleScroll = () => updatePlacement();
    const handleResize = () => updatePlacement();

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [showPopover]);

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={containerRef}>
      {/* Split Button Container: Main Action + Info Tag Trigger */}
      <div
        className={`inline-flex items-center rounded-full border transition-all backdrop-blur-md ${isConfigured
          ? "border-white/[0.20] bg-white/[0.08] hover:bg-white/[0.12] hover:border-white/[0.28] shadow-sm"
          : "border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.20] shadow-sm"
          }`}
      >
        {/* Main Schedule Button */}
        <button
          type="button"
          onClick={() => onOpenScheduleModal(repository)}
          className={`inline-flex items-center gap-1.5 font-medium text-white/85 hover:text-white transition-colors cursor-pointer ${compact
            ? "px-2 py-1.5 text-[11.5px]"
            : size === "sm"
              ? "px-2.5 py-1.5 text-xs"
              : "px-3 py-2 text-sm"
            }`}
          title="Configure automated recurring AI scan schedule"
        >
          <span className="text-xs leading-none">⏱️</span>
          <span className="whitespace-nowrap">
            {isConfigured
              ? compact
                ? frequency.charAt(0) + frequency.slice(1).toLowerCase()
                : `Auto-scan: ${frequency}`
              : compact
                ? "Schedule"
                : "Schedule Auto-Scan"}
          </span>
        </button>

        {/* Info Tag Split Divider */}
        <span className="w-px h-3.5 bg-white/[0.14] self-center" />

        {/* Info Tag Icon Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            updatePlacement();
            setOpen((prev) => !prev);
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`flex items-center justify-center transition-colors cursor-pointer ${compact ? "px-1.5 py-1.5" : size === "sm" ? "px-2 py-1.5" : "px-2.5 py-2"
            } ${showPopover
              ? "bg-white/[0.12] text-white"
              : isConfigured
                ? "text-white/80 hover:bg-white/[0.08]"
                : "text-white/45 hover:text-white hover:bg-white/[0.06]"
            }`}
          aria-label="View schedule information"
          title="View schedule details"
        >
          <span
            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${isConfigured
              ? "bg-white/[0.12] text-white border border-white/[0.20]"
              : "bg-white/[0.06] text-white/60 border border-white/[0.10]"
              }`}
          >
            ℹ
          </span>
        </button>
      </div>

      {/* Floating Info Popover rendered in portal to guarantee highest stacking context */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {showPopover && coords && (
              <motion.div
                ref={popoverRef}
                initial={{
                  opacity: 0,
                  y: placement.vertical === "top" ? 6 : -6,
                  scale: 0.95,
                }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{
                  opacity: 0,
                  y: placement.vertical === "top" ? 4 : -4,
                  scale: 0.95,
                }}
                transition={{ duration: 0.15 }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={{
                  position: "fixed",
                  zIndex: 9999,
                  ...(coords.top !== undefined ? { top: `${coords.top}px` } : {}),
                  ...(coords.bottom !== undefined ? { bottom: `${coords.bottom}px` } : {}),
                  ...(coords.left !== undefined ? { left: `${coords.left}px` } : {}),
                  ...(coords.right !== undefined ? { right: `${coords.right}px` } : {}),
                }}
                className="w-72 max-w-[calc(100vw-2rem)] bg-[#0F161E]/95 backdrop-blur-[24px] rounded-2xl shadow-2xl border border-white/[0.14] p-3.5 text-left text-white"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Popover Header */}
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/[0.08]">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <span>⏱️</span>
                    <span>Auto-Scan Schedule</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${isConfigured
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-white/[0.06] text-white/50 border border-white/[0.10]"
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
                      <div className="font-medium text-white mt-0.5">
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
                    <p className="font-medium text-white">Not scheduled yet</p>
                    <p className="text-[11px] leading-relaxed text-white/50">
                      AI automated scans are currently off for this repository. Click below to schedule recurring scans.
                    </p>
                  </div>
                )}

                {/* Popover Action Button */}
                <div className="mt-3 pt-2 border-t border-white/[0.08] flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setHovered(false);
                      onOpenScheduleModal(repository);
                    }}
                    className="text-xs font-medium text-[#F59E0B] hover:text-[#F59E0B]/80 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>{isConfigured ? "Edit Schedule" : "Configure Schedule"}</span>
                    <span>→</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
