"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function DashboardLayout({ children, title, subtitle, actions }: DashboardLayoutProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Restore sidebar preferences from localStorage & detect viewport
  useEffect(() => {
    try {
      const storedW = localStorage.getItem("gh_health_sidebar_width");
      if (storedW) {
        const parsed = parseInt(storedW, 10);
        if (!isNaN(parsed) && parsed >= 190 && parsed <= 360) {
          setSidebarWidth(parsed);
        }
      }
      const storedC = localStorage.getItem("gh_health_sidebar_collapsed");
      if (storedC !== null) {
        setIsCollapsed(storedC === "true");
      }
    } catch {
      // ignore
    }

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Polling unread notifications
  useEffect(() => {
    let cancelled = false;
    async function fetchCount() {
      try {
        const data = await api.get<{ count: number }>("/notifications/unread-count");
        if (!cancelled) setUnreadCount(data.count ?? 0);
      } catch {
        // silent
      }
    }
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("gh_health_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const handleWidthChange = (newWidth: number) => {
    const clamped = Math.max(190, Math.min(360, newWidth));
    setSidebarWidth(clamped);
    if (isCollapsed) {
      setIsCollapsed(false);
      try {
        localStorage.setItem("gh_health_sidebar_collapsed", "false");
      } catch {}
    }
    try {
      localStorage.setItem("gh_health_sidebar_width", String(clamped));
    } catch {}
  };

  const effectiveWidth = isMobile ? 0 : isCollapsed ? 68 : sidebarWidth;

  return (
    <div
      className={cn("app-layout", isDragging && "is-resizing")}
      style={{
        "--sidebar-w": `${effectiveWidth}px`,
      } as React.CSSProperties}
    >
      <Sidebar
        unreadCount={unreadCount}
        width={sidebarWidth}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        onWidthChange={handleWidthChange}
        onDragStateChange={setIsDragging}
      />
      <div className="app-content">
        <Topbar
          unreadCount={unreadCount}
          isMobile={isMobile}
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
          mobileMenuOpen={mobileMenuOpen}
        />
        <main className="app-main">
          {(title || actions) && (
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                {title && (
                  <h1 className="text-xl font-bold text-gray-900">{title}</h1>
                )}
                {subtitle && (
                  <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
                )}
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
