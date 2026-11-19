"use client";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OnboardingPhoneInput — Country Dial Code + Local Number Picker
 * Re-exports the reusable @/components/ui/PhoneInput primitive.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export {
  PhoneInput as OnboardingPhoneInput,
  CountryFlag,
} from "@/components/ui/PhoneInput";

export type {
  PhoneInputProps as OnboardingPhoneInputProps,
} from "@/components/ui/PhoneInput";

export { PhoneInput as default } from "@/components/ui/PhoneInput";
