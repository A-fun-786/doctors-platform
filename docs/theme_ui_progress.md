# 🏥 Hospital UI Theme Transformation — Master Plan & Progress Tracker

## 1. Executive Summary & Objective
Transform the entire project UI from generic blue styling into an authentic, **Hospital-Centric** medical platform aesthetic (Clinical Teal, Trust Navy, Calming Mint, and Clinical Triage Indicators). 

The entire system is architected around a **Single Source of Truth (SSOT)**: all colors are declared as string variables in a master configuration file ([`config/theme.config.ts`](../config/theme.config.ts)). In the future, modifying any color in this single file propagates automatically across all pages, components, tailwind classes, and icons without scattered hardcoded values.

---

## 2. Color Palette & Token Design

### A. Brand Scale (Clinical Teal & Calming Mint)
| Token | Hex | Role / Usage |
| :--- | :--- | :--- |
| `brand[50]` | `#f0fdfa` | Softest mint tint for subtle active backgrounds & badge tints |
| `brand[100]` | `#ccfbf1` | Light mint borders, pill backgrounds, selection states |
| `brand[200]` | `#99f6e4` | Secondary borders, pill hover states |
| `brand[300]` | `#5eead4` | Accent mint indicators, progress markers |
| `brand[400]` | `#2dd4bf` | Active highlights, focus accents |
| `brand[500]` | `#14b8a6` | Interactive hover highlights, secondary buttons |
| `brand[600]` | `#0d9488` | **Primary Hospital Teal** — action buttons, active navigation, key CTAs |
| `brand[700]` | `#0f766e` | Pressed button state, high-contrast badges |
| `brand[800]` | `#115e59` | High-contrast accessible text on white (WCAG AAA >= 7:1) |
| `brand[900]` | `#134e4a` | Deep clinical headings & high-contrast dark accents |
| `brand[950]` | `#042f2e` | Deepest contrast accents |

### B. Hospital Surfaces & Structure (Trust Navy & Clean Slates)
| Token | Hex | Role / Usage |
| :--- | :--- | :--- |
| `hospital.navy` | `#0c4a6e` | Deep Trust Navy — top bar branding, doctor title accents |
| `hospital.bg` | `#f8fafc` | Clean hospital ward background (slate-50) |
| `hospital.card` | `#ffffff` | Pure clinical white surface for cards and modals |
| `hospital.border` | `#e2e8f0` | Crisp sterile dividers and card borders |

### C. Clinical Triage Indicators (Standardized Medical Statuses)
| Medical Status | Solid | Background Tint | Border | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Confirmed** | `#059669` (Emerald) | `#ecfdf5` | `#a7f3d0` | Booked & confirmed appointments |
| **Reschedule / Attention**| `#d97706` (Amber) | `#fffbeb` | `#fde68a` | Needs rescheduling / doctor attention |
| **Emergency / Cancelled** | `#e11d48` (Crimson) | `#fff1f2` | `#fecdd3` | Cancelled, emergency, or slot blocked |
| **Teleconsultation** | `#0284c7` (Sky) | `#f0f9ff` | `#bae6fd` | Video & remote consultation mode |

---

## 3. Transformation Roadmap & Phase Progress

| Phase | Description | Target Files | Status |
| :--- | :--- | :--- | :---: |
| **Phase 1** | **Master Theme Configuration & Automated Unit Tests** | `config/theme.config.ts`, `scripts/test_theme_config.mjs` | ✅ **DONE** |
| **Phase 2** | **Tailwind & CSS Variable Binding** | `tailwind.config.ts`, `app/globals.css` | ⏳ Pending Next |
| **Phase 3** | **Brand Identity & SVG Elements** | `components/brand/BrandLogo.tsx`, `components/brand/StethoscopeHeartPulseIcon.tsx` | ⏳ Pending |
| **Phase 4** | **Doctor Dashboard & Calendar** | `components/dashboard/DashboardShell.tsx`, `OverviewTab.tsx`, `CalendarTab.tsx`, `DayView.tsx` | ⏳ Pending |
| **Phase 5** | **Patient Booking & Clinic Profile** | `app/[slug]/page.tsx`, `app/dr/[slug]/page.tsx` | ⏳ Pending |
| **Phase 6** | **Landing, Auth & Onboarding** | `components/landing/*`, `app/login/page.tsx`, `app/onboarding/page.tsx` | ⏳ Pending |
| **Phase 7** | **Automated QA & Regression Verification** | `npm run test` (All 10 test suites) | ⏳ Pending |

---

## 4. Testing Protocols & Verification Results

### A. Automated Verification (`npm run test:theme`)
* **Test Suite Script:** [`scripts/test_theme_config.mjs`](../scripts/test_theme_config.mjs)
* **Execution Command:** `npm run test:theme` (also included in root `npm test`)
* **Checks Conducted:**
  * ✅ **File Integrity:** Verifies `config/theme.config.ts` exists and exports typed tokens.
  * ✅ **Hex Code Validity:** Every brand token (50–950), surface token, and status color is strictly validated against `^#[0-9A-Fa-f]{6}$`.
  * ✅ **WCAG 2.1 Contrast Ratio Verification:**
    * Accessible brand text (`#115e59` on white `#ffffff`): **7.58:1** (Passes WCAG AA >= 4.5:1)
    * Primary text (`#0f172a` on white `#ffffff`): **17.85:1** (Passes WCAG AAA >= 7.0:1)
    * Hospital Navy (`#0c4a6e` on white `#ffffff`): **9.46:1** (Passes WCAG AA >= 4.5:1)
  * ✅ **100% Score:** Zero failures across all token categories.

### B. Manual Verification Checklist (Browser Testing)
1. **Interactive Preview Artifact:**
   * Open the generated generative UI preview artifact (`hospital_theme_ui.html`) in browser to inspect real rendered color harmony.
2. **Single Point of Control Test:**
   * Open `config/theme.config.ts`.
   * Change `brand[600]` temporarily.
   * Verify that Next.js hot-reload updates the primary elements immediately without touching component files.
3. **Contrast & Triage Visual Audit:**
   * Verify that Confirmed appointments stand out in Medical Emerald (`#059669`).
   * Verify that Reschedule slots display in clear warning Amber (`#d97706`).
   * Verify that emergency notices or cancellations render in surgical Crimson (`#e11d48`).

---

## 5. How to Update Colors in the Future (Single Point of Control)

To change any color across the entire application in the future:
1. Open [`config/theme.config.ts`](../config/theme.config.ts).
2. Edit the string variable (e.g. change `brand[600]` or `status.confirmed.solid`).
3. Save the file — the application will automatically reflect the change across all components and pages without needing manual file-by-file edits.
