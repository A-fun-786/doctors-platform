import {
  Globe,
  Smartphone,
  Video,
  Calendar,
  FlaskConical,
  Pill,
  Award,
  Clock,
  ShieldCheck,
  Star,
} from "lucide-react";

export default function PreviewSection() {
  return (
    <section className="py-20 bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-950 border border-brand-800 text-brand-300 text-xs font-semibold uppercase tracking-wider">
            Live Product Preview
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            One Unified Presence, Across Web & Mobile
          </h2>
          <p className="text-base sm:text-lg text-slate-300">
            See how your customized branding, qualifications, and patient services
            render seamlessly across dedicated web and mobile interfaces.
          </p>
        </div>

        {/* Visual Split Preview Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Doctor Website Mockup (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold mb-2">
              <Globe className="w-4 h-4 text-brand-400" />
              <span>Branded Doctor Website Preview</span>
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
                  <span>drsarahjohnson.platform.com</span>
                </div>
                <div className="w-12" />
              </div>

              {/* Website Body Content */}
              <div className="p-6 bg-slate-950 text-slate-100 space-y-6">
                {/* Doctor Header Banner inside Mockup */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                  <div className="flex items-center space-x-4">
                    {/* Avatar */}
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white font-bold text-xl ring-4 ring-slate-800 shrink-0">
                      SJ
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-white">
                          Dr. Sarah Johnson
                        </h3>
                        <ShieldCheck className="w-4 h-4 text-brand-400" />
                      </div>
                      <p className="text-sm text-brand-400 font-medium">
                        Cardiologist &middot; MBBS, MD (Cardiology)
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-amber-400" /> 10+ Years Experience
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> 4.9 (180+ Reviews)
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs shadow transition-colors shrink-0"
                  >
                    Book Consultation
                  </button>
                </div>

                {/* Bio snippet */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    About Doctor
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Senior consultant cardiologist specializing in cardiovascular health, hypertension
                    management, and non-invasive diagnostic evaluations.
                  </p>
                </div>

                {/* Available Services Grid */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Offered Services
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-brand-400" />
                        <span className="font-medium text-white">Online Video Consult</span>
                      </div>
                      <span className="text-slate-400 font-mono">$75</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-brand-400" />
                        <span className="font-medium text-white">Clinic Visit Booking</span>
                      </div>
                      <span className="text-slate-400 font-mono">$100</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Branded Mobile App Mockup (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-300 text-sm font-semibold mb-2">
              <Smartphone className="w-4 h-4 text-brand-400" />
              <span>Branded Mobile Application Preview</span>
            </div>

            {/* Mobile Device Frame */}
            <div className="max-w-[300px] mx-auto bg-slate-950 rounded-3xl p-3 border-4 border-slate-700 shadow-2xl">
              {/* Phone Speaker & Camera Notch */}
              <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-slate-950 rounded-full mr-3" />
                <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
              </div>

              {/* Phone Screen */}
              <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-4 border border-slate-800">
                {/* Status Bar */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-2">
                  <span className="font-semibold text-white">Dr. Sarah Johnson App</span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>09:41</span>
                  </div>
                </div>

                {/* Profile Widget inside App */}
                <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
                    SJ
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">Dr. Sarah Johnson</h5>
                    <p className="text-[10px] text-brand-400">Cardiologist &middot; 10+ Yrs</p>
                  </div>
                </div>

                {/* Services Title */}
                <div>
                  <p className="text-[11px] font-semibold text-slate-300 mb-2">
                    Patient Services
                  </p>

                  {/* 4 Service Cards */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-950 hover:bg-slate-800/80 p-2.5 rounded-lg border border-slate-800 flex flex-col items-center text-center space-y-1">
                      <div className="w-7 h-7 rounded-full bg-brand-900/60 text-brand-400 flex items-center justify-center">
                        <Video className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-white">Consultation</span>
                      <span className="text-[9px] text-slate-400">Audio / Video</span>
                    </div>

                    <div className="bg-slate-950 hover:bg-slate-800/80 p-2.5 rounded-lg border border-slate-800 flex flex-col items-center text-center space-y-1">
                      <div className="w-7 h-7 rounded-full bg-brand-900/60 text-brand-400 flex items-center justify-center">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-white">Appointment</span>
                      <span className="text-[9px] text-slate-400">In-Clinic Visit</span>
                    </div>

                    <div className="bg-slate-950 hover:bg-slate-800/80 p-2.5 rounded-lg border border-slate-800 flex flex-col items-center text-center space-y-1">
                      <div className="w-7 h-7 rounded-full bg-brand-900/60 text-brand-400 flex items-center justify-center">
                        <FlaskConical className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-white">Lab Tests</span>
                      <span className="text-[9px] text-slate-400">Reports & Orders</span>
                    </div>

                    <div className="bg-slate-950 hover:bg-slate-800/80 p-2.5 rounded-lg border border-slate-800 flex flex-col items-center text-center space-y-1">
                      <div className="w-7 h-7 rounded-full bg-brand-900/60 text-brand-400 flex items-center justify-center">
                        <Pill className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-white">Medicine</span>
                      <span className="text-[9px] text-slate-400">Prescriptions</span>
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
