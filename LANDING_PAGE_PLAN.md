# DocSpace Landing Page — Implementation Plan (Updated)

> **Objective:** Upgrade SaaS landing page with the 5 core navigation links (including Testimonials), the new Testimonials section (`#testimonials`), standard Login/Register actions, and full mobile responsiveness using the project's existing brand and theme configuration.

---

## 1. Project Branding & Theme Integration

- **Brand:** Project default via `@/components/brand/BrandLogo` and `@/config/brand.config.ts`.
- **Theme & Colors:** Defined strictly in `@/config/theme.config.ts` (`HOSPITAL_THEME_COLORS`):
  - Primary Brand: Clinical Emerald (`brand-600` / `#059669`, hover `brand-700`)
  - Background & Surfaces: Sterile White (`#ffffff`) & Clean Clinic Slate (`#f8fafc`)
  - Text & Accents: Dark Navy (`#0f172a`), Text Muted (`#475569`)
- **No Dark Mode Toggle:** Single, consistent, high-contrast healthcare light theme.

---

## 2. Navbar Structure (`components/landing/Navbar.tsx`)

### Desktop Navbar
- **Left:** Project `BrandLogo` (Logo + Brand Name).
- **Center Navigation (5 Direct Links — No Dropdown):**
  1. **Features** (`#features`)
  2. **Templates** (`#templates`)
  3. **How It Works** (`#how-it-works`)
  4. **Testimonials** (`#testimonials`)
  5. **FAQ** (`#faq`)
  - *All links use smooth native scroll to their corresponding section IDs.*
  - *No "Android App Generator" displayed.*
- **Right Action Button:**
  - **Single Unified Button:** "Signup / Login" (`/login`) rendered as a high-contrast primary Emerald pill button (`bg-brand-600` hover `bg-brand-700`).

### Mobile Navigation (Header & Slide-in Drawer)
- **Mobile Header (< lg):**
  - **Left:** **Hamburger menu toggle button** (`lg:hidden`) positioned on the far left, followed by the `BrandLogo` (DocSpace / Clinic Brand).
  - **Right:** The **Signup / Login button** (`text-xs sm:text-sm font-semibold text-white bg-brand-600 rounded-full`) on the right, providing clean symmetrical layout and immediate 1-tap access to authentication.
- **Drawer Panel:**
  - Slide-in from Left (`animate-in slide-in-from-left duration-300`).
  - Navigation links (`#features`, `#templates`, `#how-it-works`, `#testimonials`, `#faq`).
  - Single unified full-width **Signup / Login** button at the bottom of the drawer.
  - Auto-close when clicking any link, backdrop overlay, or pressing `Escape`.
  - Body scroll lock during open state.
  - Zero horizontal overflow.

---

## 3. Templates Section (`components/landing/Templates.tsx`)

- **Section ID:** `templates`
- **Heading:** "Choose Your <span className="text-emerald-600">Perfect Design</span>"
- **Subtitle:** "Pick from a variety of professional templates and make it yours."
- **5 Template Design Cards (with miniature browser mockup & footer):**
  1. **Modern Clinic** — Family health & polyclinic theme (Mint / Emerald) + `[ 👁 Preview ]`
  2. **HealthCare Pro** — Specialist & surgery theme (Clinical Blue) + `[ 👁 Preview ]`
  3. **MedCare Plus** — 24/7 diagnostic & polyclinic theme (Forest Teal / Dark) + `[ 👁 Preview ]`
  4. **Clinic Hub** — Neighborhood & pediatric care theme (Sky Blue) + `[ 👁 Preview ]`
  5. **Wellness Care** — Aesthetics & holistic wellness theme (Soft Sage) + `[ 👁 Preview ]`
- **Footer Row on each card:**
  - Left: Template Name in bold
  - Right: `Preview` button (with Eye icon) opening interactive live demo modal.
- **Layout:** Responsive 5-column desktop grid, 2-column tablet, 1-column mobile.

---

## 4. Testimonials Section (`components/landing/Testimonials.tsx`)

- **Section ID:** `testimonials`
- **Heading:** "Trusted by Healthcare Professionals"
- **Supporting Description:** "See how modern clinics, doctors, and polyclinics digitize operations, streamline OPD queues, and build patient trust."
- **Doctor / Clinic Cards:**
  - **Dr. Rajesh Sharma** — Medical Director, Apex Polyclinic & Diagnostic Center
  - **Dr. Anita Deshmukh** — Chief Surgeon, CareWell Multispecialty Clinic
  - **Dr. Vikram Mehta** — Senior Consultant, Metro Health Center
- **Card Content Elements:**
  - Doctor avatar / styled initials badge
  - Full doctor name + designation + clinic name
  - 5-Star rating visual (`lucide-react` Star icons)
  - Real-world clinic quote & metric highlight badge (e.g., "+42% Patient Footfall")
- **Layout:** Responsive 3-column desktop grid, 2-column tablet, 1-column mobile with subtle hover shadows.

---

## 4. Verification & Acceptance Criteria

- [ ] "Android App Generator" is not present in navbar.
- [ ] Features is a direct navbar link to `#features` (no dropdown).
- [ ] Testimonials link is present and scrolls smoothly to `#testimonials`.
- [ ] Single combined "Signup / Login" button across desktop, tablet, and mobile views.
- [ ] Mobile screen header displays Hamburger menu on the left and "Signup / Login" button on the right.
- [ ] Drawer footer contains single full-width "Signup / Login" button navigating to `/login`.
- [ ] Testimonials section displays "Trusted by Healthcare Professionals" with clean cards.
- [ ] Mobile hamburger menu opens, lists links, and closes on item click.
- [ ] Responsive across Mobile, Tablet, and Desktop with zero horizontal overflow.
