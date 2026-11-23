"use client";

import React, { useRef } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { DEFAULT_DOCTOR_AVATAR } from "@/lib/api";

interface AvatarUploaderProps {
  displayAvatar: string;
  isSaving: boolean;
  onFileSelect: (file: File) => void;
  onReset: () => void;
  onError: (msg: string) => void;
}

export default function AvatarUploader({
  displayAvatar,
  isSaving,
  onFileSelect,
  onReset,
  onError,
}: AvatarUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onError("Please select a valid image file (PNG, JPG, or WebP).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      onError("Image file size should be less than 2MB.");
      return;
    }

    onFileSelect(file);
    // Reset file input value so selecting the same file again triggers change event
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
        Doctor Profile Photo
      </label>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-brand-200 shadow-xs shrink-0 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayAvatar}
            alt="Doctor Profile Preview"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 space-y-1.5 text-center sm:text-left">
          <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5 text-brand-600" />
              <span>Choose Photo</span>
            </button>

            {displayAvatar !== DEFAULT_DOCTOR_AVATAR && (
              <button
                type="button"
                onClick={onReset}
                disabled={isSaving}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            Recommended: Square image (at least 400x400px), under 2MB (PNG, JPG, WebP). Image uploads when you save profile.
          </p>
        </div>
      </div>
    </div>
  );
}

