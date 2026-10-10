"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",     label: "Dashboard",      icon: "⊞" },
  { href: "/repositories",  label: "Repositories",   icon: "⬡" },
  { href: "/findings",      label: "Findings",        icon: "🔍" },
  { href: "/actions",       label: "AI Actions",      icon: "⚡" },
  { href: "/notifications", label: "Notifications",   icon: "🔔" },
  { href: "/settings",      label: "Settings",        icon: "⚙" },
];

interface SidebarProps {
  unreadCount?: number;
}

export function Sidebar({ unreadCount = 0 }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar flex flex-col bg-[#181438] bg-gradient-to-b from-[#181438] to-[#20134b] text-white">
      {/* Brand Header */}
      <div className="px-6 py-6 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center shadow-brand-sm flex-shrink-0">
            <span className="text-white text-base font-bold">⬡</span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-base leading-tight tracking-tight truncate">
              Health Monitor
            </p>
            <p className="text-purple-300 text-xs font-medium tracking-wide">
              GitHub Analytics
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className="block">
              <div
                className={cn(
                  "relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-white text-brand-900 shadow-sm font-semibold"
                    : "text-purple-200/80 hover:text-white hover:bg-white/10",
                )}
              >
                <span
                  className={cn(
                    "text-base w-5 text-center flex-shrink-0",
                    isActive ? "text-brand-600" : "text-purple-300",
                  )}
                >
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.href === "/notifications" && unreadCount > 0 && (
                  <span
                    className={cn(
                      "text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5",
                      isActive
                        ? "bg-brand-600 text-white"
                        : "bg-brand-500 text-white",
                    )}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer / Version badge */}
      <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between text-xs text-purple-300/60 font-medium">
        <span>AI Monitor</span>
        <span>v1.0.0</span>
      </div>
    </aside>
  );
}
