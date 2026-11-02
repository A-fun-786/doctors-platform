/**
 * =========================================================================
 * 🎨 MASTER HOSPITAL COLOR CONFIGURATION (Single Source of Truth)
 * =========================================================================
 * Theme: Option 2 - Clinical Emerald & Vitality Mint (Fresh Healing Theme)
 * =========================================================================
 */

export const HOSPITAL_THEME_COLORS = {
  // -----------------------------------------------------------------------
  // 1. BRAND SCALE: Clinical Emerald & Vitality Mint
  // -----------------------------------------------------------------------
  brand: {
    50: "#ecfdf5",  // Fresh emerald tint / ultra-light clinical background
    100: "#d1fae5", // Soft mint highlight & badge background
    200: "#a7f3d0", // Subtle border / pill highlight
    300: "#6ee7b7", // Active indicator glow & soft accent
    400: "#34d399", // Vitality mint healthcare accent
    500: "#10b981", // Base Emerald (Secondary actions & badges)
    600: "#059669", // ★ PRIMARY BRAND COLOR (Buttons, Active Tabs, Key Links)
    700: "#047857", // Accessible high-contrast text & button hover state
    800: "#065f46", // Deep forest emerald / dark active tab background
    900: "#064e3b", // Dark clinical header / banner element
    950: "#022c22", // Deepest Forest Emerald (High-contrast boundary)
  },

  // -----------------------------------------------------------------------
  // 2. HOSPITAL STRUCTURAL & SURFACE TOKENS
  // -----------------------------------------------------------------------
  hospital: {
    navy: "#064e3b",        // Deep Medical Forest Emerald (Authority text)
    navyDark: "#022c22",    // Midnight clinical dark for headers
    cyan: "#10b981",        // Diagnostic Vitality Mint
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
      bg: "#f0fdf4",        // Soft mint-50
      text: "#047857",      // High contrast emerald-700
      border: "#a7f3d0",    // Emerald-200
      solid: "#10b981",     // Video Teleconsultation Mint-Emerald
    },
  },

  // -----------------------------------------------------------------------
  // 4. BRAND GRADIENTS (Logo, Hero & Stethoscope Icons)
  // -----------------------------------------------------------------------
  gradients: {
    brandFrom: "#059669",   // Clinical Emerald start
    brandTo: "#064e3b",     // Deep Forest Emerald end
    stethoscopeFrom: "#10b981", // Vitality Mint
    stethoscopeTo: "#047857",   // Deep Clinical Emerald
    heroGlowFrom: "rgba(16, 185, 129, 0.15)",
    heroGlowTo: "rgba(6, 78, 59, 0.08)",
  },
} as const;

export type HospitalThemeColors = typeof HOSPITAL_THEME_COLORS;
