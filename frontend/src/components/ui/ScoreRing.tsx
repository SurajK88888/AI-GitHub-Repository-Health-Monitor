"use client";

import { motion } from "framer-motion";
import { scoreToband } from "@/lib/utils";
import type { ScoreBand } from "@/lib/types";

const BAND_COLORS: Record<ScoreBand, string> = {
  EXCELLENT:       "#10b981",
  GOOD:            "#3b82f6",
  NEEDS_ATTENTION: "#f59e0b",
  POOR:            "#f97316",
  CRITICAL:        "#ef4444",
};

interface ScoreRingProps {
  score: number;
  band?: ScoreBand;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ScoreRing({
  score,
  band,
  size = 80,
  strokeWidth = 7,
  className,
}: ScoreRingProps) {
  const resolvedBand = band ?? scoreToband(score);
  const color = BAND_COLORS[resolvedBand];
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, score));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={className} style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Fill */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1], delay: 0.1 }}
        />
      </svg>
      {/* Center label */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            fontSize: size > 90 ? "1.5rem" : "1rem",
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}
        >
          {Math.round(clamped)}
        </motion.span>
        {size > 60 && (
          <span style={{ fontSize: "0.6rem", color: "rgba(255, 255, 255, 0.40)", marginTop: 2 }}>/ 100</span>
        )}
      </div>
    </div>
  );
}
