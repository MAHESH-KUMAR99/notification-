"use client";

import { useEffect, useRef } from "react";
import TickerStar from "./TickerStar";

function formatRelativeTime(iso) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

// Admin-only summary of everything currently ticked for the MBBS Lighthouse
// ticker — without this, checking "what's live right now" meant hunting
// through every authority's notice list looking for a filled checkmark.
// Floats as an anchored card (not an inline banner) so opening it doesn't
// shove the rest of the page down.
export default function TickerPanel({ authorities, admin, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const noticeIndex = new Map();
  for (const a of authorities) {
    for (const n of a.notices ?? []) {
      noticeIndex.set(n.id, { notice: n, authorityName: a.name });
    }
  }

  const approved = [...admin.approvedIds].map((id) => noticeIndex.get(id)).filter(Boolean);

  return (
    <div
      ref={ref}
      className="absolute right-4 top-16 z-30 max-h-[70vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          On MBBS Lighthouse ticker
          <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">({approved.length})</span>
        </h2>
        <button
          onClick={onClose}
          className="text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          ✕
        </button>
      </div>
      {approved.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Nothing ticked yet — click ✓ next to a notice to add it.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {approved.map(({ notice, authorityName }) => (
            <li key={notice.id} className="flex items-start gap-3 px-4 py-2.5">
              <TickerStar
                noticeId={notice.id}
                pin={admin.pin}
                approved={true}
                onInvalidPin={admin.onInvalidPin}
                onToggled={admin.onToggled}
                onToast={admin.onToast}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">
                    {authorityName}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {formatRelativeTime(admin.approvedAtById.get(notice.id))}
                  </span>
                </div>
                {notice.link ? (
                  <a
                    href={notice.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm text-slate-800 hover:text-slate-950 hover:underline dark:text-slate-200 dark:hover:text-white"
                  >
                    {notice.titleEn ?? notice.title}
                  </a>
                ) : (
                  <p className="truncate text-sm text-slate-800 dark:text-slate-200">
                    {notice.titleEn ?? notice.title}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
