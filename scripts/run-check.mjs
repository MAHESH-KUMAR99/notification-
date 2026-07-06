// Entry point for the GitHub Actions cron job — runs outside the Next.js
// server so it can run on a schedule and commit results straight into the
// repo (Vercel's filesystem is read-only at runtime, so writes there never
// persist — see notification/README or project notes).
import { checkAllWatchers } from "../lib/watcher.js";

const results = await checkAllWatchers();

const updated = results.filter((r) => r.status === "new-notices");
const errored = results.filter((r) => r.status === "error");

console.log(`Checked ${results.length} watcher(s).`);
if (updated.length > 0) {
  console.log("Updated:");
  for (const r of updated) {
    console.log(`  - ${r.authorityId} (${r.watcherId}): +${r.newCount} new notice(s)`);
  }
}
if (errored.length > 0) {
  console.log("Errors:");
  for (const r of errored) {
    console.log(`  - ${r.authorityId} (${r.watcherId}): ${r.error}`);
  }
}

// Non-zero exit only if EVERY watcher errored — a handful of flaky sites
// shouldn't fail the whole workflow run.
if (errored.length === results.length && results.length > 0) {
  process.exit(1);
}
