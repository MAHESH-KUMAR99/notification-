"use client";

import { useMemo, useState } from "react";
import { isNewNotice } from "@/lib/noticeFreshness";
import { languageName } from "@/lib/translate";
import { DEFAULT_SOURCE_LABEL } from "@/lib/sourceLabel";
import { Icon } from "./Icons";
import TickerStar from "./TickerStar";

const CATEGORY_LABELS = {
  central: "Central",
  state: "State",
  institute: "Institute",
  aggregator: "Guidance",
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

function NoticesList({ notices, showOriginal, admin }) {
  return (
    <ol className="divide-y divide-slate-100">
      {notices.map((notice) => {
        const title = !showOriginal && notice.titleEn ? notice.titleEn : notice.title;
        return (
          <li key={notice.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50/80">
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {notice.link ? (
                  <a
                    href={notice.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm leading-snug text-slate-800 hover:text-slate-950 hover:underline"
                  >
                    {title}
                  </a>
                ) : (
                  <span className="text-sm leading-snug text-slate-800">{title}</span>
                )}
                {isNewNotice(notice) && (
                  <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    New
                  </span>
                )}
              </div>
              {notice.date && <div className="mt-0.5 text-xs text-slate-400">{notice.date}</div>}
            </div>
            {admin && (
              <TickerStar
                noticeId={notice.id}
                pin={admin.pin}
                approved={admin.approvedIds.has(notice.id)}
                onInvalidPin={admin.onInvalidPin}
                onToggled={admin.onToggled}
                onToast={admin.onToast}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function DetailPanel({ authority, admin }) {
  const [activeTab, setActiveTab] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [page, setPage] = useState(0);

  const groups = useMemo(() => {
    const notices = authority?.notices ?? [];
    const bySource = new Map();
    for (const notice of notices) {
      const key = notice.source ?? DEFAULT_SOURCE_LABEL;
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
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
        Select an authority from the list to see its updates.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-900">{authority.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {CATEGORY_LABELS[authority.category] ?? authority.category}
              {authority.state ? ` · ${authority.state}` : ""}
            </span>
            <span className="text-xs text-slate-400">Updated {formatDate(authority.lastUpdatedDate)}</span>
          </div>
        </div>
        <a
          href={authority.officialLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          <Icon name="link" className="h-4 w-4" />
          Official Site
        </a>
      </div>

      {currentTab?.items.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
              <Icon name="link" className="h-4 w-4 text-orange-500" />
              <h2 className="text-sm font-semibold text-slate-900">Recent Notices</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {originalLanguageLabel && (
                <div className="flex gap-1 rounded-full bg-slate-100 p-0.5">
                  {[
                    { key: false, label: "English" },
                    { key: true, label: originalLanguageLabel },
                  ].map((opt) => (
                    <button
                      key={String(opt.key)}
                      onClick={() => setShowOriginal(opt.key)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        showOriginal === opt.key
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
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
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        g.label === currentTab.label
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <NoticesList notices={pagedItems} showOriginal={showOriginal} admin={admin} />
          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={effectivePage === 0}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                ← Previous
              </button>
              <span className="text-xs text-slate-500">
                Page {effectivePage + 1} of {pageCount}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={effectivePage === pageCount - 1}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {authority.latestUpdate || "No update posted yet — check the official site."}
        </div>
      )}
    </div>
  );
}
