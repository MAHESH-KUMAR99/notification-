"use client";

import { isNewNotice } from "@/lib/noticeFreshness";
import TickerStar from "./TickerStar";

// Mirrors DetailPanel's own notice row so search results feel like the
// same list, just with an authority label prefixed since results here
// span every authority instead of just one.
function ResultRow({ result, onJump, admin }) {
  const { notice, authorityId, authorityName } = result;
  const title = notice.titleEn ?? notice.title;
  return (
    <li className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 transition-colors last:border-0 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/40">
      <div className="min-w-0 flex-1">
        <button
          onClick={() => onJump(authorityId)}
          className="text-left text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {authorityName}
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {notice.link ? (
            <a
              href={notice.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm leading-snug text-slate-800 hover:text-slate-950 hover:underline dark:text-slate-200 dark:hover:text-white"
            >
              {title}
            </a>
          ) : (
            <span className="text-sm leading-snug text-slate-800 dark:text-slate-200">{title}</span>
          )}
          {isNewNotice(notice) && (
            <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              New
            </span>
          )}
        </div>
        {notice.date && (
          <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{notice.date}</div>
        )}
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
}

export default function SearchResults({ query, results, onJump, admin }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        {results.length > 0
          ? `${results.length} notice(s) matching "${query}" across every authority.`
          : `No notices match "${query}" — try a different word, or clear the search to browse by state.`}
      </p>

      {results.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <ol>
            {results.map((r) => (
              <ResultRow key={`${r.authorityId}:${r.notice.id}`} result={r} onJump={onJump} admin={admin} />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
