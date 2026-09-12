# DocSpace — Central Project & Architecture Guide

> **For developers and AI coding agents.** Reading this document end-to-end should give you a complete mental model of the project: what every file does, how files link to each other, where data flows, and which file to open when you want to change something specific.

---

## 1. What This Project Is

DocSpace is a **multi-tenant white-label SaaS platform** for doctors. Each doctor who registers gets their own branded website subdomain / slug route (e.g. `drsarahjohnson.platform.com` or `/dr-sarah-johnson`) and a patient-facing web application, all managed from a single dashboard.

- **Phase 1 (Complete):** Foundation setup and public-facing marketing landing page with initial `/register` and `/login` routes.
- **Phase 2 (Complete):** Backend foundation and database layer (FastAPI, SQLAlchemy 2.x, PostgreSQL, Alembic migrations, `Doctor` + `Tenant` multi-tenant identity boundary).
- **Phase 3 (Complete):** Authentication and Doctor Registration (Email/Password registration & login, Google Sign-In with GCP OAuth / mock token support, PBKDF2-HMAC-SHA256 password hashing, auto-provisioning Doctor + Tenant with deterministic slug generation, stateless JWT access tokens, `/api/v1/auth/*` endpoints, and protected `/dashboard` entry point).
- **Phase 4 (Complete):** Doctor Onboarding & Live Practice Profile Management (3-step onboarding wizard at `/onboarding`, profile photo upload with default healthcare fallback, speciality selector, bio editor, 4-service feature toggles: Appointments, Video Consultation, Medicine Inventory, Lab Reports; in-dashboard profile editor at `/dashboard` with instant live synchronization to patient webpage).
- **Phase 5 (Complete):** Public Patient-Facing Practice Portal Architecture (`/[slug]` and `/dr/[slug]`): Sticky service navigation tabs, Practice Home with doctor credentials, healthcare philosophy/bio, 4 clinical commitment pillars, services showcase cards, dedicated full-page service views (In-Clinic Booking, Telehealth Video Scheduling, Pharmacy Medicine Orders, Lab & Diagnostic Reports Upload), and public patient API endpoints with feature toggle enforcement.
- **Phase 6 (Complete):** Native Android APK Builder & Doctor Dashboard App Management — Automated Jetpack Compose Android template (`android-template/`) with build-time doctor metadata injection (`DoctorConfig.kt`), headless Gradle `assembleRelease` background compilation via `AppBuildService`, custom launcher icon upload, real-time build status polling and live compilation log streaming in the Doctor Dashboard, unauthenticated APK download endpoint for patient sideloading, APK caching by clinic identity to avoid rebuilds, and `start-servers.sh` / `stop-servers.sh` operational scripts for unified platform startup.
- **Upcoming Phases:** Phase 7 (Custom Branding & Subdomain Routing), Phase 8 (Patient Management & Clinical Records), Phase 9 (Payment Gateway Integration).

---

## 2. Tech Stack Decisions

### Frontend
| Technology | Why |
| :--- | :--- |
| **Next.js 14 (App Router)** | File-system routing, server components, dynamic route matching (`app/[slug]/page.tsx`), and client-side tab state management |
| **TypeScript** | Strict type safety enforced across all components and API responses in `tsconfig.json` |
| **Tailwind CSS** | Utility-first styling — consistent design tokens via `tailwind.config.ts`, medical-grade `brand` blue palette |
| **Lucide React** | Lightweight, tree-shakeable healthcare icon set (`Stethoscope`, `Calendar`, `Video`, `Pill`, `FileText`, `ShieldCheck`, etc.) |
| **Client-Side API Utility (`lib/api.ts`)** | Native `fetch` client with JWT storage, doctor profile CRUD, public tenant endpoints, patient submission handlers, and `DEFAULT_DOCTOR_AVATAR` SVG fallback |
| **Base64 / Data URL Avatar Support** | `avatar_url` stored as `Text` allowing instant zero-dependency image previews and uploads without requiring S3/cloud storage setup during development |

### Backend & Database
| Technology | Why |
| :--- | :--- |
| **Python 3.12+ / FastAPI** | High-performance REST API with automatic OpenAPI Swagger documentation and modular routers (`auth`, `doctor`, `public`, `health`) |
| **SQLAlchemy 2.x** | Modern Python ORM using declarative mapped columns, typed relationships, and explicit foreign keys |
| **PostgreSQL 16 & SQLite** | Multi-tenant relational isolation in production with transparent SQLite auto-column migration helper for local zero-friction testing |
| **PBKDF2-HMAC-SHA256 (`hashlib` + `secrets`)** | Stdlib-based password hashing with per-user cryptographic salt and timing-safe comparison — zero external security dependencies |
| **PyJWT** | RFC 7519 compliant JSON Web Token encoding and decoding for platform sessions |
| **Alembic** | Source-of-truth migration management (`001_initial_foundation`, `002_add_auth_providers`, `003_add_doctor_onboarding_and_services`) |
| **Pydantic v2 / Settings** | Type-safe environment variable parsing (`pydantic-settings`) and strict request/response validation schemas |
| **Docker Compose** | Local PostgreSQL containerization without heavy container overhead on the backend |

---

## 3. High-Level Architecture

