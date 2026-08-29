import Link from "next/link";

// Adapted from the old app's src/lib/PageNotFound.jsx - dropped the
// Base44 "admin note" block (base44.auth.me() lookup just to show a dev
// hint), not relevant to this stack.
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-7xl font-light text-slate-300">404</h1>
          <div className="h-0.5 w-16 bg-slate-200 mx-auto" />
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl font-medium text-slate-800">הדף לא נמצא</h2>
          <p className="text-slate-600 leading-relaxed">הדף המבוקש לא קיים באפליקציה זו.</p>
        </div>

        <div className="pt-6">
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors duration-200"
          >
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    </div>
  );
}
