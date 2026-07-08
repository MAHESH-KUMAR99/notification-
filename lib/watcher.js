import { promises as fs } from "fs";
import https from "https";
import path from "path";
import crypto from "crypto";
import * as cheerio from "cheerio";
import { addNotices } from "./data.js";
import { getWatchState, setWatchEntry } from "./watchState.js";
import { translateTitle } from "./translate.js";

const WATCHERS_PATH = path.join(process.cwd(), "data", "watchers.json");
const FETCH_TIMEOUT_MS = 15000;
// Must comfortably exceed the largest single source list (NMC and Gujarat
// each return several hundred items per fetch) — otherwise older ids fall
// out of "seen" and get re-detected as new on every check.
const MAX_SEEN_IDS = 3000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function getWatchers() {
  const raw = await fs.readFile(WATCHERS_PATH, "utf-8");
  return JSON.parse(raw);
}

// Some government hosts (e.g. nmc.org.in) serve an incomplete TLS chain that
// Node's strict verifier rejects even though browsers accept it. Scoped to
// watchers that opt in via `insecureTls` — this is a read-only public notice
// fetch, not a channel that carries credentials.
function fetchInsecure(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": USER_AGENT }, rejectUnauthorized: false, timeout: timeoutMs },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        let body = "";
        res.setEncoding("utf-8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(body));
      }
    );
    req.on("timeout", () => req.destroy(new Error("Request timed out")));
    req.on("error", reject);
  });
}

