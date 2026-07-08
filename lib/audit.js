import { promises as fs } from "fs";
import path from "path";
import { extractNotices } from "./watcher.js";

// Compares each watcher's LIVE source against what's currently stored in
// data/authorities.json — pure read-only, never touches either. Shared by
// scripts/audit.mjs (CLI) and app/api/audit/route.js (the "Check now"
// button on the health page) so both report identically.
//
// Runs watchers with bounded concurrency rather than one-at-a-time: 39
// sequential live fetches (up to 15s timeout each, see FETCH_TIMEOUT_MS in
// watcher.js) can take minutes in the worst case, which blows past a
// Vercel serverless function's execution limit. Concurrency trades that
// for a bounded wall-clock time regardless of watcher count.
const DEFAULT_CONCURRENCY = 8;
const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 1500;

// Issues already investigated and understood — not silenced (still listed,
// still counted), but flagged `known: true` so the health page can show
// "N new/unexpected issues" up front instead of treating every one of
// these as equally alarming as something that just broke. Remove an entry
// here once its underlying source or extraction logic actually changes —
// don't let this list go stale and start hiding real regressions.
const KNOWN_ISSUES = {
  "madhya-pradesh/mp-latest-instructions": "Source page is JS-rendered (Angular-style) — the notice list isn't in the raw HTML at all, so a plain fetch always sees zero items. Needs a headless browser to fix.",
  "madhya-pradesh/mp-counselling-schedule": "Same JS-rendered page as mp-latest-instructions.",
  "madhya-pradesh/mp-seat-charts": "Same JS-rendered page as mp-latest-instructions.",
  "madhya-pradesh/mp-state-merit": "Same JS-rendered page as mp-latest-instructions.",
  "madhya-pradesh/mp-rule-book": "Same JS-rendered page as mp-latest-instructions.",
  "madhya-pradesh/mp-allotment-list": "Same JS-rendered page as mp-latest-instructions.",
  gujarat: "Source is one giant archive page spanning 14+ months where the same PDF is genuinely linked from multiple date sections — there's no single correct order to match.",
  "odisha/odisha-dme": "Source is a legacy static archive: only 25 of ~400 items have any date at all, and those are all from 2018-2019. Confirmed dates intentionally outrank undated items (see lib/data.js) to prevent stale content from faking as new elsewhere — here that same rule keeps old dated items above newer undated ones.",
  "west-bengal": "The source's own page lists a 22 Dec 2025 notice before a 2 Jan 2026 one — its listing order contradicts its own printed dates. We trust the confirmed date over page position (that's what stops stale notices from faking as new elsewhere), so our order differs from theirs here specifically because theirs is internally inconsistent.",
  nagaland: "Same root cause as west-bengal: two notices dated one day apart (14 and 15 Jan 2026) are listed on the source page in the opposite order from their own printed dates.",
  "delhi-ipu": "Two brochure PDFs (\"UG\"/\"PG Admission Brochure\") link to a Jan-2026 upload path with no exact day, so their date is a day-1-of-month guess — placing them a few positions off from a same-month notice that does have a confirmed exact date. Tried making a page-adjacent neighbor's date override that guess, but it broke worse on items where two such guesses sit next to each other (see lib/watcher.js inferDatesFromDatedNeighbors comment); reverted as not worth the risk for 2 items.",
  "himachal-pradesh/himachal-notifications": "Same day-1-of-month guess issue as delhi-ipu: a PDF linked from an 'uploads/2026/07/' path with no exact day guesses 1 July, which can land it a position or two off from a same-month notice with a confirmed exact date — worse when the source's own page order shifts between our last scrape and this check, since this site updates often.",
};

function knownIssueReason(key) {
  return KNOWN_ISSUES[key] ?? null;
}

