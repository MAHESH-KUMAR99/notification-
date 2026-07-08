"use client";

import { useMemo, useState } from "react";
import { isNewNotice } from "@/lib/noticeFreshness";
import { languageName } from "@/lib/translate";

const CATEGORY_LABELS = {
  central: "Central",
  state: "State",
  institute: "Institute",
};

const PAGE_SIZE = 10;

function formatDate(iso) {
  if (!iso) return "Not updated yet";
  const date = new Date(iso);
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function NoticesList({ notices, showOriginal, startIndex }) {
  return (
    <ol className="divide-y divide-slate-100 dark:divide-slate-800">
      {notices.map((notice, i) => {
        const title = !showOriginal && notice.titleEn ? notice.titleEn : notice.title;
        return (
          <li key={notice.id} className="flex gap-3 px-4 py-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {startIndex + i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                {notice.link ? (
                  <a
                    href={notice.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-800 hover:text-slate-950 hover:underline dark:text-slate-200 dark:hover:text-white"
                  >
                    {title}
                  </a>
                ) : (
                  <span className="text-sm text-slate-800 dark:text-slate-200">{title}</span>
                )}
                {isNewNotice(notice) && (
                  <span className="mt-0.5 shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    New
                  </span>
                )}
              </div>
              {notice.date && (
                <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{notice.date}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function DetailPanel({ authority }) {
  const [activeTab, setActiveTab] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [page, setPage] = useState(0);

  const groups = useMemo(() => {
    const notices = authority?.notices ?? [];
    const bySource = new Map();
    for (const notice of notices) {
      const key = notice.source ?? "__default__";
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key).push(notice);
    }
    // Keep every stored notice here (not just the first page) — pagination
    // below slices this per-page, rather than the old hard cutoff at 10
    // that hid the other half of what's already fetched and stored.
    return [...bySource.entries()].map(([label, items]) => ({ label, items }));
  }, [authority]);

  const currentTab = groups.find((g) => g.label === activeTab) ?? groups[0];
  const pageCount = currentTab ? Math.ceil(currentTab.items.length / PAGE_SIZE) : 0;

  // Switching authority or tab shows a different notice list entirely, so
  // any page position from the previous one is meaningless — always land
  // back on page 1 rather than e.g. showing an empty "page 2 of 1". Reset
  // during render (React's documented pattern for this) rather than in a
  // useEffect, which would flash the stale page for one extra render.
  const resetKey = `${authority?.id}:${currentTab?.label}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  let effectivePage = page;
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setPage(0);
    effectivePage = 0;
  }
  const pagedItems = currentTab?.items.slice(effectivePage * PAGE_SIZE, (effectivePage + 1) * PAGE_SIZE) ?? [];

  // Most common source language among translated items in this tab — good
  // enough to label the "original" toggle even on the rare list that mixes
  // more than one regional language.
  const originalLanguageLabel = useMemo(() => {
    const counts = new Map();
    for (const n of currentTab?.items ?? []) {
      if (!n.titleLang) continue;
      counts.set(n.titleLang, (counts.get(n.titleLang) ?? 0) + 1);
    }
    if (counts.size === 0) return null;
    const [topLang] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return languageName(topLang);
  }, [currentTab]);

  if (!authority) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500 dark:text-slate-400">
        Select an authority from the list to see its updates.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {authority.name}
          </h1>
          <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {CATEGORY_LABELS[authority.category] ?? authority.category}
            {authority.state ? ` · ${authority.state}` : ""}
          </span>
        </div>
        <a
          href={authority.officialLink}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Official Site ↗
        </a>
      </div>

      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Last updated: {formatDate(authority.lastUpdatedDate)}
      </p>

      {currentTab?.items.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent Notices
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {originalLanguageLabel && (
                <div className="flex gap-1 rounded-full bg-slate-100 p-0.5 dark:bg-slate-800">
                  {[
                    { key: false, label: "English" },
                    { key: true, label: originalLanguageLabel },
                  ].map((opt) => (
                    <button
                      key={String(opt.key)}
                      onClick={() => setShowOriginal(opt.key)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                        showOriginal === opt.key
                          ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                          : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              {groups.length > 1 && (
                <div className="flex gap-1">
                  {groups.map((g) => (
                    <button
                      key={g.label}
                      onClick={() => setActiveTab(g.label)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        g.label === currentTab.label
                          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <NoticesList notices={pagedItems} showOriginal={showOriginal} startIndex={effectivePage * PAGE_SIZE} />
          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={effectivePage === 0}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
              >
                ← Previous
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page {effectivePage + 1} of {pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={effectivePage === pageCount - 1}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {authority.latestUpdate || "No update posted yet — check the official site."}
        </div>
      )}
    </div>
  );
}
