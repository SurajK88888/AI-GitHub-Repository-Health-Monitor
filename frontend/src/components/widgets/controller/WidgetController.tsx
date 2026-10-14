"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WidgetPosition } from "./types";
import { REGISTERED_WIDGETS } from "./registry";
import { useWidgetController } from "./WidgetContext";

const CONTROLLER_POS_KEY = "gh_health_controller_widget_position";

export function WidgetController() {
  const {
    settings,
    mounted,
    setMasterEnabled,
    setWidgetVisible,
    showAllWidgets,
    hideAllWidgets,
    resetAllPositions,
  } = useWidgetController();

  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<WidgetPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    initialLeft: number;
    initialTop: number;
  }>({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0 });

  // Load saved position
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONTROLLER_POS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
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
      // Ignore
    }

    const handleReset = () => {
      setPosition(null);
    };
    window.addEventListener("gh_health_reset_widget_positions", handleReset);
    return () => window.removeEventListener("gh_health_reset_widget_positions", handleReset);
  }, []);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Pointer drag logic
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const widget = containerRef.current;
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
    const widget = containerRef.current;
    if (!widget) return;

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    const rawX = dragStartRef.current.initialLeft + deltaX;
    const rawY = dragStartRef.current.initialTop + deltaY;

    const widgetWidth = widget.offsetWidth || 150;
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
        localStorage.setItem(CONTROLLER_POS_KEY, JSON.stringify(position));
      } catch {
        // silent
      }
    }
  };

  if (!mounted) return null;

  // Calculate active widget count
  const activeCount = REGISTERED_WIDGETS.filter((w) => settings.widgets[w.id]).length;

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
        right: "410px",
        zIndex: 9999,
        touchAction: "none",
      };

  return (
    <div
      ref={containerRef}
      style={widgetStyle}
      className={[
        "select-none transition-shadow duration-200",
        isDragging ? "cursor-grabbing scale-[1.02] shadow-2xl ring-2 ring-brand-400" : "shadow-lg",
      ].join(" ")}
      role="region"
      aria-label="Widget Controller"
    >
      <div className="relative group bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200/90 dark:border-gray-800 rounded-2xl shadow-[0_8px_30px_rgba(139,92,246,0.12)] p-1.5 flex items-center gap-1.5">
        
        {/* ── Drag Grip ── */}
        <div
          ref={dragHandleRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex items-center px-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-brand-500 transition-colors"
          title="Drag widget controller anywhere on screen"
        >
          <span className="font-bold tracking-tighter text-xs leading-none">
            ⋮⋮
          </span>
        </div>

        {/* ── Trigger Button ── */}
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className={[
            "flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl transition-all",
            isOpen
              ? "bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-300"
              : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200",
          ].join(" ")}
          title="Open Widget Controller to manage widget visibility"
        >
          <span className="text-sm">🧩</span>
          <span className="font-medium text-[11.5px]">Widgets</span>

          {/* Active count badge */}
          <span
            className={[
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none",
              settings.masterEnabled
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
                : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
            ].join(" ")}
          >
            {settings.masterEnabled ? `${activeCount}` : "OFF"}
          </span>

          <span className="text-[9px] text-gray-400 ml-0.5">▾</span>
        </button>

        {/* ── Dropdown / Popover ── */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="text-base">🧩</span>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                      Widget Controller
                    </h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Manage global display & individual widgets
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Master Switch Card */}
              <div
                className={[
                  "p-3 rounded-xl border transition-all flex items-center justify-between gap-3",
                  settings.masterEnabled
                    ? "bg-brand-50/60 dark:bg-brand-950/40 border-brand-200 dark:border-brand-800/60"
                    : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700",
                ].join(" ")}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                      Master Widget Switch
                    </span>
                    <span
                      className={[
                        "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider",
                        settings.masterEnabled
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
                      ].join(" ")}
                    >
                      {settings.masterEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                    Turn on/off all floating widgets across every page
                  </p>
                </div>

                {/* Master Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.masterEnabled}
                  onClick={() => setMasterEnabled(!settings.masterEnabled)}
                  className={[
                    "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    settings.masterEnabled ? "bg-brand-600" : "bg-gray-300 dark:bg-gray-600",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      settings.masterEnabled ? "translate-x-5" : "translate-x-0",
                    ].join(" ")}
                  />
                </button>
              </div>

              {/* Granular Widget List */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-0.5">
                  Individual Widgets
                </span>

                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {REGISTERED_WIDGETS.map((widget) => {
                    const isVisible = settings.widgets[widget.id] ?? true;
                    const isDisabledByMaster = !settings.masterEnabled;

                    return (
                      <div
                        key={widget.id}
                        className={[
                          "p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all",
                          isDisabledByMaster
                            ? "opacity-50 bg-gray-50 dark:bg-gray-800/30 border-gray-200/50 dark:border-gray-800"
                            : isVisible
                            ? "bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 shadow-sm"
                            : "bg-gray-50/70 dark:bg-gray-800/40 border-gray-200/70 dark:border-gray-700/60",
                        ].join(" ")}
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="text-base mt-0.5 flex-shrink-0">{widget.icon}</span>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 block truncate">
                              {widget.name}
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate leading-tight">
                              {widget.description}
                            </span>
                          </div>
                        </div>

                        {/* Granular Toggle Switch */}
                        <button
                          type="button"
                          role="switch"
                          disabled={isDisabledByMaster}
                          aria-checked={isVisible}
                          onClick={() => setWidgetVisible(widget.id, !isVisible)}
                          className={[
                            "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            isDisabledByMaster
                              ? "cursor-not-allowed opacity-60 bg-gray-300 dark:bg-gray-700"
                              : isVisible
                              ? "bg-brand-500"
                              : "bg-gray-300 dark:bg-gray-600",
                          ].join(" ")}
                          title={`Toggle ${widget.name}`}
                        >
                          <span
                            className={[
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              isVisible && !isDisabledByMaster ? "translate-x-4" : "translate-x-0",
                            ].join(" ")}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Actions Footer */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={showAllWidgets}
                    className="text-[10.5px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline px-1 py-0.5"
                  >
                    Show All
                  </button>
                  <span className="text-gray-300 dark:text-gray-700">·</span>
                  <button
                    onClick={hideAllWidgets}
                    className="text-[10.5px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:underline px-1 py-0.5"
                  >
                    Hide All
                  </button>
                </div>

                <button
                  onClick={resetAllPositions}
                  className="flex items-center gap-1 text-[10.5px] font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-2 py-1 rounded-lg transition-colors"
                  title="Snap all widgets back to top navbar positions"
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Reset Layout</span>
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
