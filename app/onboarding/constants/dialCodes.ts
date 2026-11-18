/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Onboarding — Country Dial Codes
 * Single source of truth for the phone country selector.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface CountryDialCode {
  /** ISO 3166-1 alpha-2 code */
  code: string;
  name: string;
  /** Full dial prefix, e.g. "+92" */
  dial: string;
  /** Unicode flag emoji */
  flag: string;
  /** Example local format for placeholder */
  placeholder: string;
}

/**
 * Prioritised list — South Asia & Middle East first, then major global markets.
 * Keep sorted within each regional group for UX discoverability.
 */
export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  // ── South Asia (default region) ──────────────────────────────────────────
  { code: "PK", name: "Pakistan",       dial: "+92",  flag: "🇵🇰", placeholder: "300 123 4567" },
  { code: "IN", name: "India",          dial: "+91",  flag: "🇮🇳", placeholder: "98765 43210" },
  { code: "BD", name: "Bangladesh",     dial: "+880", flag: "🇧🇩", placeholder: "1711 123456" },
  { code: "LK", name: "Sri Lanka",      dial: "+94",  flag: "🇱🇰", placeholder: "77 123 4567" },
  { code: "NP", name: "Nepal",          dial: "+977", flag: "🇳🇵", placeholder: "984 123 4567" },
  { code: "AF", name: "Afghanistan",    dial: "+93",  flag: "🇦🇫", placeholder: "70 123 4567" },
  // ── Middle East ──────────────────────────────────────────────────────────
  { code: "AE", name: "UAE",            dial: "+971", flag: "🇦🇪", placeholder: "50 123 4567" },
  { code: "SA", name: "Saudi Arabia",   dial: "+966", flag: "🇸🇦", placeholder: "50 123 4567" },
  { code: "KW", name: "Kuwait",         dial: "+965", flag: "🇰🇼", placeholder: "5012 3456" },
  { code: "QA", name: "Qatar",          dial: "+974", flag: "🇶🇦", placeholder: "3312 3456" },
  { code: "OM", name: "Oman",           dial: "+968", flag: "🇴🇲", placeholder: "9212 3456" },
  { code: "BH", name: "Bahrain",        dial: "+973", flag: "🇧🇭", placeholder: "3600 0000" },
  { code: "JO", name: "Jordan",         dial: "+962", flag: "🇯🇴", placeholder: "79 123 4567" },
  { code: "IQ", name: "Iraq",           dial: "+964", flag: "🇮🇶", placeholder: "790 123 4567" },
  { code: "IR", name: "Iran",           dial: "+98",  flag: "🇮🇷", placeholder: "912 345 6789" },
  // ── South-East Asia ──────────────────────────────────────────────────────
  { code: "PH", name: "Philippines",    dial: "+63",  flag: "🇵🇭", placeholder: "912 345 6789" },
  { code: "ID", name: "Indonesia",      dial: "+62",  flag: "🇮🇩", placeholder: "812 345 6789" },
  { code: "MY", name: "Malaysia",       dial: "+60",  flag: "🇲🇾", placeholder: "12 345 6789" },
  // ── Africa ───────────────────────────────────────────────────────────────
  { code: "NG", name: "Nigeria",        dial: "+234", flag: "🇳🇬", placeholder: "801 234 5678" },
  { code: "EG", name: "Egypt",          dial: "+20",  flag: "🇪🇬", placeholder: "100 123 4567" },
  { code: "GH", name: "Ghana",          dial: "+233", flag: "🇬🇭", placeholder: "24 123 4567" },
  { code: "KE", name: "Kenya",          dial: "+254", flag: "🇰🇪", placeholder: "712 345678" },
  { code: "ZA", name: "South Africa",   dial: "+27",  flag: "🇿🇦", placeholder: "71 234 5678" },
  // ── Europe ───────────────────────────────────────────────────────────────
  { code: "TR", name: "Turkey",         dial: "+90",  flag: "🇹🇷", placeholder: "532 123 4567" },
  { code: "GB", name: "United Kingdom", dial: "+44",  flag: "🇬🇧", placeholder: "7700 900000" },
  { code: "DE", name: "Germany",        dial: "+49",  flag: "🇩🇪", placeholder: "151 2345 6789" },
  { code: "FR", name: "France",         dial: "+33",  flag: "🇫🇷", placeholder: "6 12 34 56 78" },
  // ── Americas & Oceania ───────────────────────────────────────────────────
  { code: "US", name: "United States",  dial: "+1",   flag: "🇺🇸", placeholder: "555 019 2834" },
  { code: "CA", name: "Canada",         dial: "+1",   flag: "🇨🇦", placeholder: "416 555 1234" },
  { code: "AU", name: "Australia",      dial: "+61",  flag: "🇦🇺", placeholder: "412 345 678" },
];

/**
 * Detect the user's most likely country from browser locale.
 * Falls back to Pakistan (+92) — the primary target market.
 */
export function detectDefaultCountry(): CountryDialCode {
  if (typeof navigator === "undefined" || !navigator.language) {
    return COUNTRY_DIAL_CODES[0];
  }
  const parts = navigator.language.split("-");
  const region = parts.length > 1 ? parts[1].toUpperCase() : undefined;
  if (!region) return COUNTRY_DIAL_CODES[0];
  return COUNTRY_DIAL_CODES.find((c) => c.code === region) ?? COUNTRY_DIAL_CODES[0];
}

/**
 * Parse a stored international phone string back into { country, localNumber }.
 * Handles formats like "+92 300 1234567", "+921234567", "+1 555 019 2834".
 */
export function parseStoredPhone(stored?: string | null): {
  country: CountryDialCode;
  localNumber: string;
} {
  if (!stored) return { country: COUNTRY_DIAL_CODES[0], localNumber: "" };
  const normalized = stored.trim();
  // Sort by dial length descending to match longest prefix first (e.g. +880 before +88)
  const sorted = [...COUNTRY_DIAL_CODES].sort(
    (a, b) => b.dial.length - a.dial.length
  );
  for (const c of sorted) {
    if (normalized.startsWith(c.dial)) {
      return {
        country: c,
        localNumber: normalized.slice(c.dial.length).trim(),
      };
    }
  }
  return { country: COUNTRY_DIAL_CODES[0], localNumber: normalized };
}
