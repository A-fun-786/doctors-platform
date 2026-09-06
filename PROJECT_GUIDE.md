# DocSpace — Central Project & Architecture Guide

> **For developers and AI coding agents.** Reading this document end-to-end should give you a complete mental model of the project: what every file does, how files link to each other, where data flows, and which file to open when you want to change something specific.

---

## 1. What This Project Is

DocSpace is a **multi-tenant white-label SaaS platform** for doctors. Each doctor who registers gets their own branded website subdomain (e.g. `drsarahjohnson.platform.com`) and a patient-facing mobile application, all managed from a single dashboard.

- **Phase 1 (Complete):** Foundation setup and public-facing marketing landing page with initial `/register` and `/login` routes.
- **Phase 2 (Complete):** Backend foundation and database layer (FastAPI, SQLAlchemy 2.x, PostgreSQL, Alembic migrations, `Doctor` + `Tenant` multi-tenant identity boundary).
- **Phase 3 (Complete):** Authentication and Doctor Registration (Email/Password registration & login, Google Sign-In (requires GCP OAuth credentials), extensible multi-provider model, PBKDF2-HMAC-SHA256 password hashing, auto-provisioning Doctor + Tenant with deterministic slug generation, stateless JWT access tokens, `/api/v1/auth/*` endpoints, and protected `/dashboard` entry point).
- **Upcoming Phases:** Phase 4 (Doctor Dashboard), Phase 5+ (Doctor Profile, Branding, Services, Dynamic Websites).

---

## 2. Tech Stack Decisions

