import { getAuthorities } from "./data";
import { readRepoFile, writeRepoFile } from "./githubCommit";

const APPROVALS_PATH = "data/ticker-approvals.json";

// Keeps the ticker small and self-tidying: once 10 notices are approved,
// approving an 11th silently drops the oldest approval rather than growing
// forever — admin never has to remember to clean up old ones, but can still
// remove any specific one early via the same toggle.
const MAX_TICKER_ITEMS = 10;

export async function readApprovals({ revalidate = 0 } = {}) {
  const { content, sha } = await readRepoFile(APPROVALS_PATH, { revalidate });
  if (!content) return { items: [], sha: null };
  const parsed = JSON.parse(content);
  return { items: parsed.items ?? [], sha };
}

const MAX_WRITE_ATTEMPTS = 6;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Clicking several ⭐ in quick succession means each toggle's read-then-write
// can overlap another's — GitHub rejects a write whose sha is no longer the
// file's current one (409/422) rather than silently overwriting a concurrent
// change. Retrying with a fresh read is the standard fix for that kind of
// optimistic-concurrency conflict; a real config problem (missing token,
// wrong permissions) fails with a different status and still surfaces
// immediately instead of retrying pointlessly.
export async function toggleApproval(noticeId, action) {
  // A previously-approved notice can silently fall off its authority's
  // stored list (each authority only keeps its latest 20 — see
  // MAX_NOTICES_PER_AUTHORITY in lib/data.js). getTickerPayload already
  // skips those "ghost" entries when *displaying* the ticker, but without
  // this, the ghost entry itself never leaves ticker-approvals.json — it
  // keeps eating one of the 10 slots forever, so the ticker can quietly
  // shrink to fewer visible notices than its own count claims. Pruning
  // ghosts here (on every add/remove) means the admin never has to notice
  // or manually clean this up.
  const authorities = await getAuthorities();
  const liveNoticeIds = new Set(authorities.flatMap((a) => (a.notices ?? []).map((n) => n.id)));

  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
    // Always a fresh read here (revalidate: 0, the default) — writing off a
    // cached sha would make GitHub reject the commit the moment it's stale.
    const { items: rawItems, sha } = await readApprovals();
    const items = rawItems.filter((i) => liveNoticeIds.has(i.id));
    let next;
    if (action === "add") {
      const withoutExisting = items.filter((i) => i.id !== noticeId);
      next = [...withoutExisting, { id: noticeId, approvedAt: new Date().toISOString() }];
      next.sort((a, b) => new Date(a.approvedAt) - new Date(b.approvedAt));
      if (next.length > MAX_TICKER_ITEMS) next = next.slice(next.length - MAX_TICKER_ITEMS);
    } else {
      next = items.filter((i) => i.id !== noticeId);
    }

    try {
      await writeRepoFile(
        APPROVALS_PATH,
        JSON.stringify({ items: next }, null, 2) + "\n",
        sha,
        `chore: ${action === "add" ? "approve" : "remove"} ticker notice ${noticeId}`
      );
      return next;
    } catch (err) {
      const isConflict = err.status === 409 || err.status === 422;
      if (!isConflict || attempt === MAX_WRITE_ATTEMPTS) throw err;
      // Randomized so N racing clicks don't all retry on the exact same
      // tick and collide again — each waits a different, growing amount.
      await sleep(100 * attempt + Math.random() * 200);
    }
  }
}

// Builds the public ticker payload: joins approved IDs back to their full
// notice + authority name, newest-approved-first. Notices that have since
// fallen off an authority's stored list (aged out past MAX_NOTICES_PER_AUTHORITY
// in lib/data.js) are silently skipped rather than shown as broken entries.
export async function getTickerPayload() {
  const [{ items }, authorities] = await Promise.all([
    readApprovals({ revalidate: 60 }),
    getAuthorities(),
  ]);

  const noticeIndex = new Map();
  for (const a of authorities) {
    for (const n of a.notices ?? []) {
      noticeIndex.set(n.id, { notice: n, authorityName: a.name });
    }
  }

  return items
    .slice()
    .reverse()
    .map((approval) => {
      const found = noticeIndex.get(approval.id);
      if (!found) return null;
      const { notice, authorityName } = found;
      return {
        id: notice.id,
        title: notice.titleEn ?? notice.title,
        link: notice.link ?? null,
        date: notice.date ?? null,
        authorityName,
        approvedAt: approval.approvedAt,
      };
    })
    .filter(Boolean);
}
