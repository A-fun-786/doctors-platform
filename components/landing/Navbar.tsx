"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, Menu, X } from "lucide-react";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              DocSpace
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="/"
              className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors"
            >
              Home
            </Link>
            <Link
              href="#features"
              className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors"
            >
              How It Works
            </Link>
          </nav>

          {/* Desktop Action Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-700 hover:text-brand-600 px-3 py-2 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg shadow-sm transition-colors"
            >
              Register as Doctor
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-6 space-y-3">
          <nav className="flex flex-col space-y-2">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600"
            >
              Home
            </Link>
            <Link
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-brand-600"
            >
              How It Works
            </Link>
          </nav>
          <div className="pt-3 border-t border-slate-100 flex flex-col space-y-2">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center px-4 py-2 rounded-md text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50"
            >
              Login
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center px-4 py-2 rounded-md text-sm font-medium text-white bg-brand-600 hover:bg-brand-700"
            >
              Register as Doctor
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
