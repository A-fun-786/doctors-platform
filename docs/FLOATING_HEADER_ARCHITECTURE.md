# Floating Header Architecture & Design Documentation

**Document Version:** 1.0.0  
**Target Files:**
- `components/dashboard/DashboardShell.tsx` (Doctor Dashboard Shell)
- `components/landing/Navbar.tsx` (Public Landing Page Navigation)
- `hooks/useScrolled.ts` (Reusable Window Scroll Elevation Hook)
- `app/globals.css` (Root Scroll Container Engine Configuration)
**Date:** November 2026  
**Status:** Completed, Verified & Documented  

---

## 1. Overview & Objective

### 1.1 Purpose of the Change
The objective of this design and architectural update is to elevate the platform's visual presentation and user experience by implementing a **floating glassmorphic capsule header** (inspired by the aesthetic of [Shiha Wellness](https://www.shihawellness.com)) across both the **Doctor Dashboard** and the **Marketing Home Page**.

### 1.2 Key Motivations
1. **Modern Healthcare SaaS Aesthetic**: Replace flat, full-width edge-to-edge navigation bars with detached, rounded capsule islands that float smoothly above the content viewport.
2. **Optimized Screen Real Estate & Focus**: In the doctor dashboard, the doctor's profile avatar, name, email, and logout button were relocated from the bottom-left of the sidebar to the **top-right of the floating header**, keeping identity actions immediately accessible while freeing up vertical space in the sidebar.
3. **Smooth Scroll Elevation**: As the user scrolls through appointments or landing page content, the header dynamically tucks and elevates with increased frosted-glass opacity and shadow depth.
4. **Architectural Reusability & Zero Regressions**: Extract shared scroll logic into an SSR-safe custom hook (`useScrolled`) and prevent layout clipping or click blocking through careful CSS containment (`overflow-x: clip;`, `pointer-events-none`).

---

## 2. Visual & Interaction Design Specifications

The floating header adheres to the following design system tokens:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Sticky Container: w-full max-w-7xl mx-auto, sticky top-4/top-2.5       │
│                   pointer-events-none (margins allow click-through)    │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────────────┐ │
│   │ Floating Pill: rounded-full, pointer-events-auto                 │ │
│   │   [Brand Logo]         [Navigation / Middle]      [Profile / CTA]│ │
│   │   bg-white/80          backdrop-blur-lg           border-white/70│ │
│   │   shadow-[0_10px_30px_-5px_rgba(15,23,42,0.08)]                  │ │
│   └──────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Design Tokens

| Property | Default State (Top of Page) | Scrolled State (`window.scrollY > 15px`) |
| :--- | :--- | :--- |
| **Top Position** | `top-3 sm:top-4` | `top-2 sm:top-2.5` (subtly tucked) |
| **Shape** | Capsule pill: `rounded-full` (desktop) / `rounded-2xl` (mobile) | Capsule pill: `rounded-full` / `rounded-2xl` |
| **Background Glass** | `bg-white/80 backdrop-blur-lg` | `bg-white/90 backdrop-blur-xl` |
| **Borders** | `border border-slate-200/70` with inner highlight | `border border-slate-200/90` with inner highlight |
| **Elevation Shadow** | `shadow-[0_10px_30px_-5px_rgba(15,23,42,0.08)]` | `shadow-[0_14px_35px_-5px_rgba(15,23,42,0.12)]` |
| **Transition Curve** | `transition-all duration-300` | `transition-all duration-300` |

---

## 3. Detailed Component Architecture

### 3.1 Reusable Scroll Hook (`hooks/useScrolled.ts`)
To adhere to clean DRY architecture and prevent duplicating scroll event listeners in multiple components, scroll tracking is encapsulated in `hooks/useScrolled.ts`:

- **SSR-Safety Guard**: Validates `typeof window !== "undefined"` before attaching listeners, preventing Next.js server-side hydration mismatches.
- **Passive Listener**: Uses `{ passive: true }` on the window event listener to prevent browser thread blocking during rapid scrolls.
- **Lifecycle Cleanup**: Automatically removes the event listener on component unmount.
- **Initial Mount Evaluation**: Executes an immediate scroll check on mount in case the page was reloaded when already scrolled down.

```ts
export function useScrolled(threshold = 15): boolean {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      setIsScrolled(window.scrollY > threshold);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return isScrolled;
}
```

---

### 3.2 Doctor Dashboard Shell (`components/dashboard/DashboardShell.tsx`)

