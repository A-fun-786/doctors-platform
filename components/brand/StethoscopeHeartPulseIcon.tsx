import React, { useId } from "react";

interface StethoscopeHeartPulseIconProps {
  className?: string;
  size?: number;
}

export function StethoscopeHeartPulseIcon({
  className = "w-8 h-8",
  size,
}: StethoscopeHeartPulseIconProps) {
  const gradientId = useId();
  const style = size ? { width: size, height: size } : undefined;

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <defs>
        {/* Soft Modern Medical Gradient — unique ID per instance via useId() */}
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>
      </defs>

      {/* Rounded Squircle Container Badge */}
      <rect width="100" height="100" rx="24" fill={`url(#${gradientId})`} />
      <rect
        width="96"
        height="96"
        x="2"
        y="2"
        rx="22"
        stroke="#FFFFFF"
        strokeOpacity="0.25"
        strokeWidth="2"
      />

      {/* Heart Shape formed with Stethoscope Tube */}
      <path
        d="M48 78C32 66 18 53 18 38C18 28 26 21 35 21C41 21 46 24 49 28C52 24 57 21 63 21C72 21 80 28 80 38C80 43 77 48 72 53"
        stroke="#FFFFFF"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Stethoscope Tubing and Chestpiece */}
      <path
        d="M72 53C72 59 68 64 63 64C59 64 56 61 56 57"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="56" cy="54" r="4.5" fill="#FFFFFF" />

      {/* Binaural Arc & Earpieces */}
      <path
        d="M68 28C73 24 78 26 81 30M81 30L83 28M81 30L79 32"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Center 2D ECG HeartPulse Wave */}
      <path
        d="M15 50H32L36 43L42 61L48 37L54 55L57 48L61 50H70"
        stroke="#6EE7B7"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default StethoscopeHeartPulseIcon;
