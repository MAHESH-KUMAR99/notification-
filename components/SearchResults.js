"use client";

import { isNewNotice } from "@/lib/noticeFreshness";

// Mirrors DetailPanel's own notice row so search results feel like the
// same list, just with an authority label prefixed since results here
// span every authority instead of just one.
function ResultRow({ result, onJump }) {
  const { notice, authorityId, authorityName } = result;
  const title = notice.titleEn ?? notice.title;
  return (
    <li className="flex gap-3 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800">
      <div className="min-w-0 flex-1">
        <button
          onClick={() => onJump(authorityId)}
          className="text-left text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {authorityName}
        </button>
        <div className="mt-0.5 flex items-start gap-2">
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
}

export default function SearchResults({ query, results, onJump }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        {results.length > 0
          ? `${results.length} notice(s) matching "${query}" across every authority.`
          : `No notices match "${query}" — try a different word, or clear the search to browse by state.`}
      </p>

      {results.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <ol>
            {results.map((r) => (
              <ResultRow key={`${r.authorityId}:${r.notice.id}`} result={r} onJump={onJump} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