### Frontend
| Technology | Why |
| :--- | :--- |
| **Next.js 14 (App Router)** | File-system routing, server components, static generation, ideal for future SSR subdomain pages |
| **TypeScript** | Type safety enforced across all components. Strict mode enabled in `tsconfig.json` |
| **Tailwind CSS** | Utility-first styling — no CSS files per component, single design token source via `tailwind.config.ts` |
| **Lucide React** | Lightweight, tree-shakeable icon library; no SVG management overhead |
| **Google Identity Services** | Official Google OAuth 2.0 / OpenID Connect frontend SDK integration for one-tap and button authentication (inactive until `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is configured) |
| **Client-Side Auth Utility (`lib/api.ts`)** | Lightweight native `fetch` client, localStorage JWT token management, email register/login and Google auth methods |
| **System font stack** | Avoids external network dependency for fonts during build; uses `font-sans` |

### Backend & Database
| Technology | Why |
| :--- | :--- |
| **Python 3.12+ / FastAPI** | High-performance async/sync modular REST API with automatic OpenAPI Swagger documentation |
| **SQLAlchemy 2.x** | Modern Python ORM using declarative mapped columns, typed relationships, and explicit foreign keys |
| **PostgreSQL 16** | Robust relational database for multi-tenant data isolation, ACID compliance, and relational integrity |
| **psycopg3 (`psycopg[binary]`)** | Modern, officially supported PostgreSQL driver for synchronous database operations |
| **PBKDF2-HMAC-SHA256 (`hashlib` + `secrets`)** | Stdlib-based password hashing with per-user cryptographic salt and timing-safe comparison — zero additional dependencies |
| **google-auth** | Official Google authentication client library for secure Google ID token verification (used by Google provider; inactive until `GOOGLE_CLIENT_ID` is configured) |
| **PyJWT** | High-performance, RFC 7519 compliant JSON Web Token encoding and decoding for platform sessions |
| **Alembic** | Source-of-truth migration management for incremental database schema evolution |
| **Pydantic v2 / Settings** | Type-safe environment variable parsing (`pydantic-settings`) and validation |
| **Docker Compose** | Local PostgreSQL containerization without heavy container overhead on the backend |

---

## 3. High-Level Architecture

The project is structured as a modular frontend + backend workspace.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND: NEXT.JS CLIENT                            │
│   Marketing landing page (/), Email Auth (/login, /register),               │
│   Google Auth (inactive until configured), Protected Dashboard (/dashboard),│
│   API Client (lib/api.ts)                                                   │
│   (Port 3000)                                                               │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ HTTP / CORS (http://localhost:3000)
                                   │ Bearer JWT Authorization
┌──────────────────────────────────▼──────────────────────────────────────────┐
│                      BACKEND: FASTAPI API SERVICE (backend/)                │
│                                                                             │
│  backend/app/main.py ─────────── Root health check, CORS middleware, docs   │
│  ├── backend/app/core/ ───────── Settings (config.py), DB session (database.py),│
│  │                               Security, JWT & Password Hashing (security.py)│
│  ├── backend/app/api/ ────────── Auth routes (/api/v1/auth/register, /login,│
│  │                               /google, /me), Health routes, deps.py      │
│  ├── backend/app/services/ ───── auth_service.py (Email & Google auth,      │
│  │                               Tenant slug + Provisioning)                │
│  └── backend/app/models/ ─────── SQLAlchemy models (Base, Doctor, Tenant)   │
│  (Port 8000)                                                                │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │ SQLAlchemy 2.x / psycopg3
┌──────────────────────────────────▼──────────────────────────────────────────┐
│                      DATABASE: POSTGRESQL (docker-compose)                  │
│                                                                             │
│  doctors  → id (UUID PK), email (UK), full_name, phone, avatar_url,         │
│             auth_provider, provider_id, hashed_password, is_active, created_at│
│  tenants  → id (UUID PK), doctor_id (FK UK 1:1), slug (UK), status, created_at│
│  (Port 5432)                                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. How the Files Link Together

This section traces the exact chain of dependencies so you understand what affects what.

### 4.1 Configuration chain (build-time)

```
package.json
  └── declares: next, react, react-dom, lucide-react, tailwindcss, typescript...
         │
         └── next build uses:
               ├── next.config.mjs          → Next.js runtime options
               ├── tsconfig.json            → TypeScript rules + @/* alias
               ├── postcss.config.mjs       → enables Tailwind CSS processing
               └── tailwind.config.ts       → scans app/**/*.tsx + components/**/*.tsx
                                               generates brand-* CSS variables
```

Every component that uses `brand-600`, `brand-50`, etc., is getting that color from `tailwind.config.ts`. **Changing a color there changes it everywhere** across all 7 components simultaneously.

### 4.2 Render chain (runtime)

When a browser visits `/`:

```
Browser → GET "/"
  └── Next.js App Router matches  app/page.tsx
        └── Wrapped by app/layout.tsx (always)
              ├── Injects <html lang="en">
              ├── Sets <title> and <meta description> from metadata export
              ├── Applies body classes: font-sans antialiased text-slate-900 bg-white
              └── Imports app/globals.css
                    └── @tailwind directives resolve to compiled CSS from tailwind.config.ts

  app/page.tsx renders:
    <main>
      <Navbar />          ← components/landing/Navbar.tsx
      <Hero />            ← components/landing/Hero.tsx
      <Features />        ← components/landing/Features.tsx
      <HowItWorks />      ← components/landing/HowItWorks.tsx
      <PreviewSection />  ← components/landing/PreviewSection.tsx
      <CTA />             ← components/landing/CTA.tsx
      <Footer />          ← components/landing/Footer.tsx
    </main>
```

When a browser visits `/login` or `/register`:

```
Browser → GET "/login" or "/register"
  └── Next.js App Router matches app/login/page.tsx or app/register/page.tsx
        └── Renders components/auth/EmailAuthForm.tsx
              ├── Displays email & password form fields (register or login mode)
              ├── Shows inactive Google Sign-In button placeholder (until NEXT_PUBLIC_GOOGLE_CLIENT_ID configured)
              └── On form submission:
                    ├── Register mode → calls registerWithEmail(email, password) via lib/api.ts
                    │     → POST /api/v1/auth/register
                    ├── Login mode → calls loginWithEmail(email, password) via lib/api.ts
                    │     → POST /api/v1/auth/login
                    ├── Receives platform JWT access token + doctor & tenant data
                    ├── Stores JWT in localStorage ("docspace_auth_token")
                    └── Redirects to "/dashboard"
```

When a browser visits `/dashboard`:

```
Browser → GET "/dashboard"
  └── Next.js App Router matches app/dashboard/page.tsx
        └── Client-side auth check:
              ├── Reads token from localStorage via getAuthToken()
              │     ├── Missing token → router.replace("/login")
              │     └── Present token → calls getCurrentDoctor() (GET /api/v1/auth/me)
              ├── If token valid (200 OK):
              │     └── Renders doctor profile, avatar, email, workspace slug, and Logout button
              └── If token invalid / expired (401 Unauthorized):
                    └── Clears localStorage token → router.replace("/login")
```

### 4.3 Navigation linkages inside the app

The Navbar links use two mechanisms:

- **Anchor links** (`href="#features"`, `href="#how-it-works"`) → scroll the browser to `id="features"` on `Features.tsx` and `id="how-it-works"` on `HowItWorks.tsx`. These `id` attributes must remain in sync with Navbar.
- **Route links** (`href="/login"`, `href="/register"`) → full Next.js page navigation to functional Google authentication flows.

The Hero CTA "Explore Platform" uses `<a href="#features">` (plain anchor, not Next.js `<Link>`) intentionally — smooth scroll works without client-side navigation.

### 4.4 Styling linkage

Every visual property traces back to one of two places:

```
Brand colors           → tailwind.config.ts (theme.extend.colors.brand)
                          e.g. brand-600 = #2563eb

Spacing/layout/text    → Tailwind defaults (no custom config needed)

Body font              → app/layout.tsx (className="font-sans antialiased ...")
                          font-sans = system font stack (Inter/Helvetica/Arial)

Smooth scroll          → app/globals.css (html { scroll-behavior: smooth; })

Component-level styles → Inline Tailwind classes in each .tsx file
                          No separate .css files per component
```

### 4.5 Backend Request Lifecycle & Database Flow

```
HTTP Client (Browser / Frontend / cURL)
  │
  ├── GET /health ──────────── app/main.py (Root health check)
  │
  ├── GET /api/v1/health ───── app/main.py → app/api/router.py → app/api/routes/health.py
  │     ├── GET /api/v1/health          → {"status": "healthy", "service": "doctor-platform-api"}
  │     └── GET /api/v1/health/database → app/core/database.py:get_db() (SELECT 1)
  │
  └── /api/v1/auth ─────────── app/main.py → app/api/router.py → app/api/routes/auth.py
        │
        ├── POST /api/v1/auth/register ── app/services/auth_service.py:register_email()
        │                                   ├── Validate email & password (min 6 chars)
        │                                   ├── Check for existing doctor by email
        │                                   ├── Hash password (PBKDF2-HMAC-SHA256 via security.py)
        │                                   ├── Derive doctor name from email if not provided
        │                                   ├── Atomically create Doctor + Tenant (with unique slug)
        │                                   └── Issue Platform JWT (HS256 access token)
        │
        ├── POST /api/v1/auth/login ───── app/services/auth_service.py:login_email()
        │                                   ├── Find doctor by email
        │                                   ├── Verify password hash (timing-safe comparison)
        │                                   ├── Reject Google-provider accounts (no hashed_password)
        │                                   └── Issue Platform JWT (HS256 access token)
        │
        ├── POST /api/v1/auth/google ── app/services/auth_service.py:authenticate_google()
        │                                 ├── Verify Google token (app/core/security.py)
        │                                 ├── Atomically create Doctor + Tenant (with unique slug)
        │                                 └── Issue Platform JWT (HS256 access token)
        │
        └── GET /api/v1/auth/me ────── app/api/deps.py:get_current_doctor (Bearer JWT)
                                          └── Returns authenticated doctor & tenant details
```

Database Model Linkage:
```
Doctor (app/models/doctor.py)
  └── id (UUID Primary Key)
  └── email (Unique Indexed)
  └── full_name (String)
  └── avatar_url (String, Nullable)
  └── auth_provider (String, Default: "google")
  └── provider_id (String Indexed, Nullable)
  └── hashed_password (String, Nullable)
  └── is_active (Boolean)
  └── tenant (1:1 Relationship via uselist=False, cascade="all, delete-orphan")
        │
        ▼
Tenant (app/models/tenant.py)
  └── id (UUID Primary Key)
  └── doctor_id (UUID Foreign Key → doctors.id, Unique Indexed)
  └── slug (Unique Indexed)
  └── status (Default: 'active')
  └── doctor (Relationship back_populates="tenant")
```

---

## 5. File-by-File Deep Reference

### Config & Tooling

---

#### [`package.json`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/package.json)

**Purpose:** Declares all runtime and dev dependencies. Defines npm scripts.

**Key content:**
- `dependencies`: `next`, `react`, `react-dom`, `lucide-react`
- `devDependencies`: `typescript`, `tailwindcss`, `autoprefixer`, `postcss`, type definitions
- Scripts: `npm run dev` (local dev server), `npm run build` (production build), `npm run start` (serve build), `npm run lint` (ESLint)

**When to touch:** Adding a new npm package, or changing script behavior.

**Downstream effect:** Any change here requires running `npm install` before it takes effect.

---

#### [`tsconfig.json`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/tsconfig.json)

**Purpose:** TypeScript compiler configuration.

**Key content:**
- `strict: true` — enforces strict null checks, no implicit any, etc.
- `paths: { "@/*": ["./*"] }` — enables `@/components/...` style imports from root
- `jsx: "preserve"` — Next.js handles JSX transform
- `moduleResolution: "bundler"` — compatible with Next.js/webpack bundler

**When to touch:** Adding a new path alias, changing TypeScript strictness, or adding a new `lib`.

**Downstream effect:** The `@/*` alias is used in every component import. If removed or changed, all import paths break.

---

#### [`tailwind.config.ts`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/tailwind.config.ts)

**Purpose:** Design token definition for the entire UI.

**Key content:**
```ts
theme.extend.colors.brand = {
  50:  "#eff6ff",  // lightest — used for icon backgrounds, subtle tints
  100: "#dbeafe",  // badge backgrounds
  200: "#bfdbfe",  // borders on light backgrounds
  ...
  600: "#2563eb",  // PRIMARY — buttons, active icons, accents
  700: "#1d4ed8",  // button hover state
  ...
  900: "#1e3a8a",  // CTA section background
  950: "#172554",  // darkest — deep dark UI elements
}
```
`content` paths tell Tailwind which files to scan for class usage, so unused classes get purged from the production CSS bundle.

**When to touch:** Changing the brand color (e.g. switching from blue to teal), adding a new color scale, adding custom spacing or typography tokens.

**Downstream effect:** Every `brand-*` class across all 7 components reflects the new color immediately on next build/hot-reload. This is the single source of truth for the visual identity.

---

#### [`postcss.config.mjs`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/postcss.config.mjs)

**Purpose:** Wires Tailwind CSS into the PostCSS processing pipeline.

**When to touch:** Almost never. Only if adding PostCSS plugins (e.g. `cssnano` for minification, custom plugins).

---

#### [`next.config.mjs`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/next.config.mjs)

**Purpose:** Next.js runtime configuration. Currently minimal (empty config object).

**When to touch (future):**
- Adding `rewrites` or `redirects` for subdomain routing
- Configuring `images.domains` when external doctor profile images are added
- Enabling experimental Next.js features

---

### Application Shell (`app/`)

---

#### [`app/layout.tsx`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/app/layout.tsx)

**Purpose:** Root layout component. Wraps every single page in the application. Rendered once for every route.

**Key content:**
```tsx
export const metadata: Metadata = {
  title: "DocSpace — ...",   // <title> tag in browser tab
  description: "...",        // <meta name="description"> for SEO
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased text-slate-900 bg-white">
        {children}   {/* ← This renders the matched page.tsx */}
      </body>
    </html>
  );
}
```

**Linkage:**
- Imports `./globals.css` → injects all Tailwind CSS + base styles
- `{children}` slot receives `app/page.tsx`, `app/login/page.tsx`, or `app/register/page.tsx` depending on route
- `metadata` object is used by Next.js to populate `<head>` tags

**When to touch:**
- Changing the browser tab title or SEO meta description → edit `metadata`
- Changing the body-level font, background color, or text color → edit `className` on `<body>`
- Adding a global `<Providers>` wrapper (future: context, theme, auth) → wrap `{children}` here
- Adding analytics scripts (future) → add `<Script>` tags here

---

#### [`app/globals.css`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/app/globals.css)

**Purpose:** Global stylesheet loaded by `layout.tsx` for every page.

**Key content:**
```css
@tailwind base;        /* Resets: margin, padding, box-sizing via Preflight */
@tailwind components;  /* Component classes (none custom currently) */
@tailwind utilities;   /* All utility classes: flex, p-4, text-brand-600, etc. */

