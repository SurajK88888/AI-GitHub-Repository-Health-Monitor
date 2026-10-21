"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useFetch } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { Repository, Paginated } from "@/lib/types";
import { NAV_ITEMS } from "./Sidebar";

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;
  const q = query.trim().toLowerCase();
  const index = text.toLowerCase().indexOf(q);
  if (index === -1) return <span>{text}</span>;
  const before = text.slice(0, index);
  const match = text.slice(index, index + q.length);
  const after = text.slice(index + q.length);
  return (
    <span>
      {before}
      <span className="text-brand-600 font-extrabold bg-brand-50/80 rounded px-0.5">{match}</span>
      {after}
    </span>
  );
}

export interface TopbarProps {
  unreadCount?: number;
  isMobile?: boolean;
  onToggleMobileMenu?: () => void;
  mobileMenuOpen?: boolean;
}

export function Topbar({
  unreadCount = 0,
  isMobile = false,
  onToggleMobileMenu,
  mobileMenuOpen = false,
}: TopbarProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const ref = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const { data: repoData } = useFetch<Paginated<Repository>>(
    session?.user ? "/repositories?limit=100" : null
  );

  const searchResults = (repoData?.items ?? [])
    .filter((r) => {
      if (!query.trim()) return false;
      const q = query.toLowerCase().trim();
      return r.name.toLowerCase().includes(q) || r.full_name.toLowerCase().includes(q);
    })
    .slice(0, 8);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target as Node) &&
        mobileMenuOpen &&
        onToggleMobileMenu
      ) {
        onToggleMobileMenu();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [mobileMenuOpen, onToggleMobileMenu]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && searchResults[selectedIndex]) {
        router.push(`/repositories/${searchResults[selectedIndex].id}`);
        setIsFocused(false);
      } else if (query.trim()) {
        router.push(`/repositories?search=${encodeURIComponent(query.trim())}`);
        setIsFocused(false);
      }
    } else if (e.key === "Escape") {
      setIsFocused(false);
      setSelectedIndex(-1);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIndex >= 0 && searchResults[selectedIndex]) {
      router.push(`/repositories/${searchResults[selectedIndex].id}`);
      setIsFocused(false);
    } else if (query.trim()) {
      router.push(`/repositories?search=${encodeURIComponent(query.trim())}`);
      setIsFocused(false);
    }
  };

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const firstName = session?.user?.name?.split(" ")[0] ?? "User";

  return (
    <header className="app-topbar bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6 h-16 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Mobile / Tablet Dropdown Menu Trigger */}
        <div className="md:hidden relative" ref={mobileMenuRef}>
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs",
              mobileMenuOpen
                ? "bg-[#181438] text-white border-brand-400 ring-2 ring-brand-500/20"
                : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
            )}
            title="Toggle Navigation Menu"
            aria-label="Toggle navigation menu"
          >
            <span className="text-sm text-brand-600 leading-none">⬡</span>
            <span className="font-bold text-xs">Menu</span>
            <span className={cn("text-[9px] text-gray-400 transition-transform duration-200", mobileMenuOpen && "rotate-180")}>
              ▼
            </span>
            {unreadCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse ml-0.5" />
            )}
          </button>

          {/* Mobile / Tablet Dropdown Menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full mt-2 w-64 bg-[#181438] bg-gradient-to-b from-[#181438] to-[#20134b] text-white rounded-2xl shadow-2xl border border-white/10 z-50 overflow-hidden p-2 space-y-1"
              >
                <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-gradient-brand flex items-center justify-center text-xs text-white font-bold">
                      ⬡
                    </div>
                    <span className="text-xs font-bold text-white">Health Monitor</span>
                  </div>
                  <span className="text-[10px] text-purple-300 font-medium">v1.0.0</span>
                </div>

                <div className="py-1 space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => onToggleMobileMenu?.()}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all",
                          isActive
                            ? "bg-white text-brand-900 shadow-sm"
                            : "text-purple-200/80 hover:text-white hover:bg-white/10"
                        )}
                      >
                        <span className={cn("text-sm", isActive ? "text-brand-600" : "text-purple-300")}>
                          {item.icon}
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {item.href === "/notifications" && unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-500 text-white">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search Input & Live Results Dropdown */}
        <div ref={searchContainerRef} className="relative w-52 sm:w-80">
          <form onSubmit={handleSearchSubmit} className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
            🔍
          </span>
          <input
            type="text"
            value={query}
            maxLength={100}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(-1);
              if (!isFocused) setIsFocused(true);
            }}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search repositories..."
            id="topbar-search-input"
            role="combobox"
            aria-expanded={isFocused && query.trim().length > 0}
            aria-controls="topbar-search-results"
            aria-label="Search repositories"
            autoComplete="off"
            spellCheck="false"
            className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedIndex(-1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 flex items-center justify-center text-xs transition-colors cursor-pointer"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </form>

        {/* Live Search Results Dropdown */}
        <AnimatePresence>
          {isFocused && query.trim().length > 0 && (
            <motion.div
              id="topbar-search-results"
              role="listbox"
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full mt-2 w-96 bg-white border border-gray-200/90 rounded-2xl shadow-card-lg z-50 overflow-hidden"
            >
              {searchResults.length > 0 ? (
                <div>
                  <div className="px-3.5 py-2 text-2xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
                    <span>Repositories</span>
                    <span>{searchResults.length} match{searchResults.length > 1 ? "es" : ""}</span>
                  </div>
                  <div className="py-1 max-h-72 overflow-y-auto">
                    {searchResults.map((repo, idx) => {
                      const score = repo.latest_health_score?.overall_score;
                      return (
                        <Link
                          key={repo.id}
                          href={`/repositories/${repo.id}`}
                          onClick={() => {
                            setIsFocused(false);
                            setQuery("");
                          }}
                          className={cn(
                            "flex items-center gap-3 px-3.5 py-2.5 transition-colors cursor-pointer border-b border-gray-50 last:border-b-0",
                            selectedIndex === idx ? "bg-brand-50" : "hover:bg-gray-50/80"
                          )}
                        >
                          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center text-sm flex-shrink-0 border border-brand-100/60 font-bold">
                            ⬡
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">
                              <HighlightMatch text={repo.name} query={query} />
                            </p>
                            <p className="text-2xs text-gray-400 truncate">
                              {repo.full_name}
                            </p>
                          </div>
                          {score !== undefined && (
                            <span
                              className={cn(
                                "text-2xs font-extrabold px-2 py-0.5 rounded-full flex-shrink-0 border",
                                score >= 80
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : score >= 60
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                              )}
                            >
                              {Math.round(score)}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                  <div className="p-2 border-t border-gray-100 bg-gray-50/50">
                    <button
                      type="button"
                      onClick={() => {
                        router.push(`/repositories?search=${encodeURIComponent(query.trim())}`);
                        setIsFocused(false);
                      }}
                      className="w-full text-center py-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50/80 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>View all results for &ldquo;{query.trim()}&rdquo;</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <span className="text-xl">🔍</span>
                  <p className="text-xs font-semibold text-gray-700 mt-1">No repositories found</p>
                  <p className="text-2xs text-gray-400 mt-0.5">
                    No repositories match &ldquo;{query.trim()}&rdquo;
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Notifications Icon Button */}
        <Link href="/notifications">
          <button
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors relative"
            title="Notifications"
          >
            <span className="text-base">🔔</span>
          </button>
        </Link>

        {/* Purple '+ New Scan' Button */}
        <Link href="/repositories">
          <button className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-brand-sm">
            <span className="text-base leading-none font-bold">+</span>
            <span>New Scan</span>
          </button>
        </Link>

        {/* User avatar dropdown (only shown if signed in) */}
        {session?.user ? (
          <div ref={ref} className="relative">
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-brand-200 flex-shrink-0 bg-brand-50 flex items-center justify-center">
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? "Avatar"}
                    style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "50%" }}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-brand-700 text-xs font-bold leading-none">
                    {initials}
                  </span>
                )}
              </div>

              <div className="hidden sm:flex items-center gap-1">
                <span className="text-sm font-semibold text-gray-800">
                  {firstName}
                </span>
                <span className="text-gray-400 text-xs">▾</span>
              </div>
            </button>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-xl shadow-card-lg z-50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50">
                    <p className="text-sm font-semibold text-gray-800">{session.user.name ?? "User"}</p>
                    <p className="text-xs text-gray-400 truncate">{session.user.email ?? ""}</p>
                  </div>
                  <div className="py-1">
                    <Link href="/settings" onClick={() => setOpen(false)}>
                      <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-brand-50 transition-colors">
                        ⚙ Settings
                      </button>
                    </Link>
                    <button
                      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                      className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      ↩ Sign Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <Link href="/auth/signin">
            <button className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors">
              Sign In
            </button>
          </Link>
        )}
      </div>
    </header>
  );
}
