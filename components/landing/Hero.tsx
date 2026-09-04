import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Globe,
  Smartphone,
  Calendar,
  Video,
  FileText,
  Pill,
  CheckCircle2,
} from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Value Proposition & CTAs */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multi-Tenant Healthcare Platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              Your Digital Healthcare Presence,{" "}
              <span className="text-brand-600">Built Around You.</span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Establish and elevate your medical practice with a personalized,
              custom-branded website and native mobile application. Control your
              brand, profile, and patient touchpoints seamlessly from a single
              platform.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-md hover:shadow-lg transition-all text-base"
              >
                <span>Create Your Digital Presence</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#features"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-300 shadow-sm transition-colors text-base"
              >
                Explore Platform
              </a>
            </div>

            {/* Quick Benefits / Trust Badges */}
            <div className="pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Custom Domain & Brand</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Dedicated Mobile App</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600 text-sm">
                <CheckCircle2 className="w-4 h-4 text-brand-600 shrink-0" />
                <span>Unified Management</span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual CSS Mockups (Browser + Phone) */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Decorative subtle backdrop glow */}
              <div className="absolute -inset-1.5 bg-gradient-to-r from-brand-100 to-slate-100 rounded-2xl blur-lg opacity-70 -z-10" />

              {/* Website Mockup Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden mb-6 transform -rotate-1 hover:rotate-0 transition-transform duration-300">
                {/* Browser Top Bar */}
                <div className="bg-slate-100 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  </div>
                  <div className="bg-white px-3 py-0.5 rounded text-[11px] text-slate-500 font-mono flex items-center gap-1 border border-slate-200">
                    <Globe className="w-3 h-3 text-slate-400" />
                    <span>drsarahjohnson.platform.com</span>
                  </div>
                  <div className="w-6" />
                </div>

                {/* Website Inner Content Preview */}
                <div className="p-4 bg-white">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-brand-100 border-2 border-brand-500 flex items-center justify-center text-brand-700 font-bold text-base shrink-0">
                      SJ
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          Dr. Sarah Johnson
                        </h4>
                        <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
                          Verified
                        </span>
                      </div>
                      <p className="text-xs text-brand-600 font-medium">
                        Cardiologist &middot; 10+ Yrs Exp
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        Specializing in preventive cardiology & heart health.
                      </p>
                    </div>
                  </div>

                  {/* Quick service pills */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-[11px]">
                    <div className="flex items-center gap-1.5 p-1.5 rounded bg-slate-50 border border-slate-100 text-slate-700 font-medium">
                      <Video className="w-3 h-3 text-brand-600" />
                      <span>Online Consult</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1.5 rounded bg-slate-50 border border-slate-100 text-slate-700 font-medium">
                      <Calendar className="w-3 h-3 text-brand-600" />
                      <span>Clinic Visit</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile App Mockup Card (Overlapping) */}
              <div className="bg-slate-900 rounded-2xl p-2 shadow-2xl border-4 border-slate-800 max-w-[260px] mx-auto -mt-10 lg:-ml-6 relative z-10 transform rotate-2 hover:rotate-0 transition-transform duration-300">
                {/* Phone Speaker Notch */}
                <div className="w-16 h-1 bg-slate-700 rounded-full mx-auto mb-2" />

                {/* Mobile Screen */}
                <div className="bg-white rounded-xl p-3 text-slate-900 space-y-2.5">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <span className="text-[11px] font-bold text-brand-700 flex items-center gap-1">
                      <Smartphone className="w-3 h-3" /> Dr. Johnson App
                    </span>
                    <span className="text-[9px] text-slate-400">9:41 AM</span>
                  </div>

                  <div className="text-center py-1">
                    <div className="w-8 h-8 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center mx-auto mb-1">
                      SJ
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      Dr. Sarah Johnson
                    </p>
                    <p className="text-[9px] text-slate-500">Book Care & Services</p>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                    <div className="p-1.5 rounded bg-brand-50 border border-brand-100 text-slate-800 font-medium flex items-center gap-1">
                      <Video className="w-2.5 h-2.5 text-brand-600" />
                      <span>Consult</span>
                    </div>
                    <div className="p-1.5 rounded bg-brand-50 border border-brand-100 text-slate-800 font-medium flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5 text-brand-600" />
                      <span>Appt</span>
                    </div>
                    <div className="p-1.5 rounded bg-brand-50 border border-brand-100 text-slate-800 font-medium flex items-center gap-1">
                      <FileText className="w-2.5 h-2.5 text-brand-600" />
                      <span>Lab Tests</span>
                    </div>
                    <div className="p-1.5 rounded bg-brand-50 border border-brand-100 text-slate-800 font-medium flex items-center gap-1">
                      <Pill className="w-2.5 h-2.5 text-brand-600" />
                      <span>Medicine</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
