import { UserPlus, Sliders, Rocket, CheckCircle } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: UserPlus,
    title: "Register Your Practice",
    description:
      "Sign up in minutes with your medical registration details, specialty, and practice credentials.",
  },
  {
    step: "02",
    icon: Sliders,
    title: "Customize & Brand",
    description:
      "Configure your clinic colors, profile bio, service catalog, consultation fees, and appointment preferences.",
  },
  {
    step: "03",
    icon: Rocket,
    title: "Publish & Launch",
    description:
      "Go live instantly with your dedicated web subdomain and ready-to-deploy branded mobile app for patients.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-xs font-semibold text-brand-600 uppercase tracking-widest">
            Streamlined Setup
          </h2>
          <p className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            How It Works
          </p>
          <p className="text-base sm:text-lg text-slate-600">
            Launch your branded online healthcare presence in three simple steps.
          </p>
        </div>

        {/* Steps Flow */}
        <div className="relative">
          {/* Connector Line (Desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-brand-200 via-brand-400 to-brand-200 -translate-y-12 z-0" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
            {steps.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center relative flex flex-col items-center hover:bg-slate-100/60 transition-colors"
                >
                  {/* Step Number Badge */}
                  <span className="absolute top-4 right-4 text-xs font-bold text-slate-400 font-mono">
                    STEP {item.step}
                  </span>

                  {/* Icon with Ring */}
                  <div className="w-16 h-16 rounded-full bg-white border-2 border-brand-500 shadow-sm flex items-center justify-center text-brand-600 mb-6 relative">
                    <Icon className="w-7 h-7" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-brand-600 rounded-full flex items-center justify-center text-white text-[10px]">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-xs">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