The project is structured as a modular frontend + backend workspace.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                               FRONTEND: NEXT.JS CLIENT                                  │
│   • Marketing Landing Page (/)                                                          │
│   • Auth Pages (/login, /register) ─── Auto-redirects to /onboarding if setup pending   │
│   • Doctor Onboarding Wizard (/onboarding) ─── 3-step practice & services configuration  │
│   • Protected Doctor Dashboard (/dashboard) ─── Real-time profile & service toggle sync │
│   │   └── Android App Builder UI ─── Build trigger, live log console, APK download      │
│   • Patient-Facing Portal (/[slug], /dr/[slug]) ─── Practice Home + Dedicated Services  │
│   • Central API Client (lib/api.ts)                                                     │
│   (Port 3000)                                                                           │
└────────────────────────────────────┬────────────────────────────────────────────────────┘
                                     │ HTTP / CORS (http://localhost:3000)
                                     │ Bearer JWT / Public API Requests
┌────────────────────────────────────▼────────────────────────────────────────────────────┐
│                            BACKEND: FASTAPI API SERVICE (backend/)                      │
│                                                                                         │
│  backend/app/main.py ───────────────── Root health check, CORS middleware, OpenAPI docs │
│  ├── backend/app/core/ ─────────────── Settings (config.py), DB Session & auto-migrate  │
│  │                                     (database.py), Security & JWT (security.py)      │
│  ├── backend/app/api/ ──────────────── API Routers:                                     │
│  │   ├── routes/auth.py ────────────── /api/v1/auth (register, login, google, me)       │
│  │   ├── routes/doctor.py ──────────── /api/v1/doctor/profile (GET, PUT) [Protected]    │
│  │   ├── routes/app_build.py ───────── /api/v1/doctor/app/* (preview, build, download)  │
│  │   ├── routes/public.py ──────────── /api/v1/public/tenants/{slug}/* [Unauthenticated]│
│  │   │                                 (GET tenant, POST appointments, reports, orders)│
│  │   └── routes/health.py ──────────── /api/v1/health, /api/v1/health/database          │
│  ├── backend/app/services/ ─────────── auth_service.py (provisioning & slug generation) │
│  │                                     app_build_service.py (Gradle workspace manager)  │
│  └── backend/app/models/ ───────────── SQLAlchemy models (Base, Doctor, Tenant)         │
│  (Port 8000)                                                                            │
└────────────────────┬──────────────────────────────┬────────────────────────────────────┘
                     │ SQLAlchemy 2.x / PostgreSQL   │ Build-time injection
                     │ / SQLite                      │ & Gradle compilation
┌────────────────────▼───────────────────┐  ┌───────▼────────────────────────────────────┐
│      DATABASE: POSTGRESQL / SQLITE     │  │   ANDROID BUILD ENGINE (android-template/) │
│                                        │  │                                             │
│ doctors → id, email, full_name, phone, │  │ 1. Template Clone → builds/workspaces/{id} │
│   avatar_url, speciality, bio,         │  │ 2. DoctorConfig.kt placeholder injection   │
│   onboarding_completed, auth_provider, │  │ 3. strings.xml app_name injection           │
│   provider_id, hashed_password,        │  │ 4. build.gradle.kts package name injection  │
│   app_icon_url, is_active, timestamps  │  │ 5. Custom launcher icon copy (if uploaded)  │
│                                        │  │ 6. ./gradlew assembleRelease --no-daemon    │
│ tenants → id, doctor_id (FK UK 1:1),   │  │ 7. APK → builds/apks/{clinic}_{id}.apk     │
│   slug, status, clinic_name, location, │  │                                             │
│   service_appointment,                 │  │ Template Stack:                             │
│   service_video_consultation,          │  │ • Kotlin 2.0 + Jetpack Compose + Material3 │
│   service_medicine_inventory,          │  │ • compileSdk 34 / minSdk 24 / targetSdk 34 │
│   service_lab_reports, timestamps      │  │ • Java 17 (Android Studio JBR)              │
│ (Port 5432)                            │  │ • Offline-first hardcoded DoctorConfig      │
└────────────────────────────────────────┘  └─────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                          OPERATIONAL SCRIPTS (Project Root)                              │
│                                                                                         │
│  start-servers.sh ──── Launches Backend (uvicorn :8000) + Frontend (npm dev :3000)      │
│  stop-servers.sh ───── Gracefully terminates both servers by port detection              │
│  start-tunnel.sh ───── Opens Pinggy SSH tunnel for remote access to localhost:3000       │
│  (Aliases: start.sh → start-servers.sh, stop.sh → stop-servers.sh)                      │
│  (npm scripts: servers:start, servers:stop, servers:restart)                             │
└─────────────────────────────────────────────────────────────────────────────────────────┘
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
        └── Renders components/auth/EmailAuthForm.tsx (or GoogleAuthForm.tsx)
              ├── Displays email & password form fields (register or login mode)
              ├── Shows Google Sign-In button (with demo accounts for instant local testing)
              └── On authentication success:
                    ├── Receives platform JWT access token + doctor & tenant payload
                    ├── Stores JWT in localStorage ("docspace_auth_token")
                    └── Evaluates doctor.onboarding_completed:
                          ├── If FALSE → router.push("/onboarding") (Force onboarding wizard)
                          └── If TRUE  → router.push("/dashboard") (Direct to practice dashboard)
```

When a browser visits `/onboarding`:

```
Browser → GET "/onboarding"
  └── Next.js App Router matches app/onboarding/page.tsx
        ├── Verifies JWT session via getAuthToken() (redirects to /login if missing)
        ├── Loads current profile via getDoctorProfile() (GET /api/v1/doctor/profile)
        └── Renders 3-Step Guided Onboarding Wizard:
              ├── Step 1 (Profile & Practice Details):
              │     ├── Photo Upload (base64 data URL) + Default healthcare avatar fallback
              │     ├── Full Name, Clinic Name, Location, Phone, Bio/Philosophy
              │     └── Speciality quick-select suggestion pills (Cardiologist, Dermatologist, etc.)
              ├── Step 2 (Services Selection):
              │     ├── In-Clinic Appointments (Toggle)
              │     ├── Video Consultation (Toggle)
              │     ├── Medicine Inventory & Orders (Toggle)
              │     └── Lab Reports Management (Toggle)
              └── Step 3 (Launch & Publish):
                    ├── Submits payload via updateDoctorProfile() (PUT /api/v1/doctor/profile)
                    │     → Sets onboarding_completed: true atomically in backend
                    ├── Displays personalized live patient URL (/[slug] and /dr/[slug])
                    ├── 1-Click "Copy Public Webpage Link" with clipboard confirmation
                    └── Action buttons: "Preview Patient Webpage" (/[slug]) or "Go to Dashboard" (/dashboard)
```

When a browser visits `/dashboard`:

```
Browser → GET "/dashboard"
  └── Next.js App Router matches app/dashboard/page.tsx
        └── Client-side auth check:
              ├── Reads token from localStorage via getAuthToken() (redirects to /login if missing)
              ├── Fetches current doctor & practice via getDoctorProfile() (GET /api/v1/doctor/profile)
              ├── If un-onboarded (onboarding_completed: false):
              │     └── Shows prominent alert banner with "Complete Practice Setup" CTA → /onboarding
              ├── Renders "Your Live Patient Webpage" Banner:
              │     ├── Displays doctor slug URL (e.g. localhost:3000/dr-rajesh-kumar)
              │     ├── "Copy Patient Link" button
              │     └── "Visit Live Patient Webpage" external navigation link
              ├── Renders "Practice Profile & Services Management" Real-Time Editor:
              │     ├── Doctor photo upload, name, speciality, clinic, location, bio
              │     ├── Real-time toggles for 4 services (Appointments, Video, Medicines, Reports)
              │     └── "Save Profile Changes" button → PUT /api/v1/doctor/profile
              │           └── Changes immediately reflect on the live patient webpage on reload
              └── Logout button → clears localStorage JWT and redirects to /login
```

When a patient visits `/[slug]` or `/dr/[slug]`:

```
Patient Browser → GET "/[slug]" or "/dr/[slug]" (e.g. /dr-rajesh-kumar)
  └── Next.js App Router matches app/[slug]/page.tsx (or alias app/dr/[slug]/page.tsx)
        ├── Calls getPublicDoctorProfile(slug) → GET /api/v1/public/tenants/{slug}
        │     ├── If tenant not found (404) → renders custom "Practice Not Found" card
        │     └── If active tenant (200) → receives public doctor info + enabled services
        ├── Renders Sticky Services Navigation Bar:
        │     ├── "Practice Home" tab (always present)
        │     └── Dynamic tabs for enabled services: "In-Clinic Appointments", "Video Consultation",
        │         "Medicine Orders", "Lab Reports"
        │
        ├── VIEW A: Practice Home (activeTab === "home"):
        │     ├── Hero Section: Doctor avatar (with healthcare fallback), verified badge,
        │     │   credentials, clinic name, location, and quick CTA buttons
        │     ├── Healthcare Philosophy & Bio: Doctor bio, credentials, and 4 clinical commitment
        │     │   pillars (Verified Credentials, Patient-Centric Care, Prompt Scheduling, Integrated Care)
        │     └── Care Offerings Grid: Responsive showcase cards for active services with
        │         direct click-through triggers that switch activeTab to that service
        │
        └── VIEW B: Dedicated Detailed Service View (activeTab === [service]):
              ├── Top navigation bar with "← Back to Practice Home" button and breadcrumbs
              ├── Doctor context card reiterating doctor name, avatar, clinic, and safety badge
              └── Isolated full-page interactive workflow:
                    ├── appointments → Date picker, time slot selector, patient details, and instant reference ID
                    ├── teleconsult  → Video consult date/time scheduler, symptoms notes, and HD room notice
                    ├── medicines    → Clinic pharmacy medicine ordering, dosage notes, patient delivery address
                    └── reports      → Diagnostic report uploader (PDF/scans), test category, clinical symptoms
              └── Success state with booking reference ID, "Submit Another", and "Return to Practice Home"
```

### 4.3 Navigation linkages inside the app

The Navbar links use two mechanisms:

- **Anchor links** (`href="#features"`, `href="#how-it-works"`) → scroll the browser to `id="features"` on `Features.tsx` and `id="how-it-works"` on `HowItWorks.tsx`. These `id` attributes must remain in sync with Navbar.
- **Route links** (`href="/login"`, `href="/register"`) → full Next.js page navigation to authentication flows.

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
  ├── GET /health ──────────────────── app/main.py (Root health check)
  │
  ├── GET /api/v1/health ───────────── app/main.py → app/api/router.py → app/api/routes/health.py
  │     ├── GET /api/v1/health                  → {"status": "healthy", "service": "doctor-platform-api"}
  │     └── GET /api/v1/health/database         → app/core/database.py:get_db() (SELECT 1)
  │
  ├── /api/v1/auth ─────────────────── app/main.py → app/api/routes/auth.py
  │     ├── POST /api/v1/auth/register          → registers doctor, auto-creates tenant with slug, returns JWT
  │     ├── POST /api/v1/auth/login             → verifies password hash, returns JWT + onboarding_completed
  │     ├── POST /api/v1/auth/google            → verifies Google token, provisions doctor+tenant, returns JWT
  │     └── GET /api/v1/auth/me                 → returns current authenticated doctor profile
  │
  ├── /api/v1/doctor ───────────────── app/main.py → app/api/routes/doctor.py [Protected: Bearer JWT]
  │     ├── GET /api/v1/doctor/profile          → returns doctor profile + tenant clinic & 4 service flags
  │     └── PUT /api/v1/doctor/profile          → updates full_name, avatar_url, speciality, bio, clinic_name,
  │                                               location, onboarding_completed, and 4 service flags
  │
  ├── /api/v1/doctor/app ─────────── app/main.py → app/api/routes/app_build.py [Protected: Bearer JWT]
  │     ├── GET /api/v1/doctor/app/preview              → returns app branding preview + latest built APK info
  │     ├── POST /api/v1/doctor/app/icon                → uploads custom 512×512 PNG launcher icon to backend
  │     ├── POST /api/v1/doctor/app/build (202)         → triggers background Gradle assembleRelease thread
  │     │     └── Calls: trigger_app_build() → prepare_project_workspace() → run_gradle_build() (daemon thread)
  │     ├── GET /api/v1/doctor/app/build/{task_id}/status → polls compilation progress (preparing → compiling → completed | failed)
  │     ├── GET /api/v1/doctor/app/build/{task_id}/logs → returns full Gradle stdout/stderr compilation output
  │     └── GET /api/v1/doctor/app/download/{task_id}   → [UNAUTHENTICATED] direct .apk FileResponse download
  │
  └── /api/v1/public ───────────────── app/main.py → app/api/routes/public.py [Unauthenticated]
        ├── GET /api/v1/public/tenants/{slug}                   → returns public doctor profile & enabled services
        ├── POST /api/v1/public/tenants/{slug}/appointments     → verifies service_appointment is true; returns booking ID
        ├── POST /api/v1/public/tenants/{slug}/reports          → verifies service_lab_reports is true; returns tracking ID
        └── POST /api/v1/public/tenants/{slug}/medicine-orders  → verifies service_medicine_inventory is true; returns order ID
```

Database Model Linkage:
```
Doctor (app/models/doctor.py)
  └── id (UUID Primary Key)
  └── email (Unique Indexed)
  └── full_name (String)
  └── phone (String, Nullable)
  └── avatar_url (Text, Nullable — supports base64 & external URLs)
  └── speciality (String, Nullable — e.g. "Cardiologist")
  └── bio (Text, Nullable — doctor philosophy & care background)
  └── onboarding_completed (Boolean, Default: False)
  └── auth_provider (String, Default: "google")
  └── provider_id (String Indexed, Nullable)
  └── hashed_password (String, Nullable)
  └── is_active (Boolean, Default: True)
  └── tenant (1:1 Relationship via uselist=False, cascade="all, delete-orphan")
        │
        ▼
Tenant (app/models/tenant.py)
  └── id (UUID Primary Key)
  └── doctor_id (UUID Foreign Key → doctors.id, Unique Indexed)
  └── slug (Unique Indexed — e.g. "dr-rajesh-kumar")
  └── status (Default: 'active')
  └── clinic_name (String, Nullable — e.g. "Kumar Heart & Health Clinic")
  └── location (String, Nullable — e.g. "Bandra West, Mumbai")
  └── service_appointment (Boolean, Default: True — in-clinic bookings)
  └── service_video_consultation (Boolean, Default: True — telehealth video)
  └── service_medicine_inventory (Boolean, Default: False — clinic pharmacy)
  └── service_lab_reports (Boolean, Default: False — diagnostic reports)
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

#### [`app/onboarding/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/onboarding/page.tsx)

**Purpose:** 3-step doctor onboarding and initial practice setup wizard (`/onboarding`).

**Key content:**
- **Step 1 (Practice & Doctor Details):**
  - Profile photo upload with instant browser FileReader preview and `DEFAULT_DOCTOR_AVATAR` SVG fallback.
  - Doctor name, clinic name, location, contact phone, and clinical bio / philosophy.
  - Interactive speciality suggestion pills (*Cardiologist*, *General Physician*, *Dermatologist*, *Pediatrician*, *Orthopedic*, *Gynecologist*, *Neurologist*, *Psychiatrist*, *Dentist*, *ENT Specialist*).
- **Step 2 (Care Offerings / Services Selection):**
  - 4 interactive service toggle cards: *In-Clinic Appointments*, *Video Consultation*, *Medicine Inventory & Orders*, and *Lab Reports Management* (Staff management explicitly excluded from patient offerings).
- **Step 3 (Launch & Publish):**
  - Submits profile and toggles via `updateDoctorProfile()` (`PUT /api/v1/doctor/profile`), setting `onboarding_completed: true`.
  - Displays personalized public URL (e.g. `http://localhost:3000/dr-rajesh-kumar`).
  - Copy-to-clipboard action with visual toast confirmation.
  - Quick action buttons: **"Preview Patient Webpage"** (`/[slug]`) and **"Go to Dashboard"** (`/dashboard`).

**Architectural Rationale:**
- Separating onboarding into a dedicated wizard ensures doctors complete necessary clinical credentials and select their offered services before publishing their public patient link.
- Doctors who log in or register with `onboarding_completed: false` are automatically redirected here to prevent unconfigured public profile pages.

---

#### [`app/dashboard/page.tsx`](file:///Users/mdaffanahmed/VS Code/Full stack/Doctors Platform/app/dashboard/page.tsx)

**Purpose:** Protected doctor practice management dashboard (`/dashboard`) with real-time profile editing and service sync.

**Key content:**
- Client-side route protection: verifies presence of JWT in `localStorage` (`getAuthToken()`).
- Calls `getDoctorProfile()` (`GET /api/v1/doctor/profile`) to load authenticated doctor details and tenant service flags.
- Displays prominent setup banner if `onboarding_completed: false` with direct link to `/onboarding`.
- **"Your Live Patient Webpage" Card:** Displays doctor slug URL, 1-click copy button, and direct link to open the public patient portal (`/[slug]`).
- **"Practice Profile & Services Management" Editor:**
  - In-place doctor photo upload, full name, speciality, clinic name, location, and bio editor.
  - 4 one-click toggle switches for practice services (*In-Clinic Appointments*, *Video Consultation*, *Medicine Inventory*, *Lab Reports*).
  - "Save Profile Changes" button calls `updateDoctorProfile()` (`PUT /api/v1/doctor/profile`) — any changes made here sync immediately to the live patient-facing website.
- Session **Logout** button which clears localStorage and redirects to `/login`.

**Linkage:**
- Wrapped by `app/layout.tsx`.
- Consumes `lib/api.ts` (`getDoctorProfile`, `updateDoctorProfile`, `removeAuthToken`).

---

#### [`app/[slug]/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/%5Bslug%5D/page.tsx) & [`app/dr/[slug]/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/dr/%5Bslug%5D/page.tsx)

**Purpose:** Public-facing patient portal customized per doctor based on their URL slug (e.g. `/dr-rajesh-kumar` or `/dr/dr-rajesh-kumar`).

**Key Architecture & State Design:**
- **Dynamic Data Fetching:** On mount, queries `GET /api/v1/public/tenants/{slug}` via `getPublicDoctorProfile(slug)`. If the practice does not exist, displays a user-friendly "Practice Not Found" card.
- **Sticky Top Tab Navigation Bar:**
  - Always includes `Practice Home` tab.
  - Dynamically renders tabs only for services enabled by the doctor (`In-Clinic Appointments`, `Video Consultation`, `Medicine Orders`, `Lab Reports`).
  - Active tab highlighting (`bg-brand-600 text-white`) and smooth scroll to top on tab switch.
- **Home View (`activeTab === "home"`):**
  - **Doctor Hero Profile:** High-resolution doctor avatar (or default healthcare SVG fallback), verified practice badge, full name, clinical speciality, clinic name, location, and quick CTA buttons.
  - **Doctor & Healthcare Philosophy:** Detailed clinical bio, practice introduction, and 4 healthcare commitment pillars (*Verified Credentials*, *Patient-Centric Care*, *Prompt Scheduling*, *Integrated Digital Care*).
  - **Care Offerings Cards Grid:** Visual service cards highlighting features, capabilities, and direct click-through action buttons that switch `activeTab` to that specific service.
- **Dedicated Detailed Service Views (`activeTab === [service]`):**
  - Isolates the chosen service on its own full page, hiding other services to prevent visual clutter and cognitive overload.
  - Top navigation bar with **"← Back to Practice Home"** button and breadcrumb path (`Home / [Service Name]`).
  - Clinical reassurance card showing doctor credentials and privacy/encryption badges.
  - **Full Interactive Workflows:**
    - 📅 **In-Clinic Appointments:** Preferred date picker, interactive time slot selection (`09:00 AM`, `10:00 AM`, etc.), patient details, and confirmation reference ID with return-to-home actions.
    - 📹 **Video Consultation:** Telehealth scheduling form, HD encrypted room notice, date/time slot picker, and consultation link dispatch notice.
    - 💊 **Clinic Pharmacy & Medicine Orders:** Prescription medicine request form, medication name/dosage, delivery address, and pharmacy verification ticket.
    - 🧪 **Lab & Diagnostic Reports:** Secure file uploader supporting PDFs and medical scans (`.pdf`, `image/*`), test category selector, symptoms notes, and tracking ID.
- **Auto-Guard Synchronization:** If a doctor disables a service while a patient is viewing that tab, an active `useEffect` guard automatically redirects the view back to `"home"`.

**Architectural Rationale:**
- **Client-Side Tab Isolation vs. Multi-Page Routing:** Implementing single-route tab state (`activeTab`) within `/[slug]` provides instant, zero-latency transitions without full-page reloads, retains client-side form draft states if needed, and allows single-URL sharing for the doctor's entire practice.
- **`app/dr/[slug]/page.tsx` Alias:** Re-exports `app/[slug]/page.tsx` directly, allowing doctors and patients to access practice portals via both `/dr-rajesh-kumar` and `/dr/dr-rajesh-kumar` interchangeably.

---

### Utility & Authentication Components (`lib/` & `components/auth/`)

---

#### [`lib/api.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/lib/api.ts)

**Purpose:** Centralized API client, type definitions, and authentication token manager for the frontend.

**Key content:**
- **Default Asset Constants:** `DEFAULT_DOCTOR_AVATAR` (embedded high-resolution medical doctor illustration SVG data URL for fallback).
- **Token Storage Helpers:** `getAuthToken()`, `setAuthToken(token)`, `removeAuthToken()`.
- **TypeScript Interfaces:**
  - `Doctor`, `Tenant`, `ServicesConfig` (`appointment`, `video_consultation`, `medicine_inventory`, `lab_reports`).
  - `DoctorProfileResponse`, `DoctorProfileUpdateRequest`.
  - `PublicDoctorProfileResponse` (public tenant payload with doctor info and service toggles).
  - `AppointmentBookingRequest`, `ReportUploadRequest`, `MedicineOrderRequest`.
- **API Methods:**
  - `registerWithEmail(email, password, fullName?)`
  - `loginWithEmail(email, password)`
  - `authenticateWithGoogle(credential)`
  - `getCurrentDoctor()` (`GET /api/v1/auth/me`)
  - `getDoctorProfile()` (`GET /api/v1/doctor/profile`) [Protected]
  - `updateDoctorProfile(payload)` (`PUT /api/v1/doctor/profile`) [Protected]
  - `getPublicDoctorProfile(slug)` (`GET /api/v1/public/tenants/{slug}`) [Public]
  - `bookPublicAppointment(slug, payload)` (`POST /api/v1/public/tenants/{slug}/appointments`) [Public]
  - `uploadPublicReport(slug, payload)` (`POST /api/v1/public/tenants/{slug}/reports`) [Public]
  - `orderPublicMedicine(slug, payload)` (`POST /api/v1/public/tenants/{slug}/medicine-orders`) [Public]

---

#### [`components/auth/EmailAuthForm.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/auth/EmailAuthForm.tsx)

**Purpose:** Email and password authentication & registration form with onboarding routing.

**Key content:**
- Supports `mode="login"` and `mode="register"`.
- Clean email & password inputs with client validation and loading states.
- Inactive Google Sign-In button placeholder (until Google OAuth credentials configured).
- Automatic routing: evaluates `doctor.onboarding_completed` upon authentication, directing to `/onboarding` if false or `/dashboard` if true.

---

#### [`components/auth/GoogleAuthForm.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/auth/GoogleAuthForm.tsx)

**Purpose:** Interactive Google Sign-In and practice registration form component with demo account presets.

**Key content:**
- Supports official Google Identity Services SDK (`https://accounts.google.com/gsi/client`) when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is configured.
- Provides 1-Click Quick Demo accounts ("Dr. Ahmed Khan", "Dr. Sarah Connor") for immediate local evaluation without requiring GCP console setup.
- Evaluates `doctor.onboarding_completed` upon successful authentication, directing to `/onboarding` if setup is incomplete.

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

#### [`backend/app/core/database.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/core/database.py)

**Purpose:** SQLAlchemy 2.x database connectivity layer and transparent SQLite migration helper.
- Configures engine with `pool_pre_ping=True`, `SessionLocal` factory, and `get_db()` dependency generator.
- Includes `_run_sqlite_auto_migrations()` which automatically checks SQLite PRAGMA table info on startup and adds missing columns (`speciality`, `bio`, `onboarding_completed`, `clinic_name`, `location`, `service_*`), ensuring zero-friction local development even if local SQLite db files are used without running Alembic commands.

---

#### [`backend/app/models/doctor.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/doctor.py)

**Purpose:** `Doctor` model representing the registered practitioner with profile and onboarding metadata.
- **Fields:**
  - `id` (UUID Primary Key)
  - `email` (String 255, Unique Indexed, Nullable=False)
  - `full_name` (String 255, Nullable=False)
  - `phone` (String 50, Nullable=True)
  - `avatar_url` (Text, Nullable=True) — stored as `Text` to allow base64 data URLs without 255-character truncation
  - `speciality` (String 255, Nullable=True) — e.g. "Cardiologist", "General Physician"
  - `bio` (Text, Nullable=True) — doctor background, healthcare philosophy, and credentials
  - `onboarding_completed` (Boolean, Default: False, Nullable=False) — gates access to dashboard vs. onboarding wizard
  - `auth_provider` (String 50, Default: "google")
  - `provider_id` (String 255, Indexed Nullable)
  - `hashed_password` (String 255, Nullable)
  - `app_icon_url` (String 500, Nullable) — file path to uploaded custom Android app launcher icon
  - `is_active` (Boolean, Default: True)
  - Timestamps (`created_at`, `updated_at`)
- **Relationship:** 1:1 with `Tenant` via `uselist=False, cascade="all, delete-orphan"`.

---

#### [`backend/app/models/tenant.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/tenant.py)

**Purpose:** `Tenant` model representing the isolated practice workspace and enabled service catalog.
- **Fields:**
  - `id` (UUID Primary Key)
  - `doctor_id` (UUID Foreign Key → `doctors.id`, Unique Indexed, `ondelete="CASCADE"`)
  - `slug` (String 100, Unique Indexed) — URL identifier (e.g. `dr-rajesh-kumar`)
  - `status` (String 50, Default: "active")
  - `clinic_name` (String 255, Nullable=True) — e.g. "Kumar Heart & Health Clinic"
  - `location` (String 500, Nullable=True) — e.g. "Bandra West, Mumbai"
  - **4 Platform Service Toggles:**
    - `service_appointment` (Boolean, Default: True) — In-clinic appointment booking
    - `service_video_consultation` (Boolean, Default: True) — Telehealth video consultations
    - `service_medicine_inventory` (Boolean, Default: False) — Clinic pharmacy & medicine orders
    - `service_lab_reports` (Boolean, Default: False) — Lab & diagnostic reports upload
  - Timestamps (`created_at`, `updated_at`)
- **Relationship:** 1:1 back-population to `Doctor`.

---

#### [`backend/app/schemas/profile.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/schemas/profile.py)

**Purpose:** Pydantic validation schemas for doctor profile management, service configurations, and public patient actions.
- `ServicesConfig`: schema for 4 boolean toggles (`appointment`, `video_consultation`, `medicine_inventory`, `lab_reports`).
- `DoctorProfileUpdateRequest`: schema for doctor settings updates (`full_name`, `phone`, `avatar_url`, `speciality`, `bio`, `clinic_name`, `location`, `onboarding_completed`, `services`).
- `DoctorProfileResponse`: serialized authenticated profile for dashboard/onboarding.
- `PublicDoctorInfo`: sanitized public practitioner metadata (`full_name`, `avatar_url`, `speciality`, `bio`, `clinic_name`, `location`, `slug`).
- `PublicDoctorProfileResponse`: public tenant payload returning doctor info + active `services`.
- **Patient Action Payload Schemas:**
  - `AppointmentBookingRequest` (`patient_name`, `patient_email`, `patient_phone`, `appointment_date`, `appointment_time`, `appointment_type`, `notes`).
  - `ReportUploadRequest` (`patient_name`, `patient_email`, `patient_phone`, `report_type`, `file_name`, `notes`).
  - `MedicineOrderRequest` (`patient_name`, `patient_email`, `patient_phone`, `delivery_address`, `items`, `notes`).

---

#### [`backend/app/api/routes/doctor.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/doctor.py)

**Purpose:** Authenticated profile endpoints for the logged-in doctor.
- `GET /api/v1/doctor/profile`: Returns the authenticated doctor's full profile and associated tenant's clinic information and service toggles.
- `PUT /api/v1/doctor/profile`: Atomically updates doctor profile fields (`full_name`, `avatar_url`, `speciality`, `bio`, `onboarding_completed`) and tenant fields (`clinic_name`, `location`, and 4 service toggles).

---

#### [`backend/app/api/routes/public.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/public.py)

**Purpose:** Unauthenticated public endpoints for patient-facing web interactions.
- `GET /api/v1/public/tenants/{slug}`: Looks up tenant by slug, ensures `status == "active"`, and returns public doctor profile and active service toggles. Returns 404 if not found.
- `POST /api/v1/public/tenants/{slug}/appointments`: Validates that `service_appointment` is enabled for the practice; generates unique booking ID (`APT-...`). Returns HTTP 400 if service is disabled.
- `POST /api/v1/public/tenants/{slug}/reports`: Validates that `service_lab_reports` is enabled for the practice; generates unique tracking ID (`REP-...`). Returns HTTP 400 if service is disabled.
- `POST /api/v1/public/tenants/{slug}/medicine-orders`: Validates that `service_medicine_inventory` is enabled for the practice; generates unique order ticket (`MED-...`). Returns HTTP 400 if service is disabled.

---

#### [`backend/alembic/versions/`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/alembic/versions/)

**Purpose:** Database migration manifests.
- `001_initial_foundation.py`: Creates `doctors` and `tenants` tables with explicit indexes and foreign key constraints.
- `002_add_auth_providers.py`: Adds `avatar_url`, `auth_provider`, `provider_id`, and `hashed_password` columns to `doctors` table.
- `003_add_doctor_onboarding_and_services.py`:
  - Upgrades `doctors.avatar_url` from `String(255)` to `Text` to support data URLs.
  - Adds `speciality`, `bio`, and `onboarding_completed` columns to `doctors`.
  - Adds `clinic_name`, `location`, and 4 service toggle columns (`service_appointment`, `service_video_consultation`, `service_medicine_inventory`, `service_lab_reports`) to `tenants`.

---

#### [`backend/tests/`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/tests/)

**Purpose:** Automated test suites using SQLite in-memory engine with `StaticPool`.
- `test_health_and_models.py`: Verifies root health, v1 health, database connectivity check, CORS headers, and OpenAPI schema routes.
- `test_auth.py`: Verifies email and Google authentication, password hashing, JWT tokens, and slug collisions.
- `test_profile_and_public.py`: Comprehensive test suite verifying:
  - Doctor profile retrieval and update (`GET/PUT /api/v1/doctor/profile`).
  - Live synchronization between doctor profile updates and public tenant responses (`GET /api/v1/public/tenants/{slug}`).
  - Public booking, report upload, and medicine order endpoints.
  - 404 handling for non-existent doctor slugs.
  - Strict 400 rejection when patients attempt actions on disabled services.

---

### Android Build Engine & APK Pipeline (`backend/app/services/` & `backend/app/api/routes/`)

---

#### [`backend/app/services/app_build_service.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/services/app_build_service.py)

**Purpose:** Core Android APK compilation orchestrator. Manages template cloning, doctor metadata injection, headless Gradle build execution, and built APK caching.

**Architectural Reasoning:** The build service operates entirely independently of the request lifecycle. When a doctor triggers a build from the Dashboard, the API endpoint creates a UUID `build_id`, clones the `android-template/` into an isolated workspace (`builds/workspaces/{build_id}/`), injects all doctor-specific configuration, then spawns a **daemon thread** to run `./gradlew assembleRelease --no-daemon`. This thread-based design means the HTTP request returns immediately (202 Accepted) while the 2–5 minute Gradle compilation runs in the background. The frontend polls `/build/{task_id}/status` to track progress.

**Key Functions:**
- `sanitize_package_segment(name, fallback)`: Cleans arbitrary strings into valid Android package name segments (lowercase alphanumeric, no leading digits).
- `compute_app_identity(doctor, tenant)`: Derives unique `app_name` (from clinic name) and `package_name` (`com.docspace.{doctor}.{clinic}`) for APK identification.
- `prepare_project_workspace(build_id, doctor, tenant, custom_icon_path)`: Clones `android-template/` into `builds/workspaces/{build_id}/`, then performs **5 injection steps**:
  1. **`build.gradle.kts`**: Replaces `{{PACKAGE_NAME}}` with computed `applicationId`.
  2. **`strings.xml`**: Replaces `{{APP_NAME}}` with XML-escaped clinic name.
  3. **`DoctorConfig.kt`**: Replaces 14 `{{PLACEHOLDER}}` tokens with doctor metadata (name, speciality, bio, services, contact info).
  4. **`local.properties`**: Writes `sdk.dir` pointing to Android SDK path.
  5. **Custom icon**: Copies uploaded launcher icon to `res/drawable/custom_icon.png` if available.
- `run_gradle_build(build_id, workspace_path, identity)`: Executes `./gradlew assembleRelease --no-daemon --stacktrace` in a background thread. Auto-detects Android SDK (`~/Library/Android/sdk`) and Java Home (Android Studio JBR). Streams stdout/stderr to `builds/logs/{build_id}.log`. On success, copies APK to `builds/apks/{clinic}_{build_id[:8]}.apk`. Falls back to debug APK if release variant is missing.
- `trigger_app_build(doctor, tenant, custom_icon_path)`: Entry point called by the API route. Creates build_id, prepares workspace, spawns daemon thread, returns task info immediately.
- `get_build_status(build_id)`: Checks in-memory `_BUILD_TASKS` cache or scans `builds/apks/` directory for matching files.
- `get_build_logs(build_id)`: Returns full text content from `builds/logs/{build_id}.log`.
- `get_latest_doctor_apk(doctor, tenant)`: Checks if a previously built APK matching the doctor's clinic segment exists in `builds/apks/`, enabling the dashboard to show a "Download" button without requiring a rebuild.

**Thread Safety:** Uses `threading.Lock` (`_LOCK`) to guard the shared `_BUILD_TASKS` dictionary, which stores build status, progress (0–100%), APK path, and error messages.

**Key Directories:**
```
backend/builds/
├── apks/           ← Final compiled APK files (named: {clinic}_{build_id[:8]}.apk)
├── workspaces/     ← Isolated per-build android-template clones (deleted after use)
└── logs/           ← Full Gradle compilation output logs ({build_id}.log)
```

**Build Timeout:** 300 seconds (5 minutes). If Gradle doesn't complete, the build is marked as `failed` with a timeout error.

**APK Caching Strategy:** After the first successful build, subsequent calls to `get_latest_doctor_apk()` immediately return the cached APK metadata without triggering a recompile. A doctor must explicitly press "Rebuild" in the dashboard to trigger a fresh compilation (e.g., after changing their profile photo or clinic name).

---

#### [`backend/app/api/routes/app_build.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/app_build.py)

**Purpose:** REST API routes under `/api/v1/doctor/app/` for the Android APK builder feature.

**Key endpoints:**
- `GET /preview`: Returns app branding preview (computed app name, package name, custom icon status) and the latest built APK info if one exists. Used by the Dashboard to pre-populate the Android App section.
- `POST /icon`: Accepts `multipart/form-data` image upload (PNG/JPG). Saves to `backend/uploads/icons/icon_{doctor_id}_{hex}.{ext}` and updates `doctor.app_icon_url` in the database.
- `POST /build` (202): Triggers `trigger_app_build()` in background. Returns `task_id`, status, app_name, and package_name immediately.
- `GET /build/{task_id}/status`: Returns current build progress (`preparing` → `compiling` → `completed` | `failed`), progress percentage, APK path, file size, and error message if failed.
- `GET /build/{task_id}/logs`: Returns the full Gradle compilation output for debugging build failures.
- `GET /download/{task_id}` **[UNAUTHENTICATED]**: Returns `FileResponse` with `application/vnd.android.package-archive` MIME type. Deliberately unauthenticated so doctors can share a direct download link or QR code with patients for APK sideloading.

**Authentication Design Decision:** All endpoints except `download` require Bearer JWT authentication via `get_current_doctor` dependency. The download endpoint is intentionally unauthenticated because:
1. Doctors share APK download links with patients who don't have platform accounts.
2. QR codes printed on clinic materials need to work without login.
3. The `task_id` (UUID) acts as an unguessable capability token.

---

### Native Android App Template (`android-template/`)

---

#### [`android-template/`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/android-template/) — Overview

**Purpose:** Fully decoupled, standalone Jetpack Compose Android project serving as the **compilation template** for per-doctor white-labeled native apps.

**Architectural Reasoning:** Rather than building a single universal Android app that fetches data from an API (requiring internet connectivity and backend uptime), DocSpace takes a **template injection approach**. Each doctor gets a standalone APK with their profile, services, and branding compiled directly into the binary via `DoctorConfig.kt`. This means:
- **Offline-first**: The app works without any network connection after installation.
- **Zero backend dependency**: Patients don't need to register on DocSpace — the app is self-contained.
- **White-label isolation**: Each doctor's APK has a unique `applicationId` (`com.docspace.{doctor}.{clinic}`), so multiple doctor apps can coexist on the same device.

**Template Stack:**
| Technology | Version | Purpose |
| :--- | :--- | :--- |
| Kotlin | 2.0+ | Primary language |
| Jetpack Compose | BOM 2024.01.00 | Declarative UI framework |
| Material3 | Latest | Design system (dynamic colors) |
| Android SDK | compileSdk 34, minSdk 24, targetSdk 34 | API level targeting |
| Java | 17 (Android Studio JBR) | Compilation toolchain |
| Gradle Kotlin DSL | 8.x | Build system |

---

#### [`android-template/app/build.gradle.kts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/android-template/app/build.gradle.kts)

**Purpose:** Gradle build configuration with injectable `applicationId` placeholder.

**Key details:**
- `namespace = "com.docspace.template"` — fixed namespace for R class resolution (never changes).
- `applicationId = "{{PACKAGE_NAME}}"` — placeholder replaced by `prepare_project_workspace()` with `com.docspace.{doctor}.{clinic}`.
- `compileSdk = 34`, `minSdk = 24`, `targetSdk = 34`.
- Release build type uses debug signing config (no keystore required for sideloading).
- `composeOptions.kotlinCompilerExtensionVersion = "1.5.8"`.

---

#### [`android-template/app/src/main/kotlin/com/docspace/template/config/DoctorConfig.kt`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/android-template/app/src/main/kotlin/com/docspace/template/config/DoctorConfig.kt)

**Purpose:** Template configuration object with 14 injectable placeholders. All values are `const` so they're inlined at compile time for maximum performance.

**Injected fields:**
| Placeholder | Kotlin Type | Source |
| :--- | :--- | :--- |
| `{{DOCTOR_NAME}}` | String | `doctor.full_name` |
| `{{CLINIC_NAME}}` | String | `tenant.clinic_name` |
| `{{SPECIALITY}}` | String | `doctor.speciality` or "Healthcare Practitioner" |
| `{{BIO}}` | String (raw) | `doctor.bio` |
| `{{LOCATION}}` | String | `tenant.location` |
| `{{AVATAR_URL}}` | String | `doctor.avatar_url` |
| `{{PHONE}}` | String | `doctor.phone` |
| `{{EMAIL}}` | String | `doctor.email` |
| `{{SLUG}}` | String | `tenant.slug` |
| `{{SERVICE_APPOINTMENT}}` | Boolean | `tenant.service_appointment` |
| `{{SERVICE_VIDEO_CONSULTATION}}` | Boolean | `tenant.service_video_consultation` |
| `{{SERVICE_MEDICINE_INVENTORY}}` | Boolean | `tenant.service_medicine_inventory` |
| `{{SERVICE_LAB_REPORTS}}` | Boolean | `tenant.service_lab_reports` |

---

#### Android Template UI Components

**File tree:**
```
android-template/app/src/main/kotlin/com/docspace/template/
├── MainActivity.kt              ← Entry Activity, sets Compose content
├── config/DoctorConfig.kt       ← Injected doctor metadata (see above)
├── ui/
│   ├── screens/
│   │   └── HomeScreen.kt        ← Main screen with tab navigation (Profile & Services)
│   ├── components/
│   │   ├── DoctorHeroProfile.kt ← Doctor avatar, name, speciality, verified badge
│   │   ├── DocSpaceTopBar.kt    ← Material3 top app bar with clinic name
│   │   ├── DocSpaceFooter.kt    ← App footer with branding
│   │   ├── AppointmentBookingCard.kt  ← In-clinic appointment booking form
│   │   ├── VideoConsultationCard.kt   ← Telehealth video scheduling form
│   │   ├── MedicineDeliveryCard.kt    ← Pharmacy medicine ordering form
│   │   └── LabDiagnosticsCard.kt      ← Lab report upload/viewing card
│   └── theme/
│       ├── Color.kt             ← DocSpace color palette (Slate, Brand, Emerald, Indigo)
│       ├── Theme.kt             ← Material3 light/dark theme configuration
│       └── Type.kt              ← Typography definitions
```

---

### Operational Scripts (Project Root)

---

#### [`start-servers.sh`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/start-servers.sh) (alias: [`start.sh`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/start.sh))

**Purpose:** One-command launcher for the full DocSpace platform (Backend + Frontend).

**Behavior:**
1. Creates `.pids/` and `logs/` directories.
2. Checks if port 8000 is already in use — if not, starts `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` via the backend `.venv`.
3. Checks if port 3000 is already in use — if not, starts `npm run dev`.
4. Records PIDs to `.pids/backend.pid` and `.pids/frontend.pid`.
5. Streams server output to `logs/backend.log` and `logs/frontend.log`.

**Usage:** `./start.sh` or `npm run servers:start`

---

#### [`stop-servers.sh`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/stop-servers.sh) (alias: [`stop.sh`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/stop.sh))

**Purpose:** Gracefully terminates both platform servers.

**Behavior:**
1. Reads PIDs from `.pids/` files and sends `SIGTERM`.
2. Also scans ports 3000 and 8000 via `lsof` to catch any orphaned processes.
3. Falls back to `SIGKILL` if processes don't terminate within 0.5 seconds.
4. Verifies port release and reports success/failure.

**Usage:** `./stop.sh` or `npm run servers:stop`

---

#### [`start-tunnel.sh`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/start-tunnel.sh)

**Purpose:** Opens a Pinggy SSH tunnel for remote access to the local Next.js frontend.

**Behavior:** SSH to `a.pinggy.io` on port 443 with reverse tunnel to `localhost:3000`. Auto-reconnects on disconnect with 3-second backoff.

**Usage:** `./start-tunnel.sh` or `npm run tunnel:pinggy`

---

### Updated Frontend API Client

---

#### [`lib/api.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/lib/api.ts) — Phase 6 Additions

**New TypeScript Interfaces:**
- `AppPreviewResponse`: `{ app_name, package_name, has_custom_icon, app_icon_url, latest_apk }`
- `AppBuildStartResponse`: `{ message, task_id, status, app_name, package_name }`
- `AppBuildStatusResponse`: `{ task_id, status, progress, app_name, package_name, apk_path, apk_filename, file_size, error }`

**New API Methods:**
- `getAppPreview()`: `GET /api/v1/doctor/app/preview` [Protected] — fetches app branding and cached APK.
- `uploadAppIcon(file)`: `POST /api/v1/doctor/app/icon` [Protected] — uploads custom launcher icon.
- `triggerAppBuild()`: `POST /api/v1/doctor/app/build` [Protected] — starts background Gradle compilation.
- `getAppBuildStatus(taskId)`: `GET /api/v1/doctor/app/build/{taskId}/status` [Protected] — polls build progress.
- `getAppBuildLogs(taskId)`: `GET /api/v1/doctor/app/build/{taskId}/logs` [Protected] — retrieves compilation log.
- `getAppDownloadUrl(taskId)`: Returns `${API_URL}/api/v1/doctor/app/download/{taskId}` — direct URL for APK download.

---

### Dashboard Android App Builder UI

---

#### [`app/dashboard/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/dashboard/page.tsx) — Phase 6 Additions

**New UI Sections (appended to existing dashboard):**

- **App Branding Preview Card:** Shows computed app name, package name, and custom icon upload button.
- **Build & Compilation Controls:**
  - "Build Android App" / "Rebuild Android App" button triggers `triggerAppBuild()`.
  - Live progress bar animating from 0% → 100% during compilation.
  - Package name and status label ("Compiling...", "Completed", "Failed").
- **Terminal-Style Build Log Console:** Togglable dark terminal panel (`bg-slate-900 font-mono`) streaming real-time Gradle compilation output via `getAppBuildLogs()`. Auto-scrolls to bottom.
- **APK Download Section:** On successful build, shows file size, APK filename, download button using `getAppDownloadUrl(taskId)`, and "Copy Download Link" clipboard action for sharing with patients.
- **Build Polling:** `useEffect` with 3-second `setInterval` that polls `getAppBuildStatus(taskId)` until status is `completed` or `failed`. Automatically fetches latest logs when log console is visible.

---

## 6. "What File Do I Open?" Quick Reference

### Frontend
| I want to change... | Open this file | What to edit |
| :--- | :--- | :--- |
| **Brand primary color** | [`tailwind.config.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/tailwind.config.ts) | `theme.extend.colors.brand.600` (and neighboring shades) |
| **Browser tab title / SEO description** | [`app/layout.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/layout.tsx) | `export const metadata` object |
| **Navbar links or logo** | [`Navbar.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/Navbar.tsx) | Nav links, logo, and mobile dropdown |
| **Hero headline, copy, or mockups** | [`Hero.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/components/landing/Hero.tsx) | Left column text & right column device mockup JSX |
| **Doctor Onboarding Wizard (Steps 1-3)** | [`app/onboarding/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/onboarding/page.tsx) | Step indicators, form fields, photo upload, service cards, and launch preview |
| **Speciality suggestion pills** | [`app/onboarding/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/onboarding/page.tsx) | `SPECIALITY_SUGGESTIONS` array |
| **Default healthcare avatar fallback** | [`lib/api.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/lib/api.ts) | `DEFAULT_DOCTOR_AVATAR` SVG constant |
| **Doctor Dashboard profile & service editor** | [`app/dashboard/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/dashboard/page.tsx) | In-dashboard profile form, service switches, and live link card |
| **Patient Webpage Layout & Navigation Tabs** | [`app/[slug]/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/%5Bslug%5D/page.tsx) | Sticky tab navigation bar, `activeTab` state, and view switching |
| **Patient Webpage Home Section** | [`app/[slug]/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/%5Bslug%5D/page.tsx) | Hero profile, credentials, bio, 4 commitment pillars, and services showcase cards |
| **In-Clinic Appointment Booking View** | [`app/[slug]/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/%5Bslug%5D/page.tsx) | Service 1 section: date/slot picker, patient inputs, confirmation reference |
| **Video Consultation Scheduling View** | [`app/[slug]/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/%5Bslug%5D/page.tsx) | Service 2 section: telehealth date/time slots, symptoms notes, confirmation screen |
| **Medicine Orders & Pharmacy View** | [`app/[slug]/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/%5Bslug%5D/page.tsx) | Service 3 section: medicine inputs, delivery address, order submission |
| **Lab Reports Upload View** | [`app/[slug]/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/%5Bslug%5D/page.tsx) | Service 4 section: PDF/scan file uploader, report category, tracking receipt |
| **Patient Route Alias (`/dr/[slug]`)** | [`app/dr/[slug]/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/dr/%5Bslug%5D/page.tsx) | Re-exports `app/[slug]/page.tsx` |
| **Frontend API client & type interfaces** | [`lib/api.ts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/lib/api.ts) | Types (`ServicesConfig`, `PublicDoctorProfileResponse`, `AppBuildStatusResponse`), API request helpers |
| **Dashboard APK Builder UI** | [`app/dashboard/page.tsx`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/app/dashboard/page.tsx) | Build trigger button, progress bar, terminal log console, download section |

### Backend & Database
| I want to change... | Open this file | What to edit |
| :--- | :--- | :--- |
| **Database connection string** | [`backend/.env`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/.env) | `DATABASE_URL` variable |
| **Doctor database columns** | [`backend/app/models/doctor.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/doctor.py) | `Doctor` class mapped columns + Alembic migration |
| **Tenant database columns & services** | [`backend/app/models/tenant.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/models/tenant.py) | `Tenant` class mapped columns + service toggles |
| **Profile validation schemas** | [`backend/app/schemas/profile.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/schemas/profile.py) | `DoctorProfileUpdateRequest`, `ServicesConfig`, patient action schemas |
| **Doctor profile API endpoints** | [`backend/app/api/routes/doctor.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/doctor.py) | `get_doctor_profile`, `update_doctor_profile` route handlers |
| **Android APK build API endpoints** | [`backend/app/api/routes/app_build.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/app_build.py) | Preview, icon upload, build trigger, status poll, log fetch, download routes |
| **APK compilation & template injection logic** | [`backend/app/services/app_build_service.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/services/app_build_service.py) | `prepare_project_workspace`, `run_gradle_build`, `trigger_app_build` |
| **Public tenant & patient API endpoints** | [`backend/app/api/routes/public.py`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/app/api/routes/public.py) | `get_public_tenant`, `book_appointment`, `upload_report`, `order_medicine` |
| **Database Migrations** | [`backend/alembic/versions/`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/alembic/versions/) | Add new migration version scripts |
| **Automated backend tests** | [`backend/tests/`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/backend/tests/) | `test_auth.py`, `test_profile_and_public.py` |

### Android Template
| I want to change... | Open this file | What to edit |
| :--- | :--- | :--- |
| **Injected doctor metadata placeholders** | [`DoctorConfig.kt`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/android-template/app/src/main/kotlin/com/docspace/template/config/DoctorConfig.kt) | `{{PLACEHOLDER}}` tokens — must match `app_build_service.py` replacements |
| **Android app UI (Profile & Services)** | [`HomeScreen.kt`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/android-template/app/src/main/kotlin/com/docspace/template/ui/screens/HomeScreen.kt) | Main screen with tab navigation |
| **Android app color theme** | [`Color.kt`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/android-template/app/src/main/kotlin/com/docspace/template/ui/theme/Color.kt) | DocSpace palette (Slate, Brand, Emerald, Indigo) |
| **Gradle build config (SDK, compose)** | [`build.gradle.kts`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/android-template/app/build.gradle.kts) | compileSdk, minSdk, applicationId placeholder, compose version |
| **Android manifest & permissions** | [`AndroidManifest.xml`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/android-template/app/src/main/AndroidManifest.xml) | Internet permission, activity declarations, theme |

### Operational Scripts
| I want to change... | Open this file | What to edit |
| :--- | :--- | :--- |
| **Start both servers** | [`start-servers.sh`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/start-servers.sh) | Port detection, uvicorn command, npm dev command |
| **Stop both servers** | [`stop-servers.sh`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/stop-servers.sh) | Port scanning, PID cleanup, SIGTERM/SIGKILL logic |
| **Remote tunnel access** | [`start-tunnel.sh`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/start-tunnel.sh) | Pinggy SSH tunnel configuration |
| **npm script aliases** | [`package.json`](file:///Users/mdaffanahmed/VS%20Code/Full%20stack/Doctors%20Platform/package.json) | `servers:start`, `servers:stop`, `servers:restart` |

---

## 7. Critical Linkage Rules (Do Not Break)

These are implicit contracts between files. Breaking them causes silent visual, runtime, or navigation bugs.

| Rule | Files Involved | What breaks if violated |
| :--- | :--- | :--- |
| `onboarding_completed` flag must be checked on login/register | `EmailAuthForm.tsx`, `GoogleAuthForm.tsx` → `app/onboarding` | New doctors bypass onboarding and end up with unconfigured public webpages |
| `avatar_url` must remain `Text` (not `String(255)`) | `app/models/doctor.py`, `alembic` migration 003 | Uploading base64 image data URLs crashes with SQL string length error |
| 4 Service Toggle keys must match across models and schemas | `app/models/tenant.py` ↔ `schemas/profile.py` ↔ `lib/api.ts` | Service state fails to save or synchronize to the public patient page |
| Disabled services must return HTTP 400 on public submission | `backend/app/api/routes/public.py` | Patients could book or order disabled services via direct API calls |
| `app/dr/[slug]` must re-export `app/[slug]/page.tsx` | `app/dr/[slug]/page.tsx` → `app/[slug]/page.tsx` | `/dr/[slug]` patient links return 404 or diverge in styling |
| `DEFAULT_DOCTOR_AVATAR` must be a valid self-contained SVG data URL | `lib/api.ts` → `app/[slug]/page.tsx`, `onboarding`, `dashboard` | Broken avatar images appear before a doctor uploads their photo |
| `doctor_id` in `tenants` must remain `unique=True` | `app/models/tenant.py` | Breaks 1:1 doctor-tenant workspace isolation guarantee |
| `CORS_ORIGINS` must include frontend port (`http://localhost:3000`) | `backend/.env` → `app/main.py` | Browser blocks frontend API requests with CORS errors |
| `TOKEN_STORAGE_KEY` must match across auth helpers | `lib/api.ts` | Token persistence or logout fails to clear active JWT session |
| `hash_password` salt format must be `hex$hex` | `security.py` `hash_password` ↔ `verify_password` | Password verification always fails, locking out all email-registered doctors |
| `DoctorConfig.kt` placeholder tokens must match `app_build_service.py` replacements | `DoctorConfig.kt` ↔ `app_build_service.py` `prepare_project_workspace()` | Uninjected `{{PLACEHOLDER}}` tokens cause Kotlin compilation errors or show raw template strings in the app |
| `namespace` in `build.gradle.kts` must stay `com.docspace.template` | `android-template/app/build.gradle.kts` | Changing namespace breaks R class imports across all UI components |
| `android:name` in `AndroidManifest.xml` must be `com.docspace.template.MainActivity` | `AndroidManifest.xml` | App crashes with `ClassNotFoundException` on launch |
| APK download endpoint (`/download/{task_id}`) must remain unauthenticated | `backend/app/api/routes/app_build.py` | Patients receive 401 Unauthorized when clicking shared download links |
| `builds/apks/` naming pattern must be `{clinic}_{build_id[:8]}.apk` | `app_build_service.py` `run_gradle_build` ↔ `get_latest_doctor_apk` | APK caching breaks — dashboard can't find previously built APKs |

---

## 8. Future Phase Extension Points

When future phases are implemented, here are the exact extension points:

| Feature Phase | Status | Where to Add / Extend |
| :--- | :--- | :--- |
| **Foundation & Landing (Phase 1)** | **Complete** | Public marketing landing page, brand system, and responsive shell |
| **Backend & DB Foundation (Phase 2)** | **Complete** | FastAPI, PostgreSQL, SQLAlchemy 2.x, Alembic, `Doctor` + `Tenant` models |
| **Auth & Doctor Registration (Phase 3)** | **Complete** | Email/Password & Google auth, PBKDF2 hashing, JWT tokens, auto-provisioning |
| **Doctor Onboarding & Live Profile Sync (Phase 4)** | **Complete** | 3-step wizard (`/onboarding`), profile photo upload + fallback, 4-service toggles, `/dashboard` live sync editor |
| **Patient-Facing Webpage Architecture (Phase 5)** | **Complete** | Sticky tabs, Practice Home (credentials, philosophy, commitment pillars, service cards), dedicated service views, public API endpoints with feature toggle enforcement |
| **Native Android APK Builder (Phase 6)** | **Complete** | Jetpack Compose template, `AppBuildService`, Gradle headless compilation, dashboard build UI, APK caching, `start-servers.sh` / `stop-servers.sh` operational scripts |
| **Custom Branding & Subdomain Routing (Phase 7)** | Next | Add `app/models/branding.py`, Next.js `middleware.ts` host header routing for `[subdomain].docspace.com` |
| **Patient Management & Clinical Records (Phase 8)** | Planned | Add `app/models/patient.py`, `app/models/appointment.py`, doctor dashboard patient charts & EHR |
| **Payment Gateway Integration (Phase 9)** | Planned | Stripe / Razorpay checkout integration for appointment fees and medicine orders |

---

## 9. Coding Agent Rules

### Frontend Rules
1. **Always use `@/*` imports** — never use relative imports like `../../components/...`
2. **Run `npx tsc --noEmit` before declaring a frontend change complete** — zero type errors required
3. **Add `"use client"` only when the component uses `useState`, `useEffect`, or browser APIs** — keep components as server components by default
4. **All styling via Tailwind classes** — no `style={{}}` props or separate `.module.css` files unless absolutely unavoidable
5. **Use `brand-*` colors from `tailwind.config.ts`** — never hardcode hex values in component JSX
6. **Use `DEFAULT_DOCTOR_AVATAR` from `lib/api.ts`** as the fallback for doctor profile images

### Backend Rules
7. **Always write and run tests** in `backend/` before declaring backend changes complete
8. **Use Alembic migrations as source-of-truth** for all database schema evolution — maintain SQLite runtime helper in `database.py` for local dev
9. **Always use UUID primary keys** and inherit `TimestampMixin` for relational models
10. **Keep business logic modular** — implement only what the current phase requires; defer future tables/endpoints to their respective phases
11. **Environment variables through `pydantic-settings`** — never access `os.environ` directly in application logic; use `get_settings()`

### Android Template Rules
12. **Never change `namespace` in `build.gradle.kts`** — it must remain `com.docspace.template` for R class resolution; only `applicationId` is dynamic
13. **All new DoctorConfig fields must use `{{PLACEHOLDER}}` format** and have matching replacements in `app_build_service.py` `prepare_project_workspace()`
14. **Keep the template offline-first** — do not add network API calls; all doctor data comes from compiled `DoctorConfig.kt` constants
15. **Use Material3 and DocSpace theme colors** from `Color.kt` — never hardcode hex values in Compose composables
16. **Test template compilation** via `./gradlew assembleRelease` in `android-template/` after any template changes
