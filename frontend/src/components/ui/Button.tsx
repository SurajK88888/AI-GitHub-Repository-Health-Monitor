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
  primary:   "bg-brand-500 hover:bg-brand-600 text-white shadow-brand-sm border border-brand-500",
  secondary: "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200",
  ghost:     "bg-transparent hover:bg-gray-100 text-gray-600 border border-transparent",
  danger:    "bg-red-500 hover:bg-red-600 text-white border border-red-500",
  outline:   "bg-transparent hover:bg-brand-50 text-brand-600 border border-brand-300",
};

const SIZES = {
  sm: "px-3 py-1.5 text-xs gap-1.5 rounded-lg",
  md: "px-4 py-2 text-sm gap-2 rounded-lg",
  lg: "px-5 py-2.5 text-sm gap-2 rounded-xl",
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
