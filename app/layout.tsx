import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocSpace — The Digital Healthcare Presence Platform for Doctors",
  description:
    "Empower your medical practice. Create and manage your own branded website and mobile application from one unified platform.",
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
