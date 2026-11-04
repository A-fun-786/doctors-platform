"use client";

import React from "react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

interface ToastProps {
  message: string | null;
  type?: "success" | "error" | "info";
}

export default function Toast({ message, type = "success" }: ToastProps) {
  if (!message) return null;

  const icon =
    type === "error" ? (
      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
    ) : type === "info" ? (
      <Info className="w-4 h-4 text-blue-400 shrink-0" />
    ) : (
      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
    );

  return (
    <div
      className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md mx-auto sm:mx-0 z-50 flex items-center gap-2.5 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-medium animate-in fade-in slide-in-from-bottom-3 duration-200"
      role="status"
      aria-live="polite"
    >
      {icon}
      <span>{message}</span>
    </div>
  );
}
