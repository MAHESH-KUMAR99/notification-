"use client";

import { useState } from "react";

const STATUS_META = {
  ERROR: { label: "Broken", color: "bg-red-500", text: "text-red-700 dark:text-red-400" },
  EMPTY: { label: "Empty", color: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  ORDER: { label: "Order mismatch", color: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  OK: { label: "OK", color: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
};

// Investigation only makes sense for "the extractor found nothing/broke" —
// an ORDER mismatch already has a working selector, there's nothing to
// re-guess.
const INVESTIGATABLE_STATUSES = new Set(["ERROR", "EMPTY"]);

function formatTime(iso) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function InvestigatePanel({ result }) {
  if (result.loading) {
    return <p className="pl-4 text-xs text-slate-400 dark:text-slate-500">Fetching the live page and trying candidate selectors…</p>;
  }
  if (result.error) {
    return <p className="pl-4 text-xs text-red-600 dark:text-red-400">{result.error}</p>;
  }
  if (result.candidates.length === 0) {
    return (
      <p className="pl-4 text-xs text-slate-500 dark:text-slate-400">
        No candidate selector looked like a notice list on this page — the content is likely loaded by
        JavaScript after the page loads, which a plain fetch can&apos;t see. Needs a headless browser, not a
        new selector.
      </p>
    );
  }
  return (
    <div className="pl-4">
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Read-only — nothing here is applied automatically. Copy whichever selector looks right into
        watchers.json.
      </p>
      <div className="flex flex-col gap-3">
        {result.candidates.map((c) => (
          <div key={c.selector} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                {c.selector}
              </code>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {c.label} · {c.itemCount} match(es) · score {c.score}
              </span>
            </div>
            <ul className="mt-1.5 space-y-0.5">
              {c.sample.slice(0, 3).map((s, i) => (
                <li key={i} className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {s.title || "(empty)"}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function IssueRow({ status, r, dim, investigation, onInvestigate }) {
  return (
    <li className={`flex flex-col gap-1 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800 ${dim ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_META[status].color}`} />
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{r.key}</span>
        </div>
        {!dim && INVESTIGATABLE_STATUSES.has(status) && (
          <button
            onClick={() => onInvestigate(r.key)}
            disabled={investigation?.loading}
            className="shrink-0 rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {investigation ? "Re-investigate" : "Investigate"}
          </button>
        )}
      </div>
      {dim ? (
        <p className="pl-4 text-xs text-slate-500 dark:text-slate-400">{r.knownReason}</p>
      ) : (
        <>
          {status === "ERROR" && (
            <p className="pl-4 text-xs text-slate-500 dark:text-slate-400">{r.detail}</p>
          )}
          {status === "ORDER" && (
            <p className="pl-4 text-xs text-slate-500 dark:text-slate-400">
              {r.inversions} inversion(s) across {r.overlapping} overlapping item(s) — e.g. {r.example}
            </p>
          )}
        </>
      )}
      {investigation && (
        <div className="mt-2">
          <InvestigatePanel result={investigation} />
        </div>
      )}
    </li>
  );
}

export default function HealthPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showKnown, setShowKnown] = useState(false);
  const [investigations, setInvestigations] = useState({});

  async function checkNow() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audit");
      if (!res.ok) throw new Error(`Request failed: HTTP ${res.status}`);
      const data = await res.json();
      setReport(data);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function investigate(key) {
    setInvestigations((prev) => ({ ...prev, [key]: { loading: true } }));
    try {
      const res = await fetch(`/api/investigate?key=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setInvestigations((prev) => ({ ...prev, [key]: { loading: false, candidates: data.candidates } }));
    } catch (err) {
      setInvestigations((prev) => ({ ...prev, [key]: { loading: false, error: err.message } }));
    }
  }

  const problemStatuses = ["ERROR", "EMPTY", "ORDER"];
  const unknownOf = (status) => (report?.byStatus[status] ?? []).filter((r) => !r.known);
  const knownOf = (status) => (report?.byStatus[status] ?? []).filter((r) => r.known);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Source Health Check</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Compares every watcher&apos;s live source against what&apos;s currently stored — read-only, doesn&apos;t
        change any data. Takes up to a minute since it visits every site.
      </p>

      <button
        onClick={checkNow}
        disabled={loading}
        className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        {loading ? "Checking… (this can take up to a minute)" : "Check now"}
      </button>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      {report && (
        <div className="mt-6">
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Checked {report.watcherCount} watcher(s) at {formatTime(report.checkedAt)} —{" "}
            {report.healthy ? (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                no new issues{report.knownIssueCount > 0 ? ` (${report.knownIssueCount} known, already understood)` : ""}
              </span>
            ) : (
              <span className="font-semibold text-red-600 dark:text-red-400">
                {report.unknownIssueCount} new/unexpected issue(s)
              </span>
            )}
          </p>

          <div className="mb-4 grid grid-cols-4 gap-2">
            {Object.entries(STATUS_META).map(([status, meta]) => (
              <div
                key={status}
                className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900"
              >
                <div className={`text-lg font-bold ${meta.text}`}>
                  {status === "OK" ? report.byStatus.OK.length : unknownOf(status).length}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {meta.label}
                </div>
              </div>
            ))}
          </div>

          {report.healthy ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
              No new or unexpected problems right now.
            </p>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <ol>
                {problemStatuses.flatMap((status) =>
                  unknownOf(status).map((r) => (
                    <IssueRow
                      key={status + r.key}
                      status={status}
                      r={r}
                      investigation={investigations[r.key]}
                      onInvestigate={investigate}
                    />
                  ))
                )}
              </ol>
            </div>
          )}

          {report.knownIssueCount > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowKnown((s) => !s)}
                className="text-xs font-medium text-slate-500 underline decoration-dotted hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {showKnown ? "Hide" : "Show"} {report.knownIssueCount} known/already-understood issue(s)
              </button>
              {showKnown && (
                <div className="mt-2 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                  <ol>
                    {problemStatuses.flatMap((status) =>
                      knownOf(status).map((r) => <IssueRow key={status + r.key} status={status} r={r} dim />)
                    )}
                  </ol>
                </div>
              )}
            </div>
          )}

          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            {report.totalNewNotSaved} item(s) currently live but not yet saved — normal, picked up by the next
            scheduled check.
          </p>
        </div>
      )}
    </div>
  );
}
