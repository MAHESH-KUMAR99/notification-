import { promises as fs } from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "authorities.json");

export async function getAuthorities() {
  const raw = await fs.readFile(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

export async function updateAuthority(id, updates) {
  const authorities = await getAuthorities();
  const index = authorities.findIndex((a) => a.id === id);
  if (index === -1) {
    throw new Error(`Authority not found: ${id}`);
  }

  const allowedFields = ["latestUpdate"];
  const next = { ...authorities[index] };
  for (const field of allowedFields) {
    if (field in updates) {
      next[field] = updates[field];
    }
  }
  next.lastUpdatedDate = new Date().toISOString();

  authorities[index] = next;
  await fs.writeFile(DATA_PATH, JSON.stringify(authorities, null, 2) + "\n", "utf-8");
  return next;
}

const MAX_NOTICES_PER_AUTHORITY = 20;

// Undated items must never outrank a confirmed date — "detected just now"
// is not evidence of "posted just now". This offset (~50 years) pushes the
// detection-time fallback well below any plausible real notice date, while
// still preserving relative freshness among undated items across batches.
const UNDATED_FALLBACK_OFFSET_MS = 50 * 365 * 24 * 60 * 60 * 1000;

// Sorts newest-first, in order of confidence:
// 1. An exact DD/MM/YYYY date confirmed from the source (NMC, Gujarat)
// 2. A best-effort timestamp inferred from the notice's link (e.g. a date
//    embedded in the PDF's upload path) — never shown to users, sort-only
// 3. When we first detected the notice, offset far into the past so it
//    never beats a real date, but still orders undated items amongst
//    themselves (ties fall back to each batch's original DOM order, since
//    Array.sort is stable and all items in one batch share one timestamp)
function noticeSortKey(notice) {
  if (notice.date) {
    const m = notice.date.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) {
      const [, day, month, year] = m;
      const parsed = new Date(`${year}-${month}-${day}`).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  if (typeof notice.sortTs === "number" && !Number.isNaN(notice.sortTs)) {
    return notice.sortTs;
  }
  const detected = notice.detectedAt ? new Date(notice.detectedAt).getTime() : NaN;
  return Number.isNaN(detected) ? 0 : detected - UNDATED_FALLBACK_OFFSET_MS;
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