// `timeoutMs` defaults to the normal 15s used by the scheduled scrape, but
// callers racing a hard deadline (the health-check API route, which has to
// fit 39 sites inside Vercel's function time limit) pass a shorter one so
// one unreachable site can't eat the whole budget — see lib/audit.js.
export async function fetchWithTimeout(url, { insecureTls = false, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  if (insecureTls) return fetchInsecure(url, timeoutMs);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function noticeId(title, link) {
  return crypto.createHash("sha256").update(`${title}|${link ?? ""}`).digest("hex").slice(0, 16);
}

// A few source sites (MCC/NTA ticker, Maharashtra marquee) don't expose a
// per-item date at all — but their notice PDFs are often uploaded with a
// date baked into the URL. Used only for sort order, never shown to users,
// since it's a best-effort guess, not a confirmed date.
//
// Day-of-month is deliberately the 1st (earliest possible), not a mid-month
// guess — noticeSortKey (lib/data.js) compares this raw timestamp directly
// against other notices' *confirmed* dates, so overshooting into the middle
// of the month let an undated notice from, say, July outrank a confirmed
// notice from earlier the same July (seen with Himachal Pradesh: a "day 15"
// guess ranked above a confirmed "07 Jul"). Understating the day can only
// make an undated guess rank lower than it should — never higher than a
// same-month confirmed date it should be losing to anyway.
// Rejects an (unvalidated) month/year before it reaches Date.UTC, which
// silently *rolls over* out-of-range values instead of producing NaN — e.g.
// a filename like "logo_122723723.jpeg" isn't a date at all, but got read
// as day=12 month=27 year=3723, and Date.UTC happily normalized month 27
// into some year in the far future. That nonsense timestamp then outranked
// every real notice. Day is intentionally not range-checked here since an
// invalid day (e.g. 31 in a 30-day month) still normalizes to a plausible
// nearby date, not a wild one — only month/year overflow produces the
// runaway values worth rejecting.
function isPlausibleMonthYear(month, year) {
  return month >= 1 && month <= 12 && year >= 1990 && year <= 2100;
}

export function inferSortTimestamp(link) {
  if (!link) return null;

  const uploadMatch = link.match(/uploads\/(\d{4})\/(\d{1,2})\//);
  if (uploadMatch) {
    const [, year, month] = uploadMatch;
    if (!isPlausibleMonthYear(Number(month), Number(year))) return null;
    return Date.UTC(Number(year), Number(month) - 1, 1);
  }

  // Drupal-style file directories, e.g. /sites/default/files/2026-06/...
  const drupalMatch = link.match(/files\/(\d{4})-(\d{2})\//);
  if (drupalMatch) {
    const [, year, month] = drupalMatch;
    if (!isPlausibleMonthYear(Number(month), Number(year))) return null;
    return Date.UTC(Number(year), Number(month) - 1, 1);
  }

  const filenameMatch = link.match(/(\d{2})(\d{2})(\d{4})[^\d]*\.\w+$/);
  if (filenameMatch) {
    const [, dd, mm, yyyy] = filenameMatch;
    if (!isPlausibleMonthYear(Number(mm), Number(yyyy))) return null;
    const ts = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!Number.isNaN(ts)) return ts;
  }

  return null;
}

function formatDateFromText(text) {
  const parsed = new Date(text.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  const dd = String(parsed.getDate()).padStart(2, "0");
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${parsed.getFullYear()}`;
}

// Some govt CDN links (e.g. mcc.nic.in's S3-hosted PDFs) name the file
// starting with an exact YYYYMMDD upload timestamp, others (e.g. Tamil Nadu)
// use DDMMYYYY instead — both are confirmed dates, not guesses, so safe to
// display (unlike inferSortTimestamp above).
function inferExactDateFromLink(link) {
  if (!link) return null;

  // Path itself encodes year/month/day as separate segments, e.g.
  // /uploads/news/2026/06/25/2026-06-25111303.pdf
  const pathMatch = link.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
  if (pathMatch) {
    const [, year, month, day] = pathMatch;
    const yearNum = Number(year);
    if (
      Number(month) >= 1 &&
      Number(month) <= 12 &&
      Number(day) >= 1 &&
      Number(day) <= 31 &&
      yearNum >= 1990 &&
      yearNum <= 2100
    ) {
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
  }

  const filename = link.split("/").pop() ?? "";

  const yyyymmdd = filename.match(/^(\d{4})(\d{2})(\d{2})\d*\.\w+$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${day}/${month}/${year}`;
    }
  }

  const ddmmyyyy = filename.match(/^(\d{2})(\d{2})(\d{4})\d*\.\w+$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const yearNum = Number(year);
    if (
      Number(month) >= 1 &&
      Number(month) <= 12 &&
      Number(day) >= 1 &&
      Number(day) <= 31 &&
      yearNum >= 1990 &&
      yearNum <= 2100
    ) {
      return `${day}/${month}/${year}`;
    }
  }

  return null;
}

// Extracts a date embedded in a notice's own title text, e.g. "Advt. No. 30
// dated-02.07.2026" or "Urgent Notice Dated 22-12-2025" — separators vary
// (., /, -) across sites but the DD-sep-MM-sep-YYYY shape is consistent.
function extractEmbeddedDate(text) {
  // Prefer a date in parentheses at the very end — several sites (e.g.
  // Karnataka KEA) put the notice's real publish date there, while an
  // unrelated date (an exam/deadline mentioned in the body) appears earlier.
  const trailing = text.match(/\((\d{1,2})[./-](\d{1,2})[./-](\d{4})\)\s*$/);
  if (trailing) {
    const [, day, month, year] = trailing;
    if (Number(day) >= 1 && Number(day) <= 31 && Number(month) >= 1 && Number(month) <= 12) {
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
  }

  // Otherwise take the LAST numeric date-like match, not the first — same
  // reasoning: an earlier date in the text is often unrelated to publish date.
  const numericMatches = [...text.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g)];
  if (numericMatches.length > 0) {
    const [, day, month, year] = numericMatches[numericMatches.length - 1];
    if (Number(day) >= 1 && Number(day) <= 31 && Number(month) >= 1 && Number(month) <= 12) {
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
  }

  // e.g. "03 July 2026" — day, full/short month name, year
  const named = text.match(/\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/);
  if (named) {
    return formatDateFromText(named[1]);
  }

  // Same DD-sep-MM-sep-YY shape but a 2-digit year, e.g. Assam's
  // "Advertisement Lecturer Nursing College-18-6-26" (18 June 2026) — this
  // is checked last, after every 4-digit-year attempt, since a bare 2-digit
  // trailing number is a much weaker date signal (more likely to just be
  // an unrelated number) and shouldn't preempt a more specific match.
  // Pivot at 70: 00-69 -> 2000s (all plausible notice years so far),
  // 70-99 -> 1900s, so an unrelated "-99" isn't misread as 2099.
  const shortYearMatches = [...text.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2})\b/g)];
  if (shortYearMatches.length > 0) {
    const [, day, month, yy] = shortYearMatches[shortYearMatches.length - 1];
    if (Number(day) >= 1 && Number(day) <= 31 && Number(month) >= 1 && Number(month) <= 12) {
      const year = (Number(yy) <= 69 ? 2000 : 1900) + Number(yy);
      return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
    }
  }

  return null;
}

