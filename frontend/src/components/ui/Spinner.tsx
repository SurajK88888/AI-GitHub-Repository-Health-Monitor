"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const s = size === "sm" ? "w-4 h-4 border-2" : size === "lg" ? "w-8 h-8 border-[3px]" : "w-5 h-5 border-2";
  return (
    <div
      className={cn(
        "rounded-full border-gray-200 border-t-brand-500 animate-spin",
        s,
        className,
      )}
    />
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("card p-5 space-y-3", className)}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 py-3", className)}>
      <Skeleton className="w-8 h-8 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyState({
  title,
  description,
  icon = "📭",
  action,
}: {
  title: string;
  description?: string;
  icon?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-2xl mb-4">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-gray-800 mb-1">{title}</h3>
      {description && <p className="text-xs text-gray-400 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-xl mb-3">
        ⚠️
      </div>
      <p className="text-sm font-semibold text-gray-700 mb-1">Something went wrong</p>
      {message && <p className="text-xs text-gray-400 max-w-sm mb-3">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline underline-offset-2"
        >
          Try again
        </button>
      )}
    </div>
  );
}
