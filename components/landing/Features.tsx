import {
  Globe,
  Smartphone,
  Palette,
  LayoutDashboard,
} from "lucide-react";

interface FeatureItem {
  icon: typeof Globe;
  title: string;
  description: string;
  badge?: string;
}

const features: FeatureItem[] = [
  {
    icon: Globe,
    title: "Personalized Website",
    description:
      "Get a high-performance, responsive public website customized with your medical qualifications, practice bio, service list, and contact details.",
    badge: "Web Presence",
  },
  {
    icon: Smartphone,
    title: "Branded Mobile App",
    description:
      "Deliver a dedicated mobile application for your patients under your own brand identity for bookings, consultations, and care management.",
    badge: "Mobile Presence",
  },
  {
    icon: Palette,
    title: "Complete Brand Control",
    description:
      "Configure your clinic name, logo, color theme, typography, profile narrative, and public services without writing a single line of code.",
    badge: "White-Label",
  },
  {
    icon: LayoutDashboard,
    title: "One Central Platform",
    description:
      "Manage your appointments, patient inquiries, service catalogs, and digital touchpoints seamlessly from a unified, intuitive dashboard.",
    badge: "All-in-One",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 bg-slate-50 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-xs font-semibold text-brand-600 uppercase tracking-widest">
            Platform Capabilities
          </h2>
          <p className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Everything You Need to Own Your Digital Healthcare Brand
          </p>
          <p className="text-base sm:text-lg text-slate-600">
            A comprehensive, multi-tenant solution designed specifically for modern doctors,
            clinics, and healthcare specialists.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-200 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
                      <Icon className="w-6 h-6" />
                    </div>
                    {feature.badge && (
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {feature.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
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