// Shared per-item extraction used by both extractHtmlList (fixed selectors)
// and extractHtmlTabsAuto (selectors reused across dynamically discovered
// tabs) — same title/date/link cleanup logic either way.
function extractNoticeFromNode($, node, watcher) {
  // Some sites (e.g. Kerala KEAM) put the date in its own sibling column
  // rather than inside the title cell — pull it out before it can leak
  // into (or be missing from) the title text.
  let dateFromSelector = null;
  if (watcher.dateSelector) {
    const dateNode = node.find(watcher.dateSelector).first();
    const dateText = normalizeText(dateNode.text());
    // extractEmbeddedDate parses DD-MM-YYYY explicitly (Indian convention);
    // formatDateFromText's new Date() would misread it as MM-DD-YYYY.
    dateFromSelector = extractEmbeddedDate(dateText) ?? formatDateFromText(dateText);
    dateNode.remove();
  }

  // Selector may match the <a> itself (e.g. West Bengal/Tamil Nadu, where
  // there's no separate list-item wrapper) or a container that holds one.
  const href = node.is("a") ? node.attr("href") : node.find("a").first().attr("href");
  const link = href ? new URL(href, watcher.url).href : null;

  // Some sites (e.g. Kerala KEAM) put several labelled download buttons
  // ("Notification", "Option Facilitation Centres", ...) inside the same
  // cell as the title prose; titleSelector isolates that cell and we drop
  // its nested links so their labels don't get glued onto the title.
  const titleSource = watcher.titleSelector ? node.find(watcher.titleSelector).first() : node;
  if (watcher.titleSelector) titleSource.find("a").remove();
  // .blink/marquee "New" badges (common on older Indian govt sites) get
  // concatenated into node.text() otherwise, tacking a stray "new" onto
  // the title of whichever notice was most recently flagged.
  // Excerpt/"Read More" boilerplate (e.g. Arunachal Pradesh DGME's WordPress
  // notice archive) would otherwise get appended to the title.
  titleSource.find("script, style, .blink, .blink_me, marquee, blink, .notice-archive-excerpt, .notice-read-more").remove();
  let title = normalizeText(titleSource.text());
  // Some sites (e.g. Delhi FMSC) use "Click here" as the anchor text and
  // put the real notice title as plain sibling text after it.
  title = title.replace(/^click here\s*/i, "").trim();
  // Some sites render a date right before the title inside the same node —
  // bare "24 Jun 2026 ..." (Arunachal Pradesh DGME) or bracketed
  // "[05-07-2026] - ..." (Puducherry CENTAC). Capture it before stripping
  // so it's not lost as a date signal below.
  const leadingDateMatch = title.match(
    /^\[?(\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\]?\s*-?\s*/
  );
  if (leadingDateMatch) {
    title = title.slice(leadingDateMatch[0].length).trim();
  }
  if (!title) return null;

  // Filename-embedded date (auto-generated at upload) is more trustworthy
  // than a date found in the title text, which is often a deadline or
  // event date mentioned in the notice rather than its publish date.
  const date =
    dateFromSelector ??
    inferExactDateFromLink(link) ??
    extractEmbeddedDate(title) ??
    (leadingDateMatch ? extractEmbeddedDate(leadingDateMatch[1]) : null);
  return {
    id: noticeId(title, link),
    title,
    link,
    date,
    sortTs: date ? null : inferSortTimestamp(link),
  };
}

async function extractHtmlList(watcher) {
  const html = await fetchWithTimeout(watcher.url, { insecureTls: watcher.insecureTls, timeoutMs: watcher.timeoutMs });
  const $ = cheerio.load(html);
  const items = $(watcher.itemSelector);
  if (items.length === 0 && !watcher.allowEmpty) {
    throw new Error(`Selector matched nothing: ${watcher.itemSelector}`);
  }

  const notices = [];
  items.each((_, el) => {
    const notice = extractNoticeFromNode($, $(el), watcher);
    if (notice) notices.push(notice);
  });
  return notices;
}

// For sites that dump every academic year's notices into one flat,
// unwrapped table with a plain header cell between each year's rows (e.g.
// Delhi FMSC's "Courses Updates" column has no per-year container at all —
// just <tr>MBBS/BDS 2026-27</tr> followed directly by that year's item
// rows, then <tr>MBBS/BDS 2025-26</tr>, and so on). `headerSelector` and
// `itemSelector` are queried together so cheerio returns both in true page
// order; items are collected only after the header containing
// `sectionStartText` is seen, and collection stops at the next header
// after that — so only the current year shows, not every year the site
// has ever archived on the same page.
async function extractHtmlListSection(watcher) {
  const html = await fetchWithTimeout(watcher.url, { insecureTls: watcher.insecureTls, timeoutMs: watcher.timeoutMs });
  const $ = cheerio.load(html);
  const combined = $(`${watcher.headerSelector}, ${watcher.itemSelector}`);
  if (combined.length === 0) {
    throw new Error(`Section selectors matched nothing: ${watcher.headerSelector}, ${watcher.itemSelector}`);
  }

  let foundStart = false;
  let stopped = false;
  const sectionItems = [];
  combined.each((_, el) => {
    if (stopped) return;
    const $el = $(el);
    if ($el.is(watcher.headerSelector)) {
      if (foundStart) {
        stopped = true;
      } else if ($el.text().includes(watcher.sectionStartText)) {
        foundStart = true;
      }
      return;
    }
    if (foundStart) sectionItems.push(el);
  });

  if (sectionItems.length === 0 && !watcher.allowEmpty) {
    throw new Error(`Section "${watcher.sectionStartText}" matched no items`);
  }

  const notices = [];
  for (const el of sectionItems) {
    const notice = extractNoticeFromNode($, $(el), watcher);
    if (notice) notices.push(notice);
  }
  return notices;
}

// For sites built on a Bootstrap-style nav-pills/nav-tabs template (e.g.
// Puducherry CENTAC) where each top-level tab is its own notice category —
// discovers the tabs themselves from the page instead of a fixed list, so a
// newly added category tab is picked up on the next check without editing
// watchers.json. Each top-level tab's own "ALL" sub-tab (the first nested
// tab-pane) is used as the source of truth, since it already unions that
// category's Press Release/Merit List/etc sub-tabs — scraping those
// individually would just re-detect the same notices multiple times.
async function extractHtmlTabsAuto(watcher) {
  const html = await fetchWithTimeout(watcher.url, { insecureTls: watcher.insecureTls, timeoutMs: watcher.timeoutMs });
  const $ = cheerio.load(html);
  const tabButtons = $(watcher.tabNavSelector);
  if (tabButtons.length === 0) {
    throw new Error(`Tab nav selector matched nothing: ${watcher.tabNavSelector}`);
  }

  const notices = [];
  tabButtons.each((_, btn) => {
    const $btn = $(btn);
    const label = normalizeText($btn.text());
    if (!label) return;
    const targetSel = $btn.attr("data-bs-target") || $btn.attr("href");
    if (!targetSel || !targetSel.startsWith("#")) return;
    const pane = $(targetSel);
    if (pane.length === 0) return;

    // Descend into the first nested tab-pane (the category's own "ALL" sub-tab)
    // if this tab has one; otherwise scrape the pane directly.
    const innerPane = pane.find(".tab-pane").first();
    const scope = innerPane.length ? innerPane : pane;

    scope.find(watcher.itemSelector).each((_, el) => {
      const notice = extractNoticeFromNode($, $(el), watcher);
      if (!notice) return;
      // Re-scope the id by discovered tab so the same notice cross-posted
      // into more than one category still shows up in each one's own tab.
      notices.push({ ...notice, source: label, id: `${label}:${notice.id}` });
    });
  });
  return notices;
}

// For sites where several notices share one dated header block (e.g.
// Gujarat's "[Date: 29-Jun-2026]" banners, each followed by one or more
// <li> notices) — extracts the group's date and applies it to every item.
async function extractHtmlListGrouped(watcher) {
  const html = await fetchWithTimeout(watcher.url, { insecureTls: watcher.insecureTls, timeoutMs: watcher.timeoutMs });
  const $ = cheerio.load(html);
  const groups = $(watcher.groupSelector);
  if (groups.length === 0) {
    throw new Error(`Group selector matched nothing: ${watcher.groupSelector}`);
  }

  const notices = [];
  groups.each((_, groupEl) => {
    const group = $(groupEl);
    const headerClone = group.clone();
    headerClone.find(watcher.itemSelector).remove();
    const headerText = normalizeText(headerClone.text());
    const dateMatch = headerText.match(/Date:\s*([^\]]+)/i);
    const date = dateMatch ? formatDateFromText(dateMatch[1]) : null;

    group.find(watcher.itemSelector).each((__, itemEl) => {
      const node = $(itemEl);
      node.find("script, style").remove();
      const title = normalizeText(node.text());
      if (!title) return;

      const href = node.find("a").first().attr("href");
      const link = href ? new URL(href, watcher.url).href : null;
      notices.push({
        id: noticeId(title, link),
        title,
        link,
        date,
        sortTs: date ? null : inferSortTimestamp(link),
      });
    });
  });
  return notices;
}

