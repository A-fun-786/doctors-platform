# DocSpace Landing Page — Architecture & Implementation Plan

> **Objective:** SaaS landing page architecture with 4 core navigation sections, live clinic website preview, dynamic multi-tenant white-label branding, streamlined "Signup / Login" authentication flow, WCAG 2.1 AA accessibility, and full responsive layout.

---

## 1. Project Branding & Theme Integration

- **Brand Centralization:** Strictly driven by `@/config/brand.config.ts` (`BRAND_CONFIG.name`, `BRAND_CONFIG.slug`, `BRAND_CONFIG.description`), supporting runtime white-labeling via `NEXT_PUBLIC_BRAND_NAME` with `"DocSpace"` default fallback.
- **Dynamic Usage:** All headers, testimonials, footer notices, and preview mockup domains (`carewellpolyclinic.${BRAND_CONFIG.slug}.com`) reference `BRAND_CONFIG` dynamically without hardcoded brand literals.
- **Theme & Colors:** Defined in `@/config/theme.config.ts` (`HOSPITAL_THEME_COLORS`):
  - Primary Brand: Clinical Emerald (`brand-600` / `#059669`, hover `brand-700`)
  - Background & Surfaces: Sterile White (`#ffffff`) & Clean Clinic Slate (`#f8fafc`)
  - Text & Accents: Dark Navy (`#0f172a`), Text Muted (`#475569`)
- **Visual Design:** High-contrast, clean healthcare presentation with zero color-only status communication.

---

## 2. Navbar Structure (`components/landing/Navbar.tsx`)

### Desktop Navigation
- **Left:** `BrandLogo` with responsive sizing and clinical stethoscope icon.
- **Center Navigation (Smooth Scrolling Links):**
  1. **Features** (`/#features`)
  2. **How It Works** (`/#how-it-works`)
  3. **Testimonials** (`/#testimonials`)
  4. **FAQ** (`/#faq`)
  - *All links invoke `e.preventDefault()`, scroll smoothly via `scrollIntoView({ behavior: "smooth" })`, and synchronize browser history without jump cuts.*
- **Right Action Button:**
  - Standardized **Signup / Login** button navigating to `/login` with primary brand pill styling (`bg-brand-600 hover:bg-brand-700`).

### Mobile Navigation (Header & Slide-in Drawer)
- **Mobile Header (< lg):**
  - **Left:** Accessible hamburger toggle button (`aria-label="Open navigation menu"`), followed by `BrandLogo`.
  - **Right:** Symmetrical **Signup / Login** button for 1-tap direct access.
- **Drawer Panel:**
  - Slides in from left (`animate-in slide-in-from-left duration-300`).
  - Contains navigation links and a full-width **Signup / Login** CTA button at the bottom.
  - Automatically closes on link selection, backdrop tap, or `Escape` key press.
  - Locks body scroll while open.

---

## 3. Core Page Sections (`app/page.tsx`)

1. **Hero (`Hero.tsx`):** Value proposition for clinics, primary CTAs, and interactive clinic website browser mockup with dynamic domain `carewellpolyclinic.${BRAND_CONFIG.slug}.com`.
2. **Features (`Features.tsx`, `#features`):** 5 core operational modules (Billing, Appointments, Staff, Medicine Inventory, Prescriptions/Labs) with deterministic React keys (`key={feature.title}`).
3. **Live Preview (`PreviewSection.tsx`, `#preview`):** Rich interactive browser mockup of a live clinic website with active doctor roster, status badges, and dynamic domain.
4. **How It Works (`HowItWorks.tsx`, `#how-it-works`):** 3-step clinic onboarding flow (Account creation, Doctor timings, Patient care) using dynamic `{BRAND_CONFIG.name}` and deterministic keys (`key={item.step}`).
5. **Testimonials (`Testimonials.tsx`, `#testimonials`):** Social proof from verified clinic directors, rating strips, dynamic quotes using `{BRAND_CONFIG.name}`, and deterministic keys (`key={item.name}`).
6. **FAQ Accordion (`FAQ.tsx`, `#faq`):** Accessible questions and answers with semantic `<button type="button" aria-expanded={isOpen} aria-controls="faq-answer-*">` headers and zero non-semantic wrappers.
7. **CTA (`CTA.tsx`):** Emerald ambient glow banner with direct registration entry point.
8. **Footer (`Footer.tsx`):** Dynamic brand description, active platform section navigation, clinic portal links, and dynamic copyright notice with zero dead anchor tags.

---

## 4. Verification & Quality Assurance

- [x] Zero hardcoded brand literals across landing components; full `BRAND_CONFIG` dynamic binding.
- [x] `PreviewSection.tsx` rendered in `app/page.tsx` with `#preview` anchor target.
- [x] Plan documentation located in `docs/LANDING_PAGE_PLAN.md` with zero root drift.
- [x] Clean deterministic keys used in `Testimonials`, `Features`, and `HowItWorks`.
- [x] Single semantic `<button>` accordion with full ARIA attributes (`aria-expanded`, `aria-controls`, `aria-labelledby`, `role="region"`) in `FAQ.tsx`.
- [x] Competing smooth-scroll behavior eliminated in `Navbar.tsx` via `e.preventDefault()`.
- [x] Dead footer anchors removed; all links resolve to valid sections or routes.
- [x] TypeScript type checking (`tsc --noEmit`), ESLint linting, and automated test suite 100% passed.
