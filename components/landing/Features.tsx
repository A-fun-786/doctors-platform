import {
  ReceiptText,
  CalendarCheck,
  Building2,
  FlaskConical,
  Boxes,
} from "lucide-react";

interface FeatureItem {
  icon: typeof ReceiptText;
  title: string;
  description: string;
  badge?: string;
}

const features: FeatureItem[] = [
  {
    icon: ReceiptText,
    title: "Billing & Accounts",
    description:
      "Create quick bills and receipts for doctor visits, medicines, and tests. Track your daily payments without messy paperwork.",
    badge: "Billing & Invoices",
  },
  {
    icon: CalendarCheck,
    title: "Appointments",
    description:
      "Seamlessly manage appointment booking in your clinic with patient notifications.",
    badge: "Appointments & Queue",
  },
  {
    icon: Building2,
    title: "Doctor and Staff Management",
    description:
      "Add visiting doctors, set their consultation timings and fees, and manage clinic staff from one simple dashboard.",
    badge: "Staff & Timings",
  },
  {
    icon: Boxes,
    title: "Medicine Inventory Management",
    description:
      "Track medicine stocks, clinic supplies, expiry dates, and get low-stock alerts so you never run out of essentials.",
    badge: "Stock & Medicines",
  },
  {
    icon: FlaskConical,
    title: "Prescriptions & Lab Reports",
    description:
      "Write digital prescriptions and share test reports directly with patients so they never lose their medical records.",
    badge: "Prescriptions & Labs",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 sm:py-24 bg-slate-50/70 border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold uppercase tracking-wider">
            Simple &amp; Powerful Tools
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Everything Your Clinic Needs to Run Smoothly
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            Easy-to-use tools built to save your time, simplify daily clinic work, and give your patients a better experience.
          </p>
        </div>

        {/* Feature Grid: 1-col mobile, 2-col tablet, 3-col centered desktop */}
        <div className="flex flex-wrap justify-center gap-8">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="w-full md:w-[calc(50%-1rem)] lg:w-[calc((100%-4rem)/3)] bg-white rounded-2xl p-7 border border-slate-200/90 shadow-xs hover:shadow-lg hover:border-brand-300 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-200/60 flex items-center justify-center text-brand-600 group-hover:bg-brand-600 group-hover:text-white transition-colors duration-300">
                      <Icon className="w-6 h-6" />
                    </div>
                    {feature.badge && (
                      <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200/60 px-2.5 py-0.5 rounded-full">
                        {feature.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-brand-700 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
