"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
}

const MAX_WIDTH_CLASSES: Record<NonNullable<ModalProps["maxWidth"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export default function Modal({
  isOpen,
  onClose,
  title,
  icon,
  maxWidth = "md",
  children,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    // Lock body scroll while modal is active
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-3 sm:p-4 md:p-6 overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full ${MAX_WIDTH_CLASSES[maxWidth]} max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200`}
      >
        {/* Sticky Modal Header */}
        {(title || icon) && (
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 shrink-0 bg-white">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              {icon && <span className="shrink-0">{icon}</span>}
              {typeof title === "string" ? (
                <h3 className="text-base font-bold text-slate-900 truncate">{title}</h3>
              ) : (
                <div className="min-w-0">{title}</div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors shrink-0 cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1 pb-safe">
          {children}
        </div>
      </div>
    </div>
  );
}
