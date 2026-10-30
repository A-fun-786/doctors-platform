import { StethoscopeHeartPulseIcon } from "@/components/brand/StethoscopeHeartPulseIcon";

// =========================================================================
// Master Brand Switch — update this single variable to rebrand the entire app.
// All derived properties (slug, storage keys, titles, etc.) update automatically.
// =========================================================================
export const PRIMARY_BRAND_NAME = "GoSmartClinic";

// 🎨 ICON SWITCH: Change type to "svg" or "image", or swap component
export const PRIMARY_BRAND_ICON = {
  type: "svg" as "svg" | "image",
  imageSrc: "/gosmartclinic-icon.png",
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
  tagline: "The Digital Healthcare Presence Platform for Doctors",
  description:
    "The digital healthcare platform enabling doctors to create, customize, and scale their own branded website and mobile presence effortlessly.",

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
      return `${PRIMARY_BRAND_NAME} — The Digital Healthcare Presence Platform for Doctors`;
    }
    return `${pageTitle} - ${PRIMARY_BRAND_NAME}`;
  },
} as const;

export type BrandConfig = typeof BRAND_CONFIG;
