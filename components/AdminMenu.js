"use client";

import { useEffect, useRef, useState } from "react";

// Consolidates what used to be two loose text buttons floating in the
// header into one compact control — closed by default so it doesn't
// compete for attention with the actual notices, which is what every
// non-admin visitor is here for.
export default function AdminMenu({ isAdmin, login, logout, approvedCount, onOpenTicker }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!isAdmin) {
    return (
      <button
        onClick={login}
        className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-300 hover:text-slate-600 dark:border-slate-700 dark:text-slate-500 dark:hover:border-slate-600 dark:hover:text-slate-300"
      >
        Admin
      </button>
    );
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Admin
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900">
          <button
            onClick={() => {
              onOpenTicker();
              setOpen(false);
            }}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Ticker list
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {approvedCount}
            </span>
          </button>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <button
            onClick={() => {
              logout();
              setOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-xs font-medium text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