function parseDateCell(text) {
  const cleaned = text.trim();
  const numeric = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (numeric) {
    const [, day, month, year] = numeric;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }

  // e.g. "02-Jul 2026" or "02-Jul<br> 2026" (already whitespace-normalized by
  // the caller) — hyphen between day and month, no comma before the year.
  const named = cleaned.replace(/-/g, " ").match(/(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/);
  if (named) return formatDateFromText(named[1]);

  return null;
}

// For sites that publish an actual documents table (title, year/date,
// download link) rather than a scrolling ticker — e.g. MCC's "Current
// Events" page and Maharashtra CET's "Notices" page (which has its own
// explicit "Published Date" column — use `dateCellIndex` for those).
async function extractHtmlTable(watcher) {
  const html = await fetchWithTimeout(watcher.url, { insecureTls: watcher.insecureTls, timeoutMs: watcher.timeoutMs });
  const $ = cheerio.load(html);

  let rows;
  if (watcher.tableIndex != null) {
    // Pick the Nth matching table explicitly, rather than a positional CSS
    // selector, since sites often repeat the identical table markup for
    // responsive/mobile variants.
    const table = $(watcher.tableSelector ?? "table").eq(watcher.tableIndex);
    if (table.length === 0) {
      throw new Error(`No table at index ${watcher.tableIndex} for selector ${watcher.tableSelector}`);
    }
    rows = table.find(watcher.rowSelector ?? "tr");
  } else {
    rows = $(watcher.rowSelector);
  }

  if (rows.length === 0) {
    throw new Error(`Row selector matched nothing: ${watcher.rowSelector}`);
  }

  const hasHeaderRow = watcher.hasHeaderRow ?? true;
  const notices = [];
  rows.each((rowIndex, rowEl) => {
    // Some sites mark every cell as <th> rather than just the header, so
    // tag-based detection isn't reliable — skip by position instead. Not
    // every table has a header row at all, though (e.g. some ASP.NET
    // GridViews render data straight from row 0) — `hasHeaderRow: false`
    // opts out.
    if (hasHeaderRow && rowIndex === 0) return;

    const row = $(rowEl);
    const cells = row.find("td, th");
    if (watcher.minCells != null && cells.length < watcher.minCells) return;

    const titleCell = cells.eq(watcher.titleCellIndex ?? 0);
    if (titleCell.length === 0) return;

    const title = normalizeText(titleCell.text());
    if (!title) return;

    const linkCell = watcher.linkCellIndex != null ? cells.eq(watcher.linkCellIndex) : titleCell;
    const href = linkCell.find("a").first().attr("href") ?? row.find("a").first().attr("href");
    const link = href ? new URL(href, watcher.url).href : null;

    // Priority: an explicit "Published Date" column (most authoritative) >
    // a filename-embedded upload date (system-generated, reliable) > a date
    // mentioned in the title text (often a deadline, not the publish date).
    const date =
      (watcher.dateCellIndex != null ? parseDateCell(cells.eq(watcher.dateCellIndex).text()) : null) ??
      inferExactDateFromLink(link) ??
      extractEmbeddedDate(title);

    notices.push({
      id: noticeId(title, link),
      title,
      link,
      date,
      sortTs: date ? null : inferSortTimestamp(link),
    });
  });
  return notices;
}

// For sites whose notice list is client-rendered from a JS variable
// embedded in the page's own <script> tag, e.g. AFMC Pune's
// `var notificationsJSON1 = [...]` — the JSON is in the raw HTML even
// though the visible list is built by JavaScript.
async function extractEmbeddedJson(watcher) {
  const html = await fetchWithTimeout(watcher.url, { insecureTls: watcher.insecureTls, timeoutMs: watcher.timeoutMs });
  const pattern = new RegExp(`${watcher.variableName}\\s*=\\s*(\\[.*?\\]);`, "s");
  const match = html.match(pattern);
  if (!match) {
    throw new Error(`Embedded JSON variable not found: ${watcher.variableName}`);
  }

  const items = JSON.parse(match[1]);
  if (!Array.isArray(items)) {
    throw new Error("Embedded JSON did not parse to an array");
  }

  return items.map((item) => {
    const title = normalizeText(String(item[watcher.titleField]));
    const rawDate = item[watcher.dateField];
    const parsed = rawDate ? new Date(rawDate) : null;
    const date =
      parsed && !Number.isNaN(parsed.getTime())
        ? `${String(parsed.getDate()).padStart(2, "0")}/${String(parsed.getMonth() + 1).padStart(2, "0")}/${parsed.getFullYear()}`
        : null;
    // No direct PDF URL is available (the source encrypts/tokenizes it),
    // so link back to the notice-board page itself rather than guess.
    return {
      id: `${watcher.authorityId}-${item[watcher.idField ?? "id"]}`,
      title,
      link: watcher.fallbackLink ?? watcher.url,
      date,
    };
  });
}

async function extractNmcList(watcher) {
  const body = await fetchWithTimeout(watcher.url, { insecureTls: watcher.insecureTls, timeoutMs: watcher.timeoutMs });
  const items = JSON.parse(body);
  if (!Array.isArray(items)) {
    throw new Error("NMC API returned unexpected shape");
  }

  return items.map((item) => ({
    id: `nmc-${item.latestId}`,
    title: item.pageName ?? "Untitled notice",
    link: item.docUpload ? new URL(item.docUpload, "https://www.nmc.org.in").href : null,
    date: item.updatedDate ?? null,
  }));
}

function parseSignalMs(signal) {
  if (signal.date) {
    const m = signal.date.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) {
      const [, day, month, year] = m;
      const ms = Date.UTC(Number(year), Number(month) - 1, Number(day));
      if (!Number.isNaN(ms)) return ms;
    }
  }
  // A link-inferred guess (e.g. an "uploads/2026/06/" path) is lower
  // confidence than a confirmed date, but still a real, non-borrowed
  // signal — worth inheriting from when that's all a neighbor has.
  if (typeof signal.sortTs === "number" && !Number.isNaN(signal.sortTs)) return signal.sortTs;
  return null;
}