function watcherKey(watcher) {
  return `${watcher.authorityId}${watcher.id ? `/${watcher.id}` : ""}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A "fetch failed" here isn't always the source's fault — running 8
// watchers concurrently occasionally trips a transient DNS/connection
// hiccup on our end (seen on both Tripura and Andhra Pradesh UHSAP in
// back-to-back runs, neither of which fails when re-checked alone). A
// couple of retries absorbs that noise so the health banner doesn't cry
// wolf over a blip instead of a genuinely broken source.
async function extractWithRetry(watcher) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
    try {
      return await extractNotices(watcher);
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_COUNT) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastErr;
}

async function auditWatcher(watcher, authorities) {
  const key = watcherKey(watcher);
  const reason = knownIssueReason(key);
  const authority = authorities.find((a) => a.id === watcher.authorityId);
  if (!authority) return { key, status: "NO_AUTHORITY" };

  let live;
  try {
    live = await extractWithRetry(watcher);
  } catch (err) {
    return { key, status: "ERROR", detail: err.message, known: reason != null, knownReason: reason };
  }

  if (live.length === 0) {
    return { key, status: "EMPTY", known: reason != null, knownReason: reason };
  }

  const storedKey = watcher.sourceLabel ?? "__default__";
  const stored = (authority.notices ?? []).filter((n) => (n.source ?? "__default__") === storedKey);
  const storedPos = new Map(stored.map((n, i) => [n.id, i]));

  const overlapping = [];
  let newCount = 0;
  for (const n of live) {
    if (storedPos.has(n.id)) overlapping.push({ id: n.id, title: n.title, storedPos: storedPos.get(n.id) });
    else newCount++;
  }

  if (overlapping.length < 2) {
    return { key, status: "OK", newCount, note: "too few overlapping items to check order" };
  }

  let inversions = 0;
  let example = null;
  for (let i = 0; i < overlapping.length; i++) {
    for (let j = i + 1; j < overlapping.length; j++) {
      if (overlapping[i].storedPos > overlapping[j].storedPos) {
        inversions++;
        if (!example) {
          example = `source has "${overlapping[i].title.slice(0, 45)}" before "${overlapping[j].title.slice(0, 45)}", but stored has it at position ${overlapping[i].storedPos} vs ${overlapping[j].storedPos}`;
        }
      }
    }
  }

  if (inversions === 0) {
    return { key, status: "OK", newCount, overlapping: overlapping.length };
  }
  return {
    key,
    status: "ORDER",
    newCount,
    overlapping: overlapping.length,
    inversions,
    example,
    known: reason != null,
    knownReason: reason,
  };
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  async function runOne() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runOne));
  return results;
}

export async function runAudit({ concurrency = DEFAULT_CONCURRENCY } = {}) {
  const watchers = JSON.parse(await fs.readFile(path.join(process.cwd(), "data", "watchers.json"), "utf-8"));
  const authorities = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "authorities.json"), "utf-8")
  );

  const results = await runPool(watchers, (w) => auditWatcher(w, authorities), concurrency);

  const byStatus = { ERROR: [], EMPTY: [], ORDER: [], OK: [], NO_AUTHORITY: [] };
  for (const r of results) byStatus[r.status].push(r);

  const totalNew = results.reduce((s, r) => s + (r.newCount ?? 0), 0);

  // "Healthy" only cares about issues that AREN'T already investigated and
  // explained (see KNOWN_ISSUES above) — otherwise every check would keep
  // reporting the same 8 already-understood trade-offs as if they were
  // fresh alarms, and a genuinely new problem would be lost in that noise.
  const problemStatuses = ["ERROR", "EMPTY", "ORDER"];
  const unknownIssueCount = problemStatuses.reduce(
    (sum, status) => sum + byStatus[status].filter((r) => !r.known).length,
    0
  );
  const knownIssueCount = problemStatuses.reduce(
    (sum, status) => sum + byStatus[status].filter((r) => r.known).length,
    0
  );

  return {
    checkedAt: new Date().toISOString(),
    watcherCount: watchers.length,
    byStatus,
    totalNewNotSaved: totalNew,
    unknownIssueCount,
    knownIssueCount,
    healthy: unknownIssueCount === 0,
  };
}
