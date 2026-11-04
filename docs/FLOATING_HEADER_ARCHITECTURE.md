# Header Navigation, Scroll Isolation & Profile Menu Architecture

**Document Version:** 2.0.0  
**Target Files:**
- `components/dashboard/DashboardShell.tsx` (Doctor Dashboard Shell & Header)
- `components/landing/Navbar.tsx` (Public Landing Page Navigation)
- `components/dashboard/OverviewTab.tsx` (Dashboard Overview Quick Actions)
- `app/globals.css` (Root Scroll Engine, Overscroll Locks & Auto-Hiding Scrollbar)
**Date:** November 2026  
**Status:** Implemented, Production-Verified & Fully Documented  

---

## 1. Overview & Evolution

### 1.1 Architectural Purpose
This architecture provides a unified, production-grade navigation and viewport scrolling system across the platform. It addresses the user requirements for:
1. **Edge-to-Edge Glassmorphic Transparent Sticky Headers**: Consistent, modern, edge-to-edge frosted headers on both public marketing pages and authenticated doctor dashboards.
2. **Strict Viewport Scroll Isolation**: Complete elimination of rubber-banding, bouncing, and layout jitter on macOS trackpads and mobile Safari when reaching scroll boundaries.
3. **Auto-Hiding Scrollbars with Zero Re-Renders**: Sleek, non-intrusive scrollbars that remain completely invisible at rest and smoothly fade in only while scrolling.
4. **Content-Hugging Modular Sidebar**: A compact sidebar that hugs its active modules rather than stretching empty blank space to the bottom of the screen.
5. **Integrated Profile Avatar Popover**: Removal of isolated logout buttons in favor of an intuitive, high-contrast avatar dropdown that cleanly distinguishes read-only doctor identity from clickable actions (**Admin Profile** and **Sign Out**).

---

## 2. Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ WINDOW ROOT (h-screen w-full overflow-hidden overscroll-none)                           │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ FIXED HEADER (top-0 left-0 right-0 z-40 h-14 md:h-16 bg-white/80 backdrop-blur-md)  │ │
│ │  [BrandLogo]                                 [Doctor Avatar Trigger + Dropdown]    │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                        │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ WORKSPACE CONTAINER (max-w-7xl mx-auto flex-1 min-h-0 flex gap-6 overflow-hidden)   │ │
│ │                                                                                    │ │
│ │  ┌─────────────────────┐  ┌─────────────────────────────────────────────────────┐  │ │
│ │  │ SIDEBAR (<aside>)   │  │ MAIN VIEWPORT (<main>)                              │  │ │
│ │  │ pt-20 pb-6          │  │ pt-18 md:pt-20 pb-24 md:pb-8 pr-1                   │  │ │
│ │  │ self-start          │  │ h-full overflow-y-auto overscroll-contain           │  │ │
│ │  │ w-60 (w-20 collapse)│  │ auto-hide-scrollbar                                 │  │ │
│ │  │                     │  │                                                     │  │ │
│ │  │ ┌─────────────────┐ │  │ ┌─────────────────────────────────────────────────┐ │  │ │
│ │  │ │ Menu Toggle     │ │  │ │ Page Content Physically Flows Underneath Header │ │  │ │
│ │  │ ├─────────────────┤ │  │ │ With Frosted Glass Blur Backdrop                │ │  │ │
│ │  │ │ [Overview]      │ │  │ └─────────────────────────────────────────────────┘ │  │ │
│ │  │ │ [Appointments]  │ │  │                                                     │  │ │
│ │  │ └─────────────────┘ │  │                                                     │  │ │
│ │  └─────────────────────┘  └─────────────────────────────────────────────────────┘  │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Subsystems

