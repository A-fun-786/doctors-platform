"use client";

import React from "react";
import "flag-icons/css/flag-icons.min.css";

interface CountryFlagProps {
  iso: string;
  className?: string;
}

/**
 * Renders official vector country flags via `flag-icons` CSS/SVG,
 * ensuring real flag graphics across Windows, macOS, and Linux.
 */
export function CountryFlag({ iso, className = "w-5 h-3.5" }: CountryFlagProps) {
  const code = iso.trim().toLowerCase();
  return (
    <span
      aria-hidden="true"
      className={`fi fi-${code} inline-block ${className} rounded-[2px] border border-slate-200/90 shadow-2xs shrink-0 bg-cover bg-center`}
    />
  );
}