// Applies to every extractor's output: a source whose list is itself
// newest-first, but doesn't date every item, sometimes posts a brand-new
// notice with no date anywhere in its title or link, directly above an
// older dated one (seen on Uttarakhand HNBUMU, and audited to also affect
// Gujarat, Jharkhand, Tamil Nadu, Tripura, Haryana, Delhi IPU, J&K, Bihar,
// Assam, Odisha and UP). Undated items normally rank below every dated one
// (see UNDATED_FALLBACK_OFFSET_MS in lib/data.js) specifically so stale
// pinned resources (Information Bulletin, Seat Matrix, ...) can't outrank
// real notices — but that also buries a genuinely-new undated item behind
// months-old dated ones.
//
// By default (maxLookahead: 1) only the item *directly* before a dated one
// inherits that neighbor's timestamp (batchIndex then separates the two —
// see the note inside the function) — not cascaded further back, so
// undated pinned resources earlier in the same list (which only ever
// neighbor other undated items) are unaffected.
//
// `watcher.deepDateInference: true` (maxLookahead: Infinity) lifts that
// one-hop limit for sources verified to be a single chronological notice
// feed with no separate static-resources block mixed in — e.g. Assam DME,
// which posts long runs of a dozen+ consecutive undated notices between
// dated ones (checked manually before enabling; a source mixing in
// permanent reference links, like Uttarakhand, must stay on the default
// one-hop mode or those would wrongly inherit a recent-looking date too).
//
// Either way, only sortTs is touched, never the displayed `date` field, so
// this can't trigger a false "New" badge (noticeFreshness.js keys off
// `date`, not sortTs).
function inferDatesFromDatedNeighbors(notices, maxLookahead = 1) {
  // Snapshot each item's own (non-borrowed) signal before mutating, so a
  // borrow always traces back to one genuine date/sortTs, never to a value
  // another undated item itself just borrowed.
  const originalSignal = notices.map((n) => ({ date: n.date, sortTs: n.sortTs }));

  for (let i = notices.length - 2; i >= 0; i--) {
    const current = notices[i];
    // Skips anything with EITHER a confirmed date OR its own sortTs guess.
    // A same-source neighbor's confirmed date is often more accurate than
    // a lone item's own weak link-guess (tried relaxing this to let a
    // stronger neighbor override a weak guess — e.g. Delhi IPU's "UG
    // Admission Brochure", linked to a Jan-2026 path and guessed day 1,
    // sitting right before a confirmed 29 Jan notice) but that broke on
    // *runs* of such items: two neighbors that both only have their own
    // weak guess can end up borrowing from each other's still-stale
    // pre-mutation snapshot instead of reaching the real date past both of
    // them, producing a worse order than either guess alone. Not worth
    // that risk for what's a rare, minor edge case.
    if (current.date || current.sortTs) continue;

    for (let hop = 1; hop <= maxLookahead && i + hop < notices.length; hop++) {
      const ms = parseSignalMs(originalSignal[i + hop]);
      if (ms == null) continue;
      // No epsilon added here on purpose: noticeSortKey (lib/data.js)
      // already breaks same-value ties by page position (batchIndex,
      // assigned right after this function runs), and that alone is
      // enough to place a borrowed item correctly relative to *every*
      // neighbor sharing the same base timestamp — not just the one it
      // borrowed from. Adding a flat margin here overshot: Himachal's
      // items 0/1/2 all inferred the same month-level sortTs, and a flat
      // "+1 hour" on item 1's borrow pushed it above item 0 too, even
      // though item 0 precedes it on the live page.
      current.sortTs = ms;
      break;
    }
  }
}

