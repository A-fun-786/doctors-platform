import {
  Globe,
  Calendar,
  FlaskConical,
  Pill,
  ShieldCheck,
  Star,
  Building2,
  Users,
} from "lucide-react";

export default function PreviewSection() {
  return (
    <section className="py-20 bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-950 border border-brand-800 text-brand-300 text-xs font-semibold uppercase tracking-wider">
            Live Preview
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Your Clinic&apos;s Own Website
          </h2>
          <p className="text-base sm:text-lg text-slate-300">
            See how your clinic website looks to your patients—clean, professional, and easy to book from any phone or computer.
          </p>
        </div>

        {/* Centered Web Portal Preview */}
        <div className="max-w-4xl mx-auto">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold mb-2">
              <Globe className="w-4 h-4 text-brand-400" />
              <span>Clinic Website Preview</span>
            </div>

            {/* Browser Frame */}
            <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800 shadow-2xl">
              {/* Browser Header Bar */}
              <div className="bg-slate-800/90 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <div className="bg-slate-900 px-4 py-1 rounded-md text-xs font-mono text-slate-300 border border-slate-700 flex items-center gap-2 max-w-xs truncate">
                  <span className="text-emerald-400 text-[10px]">https://</span>
                  <span>carewellpolyclinic.gosmartclinic.com</span>
                </div>
                <div className="w-12" />
              </div>

              {/* Website Body Content */}
              <div className="p-6 bg-slate-950 text-slate-100 space-y-6">
                {/* Clinic Header Banner inside Mockup */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                  <div className="flex items-center space-x-4">
                    {/* Clinic Avatar / Badge */}
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white font-bold text-xl ring-4 ring-slate-800 shrink-0">
                      <Building2 className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-white">
                          CareWell Polyclinic & Diagnostics
                        </h3>
                        <ShieldCheck className="w-4 h-4 text-brand-400" />
                      </div>
                      <p className="text-sm text-brand-400 font-medium">
                        Multi-Specialty Healthcare &middot; 14 Specialist Doctors
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-amber-400" /> 8 Departments
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> 4.9 (1,840+ Reviews)
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs shadow transition-colors shrink-0"
                  >
                    Book Appointment
                  </button>
                </div>

                {/* Multi-Doctor Roster Snippet */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    On-Duty Specialists Today
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-bold text-[10px]">
                          SJ
                        </div>
                        <div>
                          <p className="font-semibold text-white">Dr. Sarah Johnson</p>
                          <p className="text-[10px] text-brand-400">Cardiology &middot; Slot: 3:00 PM</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">Token #12</span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-teal-950 text-teal-400 border border-teal-800 flex items-center justify-center font-bold text-[10px]">
                          AR
                        </div>
                        <div>
                          <p className="font-semibold text-white">Dr. Alex Rivera</p>
                          <p className="text-[10px] text-teal-400">Pediatrics &middot; Slot: 4:30 PM</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">Token #08</span>
                    </div>
                  </div>
                </div>

                {/* Available Clinic Services */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Clinic Facilities
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-brand-400" />
                        <span className="font-medium text-white">Doctor Appointments</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="w-4 h-4 text-brand-400" />
                        <span className="font-medium text-white">Pathology Labs</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Pill className="w-4 h-4 text-brand-400" />
                        <span className="font-medium text-white">Clinic Pharmacy</span>
                      </div>
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
