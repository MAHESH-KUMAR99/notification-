import { promises as fs } from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "authorities.json");

export async function getAuthorities() {
  const raw = await fs.readFile(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

const MAX_NOTICES_PER_AUTHORITY = 20;

// Undated items must never outrank a confirmed date — "detected just now"
// is not evidence of "posted just now". This offset (~50 years) pushes the
// detection-time fallback well below any plausible real notice date, while
// still preserving relative freshness among undated items across batches.
//
// Note: this is deliberately NOT a hard confidence tier (tier always wins
// regardless of timestamp value) — an earlier version tried that and it
// backfired: a confirmed date from a year ago would then outrank a
// same-source sortTs guess from last week, which is worse than the
// original problem. Raw timestamp comparison across sortTs/detectedAt
// stays correct as long as sortTs itself isn't systematically biased late
// (see inferSortTimestamp's day-of-month choice in watcher.js).
const UNDATED_FALLBACK_OFFSET_MS = 50 * 365 * 24 * 60 * 60 * 1000;

// A source page occasionally prints a typo'd future date — e.g. Bihar
// BCECEB's "Adv. No. BCECEB(Health(JR))-2025/05 Dated 16.12.2026" (the
// advt is clearly a 2025-series one, per its own number and PDF filename
// ADV_JR25_05.pdf, so 2026 is their typo). Trusting that date verbatim let
// a stale notice's typo outrank everything genuinely recent. A couple of
// days of slack absorbs legitimate same-day/timezone edge cases without
// letting a year-off typo through.
const FUTURE_DATE_TOLERANCE_MS = 2 * 24 * 60 * 60 * 1000;

// Same-date tiebreak: 1s of "virtual time" per batchIndex step, small
// enough that ~86000 same-date items would still sort before the previous
// day (far more than any source ever returns in one batch). Notices from
// before batchIndex existed, or that fell off the source's live page since
// we last saw them, get UNKNOWN_BATCH_INDEX so they sort after every
// notice whose source-page position we actually know for that date, but
// still within that same day.
const TIEBREAK_STEP_MS = 1000;
const UNKNOWN_BATCH_INDEX = 50000;

// Sorts newest-first, in order of confidence:
// 1. An exact DD/MM/YYYY date confirmed from the source (NMC, Gujarat) —
//    unless it's implausibly far in the future, in which case it's treated
//    as untrustworthy and falls through like an unparsed date. Same-date
//    items are then ordered by their position on the source page (see
//    batchIndex above) rather than by our own arrival order — several
//    sources (e.g. Gujarat) stamp a whole batch of notices with one shared
//    date, and day granularity alone can't tell them apart otherwise.
// 2. A best-effort timestamp inferred from the notice's link (e.g. a date
//    embedded in the PDF's upload path) — never shown to users, sort-only
// 3. When we first detected the notice, offset far into the past so it
//    never beats a real date, but still orders undated items amongst
//    themselves (ties fall back to each batch's original DOM order, since
//    Array.sort is stable and all items in one batch share one timestamp)
export function noticeSortKey(notice, now = Date.now()) {
  const idx = typeof notice.batchIndex === "number" ? notice.batchIndex : UNKNOWN_BATCH_INDEX;
  const tiebreak = idx * TIEBREAK_STEP_MS;

  if (notice.date) {
    const m = notice.date.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) {
      const [, day, month, year] = m;
      const parsed = new Date(`${year}-${month}-${day}`).getTime();
      if (!Number.isNaN(parsed) && parsed <= now + FUTURE_DATE_TOLERANCE_MS) {
        return parsed - tiebreak;
      }
    }
  }
  if (typeof notice.sortTs === "number" && !Number.isNaN(notice.sortTs)) {
    return notice.sortTs - tiebreak;
  }
  // No date, no sortTs (e.g. Meghalaya's entire feed has neither) — the
  // source's own list order (batchIndex) is the only signal left. Without
  // this tiebreak, same-batch undated items fall back to whatever order
  // they happened to land in through storage's merge process, not the
  // page's true newest-first order.
  const detected = notice.detectedAt ? new Date(notice.detectedAt).getTime() : NaN;
  return (Number.isNaN(detected) ? 0 : detected - UNDATED_FALLBACK_OFFSET_MS) - tiebreak;
}

/**
 * Merges newly-detected notices (verbatim from the source site — no
 * summarization) into an authority's notice list, sorted newest-first, and
 * updates lastUpdatedDate. Deduplicates by notice id; caps the stored list length.
 */
export async function addNotices(id, newNotices) {
  if (newNotices.length === 0) return null;

  const authorities = await getAuthorities();
  const index = authorities.findIndex((a) => a.id === id);
  if (index === -1) {
    throw new Error(`Authority not found: ${id}`);
  }

  const existing = authorities[index].notices ?? [];
  const existingIds = new Set(existing.map((n) => n.id));
  const now = new Date().toISOString();
  const toAdd = newNotices
    .filter((n) => !existingIds.has(n.id))
    .map((n) => ({ ...n, detectedAt: now }));

  // Cap per source, not globally — an authority with multiple watchers
  // (e.g. Bihar's busy "Latest Updates" feed plus its sparse UGMAC board)
  // would otherwise let the busier source crowd the quieter one out
  // entirely once both compete for one shared slice(0, 20).
  const merged = [...toAdd, ...existing];
  const bySource = new Map();
  for (const notice of merged) {
    const key = notice.source ?? "__default__";
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(notice);
  }
  const capped = [];
  for (const items of bySource.values()) {
    items.sort((a, b) => noticeSortKey(b) - noticeSortKey(a));
    capped.push(...items.slice(0, MAX_NOTICES_PER_AUTHORITY));
  }

  const next = {
    ...authorities[index],
    notices: capped,
    lastUpdatedDate: now,
  };

  authorities[index] = next;
  await fs.writeFile(DATA_PATH, JSON.stringify(authorities, null, 2) + "\n", "utf-8");
  return next;
}
