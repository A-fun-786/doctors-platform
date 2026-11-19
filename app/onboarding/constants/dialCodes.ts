/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Onboarding — Country Dial Codes (Re-exported from @/lib/dialCodes)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export {
  COUNTRY_DIAL_CODES,
  detectDefaultCountry,
  parseStoredPhone,
  stripLeadingZero,
  validatePhoneNumber,
} from "@/lib/dialCodes";

export type { CountryDialCode } from "@/lib/dialCodes";