// Runs a watcher's extraction (source DOM/list order, no dedup or state
// bookkeeping) — shared by checkWatcher and by ad-hoc order-verification
// tooling that needs to see exactly what the source currently shows.
export async function extractNotices(watcher) {
  let notices;
  if (watcher.type === "html-list") {
    notices = await extractHtmlList(watcher);
  } else if (watcher.type === "html-list-grouped") {
    notices = await extractHtmlListGrouped(watcher);
  } else if (watcher.type === "html-list-section") {
    notices = await extractHtmlListSection(watcher);
  } else if (watcher.type === "html-table") {
    notices = await extractHtmlTable(watcher);
  } else if (watcher.type === "nmc-json") {
    notices = await extractNmcList(watcher);
  } else if (watcher.type === "embedded-json") {
    notices = await extractEmbeddedJson(watcher);
  } else if (watcher.type === "html-tabs-auto") {
    notices = await extractHtmlTabsAuto(watcher);
  } else {
    throw new Error(`Unknown watcher type: ${watcher.type}`);
  }

  inferDatesFromDatedNeighbors(notices, watcher.deepDateInference ? Infinity : 1);

  if (watcher.sourceLabel) {
    // Re-scope the id by source: the same notice legitimately appears on
    // multiple pages of one authority's site (e.g. Bihar cross-posts a
    // notice to both its homepage feed and its UGMAC-specific board), and
    // each should still show up in its own tab rather than being deduped
    // away as "already seen" by whichever watcher happened to run first.
    notices = notices.map((n) => ({
      ...n,
      source: watcher.sourceLabel,
      id: `${watcher.sourceLabel}:${n.id}`,
    }));
  }

  // Position on the source page right now, 0 = topmost. Several sources
  // (e.g. Gujarat) share one date across a whole batch of notices — day
  // granularity alone can't order those, so this lets noticeSortKey break
  // same-date ties by the source's own list order instead of by whichever
  // arrival order our storage happened to merge them in.
  return notices.map((n, i) => ({ ...n, batchIndex: i }));
}

