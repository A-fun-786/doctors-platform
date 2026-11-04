# 🏥 Doctor Dashboard (Main Tabs) — Theme Color Migration Plan

**File:** [`docs/doctor_dashboard_theme_plan.md`](file:///d:/doctors-platform/docs/doctor_dashboard_theme_plan.md)  
**Theme Reference:** [`config/theme.config.ts`](file:///d:/doctors-platform/config/theme.config.ts)  
**Theme Style:** Clinical Emerald & Vitality Mint (Fresh Healing Theme)  
**Status:** Approved for Implementation  

---

## 1. Executive Summary & Purpose

The objective of this plan is to update all colors across the **Doctor Dashboard Main Tabs** to strictly match the single source of truth defined in [`config/theme.config.ts`](file:///d:/doctors-platform/config/theme.config.ts).

Currently, legacy parts of the dashboard still utilize inconsistent colors (such as hardcoded `blue-*`, `indigo-*`, and `purple-*` classes). This migration harmonizes all main tabs into a unified, high-contrast clinical healthcare design:

- **Primary Brand Theme:** Clinical Emerald (`#059669` / `brand-600`) and Deep Forest Emerald (`#047857` / `brand-700`).
- **Vitality Accents:** Diagnostic Mint (`#10b981` / `brand-500` and `#34d399` / `brand-400`).
- **Backgrounds & Surfaces:** Sterile Pure White (`#ffffff`), Clean Clinical Ward Slate (`#f8fafc` / `bg-slate-50`), and Soft Mint Tints (`#ecfdf5` / `brand-50`).
- **Standardized Medical Status Triage:**
  - **Confirmed / Completed:** Medical Emerald (`#059669` / `#ecfdf5`)
  - **Reschedule / Attention Needed:** Triage Amber (`#d97706` / `#fffbeb`)
  - **Emergency / Cancelled:** Surgical Crimson (`#e11d48` / `#fff1f2`)
  - **Teleconsultation:** Vitality Mint (`#10b981` / `#f0fdf4`)

---

## 2. Color System Reference (`config/theme.config.ts`)

| Token Category | Token Name | Hex Code | UI Usage |
| :--- | :--- | :--- | :--- |
| **Brand Scale** | `brand-50` | `#ecfdf5` | Ultra-light clinical background, badge tint |
| | `brand-100` | `#d1fae5` | Soft mint highlights & pill backgrounds |
| | `brand-200` | `#a7f3d0` | Subtle borders, ECG pulse accent |
| | `brand-500` | `#10b981` | Vitality mint secondary actions & icons |
| | `brand-600` | `#059669` | **Primary Brand Color** (Buttons, Active Tabs, Key CTAs) |
| | `brand-700` | `#047857` | Hover states & high-contrast accessible text |
| | `brand-800` | `#065f46` | Deep forest container accents & headings |
| | `brand-900` | `#064e3b` | Clinical authority dark surfaces & banners |
| **Surfaces** | `hospital.surfaceBg` | `#f8fafc` | Clean dashboard page background |
| | `hospital.cardBg` | `#ffffff` | Sterile card, panel, and modal containers |
| | `hospital.border` | `#e2e8f0` | Clean structural dividers & card borders |
| **Status Tokens** | `status.confirmed` | `#059669` / `#ecfdf5` | Confirmed bookings, completed appointments |
| | `status.reschedule`| `#d97706` / `#fffbeb` | Reschedule alerts, doctor leaves, warnings |
| | `status.emergency` | `#e11d48` / `#fff1f2` | Cancellations, critical alerts, emergencies |
| | `status.teleconsult`| `#10b981` / `#f0fdf4` | Video consultation tags & indicators |

---

## 3. Scope of Main Tabs & Components

The Doctor Dashboard is organized into the following main tabs and views:

1. **Dashboard Shell & Navigation Tabs** (`components/dashboard/DashboardShell.tsx`)
2. **Tab 1: Overview** (`components/dashboard/OverviewTab.tsx`)
3. **Tab 2: Appointments / Calendar** (`components/dashboard/CalendarTab.tsx` & subcomponents)
4. **Tab 3: Profile & Settings** (`components/dashboard/ProfileTab.tsx`)
5. **Tab 4: Android App** (`components/dashboard/AndroidAppTab.tsx`)
6. **Dashboard Gateway & Alerts** (`app/dashboard/page.tsx`)

---

## 4. Detailed Component Migration Matrix

### Tab Shell: `components/dashboard/DashboardShell.tsx`
- **Location:** Desktop sidebar navigation, mobile drawer navigation, and mobile bottom navigation bar.
- **Current Findings:**
  - Active tab styling already references `bg-brand-50 text-brand-700 border-brand-600`.
  - Hover states and focus rings must be strictly standardized to `brand-50/50` and `focus-visible:ring-brand-500`.
  - Header profile pill uses clean `bg-slate-50 border-slate-200`.

### Tab 1: Overview (`components/dashboard/OverviewTab.tsx`)
- **Issue 1 (Hero Banner - Line 88):**
  - Current: `bg-gradient-to-r from-brand-600 via-blue-600 to-indigo-700` with `text-blue-100`.
  - Target: `bg-gradient-to-r from-brand-700 via-brand-600 to-brand-800` with `text-brand-100`.
  - Verification Icon: Change `text-emerald-300` to `text-brand-300`.
- **Issue 2 (Stat Cards - Line 120-125):**
  - Current: Hardcoded `blue: bg-blue-50 text-blue-600`, `indigo: bg-indigo-50 text-indigo-600`, `violet: bg-violet-50 text-violet-600`.
  - Target: Harmonize to theme colors:
    - Total Appointments: `bg-brand-50 text-brand-600`
    - Completed Consultations: `bg-emerald-50 text-emerald-700`
    - Teleconsultations: `bg-teal-50 text-teal-700`
    - Pending / Rescheduled: `bg-amber-50 text-amber-700`
- **Issue 3 (Consultation Badges - Lines 273, 294):**
  - Current: `bg-blue-50 text-blue-700 border border-blue-200`.
  - Target: `bg-brand-50 text-brand-700 border border-brand-200`.

### Tab 2: Appointments / Calendar (`components/dashboard/CalendarTab.tsx`)
- **Issue 1 (Drawer Category Badge - Line 312):**
  - Current: `text-blue-700 bg-blue-50 border border-blue-200` for "Patient Appointment".
  - Target: `text-brand-800 bg-brand-50 border border-brand-200` (matching `HOSPITAL_THEME_COLORS.status.confirmed`).
  - Leave Badge (Line 316): Retain `text-amber-800 bg-amber-50 border border-amber-200` (matching `status.reschedule`).
- **Calendar Action Buttons & Highlights:**
  - Date active selection pill: `bg-brand-600 text-white`.
  - Add Appointment CTA button: `bg-brand-600 hover:bg-brand-700 text-white shadow-sm`.

### Tab 3: Profile & Settings (`components/dashboard/ProfileTab.tsx`)
- **Issue 1 (Consultation Modes - Lines 375-450):**
  - In-Clinic Mode:
    - Current: `bg-blue-50/50 border-blue-200 text-blue-900`, pill `bg-blue-100 text-blue-800`.
    - Target: `bg-brand-50/50 border-brand-300 text-brand-900`, pill `bg-brand-100 text-brand-800`.
  - Video Consultation Mode:
    - Current: `bg-indigo-50/50 border-indigo-200 text-indigo-900`, pill `bg-indigo-100 text-indigo-800`.
    - Target: `bg-emerald-50/50 border-emerald-300 text-emerald-900`, pill `bg-emerald-100 text-emerald-800`.
  - Emergency / Priority Mode:
    - Current: `bg-purple-50/50 border-purple-200 text-purple-900`, pill `bg-purple-100 text-purple-800`.
    - Target: `bg-rose-50/50 border-rose-300 text-rose-900`, pill `bg-rose-100 text-rose-800`.
- **Issue 2 (Clinical Services Toggles - Lines 710-785):**
  - Video Consult toggle: Change `bg-indigo-600` and `border-indigo-300` to `bg-brand-600` and `border-brand-300`.
  - Lab Reports toggle: Change `bg-purple-600` and `border-purple-300` to `bg-brand-700` and `border-brand-300`.
  - Medicine toggle: Change to `bg-brand-600` and `border-brand-300`.
- **Issue 3 (Save Actions):**
  - Save Changes button: `bg-brand-600 hover:bg-brand-700 text-white focus:ring-brand-500`.

### Tab 4: Android App (`components/dashboard/AndroidAppTab.tsx`)
- **Issue 1 (Info Callouts - Lines 193, 301):**
  - Current: `bg-blue-50/60 border border-blue-200 text-slate-700`.
  - Target: `bg-brand-50/70 border border-brand-200 text-brand-950`.
- **Issue 2 (Progress Bar - Line 309):**
  - Current: `w-full bg-blue-200 rounded-full h-2` with spinner.
  - Target: `w-full bg-brand-100 rounded-full h-2` with `bg-brand-600` animated progress indicator.
- **Issue 3 (Action Button - Line 359):**
  - Unify ready download button to `bg-brand-600 hover:bg-brand-700 text-white`.

### Dashboard Gateway (`app/dashboard/page.tsx`)
- **Loading Screen (Lines 91-99):**
  - Loading icon container: `bg-brand-600 text-white shadow-md`.
  - Spinner: `text-brand-600`.
- **Setup Warning Banner (Line 121):**
  - Retain `bg-amber-50 border-amber-200 text-amber-900` with `bg-amber-600` button for clear medical triage visibility.

---

## 5. Token Replacement Summary Table

| UI Area / Element | Legacy Style | New Theme Standard |
| :--- | :--- | :--- |
| **Overview Banner Background** | `from-brand-600 via-blue-600 to-indigo-700` | `from-brand-700 via-brand-600 to-brand-800` |
| **Overview Banner Subtitle** | `text-blue-100` | `text-brand-100` |
| **Drawer Appt Header Badge** | `text-blue-700 bg-blue-50 border-blue-200` | `text-brand-800 bg-brand-50 border-brand-200` |
| **In-Clinic Consultation Pill** | `bg-blue-50 text-blue-700 border-blue-200` | `bg-brand-50 text-brand-800 border-brand-200` |
| **Profile Consultation Active Cards** | `border-blue-200`, `border-indigo-200` | `border-brand-300 bg-brand-50/60` |
| **Profile Services Active Toggles** | `bg-indigo-600`, `bg-purple-600` | `bg-brand-600 text-white` |
| **Android Tab Notice Callouts** | `bg-blue-50/60 border-blue-200` | `bg-brand-50/70 border-brand-200` |
| **Android Progress Track** | `bg-blue-200` | `bg-brand-100` / `bg-brand-600` |

---

## 6. Execution Steps & Verification Plan

1. **Step 1: Update `OverviewTab.tsx`**
   - Replace gradient banner and stat card color tokens.
2. **Step 2: Update `CalendarTab.tsx`**
   - Replace drawer badges and category tags.
3. **Step 3: Update `ProfileTab.tsx`**
   - Align consultation mode cards and clinical service toggle switches.
4. **Step 4: Update `AndroidAppTab.tsx`**
   - Update callout containers and progress bar indicators.
5. **Step 5: Codebase Validation**
   - Run `npx tsc --noEmit` to verify type safety.
   - Run `npm run test:theme` to verify theme token integrity and WCAG AA/AAA contrast ratios.
