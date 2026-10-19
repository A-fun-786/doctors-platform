import React from "react";
import { CheckCircle2 } from "lucide-react";

export default function SyncNotificationBanner() {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-start gap-2.5">
      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
      <p className="text-[11px] text-emerald-800 leading-relaxed">
        Your schedule is synced with Google Calendar. Changes will be reflected in both calendars.
      </p>
    </div>
  );
}
