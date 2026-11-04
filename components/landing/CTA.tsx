import Link from "next/link";
import { ArrowRight, ShieldCheck, Zap } from "lucide-react";

export default function CTA() {
  return (
    <section className="py-24 bg-gradient-to-br from-brand-950 via-brand-900 to-slate-950 text-white relative overflow-hidden">
      {/* Background decoration with Emerald/Mint grid */}
      <div 
        className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-15" 
        aria-hidden="true" 
      />

      {/* Soft ambient center glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-800/80 border border-brand-700/80 text-brand-200 text-xs font-semibold uppercase tracking-wider shadow-sm">
          <Zap className="w-3.5 h-3.5 text-brand-300" />
          <span>Get Started Today</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Build Your Professional Digital Presence
        </h2>

        <p className="text-base sm:text-lg text-brand-100/90 max-w-2xl mx-auto leading-relaxed">
          Join doctors and healthcare providers who are delivering modern,
          personalized, and branded care experiences to their patients.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white text-brand-950 hover:bg-emerald-50 font-bold shadow-xl shadow-brand-950/40 hover:shadow-2xl transition-all text-base hover:scale-[1.02]"
          >
            <span>Register as Doctor</span>
            <ArrowRight className="w-5 h-5 text-brand-600" />
          </Link>
        </div>

        <div className="pt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-brand-200/80">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Secure Multi-Tenant Architecture
          </span>
          <span className="hidden sm:inline text-brand-700">&middot;</span>
          <span>Zero Code Setup</span>
          <span className="hidden sm:inline text-brand-700">&middot;</span>
          <span>Instant Subdomain Provisioning</span>
        </div>
      </div>
    </section>
  );
}
