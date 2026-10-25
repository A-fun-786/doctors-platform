import type { Metadata } from "next";
import "./globals.css";
import { BRAND_CONFIG } from "@/config/brand.config";

export const metadata: Metadata = {
  title: BRAND_CONFIG.formatMetaTitle(),
  description: BRAND_CONFIG.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased text-slate-900 bg-white">{children}</body>
    </html>
  );
}
