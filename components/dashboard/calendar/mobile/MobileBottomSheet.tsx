"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}

export default function MobileBottomSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

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

  // Lock body scroll on mobile when sheet is active
  useEffect(() => {
    if (isOpen) {
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
      className="fixed inset-0 z-50 xl:hidden overflow-hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet Modal Pane */}
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 transition-all duration-300 ease-out animate-in slide-in-from-bottom"
      >
        {/* Grab Handle */}
        <div className="pt-3 pb-1 flex justify-center">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>

        {/* Sheet Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="min-w-0 pr-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close sheet"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sheet Content */}
        <div className="p-4 sm:p-5 pb-8">{children}</div>
      </div>
    </div>
  );
}

