import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary purple/violet brand palette
        brand: {
          50:  "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
        // Soft indigo for secondary elements
        indigo: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        // UI surface colors (light theme)
        surface: {
          DEFAULT: "#ffffff",
          bg:    "#f7f7fb",
          card:  "#ffffff",
          hover: "#f4f3ff",
          border: "#e5e7eb",
          muted:  "#f9fafb",
        },
        // Sidebar colors
        sidebar: {
          bg:     "#1e1b4b",
          hover:  "#2d2a6e",
          active: "#4c1d95",
          text:   "#c4b5fd",
          muted:  "#7c6fcc",
        },
        // Score band colors
        score: {
          excellent:    "#10b981",
          good:         "#3b82f6",
          needs_attention: "#f59e0b",
          poor:         "#f97316",
          critical:     "#ef4444",
        },
        // Severity
        severity: {
          critical: "#ef4444",
          high:     "#f97316",
          medium:   "#f59e0b",
          low:      "#3b82f6",
          info:     "#6366f1",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": "0.65rem",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
        "4xl": "1.5rem",
      },
      boxShadow: {
        card:   "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.04)",
        "card-md": "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.04)",
        "card-lg": "0 10px 15px -3px rgba(0,0,0,0.06), 0 4px 6px -4px rgba(0,0,0,0.04)",
        "card-hover": "0 20px 25px -5px rgba(139,92,246,0.1), 0 8px 10px -6px rgba(139,92,246,0.08)",
        brand: "0 4px 14px 0 rgba(139,92,246,0.35)",
        "brand-sm": "0 2px 8px rgba(139,92,246,0.2)",
        inner: "inset 0 2px 4px 0 rgba(0,0,0,0.06)",
      },
      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.5" },
        },
      },
      animation: {
        "fade-in":    "fade-in 0.3s ease-out both",
        shimmer:      "shimmer 1.8s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
      backgroundImage: {
        "gradient-brand":    "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
        "gradient-sidebar":  "linear-gradient(180deg, #1e1b4b 0%, #2e1065 100%)",
        "gradient-card":     "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
        "gradient-shimmer":  "linear-gradient(90deg, #f3f4f6 25%, #e9eaed 50%, #f3f4f6 75%)",
      },
    },
  },
  plugins: [],
};

export default config;
