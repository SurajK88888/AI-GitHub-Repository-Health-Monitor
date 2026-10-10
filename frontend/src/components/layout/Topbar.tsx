"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export function Topbar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const firstName = session?.user?.name?.split(" ")[0] ?? "User";

  return (
    <header className="app-topbar bg-white border-b border-gray-100 flex items-center justify-between px-6 h-16 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {/* Search Input */}
      <div className="w-72">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search repositories..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-all"
          />
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
