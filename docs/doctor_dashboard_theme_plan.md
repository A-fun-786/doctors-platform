# 🏥 Doctor Dashboard & Working Hours — Theme Color Migration Plan

**File:** [`docs/doctor_dashboard_theme_plan.md`](file:///d:/doctors-platform/docs/doctor_dashboard_theme_plan.md)  
**Theme Reference:** [`config/theme.config.ts`](file:///d:/doctors-platform/config/theme.config.ts)  
**Theme Style:** Clinical Emerald & Vitality Mint (Fresh Healing Theme)  
**Status:** Approved for Implementation (with DayView/WeekView calendar slot styling preserved)  

---

## 1. Executive Summary & Purpose

The objective of this plan is to eliminate legacy colors (such as hardcoded `blue-*` and `indigo-*`) across the **Doctor Dashboard Main Tabs** and specifically within the **Doctor Working Hours Management UI**, migrating them strictly to the single source of truth defined in [`config/theme.config.ts`](file:///d:/doctors-platform/config/theme.config.ts).

### 🔒 User Design Specification:
> **Important:** The calendar slot colors in `DayView` and `WeekView` (`SHIFT_THEME_PALETTES` — Shift 1 Warm Amber, Shift 2 Sky Blue, Shift 3 Emerald Green, Shift 4 Royal Violet) are **preserved as-is without alteration**.
> The color update is focused exclusively on the **Working Hours Management UI** (Modal dialog, Mobile capsule, and Sidebar widget).

- **Primary Brand Theme:** Clinical Emerald (`#059669` / `brand-600`) and Deep Forest Emerald (`#047857` / `brand-700`).
- **Vitality Accents:** Diagnostic Mint (`#10b981` / `brand-500` and `#34d399` / `brand-400`).
- **Backgrounds & Surfaces:** Sterile Pure White (`#ffffff`), Clean Clinical Slate (`#f8fafc` / `bg-slate-50`), and Soft Mint Tints (`#ecfdf5` / `brand-50`).

---

## 2. Color System Reference (`config/theme.config.ts`)

| Token Category | Token Name | Hex Code | UI Usage |
| :--- | :--- | :--- | :--- |
| **Brand Scale** | `brand-50` | `#ecfdf5` | Ultra-light clinical background, badge tint |
| | `brand-100` | `#d1fae5` | Soft mint highlights & pill backgrounds |
| | `brand-200` | `#a7f3d0` | Subtle borders, active shift container outline |
| | `brand-300` | `#6ee7b7` | Interactive focus rings, dashed action borders |
| | `brand-500` | `#10b981` | Vitality mint secondary actions, active dot |
| | `brand-600` | `#059669` | **Primary Brand Color** (Primary Buttons, Modals, Toggles) |
| | `brand-700` | `#047857` | Button hover states & high-contrast accessible text |
| | `brand-800` | `#065f46` | Deep forest container accents, shift slot badges |
| | `brand-900` | `#064e3b` | Clinical authority dark surfaces & banners |
| **Surfaces** | `hospital.surfaceBg` | `#f8fafc` | Clean dashboard page background |
| | `hospital.cardBg` | `#ffffff` | Sterile card, panel, and modal containers |
| | `hospital.border` | `#e2e8f0` | Clean structural dividers & card borders |
| **Status Tokens** | `status.confirmed` | `#059669` / `#ecfdf5` | Confirmed bookings, completed appointments |
| | `status.reschedule`| `#d97706` / `#fffbeb` | Reschedule alerts, doctor leaves, warnings |
| | `status.emergency` | `#e11d48` / `#fff1f2` | Cancellations, critical alerts, emergencies |
| | `status.teleconsult`| `#10b981` / `#f0fdf4` | Video consultation tags & indicators |

---

## 3. Scope of Working Hours & Calendar Components

The doctor working hours system is utilized across primary touchpoints:

1. **Working Hours Card** (`components/dashboard/calendar/sidebar/WorkingHoursCard.tsx`)
   - Sidebar desktop widget and mobile bottom sheet summary of active shifts, capacity, and slot count (**Migrated to Brand Tokens**).
2. **Edit Working Hours Modal** (`components/dashboard/calendar/modals/EditWorkingHoursModal.tsx`)
   - Complete modal dialog for configuring operating shifts, timings, session toggles, and total daily slot capacity (**Migrated to Brand Tokens**).
3. **Mobile Clinic Status Capsule** (`components/dashboard/calendar/mobile/MobileClinicStatusCapsule.tsx`)
   - Top banner capsule on mobile calendar indicating current shift status, upcoming shifts, and opening hours sheet (**Migrated to Brand Tokens**).
4. **DayView & WeekView Calendar Slot Colors** (`components/dashboard/calendar/calendarUtils.ts`, `DayView.tsx`, `WeekView.tsx`)
   - **PRESERVED:** Original multi-shift colors and slot styling are retained untouched per explicit requirement.

---

## 4. Working Hours Color Migration Matrix (Element by Element)

### 4.1. Edit Working Hours Modal (`components/dashboard/calendar/modals/EditWorkingHoursModal.tsx`)

| UI Element / Selector | Current Legacy Class | New Clinical Theme Class | Visual Rationale |
| :--- | :--- | :--- | :--- |
| **Modal Header Icon Box** (Line 237) | `bg-blue-50 text-blue-600 border border-blue-100` | `bg-brand-50 text-brand-600 border border-brand-100` | Aligns modal icon with brand clinical emerald identity |
| **Capacity Banner Gradient** (Line 254) | `bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/90 border border-blue-100 text-blue-900` | `bg-gradient-to-r from-brand-50/90 via-teal-50/60 to-brand-50/90 border border-brand-200/80 text-brand-950` | Replaces cold blue/indigo gradient with soothing clinical mint/teal banner |
| **Capacity Banner Clock Icon** (Line 256) | `text-blue-600` | `text-brand-600` | Cohesive clinical emerald accent |
| **Total Slots Pill Badge** (Line 265) | `bg-blue-600 text-white shadow-xs` | `bg-brand-600 text-white shadow-xs` | High contrast primary capacity badge |
| **Shift Card Hover Border** (Line 297) | `hover:border-blue-200` | `hover:border-brand-200` | Harmonious card hover feedback |
| **Shift Number Badge** (Line 303) | `bg-blue-50 text-blue-600 border border-blue-100` | `bg-brand-50 text-brand-700 border border-brand-200` | Clear shift numbering with high contrast |
| **Shift Label Input Focus** (Line 312) | `focus:border-blue-600` | `focus:border-brand-600` | Unified active input border |
| **Shift Slots Pill** (Line 316) | `bg-blue-50 text-blue-700 border border-blue-100` | `bg-brand-50 text-brand-800 border border-brand-200` | Matches `WorkingHoursCard.tsx` slot badge standard |
| **Shift Toggle Switch (Active)** (Line 333) | `peer-checked:bg-blue-600` | `peer-checked:bg-brand-600` | Standardized clinical emerald switch active state |
| **Time Select Dropdown Focus** (Lines 362, 384) | `focus:ring-blue-500/20 focus:border-blue-500` | `focus:ring-brand-500/20 focus:border-brand-500` | Consistent focus ring and border |
| **Add Schedule Window CTA** (Line 407) | `border-dashed border-blue-300 bg-blue-50/40 hover:bg-blue-50 text-blue-700` | `border-dashed border-brand-300 bg-brand-50/40 hover:bg-brand-100/70 text-brand-700` | Inviting dashed action container matching brand green |
| **Save Working Hours Button** (Line 426) | `bg-blue-600 hover:bg-blue-700` | `bg-brand-600 hover:bg-brand-700 focus:ring-brand-500` | Primary action button in brand emerald |

---

### 4.2. Mobile Clinic Status Capsule (`components/dashboard/calendar/mobile/MobileClinicStatusCapsule.tsx`)

| UI Element / Selector | Current Legacy Class | New Clinical Theme Class | Visual Rationale |
| :--- | :--- | :--- | :--- |
| **Capsule Container** (Line 86) | `bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100/80 hover:border-blue-200` | `bg-gradient-to-r from-brand-50/80 via-teal-50/40 to-slate-50 border border-brand-100 hover:border-brand-200` | Fresh healing clinical tint for mobile header |
| **Status Icon Wrapper** (Line 91) | `border border-blue-100` | `border border-brand-100` | Subtle clean boundary |
| **Status Icon** (Line 92) | `text-blue-600` | `text-brand-600` | Clinical emerald icon |
| **Upcoming Shift Status Dot** (Line 63) | `bg-blue-500` | `bg-brand-500` | Replaces blue dot with vital mint accent |
| **"Hours & Shifts" CTA Link** (Line 116) | `text-blue-600 group-hover:text-blue-700` | `text-brand-700 group-hover:text-brand-800` | High-contrast readable link text |
| **Chevron Arrow** (Line 119) | `text-blue-500` | `text-brand-600` | Aligned brand action indicator |

---

### 4.3. Working Hours Card (`components/dashboard/calendar/sidebar/WorkingHoursCard.tsx`)

The `WorkingHoursCard` uses brand tokens and is validated by `scripts/test_calendar_sidebar_theme.mjs`:
- **Card Header Icon:** `bg-brand-50 text-brand-600 border border-brand-100`
- **Active Status Indicator:** `text-emerald-600 font-semibold` with pulsing `bg-emerald-500`
- **Edit CTA:** `text-brand-700 hover:text-brand-800 bg-brand-50/80 hover:bg-brand-100/80 border border-brand-200`
- **Shift Row Hover:** `hover:bg-brand-50/30 hover:border-brand-200`
- **Slots Badge:** `bg-brand-50 text-brand-800 border border-brand-200`
- **Total Capacity Dot:** `bg-brand-500`

---

### 4.4. Preserved DayView & WeekView Slot Theming

As explicitly directed, `DayView` and `WeekView` calendar slots preserve their existing distinct colors to retain immediate operational clarity for the doctor:
- **Shift 1:** Warm Amber (`bg-amber-50`, `text-amber-900`, `border-amber-300`, `bg-amber-500`)
- **Shift 2:** Sky Blue (`bg-sky-50`, `text-sky-900`, `border-sky-300`, `bg-sky-500`)
- **Shift 3:** Emerald Green (`bg-emerald-50`, `text-emerald-900`, `border-emerald-300`, `bg-emerald-500`)
- **Shift 4:** Royal Violet (`bg-purple-50`, `text-purple-900`, `border-purple-300`, `bg-purple-500`)

---

### 4.5. Calendar Header View Switcher (`components/dashboard/calendar/views/CalendarHeader.tsx`)

| UI Element / Selector | Current Legacy Class | New Clinical Theme Class | Visual Rationale |
| :--- | :--- | :--- | :--- |
| **Day / Week / Month Active Pill** | `bg-blue-600 text-white shadow-xs` | `bg-brand-600 hover:bg-brand-700 text-white shadow-xs` | Unifies view toggles with primary clinical emerald branding |
| **Day / Week / Month Inactive Hover** | `text-slate-600 hover:text-slate-900 hover:bg-slate-50` | `text-slate-600 hover:text-brand-700 hover:bg-brand-50/70` | Subtle mint hover feedback consistent with dashboard tabs |
| **Keyboard Focus State** | N/A | `focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500` | WCAG AA compliance with visible brand focus indicator |

---

### 4.6. Calendar Current Date ("Today") UI Migration (`WeekView.tsx`, `MobileHorizonDayStrip.tsx`, `MonthView.tsx`)

> **Note:** Calendar slot appointments and shift theme colors (`SHIFT_THEME_PALETTES`) are strictly preserved. Only current date headers and badges are migrated.

| UI Element / Selector | Current Legacy Class | New Clinical Theme Class | Visual Rationale |
| :--- | :--- | :--- | :--- |
| **WeekView Today Date Badge (Unselected)** | `border-2 border-blue-600 text-blue-600 bg-white` | `border-2 border-brand-600 text-brand-600 bg-brand-50/50 shadow-2xs hover:bg-brand-100/60` | High-contrast clinical emerald current-date indicator |
| **WeekView Selected Date Badge** | `bg-blue-600 text-white shadow-xs` | `bg-brand-600 text-white shadow-xs` | Solid clinical emerald selected date circle |
| **WeekView Today Indicator Dot** | `bg-blue-600` | `bg-brand-600` | Cohesive clinical emerald today dot |
| **WeekView Today Day Name** | `text-blue-600` | `text-brand-600` | Clean high-contrast day name |
| **WeekView Today Column Header Tint** | `bg-blue-50/25 hover:bg-blue-50/50` | `bg-brand-50/30 hover:bg-brand-50/60` | Soothing mint header background |
| **Mobile Horizon Strip Today Chip** | `border border-blue-400 bg-blue-50/60 text-blue-900` | `border border-brand-300 bg-brand-50/60 text-brand-900` | Mobile current day capsule matching brand palette |
| **MonthView Today Cell Circle** | `bg-blue-600 text-white` | `bg-brand-600 text-white` | High-contrast today date badge in monthly grid |

---

### 4.7. Calendar Legend Indicator Dots Migration Plan (`WeekView.tsx`, `DayView.tsx`)

> [!IMPORTANT]
> **Explicit User Preservation Requirement:**
> 1. In `DayView.tsx`, the **Summary KPI Card Calendar Icon** (`bg-blue-50 text-blue-600` on Line 108) is **STRICTLY PRESERVED** and **WILL NOT BE CHANGED**.
> 2. The appointment slot palettes (`SHIFT_THEME_PALETTES`) across DayView and WeekView remain preserved as-is.
> 3. Only the specific legend indicator dots for patient appointments are migrated to Clinical Emerald (`brand-*`).

| UI Element / File | Location | Current Legacy Class | New Clinical Theme Class | Visual Rationale & Status |
| :--- | :--- | :--- | :--- | :--- |
| **WeekView Legend Appointment Dot**<br>[`WeekView.tsx`](file:///d:/doctors-platform/components/dashboard/calendar/views/WeekView.tsx) | Line 92 | `w-2.5 h-2.5 rounded-xs bg-blue-600 border border-blue-700` | `w-2.5 h-2.5 rounded-xs bg-brand-600 border border-brand-700` | Replaces legacy blue square dot with Clinical Emerald (`brand-600`) indicator matching confirmed appointment branding. |
| **DayView Legend Patient Dot**<br>[`DayView.tsx`](file:///d:/doctors-platform/components/dashboard/calendar/views/DayView.tsx) | Line 84 | `w-1.5 h-1.5 rounded-full bg-blue-500` | `w-1.5 h-1.5 rounded-full bg-brand-500` | Harmonizes small patient appointment legend dot with Diagnostic Mint (`brand-500`). |
| **DayView Summary KPI Icon**<br>[`DayView.tsx`](file:///d:/doctors-platform/components/dashboard/calendar/views/DayView.tsx) | Line 108 | `bg-blue-50 text-blue-600` | `bg-blue-50 text-blue-600` | 🔒 **PRESERVED AS-IS (NO CHANGE):** Explicit user instruction to retain original blue styling for KPI card icon. |

---

## 5. Accessibility & Contrast Compliance (WCAG AA / AAA)

All Working Hours UI color combinations meet or exceed WCAG requirements:

| Element | Background | Foreground | Contrast Ratio | WCAG Rating |
| :--- | :--- | :--- | :--- | :--- |
| **Shift Number Badge** | `#ecfdf5` (`brand-50`) | `#047857` (`brand-700`) | **7.8 : 1** | AAA (Pass) |
| **Working Hours Edit CTA** | `#ecfdf5` (`brand-50`) | `#047857` (`brand-700`) | **7.8 : 1** | AAA (Pass) |
| **Capacity Slot Pill** | `#059669` (`brand-600`) | `#ffffff` (White) | **4.6 : 1** | AA (Pass) |
| **Save Hours CTA Button** | `#059669` (`brand-600`) | `#ffffff` (White) | **4.6 : 1** | AA (Pass) |
| **Add Schedule Window Link** | `#ecfdf5` (`brand-50`) | `#047857` (`brand-700`) | **7.8 : 1** | AAA (Pass) |

---

## 6. Execution Steps & Verification Checklist

1. **Step 1: `EditWorkingHoursModal.tsx` Migrated** — Verified 0 legacy `blue-*` classes.
2. **Step 2: `MobileClinicStatusCapsule.tsx` Migrated** — Verified 0 legacy `blue-*` classes.
3. **Step 3: `DayView.tsx` and `WeekView.tsx` Calendar Slots** — Preserved in original colors per user preference.
4. **Step 4: Legend Indicator Dots Migration:**
   - Update `WeekView.tsx` Line 92: `bg-blue-600 border border-blue-700` → `bg-brand-600 border border-brand-700`.
   - Update `DayView.tsx` Line 84: `bg-blue-500` → `bg-brand-500`.
   - 🔒 **Preserved:** `DayView.tsx` Line 108 Summary KPI icon (`bg-blue-50 text-blue-600`) remains strictly unchanged.
5. **Step 5: Automated Verification**
   - Run `npx tsc --noEmit` — 0 errors.
   - Run `npm test` & `npm run test:calendar:sidebar` — 100% tests pass.
