"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  NAVBAR_ITEMS,
  NAVBAR_CTA_AUTHENTICATED,
  NAVBAR_CTA_UNAUTHENTICATED,
} from "./navItems";

/**
 * GlobalNavbar — public-facing top navigation bar.
 *
 * Used on: landing page (/) and auth pages (/auth/*).
 * Authenticated app pages use DashboardLayout → Sidebar + Topbar instead.
 *
 * To add/remove/reorder nav links, edit `navItems.ts` in this folder.
 */
export function GlobalNavbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";

  // Mobile menu state
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Scrolled state — adds shadow when page is scrolled
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const cta = isAuthenticated ? NAVBAR_CTA_AUTHENTICATED : NAVBAR_CTA_UNAUTHENTICATED;

  // User initials for authenticated avatar
  const initials = session?.user?.name
    ? session.user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50 transition-all duration-200",
        scrolled
          ? "bg-white/96 shadow-[0_2px_16px_rgba(139,92,246,0.08)] backdrop-blur-md border-b border-gray-100"
          : "bg-white/90 backdrop-blur-sm border-b border-gray-100/80",
      ].join(" ")}
      role="banner"
    >
      <div className="max-w-[1100px] mx-auto px-6 h-[60px] flex items-center justify-between gap-6">

        {/* ── Brand / Logo ───────────────────────────────── */}
        <Link
          href="/"
          className="flex items-center gap-2.5 flex-shrink-0 group"
          aria-label="Health Monitor home"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-500 flex items-center justify-center shadow-brand-sm group-hover:shadow-brand transition-shadow duration-200">
            <span className="text-white text-sm font-bold leading-none">⬡</span>
          </div>
          <div className="leading-tight">
            <span className="font-bold text-[15px] text-gray-900 tracking-tight">
              Health Monitor
            </span>
            <span className="hidden sm:block text-[10px] font-medium text-brand-500 tracking-wide leading-none mt-0.5">
              GitHub Analytics
            </span>
          </div>
        </Link>

        {/* ── Desktop Nav Links ──────────────────────────── */}
        <nav
          className="hidden md:flex items-center gap-1"
          aria-label="Main navigation"
        >
          {NAVBAR_ITEMS.map((item) => {
            const isActive =
              item.href.startsWith("/#")
                ? false
                : pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13.5px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                {item.icon && (
                  <span className="text-[13px] leading-none opacity-70">
                    {item.icon}
                  </span>
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ── Desktop Right Controls ─────────────────────── */}
        <div className="hidden md:flex items-center gap-2.5">
          {isAuthenticated && session?.user ? (
            <>
              {/* User avatar chip */}
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
                <div className="w-6 h-6 rounded-full overflow-hidden border border-brand-200 bg-brand-50 flex items-center justify-center flex-shrink-0">
                  {session.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt={session.user.name ?? "User avatar"}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-brand-700 text-[10px] font-bold leading-none">
                      {initials}
                    </span>
                  )}
                </div>
                <span className="text-[13px] font-semibold text-gray-700 max-w-[96px] truncate">
                  {session.user.name?.split(" ")[0] ?? "User"}
                </span>
              </div>

              {/* CTA */}
              <Link href={cta.href}>
                <button
                  id="navbar-cta-btn"
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-brand-500 to-indigo-500 hover:from-brand-600 hover:to-indigo-600 text-white text-[13px] font-semibold rounded-lg shadow-brand-sm hover:shadow-brand transition-all duration-150"
                >
                  {cta.label}
                </button>
              </Link>
            </>
          ) : (
            <Link href={cta.href}>
              <button
                id="navbar-cta-btn"
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-brand-500 to-indigo-500 hover:from-brand-600 hover:to-indigo-600 text-white text-[13px] font-semibold rounded-lg shadow-brand-sm hover:shadow-brand transition-all duration-150"
              >
                {cta.label}
              </button>
            </Link>
          )}
        </div>

        {/* ── Mobile Hamburger ───────────────────────────── */}
        <button
          id="navbar-mobile-menu-btn"
          className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          <span className="sr-only">{mobileOpen ? "Close" : "Menu"}</span>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <motion.rect
              x="3" y="4" width="14" height="1.8" rx="1"
              fill="currentColor"
              animate={{ rotate: mobileOpen ? 45 : 0, y: mobileOpen ? 5 : 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.rect
              x="3" y="9.1" width="14" height="1.8" rx="1"
              fill="currentColor"
              animate={{ opacity: mobileOpen ? 0 : 1 }}
              transition={{ duration: 0.15 }}
            />
            <motion.rect
              x="3" y="14.2" width="14" height="1.8" rx="1"
              fill="currentColor"
              animate={{ rotate: mobileOpen ? -45 : 0, y: mobileOpen ? -5 : 0 }}
              transition={{ duration: 0.2 }}
            />
          </svg>
        </button>
      </div>

      {/* ── Mobile Dropdown Menu ───────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            ref={menuRef}
            id="navbar-mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="md:hidden overflow-hidden border-t border-gray-100 bg-white/98 shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
          >
            <div className="max-w-[1100px] mx-auto px-6 py-4 space-y-1">
              {NAVBAR_ITEMS.map((item) => {
                const isActive =
                  item.href.startsWith("/#")
                    ? false
                    : pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-[14px] font-medium transition-colors",
                      isActive
                        ? "bg-brand-50 text-brand-700"
                        : "text-gray-700 hover:bg-gray-50 hover:text-gray-900",
                    ].join(" ")}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {item.icon && (
                      <span className="text-[15px] opacity-70">{item.icon}</span>
                    )}
                    {item.label}
                  </Link>
                );
              })}

              {/* Mobile CTA */}
              <div className="pt-2 pb-1 border-t border-gray-100 mt-2">
                <Link href={cta.href} className="block">
                  <button
                    id="navbar-mobile-cta-btn"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-brand-500 to-indigo-500 text-white text-[14px] font-semibold rounded-xl shadow-brand-sm transition-all"
                  >
                    {cta.label}
                  </button>
                </Link>

                {/* Authenticated user info in mobile */}
                {isAuthenticated && session?.user && (
                  <div className="mt-2 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="w-7 h-7 rounded-full overflow-hidden border border-brand-200 bg-brand-50 flex items-center justify-center flex-shrink-0">
                      {session.user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={session.user.image}
                          alt={session.user.name ?? "Avatar"}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-brand-700 text-[10px] font-bold">{initials}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-gray-800 truncate">
                        {session.user.name ?? "User"}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {session.user.email ?? ""}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
