"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface CalendarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  categoryBadge?: React.ReactNode;
  children: React.ReactNode;
}

export default function CalendarDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  categoryBadge,
  children,
}: CalendarDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Trap body scroll on mobile only to prevent background jumping
  useEffect(() => {
    if (isOpen && window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Subtle backdrop: keeps calendar visible behind panel on desktop while providing focus */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in Panel from the Right */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10 pointer-events-none">
        <div
          ref={drawerRef}
          className="w-screen max-w-md md:max-w-lg lg:w-[480px] pointer-events-auto bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 ease-out"
        >
          {/* Sticky Panel Header */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-6 py-4.5 border-b border-slate-100 flex items-start justify-between gap-4 shrink-0">
            <div className="min-w-0 space-y-1">
              {categoryBadge && <div className="flex items-center">{categoryBadge}</div>}
              {typeof title === "string" ? (
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                  {title}
                </h2>
              ) : (
                title
              )}
              {subtitle && (
                <div className="text-xs text-slate-500 font-medium">
                  {subtitle}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Drawer Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 focus:outline-none">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
