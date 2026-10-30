"use client";

import React, { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function RootGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("RootGlobalError", "Root Layout error encountered", error, {
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans antialiased bg-slate-50 text-slate-900 flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
          <h2 className="text-xl font-bold text-slate-900">System Initialization Error</h2>
          <p className="text-sm text-slate-600">
            A critical error occurred while initializing the healthcare application.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm"
          >
            Reload Platform
          </button>
        </div>
      </body>
    </html>
  );
}
