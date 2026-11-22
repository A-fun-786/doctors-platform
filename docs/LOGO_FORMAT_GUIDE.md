# Logo File Formats — Industry Standard Guide & Hierarchy

A reference guide outlining industry standards, best practices, and hierarchy for using logo file formats in modern web, mobile, and digital applications.

---

## 1. Industry Standard Hierarchy: When to Use Which Format

| Rank | Format | Type | Primary Use Case | Key Advantages & Characteristics |
| :---: | :---: | :---: | :--- | :--- |
| **#1** | **SVG (`.svg`)** | Vector | **Web Navbar, Header, Footer, Hero** | • **Infinite scalability**: Never pixelates or blurs on 4K, 8K, or Retina screens.<br>• **Smallest file size**: Typically under 5 KB.<br>• **CSS stylable**: Supports dynamic color changes, theme switching (dark/light), and CSS animations. |
| **#2** | **WebP (`.webp`)** | Raster | **High-Performance Web Logos & Hero Banners** | • **Modern web standard**: Created by Google, supported by >97% of modern browsers.<br>• **High compression**: 25%–35% smaller file size compared to PNG with identical visual fidelity.<br>• Supports alpha transparency and lossless compression. |
| **#3** | **PNG (`.png`)** | Raster | **Universal Fallback & High-Res Screens (`@2x`)** | • **100% universal compatibility**: Supported across every browser, OS, and platform.<br>• Crisp alpha transparency.<br>• Standard for high-density displays (e.g., `logo@2x.png`). |
| **#4** | **ICO (`.ico`)** | Container | **Browser Tab Favicons** | • Supports multi-resolution containers (16x16, 32x32, 48x48) in a single file.<br>• Full backwards compatibility for legacy and desktop browsers. |
| **Avoid** | **JPG / JPEG (`.jpg`)** | Raster | **Photography only (Never for logos)** | • **No transparency support**: Forces a solid rectangular background (often white).<br>• Lossy compression creates visible artifacts, fuzziness, and blur around text and sharp vector edges. |

---

## 2. In-Depth Format Breakdown

### 2.1 SVG (Scalable Vector Graphics)
- **Best For**: Website headers, navigation bars, footers, inline icons.
- **Why**: SVG code describes shapes mathematically rather than as fixed pixel grids. It renders identically at 16px or 1600px width.
- **Limitation**: Not supported as a desktop OS application icon or legacy favicon without fallbacks.

### 2.2 WebP
- **Best For**: Web pages prioritizing fast loading speeds and high Core Web Vitals (LCP scores).
- **Why**: Drastically cuts bandwidth while preserving crisp transparent edges.
- **Best Practice**: Use inside a `<picture>` element with a PNG fallback, or serve automatically via Next.js `next/image`.

### 2.3 PNG (Portable Network Graphics)
- **Best For**: Universal web fallback, email templates, desktop applications, retina scaling.
- **Variants**:
  - `logo.png` (1x standard resolution)
  - `logo@2x.png` (2x high-density pixel resolution for Apple Retina and 4K displays)
  - `emblem-only.png` (Standalone square icon/symbol for compact views)

### 2.4 ICO & Apple Touch Icons (Favicon Ecosystem)
- **`favicon.ico`**: Root-level fallback for browser tabs and bookmarks.
- **`favicon-16.png` & `favicon-32.png`**: Modern browser tab icons.
- **`apple-touch-icon.png` (180x180)**: iOS Safari "Add to Home Screen" bookmarks.
- **`icon-192.png` & `icon-512.png`**: Android, Chrome, and PWA (Progressive Web App) home screen icons and splash screens.

---

## 3. Recommended Implementation Architecture

### 3.1 Next.js App Router Metadata (`app/layout.tsx`)
```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
};
```

### 3.2 HTML / Responsive `<picture>` Pattern
Delivers modern WebP to supported browsers while falling back to crisp `@2x` PNG on older clients:

```html
<picture>
  <source srcset="/logo.webp" type="image/webp" />
  <img 
    src="/logo.png" 
    srcset="/logo.png 1x, /logo@2x.png 2x" 
    width="334" 
    height="64" 
    alt="Go Smart Clinic Logo" 
    loading="eager" 
  />
</picture>
```

---

## 4. Quick Decision Matrix

| Where is the logo being displayed? | Recommended Format |
| :--- | :--- |
| **Website Navbar / Top Header** | SVG (Primary) or WebP (with PNG @2x fallback) |
| **Browser Tab (Favicon)** | `favicon.ico` + `favicon-32.png` |
| **Mobile App (iOS / Android Home Screen)** | `apple-touch-icon.png` (iOS), `icon-192.png` & `icon-512.png` (Android / PWA) |
| **Email Signatures / HTML Newsletters** | PNG (with absolute URL, e.g. `https://domain.com/logo.png`) |
| **Print / Stationery / Banners** | Vector PDF or SVG |
