// A notice is "new" if the SOURCE's own published date is today or
// yesterday (day-granularity, since that's all these sites give us).
//
// Deliberately NOT based on `detectedAt` (when our scraper first saw it):
// the first time we scrape an authority — or re-scrape after a watch-state
// reset, or a notice's id shifts slightly on the source — every existing
// notice gets today's detectedAt even though most of it is weeks old on
// the actual site. That repainted stale backlog as "NEW" (e.g. Haryana
// notices dated 02/07 showing NEW on 08/07). The published date is the
// one signal that doesn't drift with our own pipeline's timing.
//
// An undated notice is never flagged "new" — we have no trustworthy signal
// for it either way, so silence is the safe default (matches how undated
// notices are already deprioritized in list sorting, see lib/data.js).
const NEW_WINDOW_DAYS = 1;

function parseNoticeDate(dateStr) {
  const m = dateStr?.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, day, month, year] = m;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isNewNotice(notice, now = new Date()) {
  const noticeDate = parseNoticeDate(notice.date);
  if (!noticeDate) return false;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = Math.round((today - noticeDate.getTime()) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 && diffDays <= NEW_WINDOW_DAYS;
}
