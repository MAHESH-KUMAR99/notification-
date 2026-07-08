import * as cheerio from "cheerio";
import { fetchWithTimeout } from "./watcher.js";

// Rough day-first date shapes seen across every source watcher.js already
// handles: DD/MM/YYYY, DD-MM-YYYY, DD Month YYYY, DD-MM-YY. Used only to
// score a candidate ("does this look like a notice list"), never to parse
// a real date — that stays watcher.js's job once a selector is chosen.
const DATE_LIKE_RE = /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/;

// Candidate "shapes" tried against every broken/empty watcher's live page —
// the same handful of patterns that, between them, cover every watcher
// already configured in data/watchers.json (checked 2026-07-08). Each
// yields a CSS selector string plus the matched elements, so the caller
// can both display it and re-extract a title/link/date sample from it.
const CANDIDATE_SELECTORS = [
  { label: "PDF links anywhere on the page", selector: 'a[href$=".pdf"]' },
  { label: "Table rows", selector: "table tr" },
  { label: "List items containing a PDF link", selector: 'li:has(a[href$=".pdf"])' },
  { label: "List items containing any link", selector: "li:has(a)" },
  { label: "Divs/paragraphs containing a PDF link", selector: 'div:has(> a[href$=".pdf"]), p:has(> a[href$=".pdf"])' },
];

function sampleFromElement($, el) {
  const $el = $(el);
  const href = $el.is("a") ? $el.attr("href") : $el.find("a").first().attr("href");
  const title = $el.text().trim().replace(/\s+/g, " ");
  return { title: title.slice(0, 90), href: href ?? null, hasDate: DATE_LIKE_RE.test(title) };
}

function scoreCandidate(samples) {
  if (samples.length < 2 || samples.length > 500) return -1;
  const withLink = samples.filter((s) => s.href).length;
  const withDate = samples.filter((s) => s.hasDate).length;
  const withTitle = samples.filter((s) => s.title.length > 5).length;
  // Weighted toward "looks like a real notice list": every item should
  // have a title and ideally a link; dates are a bonus, not required
  // (several legitimate sources, e.g. Meghalaya, have none — see
  // lib/data.js's undated-item handling).
  return (withTitle / samples.length) * 2 + (withLink / samples.length) * 2 + (withDate / samples.length);
}

/**
 * Fetches a URL and tries a fixed set of common list/table shapes against
 * it, returning ranked candidate selectors with a short sample of what
 * each would extract. Read-only — never writes to watchers.json or
 * authorities.json. Meant to cut down the manual "open the page, guess a
 * selector, check the count" loop (done by hand for ~10 watchers across
 * this project's history) to one request.
 */
export async function investigateUrl(url, { insecureTls = false } = {}) {
  const html = await fetchWithTimeout(url, { insecureTls });
  const $ = cheerio.load(html);
  const candidates = [];

  for (const { label, selector } of CANDIDATE_SELECTORS) {
    let matched;
    try {
      matched = $(selector);
    } catch {
      continue;
    }
    if (matched.length === 0) continue;

    const samples = matched.toArray().map((el) => sampleFromElement($, el));
    const score = scoreCandidate(samples);
    if (score <= 0) continue;

    candidates.push({
      label,
      selector,
      itemCount: matched.length,
      score: Math.round(score * 100) / 100,
      sample: samples.slice(0, 5),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return { url, htmlLength: html.length, candidates: candidates.slice(0, 5) };
}