html { scroll-behavior: smooth; }  /* Enables smooth scrolling for anchor links */

body {
  color: #1e293b;
  background-color: #ffffff;
  -webkit-font-smoothing: antialiased;  /* Makes fonts crisper on macOS/iOS */
}
```

**Linkage:**
- Must be imported in `app/layout.tsx` — this is what activates Tailwind across the app
- `scroll-behavior: smooth` is what makes Navbar's `href="#features"` and Hero's `href="#features"` smooth-scroll instead of jumping

**When to touch:**
- Adding custom global CSS classes (e.g. `.prose`, `.container`)
- Adjusting base body colors or antialiasing
- Adding CSS custom properties (variables) for theming

---

#### [`app/page.tsx`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/app/page.tsx)

**Purpose:** The landing page. Matched by Next.js when visiting `/`. Acts as the composition root for all 7 landing sections.

**Key content:**
```tsx
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <PreviewSection />
      <CTA />
      <Footer />
    </main>
  );
}
```

**Linkage:**
- Imports all 7 components from `@/components/landing/*`
- Rendered inside `app/layout.tsx`'s `{children}` slot
- `<main>` wrapper ensures the page has a minimum full viewport height

**When to touch:**
- Reordering sections → reorder the component JSX
- Adding a new landing section → import and insert a new component here
- Removing a section → remove the component import and JSX

---

#### [`app/register/page.tsx`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/app/register/page.tsx)

**Purpose:** Doctor practice registration and onboarding route `/register`. Renders `EmailAuthForm` in registration mode.

**Key content:**
- Page metadata (`title: "Register Practice - DocSpace"`)
- Renders `<EmailAuthForm mode="register" />` for email/password-based practice creation with workspace auto-provisioning
- Auto-redirects to `/dashboard` upon registration

**Linkage:**
- Wrapped by `app/layout.tsx`
- Linked from: `Navbar.tsx` (Register button), `Hero.tsx` (primary CTA), `CTA.tsx` (register button)

---

#### [`app/login/page.tsx`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/app/login/page.tsx)

**Purpose:** Doctor portal login route `/login`. Renders `EmailAuthForm` in login mode.

**Key content:**
- Page metadata (`title: "Doctor Login - DocSpace"`)
- Renders `<EmailAuthForm mode="login" />` for email/password-based doctor authentication
- Auto-redirects to `/dashboard` upon successful login

**Linkage:**
- Wrapped by `app/layout.tsx`
- Linked from: `Navbar.tsx` (Login link) and `EmailAuthForm` mode switcher

---

#### [`app/dashboard/page.tsx`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/app/dashboard/page.tsx)

**Purpose:** Protected doctor dashboard entry point (`/dashboard`).

**Key content:**
- Client-side route protection: verifies presence of JWT in `localStorage` (`getAuthToken()`)
- Calls `getCurrentDoctor()` (`GET /api/v1/auth/me`) to load authenticated doctor details
- Displays doctor profile header, avatar, email, auth provider, workspace slug (`doctor.tenant.slug`), and system IDs
- Provides session **Logout** button which clears localStorage and redirects to `/login`
- Automatic redirection to `/login` if unauthenticated or if JWT has expired (401)

**Linkage:**
- Wrapped by `app/layout.tsx`
- Consumes `lib/api.ts` (`getCurrentDoctor`, `removeAuthToken`)

---

### Utility & Authentication Components (`lib/` & `components/auth/`)

---

#### [`lib/api.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/lib/api.ts)

**Purpose:** Centralized API client and authentication token manager for the frontend.

**Key content:**
- Token storage helpers: `getAuthToken()`, `setAuthToken(token)`, `removeAuthToken()`
- TypeScript interfaces: `Doctor`, `Tenant`, `AuthResponse`, `DoctorMeResponse`
- `authenticateWithGoogle(credential: string)`: sends Google ID token to `POST /api/v1/auth/google`, stores JWT, and returns auth response
- `registerWithEmail(email, password, fullName?)`: sends email & password to `POST /api/v1/auth/register`, stores JWT, and returns auth response
- `loginWithEmail(email, password)`: sends credentials to `POST /api/v1/auth/login`, stores JWT, and returns auth response
- `getCurrentDoctor(token?: string)`: fetches authenticated profile from `GET /api/v1/auth/me` with `Authorization: Bearer` header

---

#### [`components/auth/EmailAuthForm.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/auth/EmailAuthForm.tsx)

**Purpose:** Simple email and password authentication & registration form.

**Key content:**
- Supports `mode="login"` and `mode="register"`
- Clean email & password inputs with client validation and loading states
- Inactive Google Sign-In button placeholder (until Google OAuth credentials configured)
- Automatic workspace provisioning and redirect to `/dashboard` upon authentication

---

#### [`components/auth/GoogleAuthForm.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/auth/GoogleAuthForm.tsx)

**Purpose:** Interactive Google Sign-In and practice registration form component (preserved for Google OAuth).

**Key content:**
- Supports official Google Identity Services SDK (`https://accounts.google.com/gsi/client`) when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set
- Provides 1-Click Quick Demo accounts ("Dr. Ahmed Khan", "Dr. Sarah Connor") for immediate local evaluation without requiring cloud console configuration
- Displays loading spinners, error alerts, security badges, and mode switching between register and login

### Landing Page Components (`components/landing/`)

All components in this directory are **server components by default** (no `"use client"` directive), except `Navbar.tsx` which requires client state for the mobile menu toggle.

---

#### [`components/landing/Navbar.tsx`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/components/landing/Navbar.tsx)

**Purpose:** Sticky navigation header. The only component with client-side interactivity (mobile menu open/close state).

**Key content:**
- `"use client"` directive → enables `useState` for `mobileMenuOpen` boolean
- Desktop layout: logo left, nav links center-left, action buttons right
- Mobile layout: hamburger button toggles a dropdown below the header
- Nav links use anchor hrefs (`#features`, `#how-it-works`) that scroll to sections
- Action buttons use Next.js `<Link>` for route navigation

**Linkage:**
- Imported in `app/page.tsx`
- Nav anchor targets `#features` → must match `id="features"` in `Features.tsx`
- Nav anchor target `#how-it-works` → must match `id="how-it-works"` in `HowItWorks.tsx`
- Login button → routes to `app/login/page.tsx`
- Register button → routes to `app/register/page.tsx`

**When to touch:**
- Adding a new navigation link → add `<Link>` to both desktop nav and mobile dropdown
- Changing the platform logo icon or name → edit logo JSX block
- Making the mobile menu animated → add transition classes to the dropdown div

---

#### [`components/landing/Hero.tsx`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/components/landing/Hero.tsx)

**Purpose:** Above-the-fold hero section. First impression of the platform. Communicates the core value proposition and drives initial conversions.

**Key content:**
- 12-column CSS grid: 7 cols for copy, 5 cols for visual mockups
- Left column: badge, h1 headline, paragraph, two CTAs, three trust badges
- Right column: browser frame mockup (CSS only) + phone mockup (CSS only) positioned with slight rotation and overlap for visual depth
- Primary CTA `"Create Your Digital Presence"` → `/register`
- Secondary CTA `"Explore Platform"` → `#features` (anchor scroll)

**Linkage:**
- Imported in `app/page.tsx`, renders directly below `Navbar`
- The secondary CTA anchor `#features` depends on `id="features"` in `Features.tsx`
- Visual mockups use icons from Lucide React: `Globe`, `Video`, `Calendar`, `FileText`, `Pill`, etc.

**When to touch:**
- Changing the main headline or supporting copy → left column `<h1>` and `<p>`
- Updating the sample doctor data in the browser mockup → the mockup JSX in the right column
- Updating service icons in the phone mockup → the 2×2 grid in the phone frame
- Adjusting the trust badges below CTAs → the three `<div>` elements in the bottom row

---

#### [`components/landing/Features.tsx`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/components/landing/Features.tsx)

**Purpose:** Explains what the platform offers through 4 feature cards.

**Key content:**
```tsx
const features: FeatureItem[] = [
  { icon: Globe,           title: "Personalized Website",   description: "...", badge: "Web Presence" },
  { icon: Smartphone,      title: "Branded Mobile App",     description: "...", badge: "Mobile Presence" },
  { icon: Palette,         title: "Complete Brand Control", description: "...", badge: "White-Label" },
  { icon: LayoutDashboard, title: "One Central Platform",   description: "...", badge: "All-in-One" },
];
```
- Cards rendered by `.map()` — no hardcoded JSX per card
- The `FeatureItem` interface enforces type safety on the data array
- Grid: 1 col → 2 col (md) → 4 col (lg)

**Linkage:**
- Has `id="features"` on the `<section>` tag → this is the scroll target for Navbar and Hero CTAs
- Imported in `app/page.tsx`

**When to touch:**
- Adding/removing/editing a feature → modify the `features` array
- Changing the section title/subtitle → edit the section header div
- Adding a 5th card → add an object to `features` array; extend `FeatureItem` type if needed

---

#### [`components/landing/HowItWorks.tsx`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/components/landing/HowItWorks.tsx)

**Purpose:** Explains the onboarding process as a 3-step visual flow.

**Key content:**
```tsx
const steps = [
  { step: "01", icon: UserPlus, title: "Register Your Practice",  description: "..." },
  { step: "02", icon: Sliders,  title: "Customize & Brand",       description: "..." },
  { step: "03", icon: Rocket,   title: "Publish & Launch",        description: "..." },
];
```
- Desktop: horizontal 3-column grid with a CSS gradient line connecting the steps
- Mobile: vertical stacked cards (connector line hidden)
- Each card has a step number badge (top-right), icon with ring, title, and description

**Linkage:**
- Has `id="how-it-works"` on the `<section>` tag → scroll target for Navbar link
- Imported in `app/page.tsx`

**When to touch:**
- Editing step copy → modify `steps` array objects
- Adding a step → add an object to `steps` array (connector line will still render but may need CSS adjustment)
- Changing icons → swap Lucide icon imports and update `icon` property in array

---

#### [`components/landing/PreviewSection.tsx`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/components/landing/PreviewSection.tsx)

**Purpose:** Shows doctors what their final branded output will look like: a web portal and a mobile patient app, both themed to a sample doctor's profile.

**Key content:**
- Dark (`bg-slate-900`) section for visual contrast — creates clear separation from the features section
- Left column (7 cols): browser chrome frame → website inner content with doctor profile, bio, services, a "Book Consultation" button
- Right column (5 cols): phone device frame → app screen with profile widget, 2×2 service card grid (Consultation, Appointment, Lab Tests, Medicine)
- Sample data: `Dr. Sarah Johnson`, `Cardiologist`, `MBBS MD`, `10+ Years`, `4.9 Rating`
- All elements are pure CSS/Tailwind — no real functionality

**Linkage:**
- Imported in `app/page.tsx`
- Uses icons: `Globe`, `Smartphone`, `Video`, `Calendar`, `FlaskConical`, `Pill`, `Award`, `Clock`, `ShieldCheck`, `Star` from Lucide React

**When to touch:**
- Changing sample doctor name/data → update text strings directly in JSX (no data array — it's a standalone visual)
- Adding a third service or changing service icons → update the service card grid inside the phone/browser mockup JSX
- Changing dark section background → edit `bg-slate-900` on the `<section>`

---

#### [`components/landing/CTA.tsx`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/components/landing/CTA.tsx)

**Purpose:** Bottom-of-page conversion section. Creates urgency and drives registration before the user reaches the footer.

**Key content:**
- `bg-brand-900` background with a CSS dot-grid overlay (`bg-[radial-gradient(...)]`) for subtle texture
- Headline, supporting copy, single CTA button "Register as Doctor" → `/register`
- Trust badges at the bottom: "Secure Multi-Tenant Architecture", "Zero Code Setup", "Instant Subdomain Provisioning"

**Linkage:**
- Imported in `app/page.tsx`
- Register button links to `app/register/page.tsx`

**When to touch:**
- Editing the CTA headline or supporting text → change the `<h2>` and `<p>` directly
- Changing trust badge copy → edit the three `<span>` elements in the bottom row
- Changing background pattern or color → edit `bg-brand-900` and the `bg-[radial-gradient...]` class

---

#### [`components/landing/Footer.tsx`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/components/landing/Footer.tsx)

**Purpose:** Platform footer with branding, navigation links, and legal placeholders.

**Key content:**
- 4-column grid: brand column (2 cols wide), Platform links, Company links
- Platform column links to real routes (`/register`, `/login`) and anchor links (`#features`, `#how-it-works`)
- Company column links are all `href="#"` placeholders (About, Contact, Privacy, Terms)
- Dynamic copyright year: `{new Date().getFullYear()}` — updates automatically each year

**Linkage:**
- Imported in `app/page.tsx`
- Platform links mirror Navbar routes for consistency
- Company links are stubs — will need real pages in future phases

**When to touch:**
- Adding new footer links or columns → add `<li>` items or new column `<div>`
- Changing platform description → edit the `<p>` below the logo
- Implementing legal pages (future) → change `href="#privacy"` to `href="/privacy"` etc.

---

### Backend Foundation & Database (`backend/`)

---

#### [`docker-compose.yml`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/docker-compose.yml)

**Purpose:** Containerizes local PostgreSQL 16 on port 5432 with persistent volume storage (`postgres_data`).

**Key commands:**
- `docker compose up -d postgres` — starts PostgreSQL background container
- `docker compose down` — stops container

---

#### [`backend/requirements.txt`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/requirements.txt)

**Purpose:** Python dependency manifest for FastAPI, SQLAlchemy 2.x, psycopg3, Alembic, Pydantic v2, pytest, HTTPX, google-auth, requests, and PyJWT.

---

#### [`backend/.env.example`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/.env.example) & [`backend/.env`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/.env)

**Purpose:** Environment configuration specifying `APP_NAME`, `ENVIRONMENT`, `DATABASE_URL`, `CORS_ORIGINS`, `GOOGLE_CLIENT_ID`, `JWT_SECRET_KEY`, `JWT_ALGORITHM`, and `ACCESS_TOKEN_EXPIRE_MINUTES`.

---

#### [`backend/app/main.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/main.py)

**Purpose:** Application entry point. Configures `FastAPI` instance, CORS middleware with configurable origins, root `GET /health` endpoint, interactive OpenAPI docs (`/docs`), and mounts versioned `/api/v1` router.

---

#### [`backend/app/core/config.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/config.py)

**Purpose:** Centralized settings singleton using `pydantic-settings`. Loads `.env`, parses comma-separated `CORS_ORIGINS` into a list, parses Google OAuth & JWT settings, and provides cached `get_settings()` helper.

---

#### [`backend/app/core/security.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/security.py)

**Purpose:** Core cryptographic security, password hashing, and token verification module.
- `hash_password(password: str)`: generates PBKDF2-HMAC-SHA256 hash with cryptographically secure 16-byte salt via `secrets.token_hex()`. Returns `salt$hash` format string
- `verify_password(plain_password: str, hashed_password: str)`: validates plaintext password against stored hash using timing-safe `secrets.compare_digest()` to prevent timing attacks
- `verify_google_token(credential: str)`: validates Google ID tokens via `google-auth` / tokeninfo API, with development-mode mock token parsing support
- `create_access_token(subject: str, expires_delta)`: generates signed HS256 JWT access tokens
- `decode_access_token(token: str)`: validates and decodes platform JWT access tokens

---

#### [`backend/app/core/database.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/database.py)

**Purpose:** SQLAlchemy 2.x database connectivity layer. Configures engine with `pool_pre_ping=True`, `SessionLocal` factory, and the `get_db()` dependency generator for FastAPI endpoints.

---

#### [`backend/app/models/base.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/base.py)

**Purpose:** Declarative base class (`Base`) and shared `TimestampMixin` providing server-default `created_at` and on-update `updated_at` timezone-aware timestamps.

---

#### [`backend/app/models/doctor.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/doctor.py)

**Purpose:** `Doctor` model representing the platform user with multi-provider authentication support.
- Fields: `id` (UUID PK), `email` (Unique Indexed), `full_name`, `phone`, `avatar_url` (Nullable), `auth_provider` (Default: `"google"`), `provider_id` (Indexed Nullable), `hashed_password` (Nullable), `is_active` (Boolean), `created_at`, `updated_at`.
- Relationship: 1:1 with `Tenant` via `uselist=False, cascade="all, delete-orphan"`.

---

#### [`backend/app/models/tenant.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/tenant.py)

**Purpose:** `Tenant` model representing an isolated workspace.
- Fields: `id` (UUID PK), `doctor_id` (UUID FK → `doctors.id`, Unique Indexed), `slug` (Unique Indexed), `status`, `created_at`, `updated_at`.
- Relationship: 1:1 back-population to `Doctor`.

---

#### [`backend/app/models/__init__.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/__init__.py)

**Purpose:** Exports `Base`, `TimestampMixin`, `Doctor`, and `Tenant` so Alembic automatically discovers all models for metadata reflection.

---

#### [`backend/app/schemas/auth.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/schemas/auth.py)

**Purpose:** Pydantic validation schemas for authentication and user metadata.
- `GoogleAuthRequest`: contains `credential` (Google ID Token string)
- `EmailRegisterRequest`: contains `email`, `password` (required), `full_name` and `phone` (optional). Doctor name is auto-derived from email if omitted
- `EmailLoginRequest`: contains `email` and `password` (both required)
- `TenantResponse`, `DoctorResponse`, `AuthResponse`, `DoctorMeResponse`: response serialization schemas with `from_attributes=True` for ORM model compatibility

---

#### [`backend/app/services/auth_service.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/services/auth_service.py)

**Purpose:** Business logic layer for authentication, registration, and workspace provisioning.
- `slugify(text: str)`: transforms doctor names into URL-safe slugs
- `generate_unique_tenant_slug(db, full_name)`: deterministic unique tenant slug generator with collision resolution (`dr-ahmed-khan`, `dr-ahmed-khan-2`)
- `AuthService.authenticate_google(db, credential)`: handles single-transaction atomic creation of `Doctor` and `Tenant` via Google token, updates existing doctor metadata, and issues JWT access token
- `AuthService.register_email(db, email, password, full_name?, phone?)`: validates inputs, checks for duplicate emails, hashes password with PBKDF2, auto-derives doctor name from email if not provided, atomically creates `Doctor` (with `auth_provider="email"`) and `Tenant`, and issues JWT access token
- `AuthService.login_email(db, email, password)`: finds doctor by email, verifies stored password hash, rejects Google-provider accounts that lack a `hashed_password`, checks `is_active`, and issues JWT access token

---

#### [`backend/app/api/deps.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/deps.py)

**Purpose:** FastAPI dependency injection helpers for protected endpoints.
- `get_current_doctor`: extracts HTTP Bearer JWT token from `Authorization` header, decodes doctor UUID, checks `is_active`, and returns active `Doctor` instance (with loaded `Tenant`).

---

#### [`backend/app/api/router.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/router.py) & [`backend/app/api/routes/`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/)

**Purpose:** API routing structure.
- `routes/health.py`: `GET /api/v1/health` and `GET /api/v1/health/database`
- `routes/auth.py`:
  - `POST /api/v1/auth/register` (email/password doctor registration — 201 Created)
  - `POST /api/v1/auth/login` (email/password doctor authentication — 200 OK)
  - `POST /api/v1/auth/google` (Google ID token authentication/registration — 200 OK)
  - `GET /api/v1/auth/me` (protected current doctor endpoint with Bearer JWT)

---

#### [`backend/alembic/versions/`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/alembic/versions/)

**Purpose:** Database migration system.
- `001_initial_foundation.py`: creates `doctors` and `tenants` tables with explicit indexes and foreign key constraints.
- `002_add_auth_providers.py`: adds `avatar_url`, `auth_provider`, `provider_id`, and `hashed_password` columns to `doctors` table.

---

#### [`backend/tests/`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/tests/)

**Purpose:** Automated test suites using SQLite in-memory engine with `StaticPool`.
- `test_health_and_models.py`: verifies root health, v1 health, database connectivity check, CORS headers, and OpenAPI schema routes.
- `test_auth.py`: verifies Google registration, existing doctor login, slug collision handling, JWT generation, protected `/me` endpoint, invalid/missing tokens, inactive user rejection, **email registration (201), duplicate email prevention (400), wrong password rejection (401), correct password login (200), and JWT-protected `/me` access with email-issued tokens**.

---

## 6. "What File Do I Open?" Quick Reference

### Frontend
| I want to change... | Open this file | What to edit |
| :--- | :--- | :--- |
| **Brand primary color** | [`tailwind.config.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/tailwind.config.ts) | `theme.extend.colors.brand.600` (and neighboring shades) |
| **Browser tab title / SEO description** | [`app/layout.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/layout.tsx) | `export const metadata` object |
| **Body font or base text color** | [`app/layout.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/layout.tsx) | `className` on `<body>` |
| **Smooth scroll on/off** | [`app/globals.css`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/globals.css) | `html { scroll-behavior }` |
| **Navbar logo name or icon** | [`Navbar.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/Navbar.tsx) | Logo `<Link>` block at top |
| **Navbar links (add/remove/rename)** | [`Navbar.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/Navbar.tsx) | Desktop nav `<Link>` items + mobile dropdown `<Link>` items (must update both) |
| **Anchor scroll targets** | [`Navbar.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/Navbar.tsx) + [`Features.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/Features.tsx) + [`HowItWorks.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/HowItWorks.tsx) | `href="#x"` in Navbar must match `id="x"` in target section |
| **Hero headline or copy** | [`Hero.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/Hero.tsx) | Left column `<h1>` and `<p>` |
| **Hero CTA buttons** | [`Hero.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/Hero.tsx) | Primary `<Link href="/register">`, Secondary `<a href="#features">` |
| **Hero small trust badges** | [`Hero.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/Hero.tsx) | Three `<div>` elements in the bottom trust badge row |
| **Hero browser mockup content** | [`Hero.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/Hero.tsx) | Right column — "Website Mockup Card" JSX block |
| **Hero phone mockup content** | [`Hero.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/Hero.tsx) | Right column — "Mobile App Mockup Card" JSX block |
| **Feature cards (content, icons)** | [`Features.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/Features.tsx) | `features` array at the top of the file |
| **Features section title/subtitle** | [`Features.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/Features.tsx) | Section header div |
| **How It Works steps** | [`HowItWorks.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/HowItWorks.tsx) | `steps` array at the top of the file |
| **Sample doctor name/data in preview** | [`PreviewSection.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/PreviewSection.tsx) | Inline text strings in browser and phone mockup JSX |
| **Mobile app service cards in preview** | [`PreviewSection.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/PreviewSection.tsx) | 2×2 grid inside the phone screen div |
| **CTA section headline / trust copy** | [`CTA.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/CTA.tsx) | `<h2>`, `<p>`, trust badge `<span>` elements |
| **Footer platform description** | [`Footer.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/Footer.tsx) | `<p>` below the logo |
| **Footer navigation links** | [`Footer.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/Footer.tsx) | `<ul>` link items in each column |
| **Order of landing page sections** | [`app/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/page.tsx) | Component order in `<main>` |
| **Registration page copy / mode** | [`app/register/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/register/page.tsx) | Renders `EmailAuthForm mode="register"` |
| **Login page copy / mode** | [`app/login/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/login/page.tsx) | Renders `EmailAuthForm mode="login"` |
| **Email Auth form UI / validation** | [`EmailAuthForm.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/auth/EmailAuthForm.tsx) | Email & password fields, inactive Google button, form handlers |
| **Google Auth UI / Demo accounts** | [`GoogleAuthForm.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/auth/GoogleAuthForm.tsx) | Button handlers, GIS integration, and demo account presets (preserved for Google OAuth) |
| **Protected Dashboard page** | [`app/dashboard/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/dashboard/page.tsx) | Profile banner, workspace cards, and logout logic |
| **Frontend API client & tokens** | [`lib/api.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/lib/api.ts) | Fetch wrapper, JWT token storage, `registerWithEmail`, `loginWithEmail`, `authenticateWithGoogle`, and `getCurrentDoctor` methods |

### Backend & Database
| I want to change... | Open this file | What to edit |
| :--- | :--- | :--- |
| **Database URL or connection string** | [`backend/.env`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/.env) | `DATABASE_URL` variable |
| **Allowed CORS origins** | [`backend/.env`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/.env) | `CORS_ORIGINS` variable |
| **Google OAuth Client ID** | [`backend/.env`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/.env) | `GOOGLE_CLIENT_ID` variable |
| **JWT Secret Key & Expiration** | [`backend/.env`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/.env) | `JWT_SECRET_KEY` and `ACCESS_TOKEN_EXPIRE_MINUTES` |
| **App configuration / settings** | [`backend/app/core/config.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/config.py) | `Settings` class fields and validators |
| **Doctor database columns** | [`backend/app/models/doctor.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/doctor.py) | `Doctor` class mapped columns + Alembic migration |
| **Tenant database columns** | [`backend/app/models/tenant.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/tenant.py) | `Tenant` class mapped columns + Alembic migration |
| **Tenant slug generation / collision** | [`backend/app/services/auth_service.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/services/auth_service.py) | `slugify` and `generate_unique_tenant_slug` functions |
| **Password hashing / verification** | [`backend/app/core/security.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/security.py) | `hash_password` and `verify_password` functions |
| **Google auth verification logic** | [`backend/app/core/security.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/security.py) | `verify_google_token` and `create_access_token` |
| **Email registration / login logic** | [`backend/app/services/auth_service.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/services/auth_service.py) | `AuthService.register_email` and `AuthService.login_email` methods |
| **Current Doctor dependency** | [`backend/app/api/deps.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/deps.py) | `get_current_doctor` bearer token validation |
| **Auth API endpoints** | [`backend/app/api/routes/auth.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/auth.py) | `email_register`, `email_login`, `google_auth`, `get_me` route handlers |
| **New API routes** | [`backend/app/api/router.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/router.py) | Include new route modules in `api_router` |
| **Health check logic** | [`backend/app/api/routes/health.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/health.py) | `health_check` and `database_health_check` handlers |
| **PostgreSQL Docker credentials** | [`docker-compose.yml`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/docker-compose.yml) | `environment` variables under `postgres` service |

---

## 7. Critical Linkage Rules (Do Not Break)

These are implicit contracts between files. Breaking them causes silent visual, runtime, or navigation bugs.

| Rule | Files Involved | What breaks if violated |
| :--- | :--- | :--- |
| `href="#features"` must match `id="features"` | `Navbar.tsx`, `Hero.tsx` → `Features.tsx` | Clicking nav link or CTA scrolls to wrong position / nowhere |
| `href="#how-it-works"` must match `id="how-it-works"` | `Navbar.tsx` → `HowItWorks.tsx` | How It Works nav link stops working |
| All pages are wrapped by `app/layout.tsx` | All `page.tsx` files | If layout removed, all pages lose metadata and global styles |
| `app/globals.css` must be imported in `layout.tsx` | `layout.tsx` → `globals.css` | Tailwind CSS stops working across entire app |
| `tailwind.config.ts` content paths must include `app/**` and `components/**` | `tailwind.config.ts` | Brand colors and utility classes get purged from production build |
| `@/*` alias must resolve correctly in `tsconfig.json` | All component imports | All `@/components/...` imports break with module not found errors |
| All SQLAlchemy models must be imported in `app/models/__init__.py` | `app/models/*` → `alembic/env.py` | Alembic autogenerate will miss newly added tables / columns |
| `doctor_id` in `tenants` must remain `unique=True` | `app/models/tenant.py` | Breaks 1:1 doctor-tenant workspace isolation guarantee |
| `CORS_ORIGINS` must include frontend port (`http://localhost:3000`) | `backend/.env` → `app/main.py` | Browser blocks frontend API requests with CORS errors |
| `TOKEN_STORAGE_KEY` must match across auth helpers | `lib/api.ts` | Token persistence or logout fails to clear active JWT session |
| `JWT_SECRET_KEY` must be at least 32 characters long | `backend/.env` → `security.py` | PyJWT generates security warnings or fails signature verification |
| `EmailAuthForm` must import `registerWithEmail` and `loginWithEmail` from `lib/api.ts` | `EmailAuthForm.tsx` → `lib/api.ts` | Email registration/login form silently fails with undefined function errors |
| `hash_password` salt format must be `hex$hex` | `security.py` `hash_password` ↔ `verify_password` | Password verification always fails, locking out all email-registered doctors |
| `auth_provider` value must be `"email"` for email-registered doctors | `auth_service.py` → `security.py` | `login_email` rejects email accounts or allows cross-provider login |
| `/api/v1/auth/register` and `/api/v1/auth/login` frontend URLs must match backend route prefixes | `lib/api.ts` → `routes/auth.py` | Registration/login API calls return 404 |

---

## 8. Future Phase Extension Points

When future phases are implemented, here are the exact extension points:

| Feature Phase | Status | Where to Add / Extend |
| :--- | :--- | :--- |
| **Foundation & Landing (Phase 1)** | **Complete** | Public marketing landing page, brand system, and responsive shell |
| **Backend & DB Foundation (Phase 2)** | **Complete** | FastAPI, PostgreSQL, SQLAlchemy 2.x, Alembic, `Doctor` + `Tenant` models |
| **Auth & Doctor Registration (Phase 3)** | **Complete** | Email/Password registration & login (`/auth/register`, `/auth/login`), Google Sign-In (`/auth/google` — inactive until configured), PBKDF2 password hashing, JWT tokens, auto-provisioning, `/dashboard` entry |
| **Doctor Dashboard (Phase 4)** | Next | Extend `app/dashboard/` with metrics, overview cards; add `backend/app/api/routes/dashboard.py` |
| **Doctor Profile Management (Phase 5)** | Planned | Add `app/models/doctor_profile.py`, migration `003_doctor_profile.py`, profile CRUD endpoints |
| **Branding Configuration (Phase 6)** | Planned | Add `app/models/branding.py`, migration `004_branding.py`, branding endpoints |
| **Services Management (Phase 7)** | Planned | Add `app/models/service.py`, migration `005_services.py`, service CRUD endpoints |
| **Website Configuration (Phase 8)** | Planned | Add `app/models/website_config.py`, migration `006_website_config.py` |
| **Doctor Subdomain Routing (Phase 9)** | Planned | Next.js `middleware.ts` host header inspection; dynamic tenant lookup via backend API |

---

## 9. Coding Agent Rules

### Frontend Rules
1. **Always use `@/*` imports** — never use relative imports like `../../components/...`
2. **Run `npx tsc --noEmit` before declaring a frontend change complete** — zero type errors required
3. **Add `"use client"` only when the component uses `useState`, `useEffect`, or browser APIs** — keep components as server components by default
4. **All styling via Tailwind classes** — no `style={{}}` props or separate `.module.css` files unless absolutely unavoidable
5. **Use `brand-*` colors from `tailwind.config.ts`** — never hardcode hex values in component JSX

### Backend Rules
6. **Always write and run `pytest`** in `backend/` before declaring backend changes complete
7. **Use Alembic migrations as source-of-truth** for all database schema evolution — do not use `create_all()` in production code
8. **Always use UUID primary keys** and inherit `TimestampMixin` for relational models
9. **Keep business logic modular** — implement only what the current phase requires; defer future tables/endpoints to their respective phases
10. **Environment variables through `pydantic-settings`** — never access `os.environ` directly in application logic; use `get_settings()`
