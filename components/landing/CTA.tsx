import Link from "next/link";
import { ArrowRight, ShieldCheck, Zap } from "lucide-react";

export default function CTA() {
  return (
    <section className="py-20 bg-brand-900 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-800/80 border border-brand-700 text-brand-200 text-xs font-semibold uppercase tracking-wider">
          <Zap className="w-3.5 h-3.5 text-brand-300" />
          <span>Get Started Today</span>
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Build Your Professional Digital Presence
        </h2>

        <p className="text-base sm:text-lg text-brand-100 max-w-2xl mx-auto leading-relaxed">
          Join doctors and healthcare providers who are delivering modern,
          personalized, and branded care experiences to their patients.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-white text-brand-900 hover:bg-brand-50 font-bold shadow-lg hover:shadow-xl transition-all text-base"
          >
            <span>Register as Doctor</span>
            <ArrowRight className="w-5 h-5 text-brand-600" />
          </Link>
        </div>

        <div className="pt-6 flex items-center justify-center gap-6 text-xs text-brand-200">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Secure Multi-Tenant Architecture
          </span>
          <span className="hidden sm:inline">&middot;</span>
          <span>Zero Code Setup</span>
          <span className="hidden sm:inline">&middot;</span>
          <span>Instant Subdomain Provisioning</span>
        </div>
      </div>
    </section>
  );
}
