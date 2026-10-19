"use client";

import React from "react";
import { RotateCw } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";

interface GoogleCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorEmail: string;
  onSync: () => void;
}

const GoogleIcon = (
  <div className="w-6 h-6 flex items-center justify-center shrink-0">
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  </div>
);

export default function GoogleCalendarModal({
  isOpen,
  onClose,
  doctorEmail,
  onSync,
}: GoogleCalendarModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      icon={GoogleIcon}
      title="Google Calendar Settings"
    >
      <div className="mt-4 space-y-4">
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Connected Account</span>
            <Badge variant="success" className="text-[10px] font-bold">
              Active
            </Badge>
          </div>
          <p className="text-xs font-mono text-slate-600 truncate">{doctorEmail}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200">
            <div>
              <div className="text-xs font-bold text-slate-900">Two-way Sync</div>
              <div className="text-[11px] text-slate-500">
                Sync appointments and blocked periods bidirectionally
              </div>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200">
            <div>
              <div className="text-xs font-bold text-slate-900">Push Notifications</div>
              <div className="text-[11px] text-slate-500">
                Alert on newly synced Google calendar events
              </div>
            </div>
            <input
              type="checkbox"
              defaultChecked
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Done
          </button>
          <button
            type="button"
            onClick={() => {
              onSync();
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Sync Now
          </button>
        </div>
      </div>
    </Modal>
  );
}