### 3.1 Transparent Sticky Header System
Both the marketing homepage ([`components/landing/Navbar.tsx`](file:///Users/emanur/doctors-platform/components/landing/Navbar.tsx)) and the doctor portal ([`components/dashboard/DashboardShell.tsx`](file:///Users/emanur/doctors-platform/components/dashboard/DashboardShell.tsx)) use an edge-to-edge transparent sticky header.

#### Design Tokens & Configuration:
- **Positioning**: `fixed top-0 left-0 right-0 z-40 w-full` (Dashboard) / `sticky top-0 z-50 w-full` (Landing).
- **Surface**: `bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-2xs`.
- **Height**: Mobile `h-14` (56px), Desktop `h-16` (64px).
- **Physical Content Flow**: Content within `<main>` passes physically underneath the header. The top padding on `<main>` (`pt-18 md:pt-20` / 80px) offsets the 64px header height with 16px of breathing margin, so elements are never occluded on initial load.

---

### 3.2 Viewport Scroll Isolation & Zero-Bounce Physics
A recurring issue on macOS trackpads and mobile touch devices is **rubber-band bouncing**: when reaching the top or bottom of a scrollable section, the entire browser window shifts, causing fixed and sticky elements to visibly jitter.

#### The Multi-Layer Solution:
1. **Root HTML/Body Lock** ([`app/globals.css`](file:///Users/emanur/doctors-platform/app/globals.css)):
   ```css
   html, body {
     scroll-behavior: smooth;
     overflow-x: clip;
     max-width: 100vw;
     overscroll-behavior-y: none; /* Disables window rubber-banding */
   }
   ```
2. **Dashboard Shell Root Lock** ([`components/dashboard/DashboardShell.tsx`](file:///Users/emanur/doctors-platform/components/dashboard/DashboardShell.tsx)):
   ```tsx
   <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden overscroll-none">
   ```
3. **Dedicated Main Scroll Viewport**:
   ```tsx
   <main
     ref={mainRef}
     onScroll={handleMainScroll}
     className="flex-1 min-w-0 h-full overflow-y-auto overscroll-contain auto-hide-scrollbar pt-18 md:pt-20 pr-1 pb-24 md:pb-8"
   >
   ```
   - Because `<main>` is the **only** scrollable element in the viewport and has `overscroll-contain`, scrolling to the boundary stops immediately without transmitting momentum to the window, the header, or the sidebar.

---

### 3.3 Auto-Hiding Custom Scrollbar Engine
Native custom scrollbars (`::-webkit-scrollbar`) traditionally stay permanently visible once defined, cluttering the UI. We solved this with a performant CSS + DOM hybrid:

#### 1. CSS Engine ([`app/globals.css`](file:///Users/emanur/doctors-platform/app/globals.css)):
```css
/* At rest: completely invisible */
.auto-hide-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

/* While scrolling: sleek 6px slate-400 thumb */
.auto-hide-scrollbar.is-scrolling {
  scrollbar-color: #94a3b8 transparent;
}

.auto-hide-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.auto-hide-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.auto-hide-scrollbar::-webkit-scrollbar-thumb {
  background-color: transparent;
  border-radius: 9999px;
  transition: background-color 0.2s ease-in-out;
}

.auto-hide-scrollbar.is-scrolling::-webkit-scrollbar-thumb {
  background-color: #94a3b8;
}

.auto-hide-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #64748b;
}
```

#### 2. Zero-Re-Render Event Listener ([`components/dashboard/DashboardShell.tsx`](file:///Users/emanur/doctors-platform/components/dashboard/DashboardShell.tsx)):
```tsx
const mainRef = useRef<HTMLElement>(null);
const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const handleMainScroll = () => {
  // Direct DOM class manipulation avoids triggering React reconciliation cycles
  if (mainRef.current && !mainRef.current.classList.contains("is-scrolling")) {
    mainRef.current.classList.add("is-scrolling");
  }
  if (scrollTimeoutRef.current) {
    clearTimeout(scrollTimeoutRef.current);
  }
  scrollTimeoutRef.current = setTimeout(() => {
    if (mainRef.current) {
      mainRef.current.classList.remove("is-scrolling");
    }
  }, 900);
};

useEffect(() => {
  return () => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
  };
}, []);
```
- **Performance**: 0 React re-renders while scrolling (60fps/120fps smooth performance).
- **Interaction**: The scrollbar appears instantly on scroll, and gently fades out 900ms after the user stops scrolling.

---

### 3.4 Compact Sidebar Navigation (`<aside>`)
When temporary development modules were removed, having `h-full` and `flex-1 min-h-0` on the sidebar forced the white navigation card to stretch across the full viewport height, leaving 70% of the box as empty white space.

#### Architectural Fix:
- **`self-start` Content Hugging**: Changed `<aside>` from `h-full` to `self-start`.
- **Natural Content Sizing**: Removed `flex-1 min-h-0` from `<nav>`. The card now sizes directly to its 2 primary items: **Overview** and **Appointments** (~110px).
- **Proportional Width**: Refined expanded sidebar width from `w-64` (256px) to `w-60` (240px). Collapsed rail remains `w-20` (80px).
- **Profile Relocation**: Profile navigation was intentionally removed from the sidebar since it is prominently accessible in the top-right avatar popover.

---

### 3.5 Avatar Trigger & Profile Popover Dropdown Architecture

#### 1. High-Contrast Avatar Trigger:
- **Pill Container**: `bg-white/95 hover:bg-white border border-slate-300 hover:border-slate-400 shadow-xs`.
- **Open Active State**: When `isProfileMenuOpen` is true, the pill activates `border-2 border-brand-500 ring-2 ring-brand-500/20`.
- **Avatar Image**: Dual-layer `border-2 border-white ring-2 ring-slate-300 group-hover:ring-brand-500 shadow-xs` with a green `bg-emerald-500 ring-2 ring-white` active presence dot.

#### 2. Reusable Modular Popover (`ProfileDropdownMenu`):
Extracted into a reusable subcomponent shared between mobile and desktop headers:

```tsx
interface ProfileDropdownMenuProps {
  avatar: string;
  formattedDoctorName: string;
  email: string;
  speciality: string;
  onNavigateProfile: () => void;
  onLogout: () => void;
  className?: string;
}
```

#### 3. Visual Information vs. Action Hierarchy:
- **Top Card (Read-Only Information)**:
  - Displayed inside `bg-slate-50/90 border border-slate-100 rounded-xl select-text cursor-default`.
  - Shows avatar, presence ring, doctor name, email, and speciality badge.
  - No interactive button styling; explicitly signals pure account context.
- **Action Items (Clickable)**:
  - Distinct bordered interactive rows (`hover:bg-brand-50/80 border border-slate-100 hover:border-brand-200/80 shadow-2xs`).
  - Right-pointing navigation chevron (`ChevronRight`) with subtle hover translation (`group-hover:translate-x-0.5`).
  - **Admin Profile**: Navigates to doctor practice details, fees, and photo.
  - **Sign Out**: Highlighted with rose accents (`bg-rose-50 text-rose-600 hover:bg-rose-50 border-slate-100 hover:border-rose-200/80`).
- **Scale**: Compact `w-[268px]` (desktop) and `w-[264px]` (mobile).

---

## 4. Invariant Rules for Future Developers & AI Agents

> [!IMPORTANT]
> When modifying navigation, headers, or scrolling anywhere in this repository, follow these non-negotiable rules:

1. **Do NOT Re-Introduce Window-Level Scrolling**:
   - The root shell must remain `h-screen overflow-hidden overscroll-none`.
   - Never remove `overscroll-contain` or `h-full overflow-y-auto` from `<main>`. Doing so causes trackpad bounce on macOS and breaks scroll isolation.

2. **Do NOT Use React State for Continuous Scrollbar Toggling**:
   - Use direct class manipulation (`classList.add("is-scrolling")`) on `mainRef` via `handleMainScroll`.
   - Never call `setState()` on every scroll event, as this forces React to re-render the entire dashboard tree at 60Hz.

3. **Do NOT Add `flex-1 min-h-0` to the Desktop Sidebar `<nav>`**:
   - The desktop sidebar uses `self-start` to hug its content.
   - Forcing `flex-1` causes the white sidebar card to stretch down the full viewport height, creating an unsightly empty box when there are few modules.

4. **Keep `ProfileDropdownMenu` as the Single Source of Truth**:
   - Both the mobile top bar and the desktop top bar render `<ProfileDropdownMenu ... />`.
   - Never duplicate the popover JSX; make all changes inside `ProfileDropdownMenu`.

5. **Maintain High Contrast on Avatar Borders**:
   - The avatar image must have `border-2 border-white ring-2 ring-slate-300`.
   - Never revert to transparent or faint single-pixel borders (`border-slate-200/50`), which blend into the white frosted header.

---

## 5. Verification Checklist

- [x] `npx tsc --noEmit` compiles with 0 errors.
- [x] Window rubber-banding locked on macOS trackpad and mobile Safari.
- [x] Content scrolls physically behind the 64px header with frosted blur.
- [x] Scrollbar remains completely invisible at rest and appears smoothly only during active scrolling.
- [x] Profile avatar dropdown works identically on mobile and desktop viewports.
- [x] Desktop sidebar neatly hugs its 2 active navigation items.
- [x] Clicking outside or pressing `Escape` dismisses the profile popover and mobile drawer.
