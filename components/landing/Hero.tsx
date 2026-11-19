import Link from "next/link";
import {
  ArrowRight,
  Globe,
  Building2,
} from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-gradient-to-b from-emerald-50/50 via-slate-50/20 to-white">
      {/* Ambient background soft glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-200/35 via-teal-100/20 to-transparent pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Value Proposition & CTAs */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              Empower Your Clinic with a Branded{" "}
              <span className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 bg-clip-text text-transparent">
                Digital Operating System.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Manage doctor schedules, book patient appointments, handle bills, and share lab reports—all from one simple place.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-md shadow-brand-600/25 hover:shadow-lg hover:shadow-brand-600/35 transition-all text-base"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#features"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-lg bg-white hover:bg-emerald-50/40 text-slate-700 hover:text-emerald-800 font-semibold border border-slate-300 hover:border-emerald-200 shadow-sm transition-all text-base"
              >
                Explore Features
              </a>
            </div>
          </div>

          {/* Right Column: Visual CSS Mockup (Clinic Browser) */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Decorative subtle backdrop glow */}
              <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-200/70 via-teal-100/50 to-emerald-100/60 rounded-2xl blur-xl opacity-80 -z-10" />

              {/* Website Mockup Card */}
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xl overflow-hidden transition-transform duration-300">
                {/* Browser Top Bar */}
                <div className="bg-slate-100/80 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  </div>
                  <div className="bg-white px-3 py-0.5 rounded text-[11px] text-slate-500 font-mono flex items-center gap-1 border border-slate-200">
                    <Globe className="w-3 h-3 text-emerald-600" />
                    <span>carewellpolyclinic.gosmartclinic.com</span>
                  </div>
                  <div className="w-6" />
                </div>

                {/* Website Inner Content Preview: Clinic Portal */}
                <div className="p-4 bg-white space-y-3">
                  {/* Clinic Header */}
                  <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            CareWell Polyclinic & Diagnostics
                          </h4>
                          <span className="text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.2 rounded">
                            Verified
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          14 On-Duty Doctors &middot; Open Daily 8 AM - 9 PM
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Doctor Roster Snippet */}
                  <div className="space-y-1.5">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center">
                          SJ
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-[11px]">Dr. Sarah Johnson</p>
                          <p className="text-[10px] text-emerald-600">Cardiology &middot; Slot: 3:00 PM</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Available
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 font-bold text-[10px] flex items-center justify-center">
                          AR
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-[11px]">Dr. Alex Rivera</p>
                          <p className="text-[10px] text-teal-600">Pediatrics &middot; Slot: 4:30 PM</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Available
                      </span>
                    </div>
                  </div>

                  {/* Clinic Services Badges */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px] text-center">
                    <div className="p-1 rounded bg-slate-50 border border-slate-100 font-medium text-slate-700">
                      Patient Queue
                    </div>
                    <div className="p-1 rounded bg-slate-50 border border-slate-100 font-medium text-slate-700">
                      Lab Tests
                    </div>
                    <div className="p-1 rounded bg-slate-50 border border-slate-100 font-medium text-slate-700">
                      Pharmacy
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
