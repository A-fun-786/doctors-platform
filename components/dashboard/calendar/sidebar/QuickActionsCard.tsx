"use client";

import React from "react";
import { CalendarDays, Ban, RotateCw } from "lucide-react";

interface QuickActionsCardProps {
  onAddAppointment: () => void;
  onBlockTime: () => void;
  onSyncGoogle: () => void;
  syncingGoogle: boolean;
}

export default function QuickActionsCard({
  onAddAppointment,
  onBlockTime,
  onSyncGoogle,
  syncingGoogle,
}: QuickActionsCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2.5">
      <h3 className="text-xs font-bold text-slate-900 mb-2">Quick Actions</h3>

      <button
        type="button"
        onClick={onAddAppointment}
        className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all group"
      >
        <CalendarDays className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />
        <span>Add Appointment</span>
      </button>

      <button
        type="button"
        onClick={onBlockTime}
        className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all group"
      >
        <Ban className="w-4 h-4 text-slate-500 group-hover:text-amber-600" />
        <span>Block Time / Leave</span>
      </button>

      <button
        type="button"
        onClick={onSyncGoogle}
        disabled={syncingGoogle}
        className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all group disabled:opacity-60"
      >
        <RotateCw
          className={`w-4 h-4 text-slate-500 group-hover:text-blue-600 ${
            syncingGoogle ? "animate-spin" : ""
          }`}
        />
        <span>{syncingGoogle ? "Syncing..." : "Sync with Google Calendar"}</span>
      </button>
    </div>
  );
}