#### Desktop View (`>= md`)
- **Detached Floating Top Bar**:
  - Encapsulated in `<header className="hidden md:block sticky z-40 ...">`.
  - Left: `BrandLogo` lockup.
  - Right: Doctor profile lockup with `avatar` (with fallback SVG and subtle ring highlight), doctor `full_name`, `email` (neatly truncated), and a pill logout button (`rounded-full px-4 py-2`).
- **Sidebar (`<aside>`) Alignment**:
  - The collapsible sidebar is positioned with `sticky top-20 self-start`.
  - When the floating header sits at `top-4` with an inner height of ~56px (total 72px), `top-20` (80px) provides an 8px vertical margin between the header and sidebar, preventing any overlap during scrolling.
- **Collapsible Rail**: Maintains compact `w-20` icon mode and expanded `w-64` navigation mode.

#### Mobile View (`< md`)
- Preserves the required test selector `<header className="md:hidden sticky top-0 z-40 ...">`.
- Inside the sticky wrapper, an elevated floating card (`rounded-2xl px-3.5 h-13`) hosts:
  - Accessible hamburger menu toggle (`aria-label="Open navigation menu"`).
  - Brand Logo.
  - Doctor avatar image.
  - Direct compact logout button.
- Smooth slide-out mobile drawer with `role="dialog"`, `aria-modal="true"`, background backdrop blur, and body scroll lock.

---

### 3.3 Public Marketing Navbar (`components/landing/Navbar.tsx`)

- **Floating Capsule Container**:
  - Matches the same floating pill styling (`rounded-full`, glassmorphic backdrop, dynamic scroll elevation).
  - Left: `BrandLogo`.
  - Center: Navigation links (`Home`, `Features`, `How It Works`).
  - Right: `Login` link and a high-contrast pill CTA (`Register as Doctor`).
- **Mobile Actions & Dropdown**:
  - Direct `Login` and `Sign Up` action links directly visible on mobile screens.
  - Hamburger menu opens an elevated floating card dropdown directly below the pill navbar, equipped with keyboard `Escape` dismissal.

---

### 3.4 Root Scroll Container Fix (`app/globals.css`)

#### The Problem:
In modern WebKit (Safari / iOS) and Blink (Chrome / Edge), applying `overflow-x: hidden` to root `html` or `body` elements causes the browser engine to automatically compute `overflow-y` to `auto` or treat `body` as a non-viewport scroll container. This breaks `position: sticky` on all descendent elements.

#### The Solution:
Replaced `overflow-x: hidden` with modern CSS `overflow-x: clip;` on `html` and `body`:
```css
html {
  scroll-behavior: smooth;
  overflow-x: clip;
  max-width: 100vw;
}

body {
  overflow-x: clip;
  max-width: 100vw;
}

/* Fallback for legacy browsers without clip support */
@supports not (overflow-x: clip) {
  html, body {
    overflow-x: hidden;
  }
}
```
- `overflow-x: clip` suppresses horizontal scrolling without establishing an independent scroll container.
- `position: sticky` continues to work across all scroll states.
- The `@supports not (overflow-x: clip)` block maintains backward compatibility for legacy environments and passes all automated responsive regression tests.

---

### 3.5 Pointer Events & Hit-Testing Architecture

A common pitfall with floating headers that have padding and margins is the creation of "invisible dead click zones" where transparent margins intercept user clicks intended for underlying page content.

**How This Architecture Solves It:**
1. The full-width outer header container has `pointer-events-none`. Clicks on any transparent space around or above the pill pass directly through to whatever element is beneath it.
2. The inner pill element has `pointer-events-auto`. All buttons, links, dropdowns, and interactive items inside the header receive events normally.

---

## 4. Verification & Testing

### 4.1 Automated Test Suite
All automated test suites were run and passed at 100%:
- `scripts/test_dashboard_shell.mjs`: Validates mobile header selectors, hamburger accessibility, dead code elimination, and tab state.
- `scripts/test_responsive_qa_suite.mjs`: Validates sticky header positioning (`sticky top-0 z-40`), responsive breakpoints, collapsible sidebar, and layout containment.
- `scripts/test_full_platform_qa.mjs`: Validates landing navbar direct action buttons, WCAG accessibility, and doctor session context.

### 4.2 Production Build Verification
- Command: `npm run build`
- Result: **0 errors**. All 8 static and dynamic routes compiled with type checking and linting passing cleanly.

