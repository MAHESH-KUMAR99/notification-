// Vercel's runtime filesystem is read-only (see lib/data.js's own writes,
// which only ever happen from the GitHub Actions cron, never from a
// deployed request). Admin actions that need to persist (ticker
// approve/remove) can't write locally in production, so they go through
// GitHub's Contents API instead — the same "git is the database" pattern
// the cron workflows already rely on, just triggered by a click instead of
// a schedule.
const OWNER = "MAHESH-KUMAR99";
const REPO = "notification-";
const BRANCH = "main";

function apiHeaders() {
  const token = process.env.TICKER_GITHUB_TOKEN;
  if (!token) throw new Error("TICKER_GITHUB_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

// Reads a repo file's current content + sha (the sha is required by GitHub
// to prove you're updating the version you think you are, not clobbering a
// concurrent change).
//
// `revalidate` lets read-only callers (the public ticker GET, hit by every
// visitor's browser on a poll interval) share one cached GitHub API call
// for a short window instead of each request spending its own hit against
// GitHub's rate limit. Callers about to write (toggleApproval, which needs
// the true current sha to avoid clobbering a concurrent admin action) must
// pass `revalidate: 0` to force a fresh read.
export async function readRepoFile(filePath, { revalidate = 0 } = {}) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`;
  const res = await fetch(url, { headers: apiHeaders(), next: { revalidate } });
  if (res.status === 404) return { content: null, sha: null };
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const content = Buffer.from(json.content, "base64").toString("utf-8");
  return { content, sha: json.sha };
}

// Commits new content for a repo file. `expectedSha` must be the sha just
// read from readRepoFile (or null for a brand-new file) — this is what
// stops two admin clicks racing each other from silently losing one.
export async function writeRepoFile(filePath, content, expectedSha, message) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
  const body = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch: BRANCH,
    ...(expectedSha ? { sha: expectedSha } : {}),
  };
  const res = await fetch(url, { method: "PUT", headers: apiHeaders(), body: JSON.stringify(body) });
  if (!res.ok) {
    const err = new Error(`GitHub write failed: ${res.status} ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
