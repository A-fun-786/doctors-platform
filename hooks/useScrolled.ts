"use client";

import { useState, useEffect } from "react";

/**
 * Custom hook to track window scroll position for floating headers and navbars.
 * Used across the application shell and landing navigation for Shiha Wellness-style
 * glassmorphic elevation transitions.
 *
 * @param threshold - Scroll offset threshold in pixels to trigger elevated state (default: 15)
 * @returns boolean - true if window.scrollY exceeds the threshold, false otherwise
 *
 * @example
 * ```tsx
 * const isScrolled = useScrolled(15);
 * return (
 *   <header className={isScrolled ? "shadow-lg bg-white/90" : "shadow-sm bg-white/80"}>
 *     ...
 *   </header>
 * );
 * ```
 */
export function useScrolled(threshold = 15): boolean {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      setIsScrolled(window.scrollY > threshold);
    };

    // Perform initial check on mount
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return isScrolled;
}

