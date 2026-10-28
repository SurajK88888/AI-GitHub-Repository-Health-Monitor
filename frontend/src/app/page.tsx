"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlobalNavbar } from "@/components/navbar";
import { LuxuryHeroOverlay } from "@/components/hero";
import { LandingSections } from "@/components/landing";

export default function HomePage() {
  const [scrolledPastHero, setScrolledPastHero] = useState(false);

  // Reveal GlobalNavbar when scrolling past the hero overlay
  useEffect(() => {
    const handleScroll = () => {
      setScrolledPastHero(window.scrollY > 350);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#090D11", color: "#FFFFFF" }}>
      {/* Global Navbar — seamlessly reveals when scrolling past the luxury hero */}
      <AnimatePresence>
        {scrolledPastHero && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            className="fixed top-0 left-0 right-0 z-50"
          >
            <GlobalNavbar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero — full-viewport video background section ── */}
      <section
        style={{
          position: "relative",
          minHeight: "100vh",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Background video — decorative, muted, loop */}
        <video
          className="hero-video-bg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src="/hero-bg.mp4" type="video/mp4" />
        </video>

        {/* Gradient overlay — ensures text legibility over the video */}
        <div className="hero-video-overlay" aria-hidden="true" />

        {/* ── Luxury Hero Foreground UI Overlay Container (z-index: 10) ── */}
        <LuxuryHeroOverlay />
      </section>

      {/* ── 7 Below-the-Fold Luxury Glassmorphic Sections ── */}
      <LandingSections />
    </div>
  );
}

