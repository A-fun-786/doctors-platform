"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import { useScrolled } from "@/hooks/useScrolled";

/**
 * Landing Page Navbar
 * Implements a floating pill capsule header inspired by Shiha Wellness.
 * Detached from viewport edges with glassmorphic backdrop, dynamic scroll elevation,
 * and responsive mobile action buttons.
 */
export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isScrolled = useScrolled(15);

  // Close mobile dropdown on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header
      className={`sticky z-50 px-3 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto pointer-events-none transition-all duration-300 ${
        isScrolled ? "top-2 sm:top-2.5" : "top-3 sm:top-4"
      }`}
    >
      <div
        className={`pointer-events-auto rounded-full px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between transition-all duration-300 border ${
          isScrolled
            ? "bg-white/90 backdrop-blur-xl border-slate-200/90 shadow-[0_14px_35px_-5px_rgba(15,23,42,0.12),inset_0_1px_0_0_rgba(255,255,255,0.95)]"
            : "bg-white/80 backdrop-blur-lg border-slate-200/70 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.08),inset_0_1px_0_0_rgba(255,255,255,0.85)]"
        }`}
      >
        {/* Brand Logo */}
        <BrandLogo size="sm" className="shrink-0" textClassName="text-base sm:text-lg" />

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center space-x-8">
          <Link
            href="/"
            className="text-sm font-medium text-slate-700 hover:text-brand-600 transition-colors"
          >
            Home
          </Link>
          <Link
            href="#features"
            className="text-sm font-medium text-slate-700 hover:text-brand-600 transition-colors"
          >
            Features
          </Link>
          <Link
            href="#how-it-works"
            className="text-sm font-medium text-slate-700 hover:text-brand-600 transition-colors"
          >
            How It Works
          </Link>
        </nav>

        {/* Desktop Action Buttons */}
        <div className="hidden md:flex items-center space-x-3">
          <Link
            href="/login"
            className="text-sm font-semibold text-slate-700 hover:text-brand-600 px-3.5 py-2 transition-colors"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="text-xs sm:text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-5 py-2.5 rounded-full shadow-xs hover:shadow-md transition-all hover:scale-[1.02] active:scale-95"
          >
            Register as Doctor
          </Link>
        </div>

        {/* Mobile Action Buttons & Menu Button */}
        <div className="flex md:hidden items-center gap-1.5 sm:gap-2">
          <Link
            href="/login"
            className="text-xs sm:text-sm font-semibold text-slate-700 hover:text-brand-600 px-2 sm:px-2.5 py-1.5 rounded-full hover:bg-slate-100/80 active:scale-95 transition-all"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center text-xs sm:text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 active:scale-95 px-2.5 sm:px-3 py-1.5 rounded-full shadow-2xs transition-all whitespace-nowrap"
          >
            Sign Up
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 sm:p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden pointer-events-auto mt-2 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col space-y-1">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-xl text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
            >
              Home
            </Link>
            <Link
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-xl text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3.5 py-2.5 rounded-xl text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
            >
              How It Works
            </Link>
          </nav>
          <div className="pt-3 border-t border-slate-100 flex flex-col space-y-2">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center px-4 py-2.5 rounded-full text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center px-4 py-2.5 rounded-full text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 shadow-xs transition-colors"
            >
              Register as Doctor
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
