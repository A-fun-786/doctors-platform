/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Onboarding — Wizard Steps Definition (single source of truth)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface StepConfig {
  id: number;
  title: string;
  shortLabel: string;
  description: string;
}

export const WIZARD_STEPS: StepConfig[] = [
  {
    id: 1,
    title: "What is your clinic name?",
    shortLabel: "Clinic Name",
    description: "Enter the official practice name shown to patients.",
  },
  {
    id: 2,
    title: "Add your clinic logo",
    shortLabel: "Clinic Logo",
    description: "Upload a practice logo, emblem, or doctor avatar.",
  },
  {
    id: 3,
    title: "Helpline & Contact number",
    shortLabel: "Contact Phone",
    description: "Primary phone number for patient appointments & queries.",
  },
  {
    id: 4,
    title: "Where is your clinic located?",
    shortLabel: "Clinic Location",
    description: "Complete physical address and clinic location details.",
  },
];

export const TOTAL_STEPS = WIZARD_STEPS.length;
