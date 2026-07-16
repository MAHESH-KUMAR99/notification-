"use client";

// Self-dismissing confirmation banner — used for both success ("Added to
// ticker") and failure feedback so every admin action gets an explicit
// acknowledgement instead of a silent state change the admin has to
// visually double-check by re-scanning the ✓ marks.
export default function Toast({ message, tone = "success" }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
      <div
        className={`pointer-events-auto rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg ${
          tone === "error" ? "bg-red-600" : "bg-slate-900 dark:bg-slate-100 dark:text-slate-900"
        }`}
      >
        {message}
      </div>
    </div>
  );
}
