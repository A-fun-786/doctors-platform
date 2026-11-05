# 🗓️ Appointment Tab — Sidebar Components Theme Migration Plan

**Document:** `docs/calendar_sidebar_theme_plan.md`  
**Theme Reference:** [`config/theme.config.ts`](file:///d:/doctors-platform/config/theme.config.ts)  
**Target Module:** Appointment Calendar Sidebar (`components/dashboard/calendar/sidebar/*`)  
**Scope:** `MiniCalendar.tsx`, `WorkingHoursCard.tsx`, and `CalendarSidebar.tsx`  
**Status:** ✅ Completed & Verified (100% Tests Passing)  

---

## 1. Executive Summary

This plan focuses exclusively on migrating the **Appointment Tab's Sidebar Components** from legacy `blue-*` styles to the centralized clinical theme system defined in [`config/theme.config.ts`](file:///d:/doctors-platform/config/theme.config.ts).

### Theme Tokens in Use:
- **Primary Brand Color (`brand-600` / `#059669`):** Selected date active background, primary icons, and high-contrast indicators.
- **Brand Hover / Accessible Contrast (`brand-700` / `#047857`):** Hover states on action buttons, high-contrast dark green text.
- **Subtle Surface Tint (`brand-50` / `#ecfdf5`):** Soft background for today's date pill, icon containers, and shift badges.
- **Subtle Borders (`brand-100` / `#d1fae5` & `brand-200` / `#a7f3d0`):** Badge outlines, today border indicator, and hover borders.
- **Active Range Tint (`brand-100` / `#d1fae5`):** Current active week days background highlighting.
- **Vitality Mint Accent (`brand-500` / `#10b981`):** Capacity status bullet and pulse indicator.

---

## 2. Target Files Breakdown

### File 1: [`components/dashboard/calendar/sidebar/MiniCalendar.tsx`](file:///d:/doctors-platform/components/dashboard/calendar/sidebar/MiniCalendar.tsx)

Responsible for the interactive Google Calendar-style month matrix, active day indicators, and event dots.

#### Specific Changes Required:
1. **Default Event Indicator Dot (Line 83):**
   - **Current:** `let dotColor = "bg-blue-600";`
   - **Target:** `let dotColor = "bg-brand-600";`

2. **Selected Date = Today (Lines 86-88):**
   - **Current:** `bg-blue-600 text-white font-bold shadow-xs scale-105`
   - **Target:** `bg-brand-600 text-white font-bold shadow-xs scale-105`
   - **Dot Color:** Remains `bg-white`.

3. **Today (Not Selected) (Lines 90-92):**
   - **Current:** `border-2 border-blue-600 text-blue-600 font-extrabold bg-blue-50/50 shadow-2xs hover:bg-blue-100/60`
   - **Target:** `border-2 border-brand-600 text-brand-600 font-extrabold bg-brand-50/50 shadow-2xs hover:bg-brand-100/60`
   - **Dot Color:** `bg-brand-600`

4. **Selected Date (Other Days) (Lines 94-96):**
   - **Current:** `bg-blue-100 text-blue-800 font-bold hover:bg-blue-200/80 shadow-2xs`
   - **Target:** `bg-brand-100 text-brand-800 font-bold hover:bg-brand-200/80 shadow-2xs`
   - **Dot Color:** `bg-brand-700`

---

### File 2: [`components/dashboard/calendar/sidebar/WorkingHoursCard.tsx`](file:///d:/doctors-platform/components/dashboard/calendar/sidebar/WorkingHoursCard.tsx)

Displays active operating shifts, total patient booking capacity, and provides the "Edit" CTA trigger.

#### Specific Changes Required:
1. **Header Clock Icon Container (Line 35):**
   - **Current:** `bg-blue-50 text-blue-600 ... border border-blue-100`
   - **Target:** `bg-brand-50 text-brand-600 ... border border-brand-100`

2. **"Edit" Hours Action Button (Line 51):**
   - **Current:** `text-blue-600 hover:text-blue-700 bg-blue-50/70 hover:bg-blue-100/70 border-blue-100`
   - **Target:** `text-brand-700 hover:text-brand-800 bg-brand-50/80 hover:bg-brand-100/80 border-brand-200`

3. **Shift Item Hover State (Line 78):**
   - **Current:** `hover:bg-blue-50/30 border border-slate-100 hover:border-blue-200`
   - **Target:** `hover:bg-brand-50/30 border border-slate-100 hover:border-brand-200`

4. **Shift Slot Count Pill (Line 95):**
   - **Current:** `bg-blue-50 text-blue-700 border border-blue-100`
   - **Target:** `bg-brand-50 text-brand-800 border border-brand-200 font-semibold`

5. **Total Capacity Dot (Line 112):**
   - **Current:** `bg-blue-500`
   - **Target:** `bg-brand-500`

---

### File 3: [`components/dashboard/calendar/sidebar/CalendarSidebar.tsx`](file:///d:/doctors-platform/components/dashboard/calendar/sidebar/CalendarSidebar.tsx)

- **Verification:** Serves as the wrapper container (`hidden xl:grid xl:col-span-3 grid-cols-1 gap-5`).
- Ensure props passed between `CalendarTab` and both child widgets maintain typing and render without layout shift.

---

## 3. Side-by-Side Comparison

| Component Element | Legacy Class (Old) | New Brand Class (New Theme) | Hex Reference |
| :--- | :--- | :--- | :--- |
| **MiniCal Today + Selected** | `bg-blue-600 text-white` | `bg-brand-600 text-white` | `#059669` |
| **MiniCal Today (Unselected)** | `border-blue-600 text-blue-600 bg-blue-50/50` | `border-brand-600 text-brand-600 bg-brand-50/50` | `#059669` / `#ecfdf5` |
| **MiniCal Selected Other Day** | `bg-blue-100 text-blue-800` | `bg-brand-100 text-brand-800` | `#d1fae5` / `#065f46` |
| **MiniCal Event Dot** | `bg-blue-600` / `bg-blue-700` | `bg-brand-600` / `bg-brand-700` | `#059669` / `#047857` |
| **Working Hours Clock Icon** | `bg-blue-50 text-blue-600 border-blue-100` | `bg-brand-50 text-brand-600 border-brand-100` | `#ecfdf5` / `#059669` |
| **Edit Hours Button** | `text-blue-600 bg-blue-50/70 border-blue-100` | `text-brand-700 bg-brand-50/80 border-brand-200` | `#047857` / `#ecfdf5` |
| **Shift Item Hover** | `hover:bg-blue-50/30 hover:border-blue-200` | `hover:bg-brand-50/30 hover:border-brand-200` | `#ecfdf5` / `#a7f3d0` |
| **Shift Slot Badge** | `bg-blue-50 text-blue-700 border-blue-100` | `bg-brand-50 text-brand-800 border-brand-200` | `#ecfdf5` / `#065f46` |
| **Capacity Dot Indicator** | `bg-blue-500` | `bg-brand-500` | `#10b981` |

---

## 4. Implementation Steps

1. **Step 1:** Update [`components/dashboard/calendar/sidebar/MiniCalendar.tsx`](file:///d:/doctors-platform/components/dashboard/calendar/sidebar/MiniCalendar.tsx) — ✅ Completed.
2. **Step 2:** Update [`components/dashboard/calendar/sidebar/WorkingHoursCard.tsx`](file:///d:/doctors-platform/components/dashboard/calendar/sidebar/WorkingHoursCard.tsx) — ✅ Completed.
3. **Step 3:** Verify TypeScript compilation & Tailwind CSS rendering (`npm run test`, `npx tsc --noEmit`) — ✅ 100% Passed.
4. **Step 4:** Added regression test suite [`scripts/test_calendar_sidebar_theme.mjs`](file:///d:/doctors-platform/scripts/test_calendar_sidebar_theme.mjs) — ✅ 100% Passed.