async function checkWatcher(watcher) {
  try {
    const notices = await extractNotices(watcher);

    // Watchers key their state by `id` when set, falling back to
    // `authorityId` — needed when one authority has multiple watchers (e.g.
    // Bihar's general "Latest Updates" widget plus its UGMAC-specific
    // notice board), so they don't clobber each other's seenIds.
    const watchKey = watcher.id ?? watcher.authorityId;

    const state = await getWatchState();
    const previous = state[watchKey] ?? { seenIds: [] };
    const seenIds = new Set(previous.seenIds ?? []);

    const newNotices = notices.filter((n) => !seenIds.has(n.id));
    if (newNotices.length > 0) {
      // Sequential, not Promise.all: the free translate endpoint has no API
      // key and is rate-limited, and a batch is usually only a handful of
      // genuinely new notices per run anyway.
      for (const notice of newNotices) {
        const translation = await translateTitle(notice.title);
        if (translation) Object.assign(notice, translation);
      }
      await addNotices(watcher.authorityId, newNotices);
    }

    const updatedSeenIds = [...new Set([...notices.map((n) => n.id), ...seenIds])].slice(
      0,
      MAX_SEEN_IDS
    );
    await setWatchEntry(watchKey, {
      seenIds: updatedSeenIds,
      lastCheckedAt: new Date().toISOString(),
      status: "ok",
    });

    return {
      authorityId: watcher.authorityId,
      watcherId: watchKey,
      status: newNotices.length > 0 ? "new-notices" : "unchanged",
      newCount: newNotices.length,
    };
  } catch (error) {
    const watchKey = watcher.id ?? watcher.authorityId;
    const state = await getWatchState();
    await setWatchEntry(watchKey, {
      ...(state[watchKey] ?? {}),
      lastCheckedAt: new Date().toISOString(),
      status: "error",
      error: error.message,
    });
    return { authorityId: watcher.authorityId, watcherId: watchKey, status: "error", error: error.message };
  }
}

export async function checkAllWatchers() {
  const watchers = await getWatchers();
  const results = [];
  for (const watcher of watchers) {
    results.push(await checkWatcher(watcher));
  }
  return results;
}
