"use client";

import { useMemo, useState } from "react";

const CATEGORY_LABELS = {
  central: "Central",
  state: "State",
  institute: "Institute",
};

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

function NoticesList({ notices }) {
  return (
    <ol className="divide-y divide-slate-100 dark:divide-slate-800">
      {notices.map((notice, i) => (
        <li key={notice.id} className="flex gap-3 px-4 py-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            {notice.link ? (
              <a
                href={notice.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-800 hover:text-slate-950 hover:underline dark:text-slate-200 dark:hover:text-white"
              >
                {notice.title}
              </a>
            ) : (
              <span className="text-sm text-slate-800 dark:text-slate-200">{notice.title}</span>
            )}
            {notice.date && (
              <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{notice.date}</div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function DetailPanel({ authority }) {
  const [activeTab, setActiveTab] = useState(null);

  const groups = useMemo(() => {
    const notices = authority?.notices ?? [];
    const bySource = new Map();
    for (const notice of notices) {
      const key = notice.source ?? "__default__";
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key).push(notice);
    }
    return [...bySource.entries()].map(([label, items]) => ({
      label,
      items: items.slice(0, 10),
    }));
  }, [authority]);

  const currentTab = groups.find((g) => g.label === activeTab) ?? groups[0];

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
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent Notices
            </h2>
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
          <NoticesList notices={currentTab.items} />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {authority.latestUpdate || "No update posted yet — check the official site."}
        </div>
      )}
    </div>
  );
}
