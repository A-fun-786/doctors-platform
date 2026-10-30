"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

export interface AdaptiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  /** Sizing on desktop: 'sm' (400px), 'md' (560px), 'lg' (720px), 'xl' (900px) */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

/**
 * Adaptive Modal Primitive.
 * Renders as a centered dialog on laptops/desktops, and transforms into a thumb-friendly
 * Bottom Sheet on mobile devices with safe-area support.
 */
export function AdaptiveModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  className = "",
}: AdaptiveModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "md:max-w-md",
    md: "md:max-w-lg",
    lg: "md:max-w-2xl",
    xl: "md:max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal / Bottom Sheet Content */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full bg-white shadow-2xl transition-all 
          /* Mobile styles: Bottom Sheet */
          rounded-t-3xl max-h-[90vh] flex flex-col pb-safe
          /* Desktop styles: Centered Dialog */
          md:rounded-2xl md:max-h-[85vh] md:pb-0 md:border md:border-slate-200 ${sizeClasses[size]} ${className}`}
      >
        {/* Mobile Swipe / Pull Handle Indicator */}
        <div className="flex md:hidden justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-slate-100">
            <div>
              {title && <h2 className="text-lg font-bold text-slate-900">{title}</h2>}
              {description && (
                <p className="text-xs text-slate-500 mt-0.5">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Body content */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

export default AdaptiveModal;
