import { StethoscopeHeartPulseIcon } from "@/components/brand/StethoscopeHeartPulseIcon";

// =========================================================================
// Master Brand Switch — update this single variable to rebrand the entire app.
// All derived properties (slug, storage keys, titles, etc.) update automatically.
// =========================================================================
export const PRIMARY_BRAND_NAME =
  process.env.NEXT_PUBLIC_BRAND_NAME || "GoSmart Clinic";

// 🎨 ICON SWITCH: Change type to "svg" or "image", or swap component
export const PRIMARY_BRAND_ICON = {
  type: "image" as "svg" | "image",
  imageSrc: "/emblem-only.png",
  fullLogo: "/logo.webp",
  fullLogoPng: "/logo.png",
  component: StethoscopeHeartPulseIcon,
  alt: `${PRIMARY_BRAND_NAME} Icon`,
};

// =========================================================================
// ⚡ AUTOMATED DERIVED PROPERTIES (Everything derives from PRIMARY_BRAND_NAME)
// =========================================================================
const brandSlug = PRIMARY_BRAND_NAME.toLowerCase().replace(/[^a-z0-9]/g, "");

export const BRAND_CONFIG = {
  // Identity
  name: PRIMARY_BRAND_NAME,
  slug: brandSlug,
  tagline: "Simple & Smart Software for Modern Clinics",
  description:
    "An easy-to-use platform for clinics to manage doctor appointments, bills, patient records, and daily visits in one place.",

  // Central Brand Assets (Single Source of Truth)
  assets: {
    favicon: "/favicon.ico",
    favicon16: "/favicon-16.png",
    favicon32: "/favicon-32.png",
    appleTouchIcon: "/apple-touch-icon.png",
    icon192: "/icon-192.png",
    icon512: "/icon-512.png",
    emblem: "/emblem-only.png",
    logo: "/logo.png",
    logoWebp: "/logo.webp",
    logo2x: "/logo@2x.png",
  },

  // Default Fallbacks
  defaultClinicLogo: "/emblem-only.png",
  defaultLogo: "/logo.png",

  // Dynamic Metadata Icons Helper for Next.js App Router (Favicons & Apple Touch)
  getMetadataIcons: () => ({
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  }),

  // Dynamic UI Strings
  poweredBy: `Powered by ${PRIMARY_BRAND_NAME}`,
  backToHome: `Back to ${PRIMARY_BRAND_NAME} Home`,
  copyright: (year = new Date().getFullYear()) =>
    `© ${year} ${PRIMARY_BRAND_NAME} Platform. All rights reserved.`,

  // Icon Configuration
  icon: PRIMARY_BRAND_ICON,

  // Storage Keys (Tokens, Session, Telemetry)
  storage: {
    authTokenKey: `${brandSlug}_auth_token`,
    legacyAuthTokenKey: "docspace_auth_token", // Backward-compatible fallback
    sessionIdKey: `${brandSlug}_session_id`,
    telemetryPrefix: `${brandSlug}-diagnostics`,
    telemetryVersion: `${PRIMARY_BRAND_NAME} Telemetry v1.0`,
  },

  // Android Mobile App Configuration
  android: {
    packagePrefix: `com.${brandSlug}`,
    defaultIconLabel: `Default ${PRIMARY_BRAND_NAME} Icon`,
    rootProjectName: `${PRIMARY_BRAND_NAME}Android`,
    apkFilename: (taskId: string) => `${PRIMARY_BRAND_NAME}_${taskId.slice(0, 8)}.apk`,
  },

  // SEO & Browser Tab Title Formatter
  formatMetaTitle: (pageTitle?: string) => {
    if (!pageTitle) {
      return `${PRIMARY_BRAND_NAME} — Simple Clinic Management Software`;
    }
    return `${pageTitle} - ${PRIMARY_BRAND_NAME}`;
  },
} as const;

export type BrandConfig = typeof BRAND_CONFIG;
