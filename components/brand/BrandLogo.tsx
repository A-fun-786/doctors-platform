import React from "react";
import Link from "next/link";
import { BRAND_CONFIG } from "@/config/brand.config";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
  showText?: boolean;
  href?: string | null;
  className?: string;
  textClassName?: string;
}

export function BrandLogo({
  size = "md",
  variant = "light",
  showText = true,
  href = "/",
  className = "",
  textClassName = "",
}: BrandLogoProps) {
  const iconSizeClasses = {
    sm: "w-7 h-7",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  }[size];

  const textSizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  }[size];

  const textColorClass = variant === "dark" ? "text-white" : "text-slate-900";
  const { icon, name } = BRAND_CONFIG;

  const content = (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Dynamic Brand Icon (SVG or Image) */}
      <div className={`shrink-0 ${iconSizeClasses} flex items-center justify-center`}>
        {icon.type === "svg" ? (
          <icon.component className="w-full h-full" />
        ) : (
          <img
            src={icon.imageSrc}
            alt={icon.alt}
            className="w-full h-full object-contain rounded-lg"
          />
        )}
      </div>

      {/* Dynamic Brand Name Text */}
      {showText && (
        <span
          className={`font-bold tracking-tight ${textColorClass} ${textSizeClasses} ${textClassName}`}
        >
          {name}
        </span>
      )}
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="inline-flex items-center focus:outline-none">
      {content}
    </Link>
  );
}

export default BrandLogo;
