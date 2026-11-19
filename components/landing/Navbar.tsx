"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";

/**
 * DocSpace SaaS Landing Page Navbar
 * - Left: Hamburger Menu (Mobile/Tablet) + BrandLogo
 * - Center: Features, How It Works, Testimonials, FAQ (Desktop)
 * - Right: Single Combined "Signup / Login" Button (/login)
 * - Mobile Drawer: Slide-out drawer from left with nav links and "Signup / Login" button
 */
export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { label: "Features", href: "/#features" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Testimonials", href: "/#testimonials" },
    { label: "FAQ", href: "/#faq" },
  ];

  const handleLinkClick = (href: string) => {
    setMobileMenuOpen(false);
    if (href.startsWith("/#")) {
      const targetId = href.replace("/#", "");
      const elem = document.getElementById(targetId);
      if (elem) {
        elem.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">

          {/* Left: Mobile Hamburger & Brand Logo */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 sm:p-2 -ml-1 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Open navigation menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <BrandLogo size="md" className="shrink-0" textClassName="text-base sm:text-lg font-bold" />
          </div>

          {/* Center Navigation Links (Desktop: smooth scroll) */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => handleLinkClick(link.href)}
                className="text-sm font-semibold text-slate-700 hover:text-brand-600 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Action: Single Combined Signup / Login Button */}
          <div className="flex items-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center text-xs sm:text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3.5 sm:px-5 py-1.5 sm:py-2.5 rounded-full shadow-xs hover:shadow transition-all hover:scale-[1.01] active:scale-98 whitespace-nowrap"
            >
              SignUp / LogIn
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile Drawer (Slide-in from Left) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel on Left */}
          <aside className="fixed inset-y-0 left-0 w-72 sm:w-80 bg-white shadow-2xl flex flex-col justify-between z-50 border-r border-slate-200 animate-in slide-in-from-left duration-300">
            {/* Drawer Top Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <BrandLogo size="sm" textClassName="text-base font-bold" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Navigation Links */}
            <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-1.5">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => handleLinkClick(link.href)}
                  className="flex items-center px-4 py-3 rounded-xl text-base font-semibold text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Drawer Bottom Action: Single Combined Signup / Login */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex flex-col space-y-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full inline-flex items-center justify-center text-center px-4 py-3 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-sm hover:shadow transition-all"
              >
                Signup / Login
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
