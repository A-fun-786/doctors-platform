# DocSpace — Multi-Tenant White-Label Doctor Platform

A modern B2B SaaS platform enabling doctors and healthcare specialists to create, brand, and manage their dedicated digital presence, personalized website, and patient mobile application from a single dashboard.

## Screenshots

### 1. Homepage — Hero Section (`/`)
The public marketing landing page featuring the "Your Digital Healthcare Presence, Built Around You" hero headline with live web profile and branded mobile app mockups.

![Homepage Hero](public/screenshots/01-homepage-hero.jpg)

---

### 2. How It Works — 3-Step Onboarding (`/#how-it-works`)
The 3-step connected onboarding journey: **Register Your Practice → Customize & Brand → Publish & Launch**, followed by the "One Unified Presence, Across Web & Mobile" live product preview section.

![How It Works](public/screenshots/02-how-it-works.jpg)

---

### 3. Doctor Login Portal (`/login`)
The secure Doctor authentication page — "Welcome Back, Doctor" — supporting Email/Password sign-in with JWT session security and Google Sign-In integration.

![Doctor Login](public/screenshots/03-doctor-login.jpg)

---

### 4. Doctor Onboarding Wizard (`/onboarding`)
Step 1 of 3 of the guided practice setup: **Practice & Doctor Details** form — Profile photo upload, Doctor full name, Clinic/Hospital name, and Primary Speciality selector with multiple specialities.

![Doctor Onboarding](public/screenshots/04-doctor-onboarding.jpg)

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

## Project Structure

```text
Doctors Platform/
├── app/
│   ├── layout.tsx         # Root layout with Inter font and global styles
│   ├── page.tsx           # Public platform landing page
│   ├── globals.css        # Tailwind directives and base styles
│   ├── login/
│   │   └── page.tsx       # Placeholder login page
│   └── register/
│       └── page.tsx       # Placeholder doctor registration page
│
├── components/
│   └── landing/
│       ├── Navbar.tsx     # Responsive navigation header
│       ├── Hero.tsx       # Hero section with dual CSS mockups & CTAs
│       ├── Features.tsx   # Core platform capabilities grid
│       ├── HowItWorks.tsx # 3-step connected onboarding process
│       ├── PreviewSection.tsx # Split website + mobile preview mockups
│       ├── CTA.tsx        # Final conversion section
│       └── Footer.tsx     # Platform footer with links
│
├── public/                # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── postcss.config.mjs
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm / yarn / pnpm

### Installation

```bash
npm install
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the landing page.

### Building for Production

```bash
npm run build
npm run start
```
