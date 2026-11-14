import Link from "next/link";
import BrandLogo from "@/components/brand/BrandLogo";
import { BRAND_CONFIG } from "@/config/brand.config";

export default function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-2">
            <BrandLogo size="md" variant="dark" />
            <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
              {BRAND_CONFIG.description}
            </p>
          </div>

          {/* Links: Platform */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3 uppercase tracking-wider text-xs">
              Platform
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="#features" className="hover:text-white transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-white transition-colors">
                  Doctor Registration
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Doctor Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Links: Company & Legal */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3 uppercase tracking-wider text-xs">
              Company
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="#about" className="hover:text-white transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-white transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="#privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#terms" className="hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>{BRAND_CONFIG.copyright()}</p>
          <p>Multi-Tenant White-Label Healthcare Infrastructure</p>
        </div>
      </div>
    </footer>
  );
}
