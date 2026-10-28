"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/repositories", label: "Repositories", icon: "⬡" },
  { href: "/findings", label: "Findings", icon: "🔍" },
  { href: "/actions", label: "AI Actions", icon: "⚡" },
  { href: "/notifications", label: "Notifications", icon: "🔔" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export interface SidebarProps {
  unreadCount?: number;
  width?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onWidthChange?: (newWidth: number) => void;
  onDragStateChange?: (dragging: boolean) => void;
}

export function Sidebar({
  unreadCount = 0,
  width = 240,
  isCollapsed = false,
  onToggleCollapse,
  onWidthChange,
  onDragStateChange,
}: SidebarProps) {
  const pathname = usePathname();
  const [isDragging, setIsDragging] = useState(false);

  // Resize drag handler on the right edge
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!onWidthChange || isCollapsed) return;
    e.preventDefault();
    setIsDragging(true);
    onDragStateChange?.(true);

    const startX = e.clientX;
    const initialWidth = width;

    const handlePointerMove = (evt: PointerEvent) => {
      const deltaX = evt.clientX - startX;
      const targetW = initialWidth + deltaX;

      // Strict boundary clamping: minimum 190px, maximum 360px
      // Firm stop at 190px: no flickering, no jumping, and no forced decrease or auto-collapse
      const clampedW = Math.max(190, Math.min(360, targetW));
      onWidthChange(clampedW);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      onDragStateChange?.(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const isCompact = width < 220;

  return (
    <aside
      className={cn(
        "app-sidebar flex flex-col bg-[#0F171E]/65 backdrop-blur-[20px] border-r border-white/[0.08] text-white select-none relative overflow-x-hidden",
        isCollapsed ? "w-[68px]" : ""
      )}
      style={{
        width: isCollapsed ? 68 : width,
        transition: isDragging ? "none" : "width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "border-b border-white/[0.08] transition-all duration-300",
          isCollapsed ? "py-4 px-2 flex flex-col items-center gap-2.5" : "py-5 px-5 flex items-center justify-between"
        )}
      >
        {isCollapsed ? (
          <>
            {/* Logo centered cleanly */}
            <Link href="/" className="flex items-center justify-center" title="AI GitHub Health Monitor">
              <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.15] flex items-center justify-center flex-shrink-0">
                <span className="text-[#F59E0B] text-base font-bold">⬡</span>
              </div>
            </Link>

            {/* Expand button positioned cleanly below logo (no covering or collision) */}
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white/70 hover:text-white border border-white/[0.10] flex items-center justify-center text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                »
              </button>
            )}
          </>
        ) : (
          <>
            <Link href="/" className="flex items-center gap-2.5 min-w-0" title="AI GitHub Health Monitor">
              <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.15] flex items-center justify-center flex-shrink-0">
                <span className="text-[#F59E0B] text-base font-bold">⬡</span>
              </div>
              <div className="min-w-0 flex-1 transition-opacity duration-300">
                <p
                  className={cn(
                    "text-white font-bold leading-tight tracking-tight truncate",
                    isCompact ? "text-sm" : "text-base"
                  )}
                >
                  Health Monitor
                </p>
                <p className={cn("text-white/40 font-medium tracking-wide truncate", isCompact ? "text-[11px]" : "text-xs")}>
                  GitHub Analytics
                </p>
              </div>
            </Link>

            {/* Minimize / Collapse Button */}
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.08] border border-transparent hover:border-white/[0.10] transition-colors cursor-pointer flex-shrink-0 text-sm font-bold ml-1"
                title="Collapse sidebar (icon view)"
                aria-label="Collapse sidebar"
              >
                «
              </button>
            )}
          </>
        )}
      </div>

      {/* Navigation List */}
      <nav className={cn("flex-1 space-y-1.5 overflow-y-auto transition-all duration-300", isCollapsed ? "px-2 py-4" : isCompact ? "px-2.5 py-4" : "px-3.5 py-5")}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="block group relative" title={isCollapsed ? item.label : undefined}>
              <div
                className={cn(
                  "relative flex items-center transition-all duration-200",
                  isCollapsed
                    ? "w-10 h-10 mx-auto justify-center px-0 rounded-xl"
                    : isCompact
                    ? "px-2.5 py-2 gap-2 text-xs font-medium rounded-[12px]"
                    : "px-3 py-2.5 gap-3 text-sm font-medium rounded-[12px]",
                  isActive
                    ? "bg-white/[0.10] border border-white/[0.22] text-white font-semibold shadow-sm"
                    : "text-white/55 hover:text-white hover:bg-white/[0.04] border border-transparent"
                )}
              >
                <span
                  className={cn(
                    "flex-shrink-0 flex items-center justify-center text-center",
                    isCompact && !isCollapsed ? "text-sm w-4" : "text-base w-5",
                    isActive ? "text-[#F59E0B]" : "text-white/40"
                  )}
                >
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <span className="flex-1 truncate transition-opacity duration-300">
                    {item.label}
                  </span>
                )}

                {item.href === "/notifications" && unreadCount > 0 && (
                  isCollapsed ? (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#F59E0B] border-2 border-[#090D11] animate-pulse" />
                  ) : (
                    <span
                      className={cn(
                        "font-bold rounded-full flex items-center justify-center flex-shrink-0",
                        isCompact ? "text-[10px] min-w-[18px] h-4 px-1" : "text-xs min-w-[20px] h-5 px-1.5",
                        isActive ? "bg-white/20 text-white border border-white/25" : "bg-[#F59E0B] text-[#090D11]"
                      )}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )
                )}
              </div>

              {/* Floating Tooltip in Collapsed Mode */}
              {isCollapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#0F161E]/95 backdrop-blur-md text-white shadow-xl border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                  {item.label}
                  {item.href === "/notifications" && unreadCount > 0 && ` (${unreadCount})`}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Version badge */}
      <div
        className={cn(
          "py-3.5 border-t border-white/[0.08] flex items-center text-white/[0.35] font-medium transition-all duration-300 overflow-hidden",
          isCollapsed ? "px-2 justify-center text-[10px]" : isCompact ? "px-3.5 justify-between text-[11px]" : "px-5 justify-between text-xs"
        )}
      >
        <span className="truncate">{isCollapsed ? "AI" : "AI Monitor"}</span>
        <span className="truncate">{isCollapsed ? "1.0" : "v1.0.0"}</span>
      </div>

      {/* Drag Resizer Handle on Right Edge (Min 190px, Max 360px limit) */}
      {!isCollapsed && (
        <div
          onPointerDown={handlePointerDown}
          className={cn(
            "absolute top-0 right-0 bottom-0 w-2.5 cursor-col-resize z-50 group flex items-center justify-center transition-colors hover:bg-white/[0.06]",
            isDragging && "bg-white/[0.08]"
          )}
          title="Drag to resize sidebar (190px – 360px)"
        >
          <div
            className={cn(
              "w-0.5 h-8 rounded-full transition-colors",
              isDragging ? "bg-[#F59E0B]" : "bg-transparent group-hover:bg-[#F59E0B]/70"
            )}
          />
        </div>
      )}
    </aside>
  );
}
