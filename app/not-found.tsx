import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
          <FileQuestion className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900">Page Not Found</h2>
          <p className="text-sm text-slate-500">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition shadow-sm"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

