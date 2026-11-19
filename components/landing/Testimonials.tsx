import { Star, Building2, Quote, ShieldCheck, Sparkles } from "lucide-react";

interface TestimonialItem {
  name: string;
  designation: string;
  clinic: string;
  location: string;
  initials: string;
  rating: number;
  highlight: string;
  quote: string;
  metricBadge?: string;
}

const testimonials: TestimonialItem[] = [
  {
    name: "Dr. Rajesh Sharma",
    designation: "Medical Director & Senior Physician",
    clinic: "Apex Polyclinic & Diagnostic Center",
    location: "Mumbai",
    initials: "RS",
    rating: 5,
    highlight: "+42% More Appointments",
    quote:
      "Managing 14 visiting doctors with different timings used to be very stressful. GoSmartClinic gave our clinic its own branded website. Patient waiting times dropped drastically and our appointments grew by 42%.",
    metricBadge: "14 Doctors Managed",
  },
  {
    name: "Dr. Anita Deshmukh",
    designation: "Chief Surgeon & Co-Founder",
    clinic: "CareWell Multispecialty Clinic",
    location: "Pune",
    initials: "AD",
    rating: 5,
    highlight: "Zero Commission Fees",
    quote:
      "Instead of paying heavy commission fees to third-party listing apps, GoSmartClinic gave us our own direct clinic website. Patients book appointments directly and download their test reports online.",
    metricBadge: "2,500+ Patients Served",
  },
  {
    name: "Dr. Vikram Mehta",
    designation: "Senior Consultant & Clinic Owner",
    clinic: "Metro Health Center",
    location: "Delhi NCR",
    initials: "VM",
    rating: 5,
    highlight: "Ready in Under 45 Minutes",
    quote:
      "Setting up was incredibly simple. We configured 3 clinic branches, organized doctor schedules, and started sharing digital prescriptions in less than an hour. Automated reminders cut missed appointments by half.",
    metricBadge: "3 Branches Live",
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-20 sm:py-24 bg-white border-t border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5 text-brand-600" />
            <span>Success Stories</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Loved by Doctors &amp; Clinics
          </h2>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            See how doctors and clinic owners save hours each day, manage patient visits smoothly, and build lasting patient trust.
          </p>
        </div>


        {/* Metric Highlights Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14 max-w-4xl mx-auto">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">250+</p>
            <p className="text-xs text-slate-600 font-medium mt-0.5">Clinics Onboarded</p>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <p className="text-2xl sm:text-3xl font-extrabold text-brand-600">180K+</p>
            <p className="text-xs text-slate-600 font-medium mt-0.5">Appointments Booked</p>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900">99.9%</p>
            <p className="text-xs text-slate-600 font-medium mt-0.5">System Uptime</p>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-500">4.9 / 5</p>
            <p className="text-xs text-slate-600 font-medium mt-0.5">Doctor Satisfaction</p>
          </div>
        </div>

        {/* Testimonials Cards Grid (Responsive: 1-col mobile, 2-col tablet, 3-col desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl p-7 border border-slate-200 shadow-xs hover:shadow-xl hover:border-brand-300 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group relative"
            >
              <div>
                {/* Header: Star Rating & Highlight Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-1" aria-label={`${item.rating} out of 5 stars`}>
                    {[...Array(item.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  {item.metricBadge && (
                    <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-0.5 rounded-full">
                      {item.metricBadge}
                    </span>
                  )}
                </div>

                {/* Highlight text */}
                <p className="text-xs font-bold text-brand-700 uppercase tracking-wide mb-2.5">
                  {item.highlight}
                </p>

                {/* Quote text */}
                <div className="relative">
                  <Quote className="w-8 h-8 text-slate-100 absolute -top-4 -left-2 -z-10" />
                  <p className="text-sm text-slate-700 leading-relaxed italic relative z-10">
                    &ldquo;{item.quote}&rdquo;
                  </p>
                </div>
              </div>

              {/* Author Footer: Doctor Avatar + Name + Clinic */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-brand-600 to-teal-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {item.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {item.name}
                    </h4>
                    <span title="Verified Professional">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate">{item.designation}</p>
                  <p className="text-[11px] text-slate-400 font-medium truncate">
                    {item.clinic}, {item.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
