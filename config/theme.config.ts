/**
 * =========================================================================
 * 🎨 MASTER HOSPITAL COLOR CONFIGURATION (Single Source of Truth)
 * =========================================================================
 * Future me pure project ka color change karna ho, toh sirf is ek file me
 * string variables ko update karein. Har page, component, tailwind config,
 * aur icons automatically update ho jayenge.
 * =========================================================================
 */

export const HOSPITAL_THEME_COLORS = {
  // -----------------------------------------------------------------------
  // 1. BRAND SCALE: Clinical Teal & Trust Navy
  // -----------------------------------------------------------------------
  brand: {
    50: "#f0fdfa",  // Lightest clinical background / mint tint
    100: "#ccfbf1", // Soft mint highlight & badge background
    200: "#99f6e4", // Subtle border / pill highlight
    300: "#5eead4", // Active indicator glow
    400: "#2dd4bf", // Bright healthcare accent
    500: "#0d9488", // Base Medical Teal (Secondary actions & badges)
    600: "#0f766e", // ★ PRIMARY BRAND COLOR (Buttons, Active Tabs, Key Links)
    700: "#115e59", // Accessible high-contrast text & button hover state
    800: "#134e4a", // Deep teal text / dark active tab background
    900: "#0f3e3a", // Dark clinical header element
    950: "#042f2e", // Deepest Navy-Teal (High-contrast boundary)
  },

  // -----------------------------------------------------------------------
  // 2. HOSPITAL STRUCTURAL & SURFACE TOKENS
  // -----------------------------------------------------------------------
  hospital: {
    navy: "#0c4a6e",        // Deep Medical Trust Navy (Header & Authority text)
    navyDark: "#082f49",    // Midnight hospital blue for high-contrast headers
    cyan: "#0284c7",        // Diagnostic Sky / Secondary Healthcare Blue
    surfaceBg: "#f8fafc",   // Clean clinic background (Off-white / Slate 50)
    cardBg: "#ffffff",      // Sterile Pure White card background
    border: "#e2e8f0",      // Subtle card & table divider border (Slate 200)
    borderDark: "#cbd5e1",  // Stronger input border (Slate 300)
    textMain: "#0f172a",    // Deep slate navy (WCAG AAA primary text)
    textMuted: "#475569",   // Clinical slate secondary text / timestamps
    textSubtle: "#64748b",  // Tertiary metadata / helper captions
  },

  // -----------------------------------------------------------------------
  // 3. CLINICAL TRIAGE & STATUS TOKENS
  // -----------------------------------------------------------------------
  status: {
    confirmed: {
      bg: "#ecfdf5",        // Soft emerald-50
      text: "#065f46",      // High contrast emerald-800
      border: "#a7f3d0",    // Emerald-200
      solid: "#059669",     // Medical Emerald (Confirmed / Completed)
    },
    reschedule: {
      bg: "#fffbeb",        // Soft amber-50
      text: "#92400e",      // High contrast amber-800
      border: "#fde68a",    // Amber-200
      solid: "#d97706",     // Triage Amber (Pending / Reschedule required)
    },
    emergency: {
      bg: "#fff1f2",        // Soft rose-50
      text: "#9f1239",      // High contrast rose-800
      border: "#fecdd3",    // Rose-200
      solid: "#e11d48",     // Surgical Crimson (Emergency / Cancelled)
    },
    teleconsult: {
      bg: "#f0f9ff",        // Soft sky-50
      text: "#075985",      // High contrast sky-800
      border: "#bae6fd",    // Sky-200
      solid: "#0284c7",     // Video Teleconsultation Sky Blue
    },
  },

  // -----------------------------------------------------------------------
  // 4. BRAND GRADIENTS (Logo, Hero & Stethoscope Icons)
  // -----------------------------------------------------------------------
  gradients: {
    brandFrom: "#0f766e",   // Clinical Teal start
    brandTo: "#0c4a6e",     // Trust Navy end
    stethoscopeFrom: "#0d9488",
    stethoscopeTo: "#0284c7",
    heroGlowFrom: "rgba(13, 148, 136, 0.12)",
    heroGlowTo: "rgba(12, 74, 110, 0.08)",
  },
} as const;

export type HospitalThemeColors = typeof HOSPITAL_THEME_COLORS;

