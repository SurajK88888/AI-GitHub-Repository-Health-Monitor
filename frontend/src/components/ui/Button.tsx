"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
  icon?: ReactNode;
  title?: string;
}

const VARIANTS = {
  primary:   "bg-white hover:bg-white/90 active:bg-white/80 text-[#090D11] border border-white font-medium shadow-sm",
  secondary: "bg-white/[0.05] hover:bg-white/[0.10] text-white border border-white/[0.14] font-medium backdrop-blur-md",
  ghost:     "bg-transparent hover:bg-white/[0.06] text-white/70 hover:text-white border border-transparent font-medium",
  danger:    "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 font-medium",
  outline:   "bg-transparent hover:bg-white/[0.06] text-[#F59E0B] border border-[#F59E0B]/30 font-medium",
};

const SIZES = {
  sm: "px-3.5 py-1.5 text-xs gap-1.5 rounded-full",
  md: "px-4 py-2 text-sm gap-2 rounded-full",
  lg: "px-5 py-2.5 text-sm gap-2 rounded-full",
};

export function Button({
  children,
  onClick,
  variant = "secondary",
  size = "md",
  loading = false,
  disabled = false,
  type = "button",
  className,
  icon,
  title,
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "inline-flex items-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        icon
      ) : null}
      {children}
    </motion.button>
  );
}
