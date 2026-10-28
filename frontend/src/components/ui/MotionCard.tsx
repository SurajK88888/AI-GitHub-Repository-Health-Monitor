"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode, CSSProperties } from "react";

interface MotionCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  dragging?: boolean;
  dragHandle?: boolean;
}

export function MotionCard({
  children,
  className,
  style,
  onClick,
  dragging = false,
  dragHandle = false,
}: MotionCardProps) {
  return (
    <motion.div
      className={cn("card relative bg-[#0F171E]/55 backdrop-blur-[20px] border border-white/[0.12] rounded-[24px] text-white shadow-none hover:border-white/[0.20]", className)}
      style={{
        ...style,
        opacity: dragging ? 0.6 : 1,
      }}
      whileHover={{
        y: -3,
        boxShadow: "0 12px 30px rgba(0, 0, 0, 0.35)",
      }}
      transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.8 }}
      onClick={onClick}
    >
      {dragHandle && (
        <div className="absolute top-3 right-3 text-gray-300 text-sm cursor-grab active:cursor-grabbing select-none z-10 hover:text-gray-400 transition-colors">
          ⠿
        </div>
      )}
      {children}
    </motion.div>
  );
}
