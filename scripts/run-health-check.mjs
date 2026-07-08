// Runs the read-only source audit and saves a small summary to
// data/health-status.json — the main page reads this (via
// lib/health.js) to show a "some sources need attention" banner linking
// to /health, without every visitor triggering a live 39-site check.
//
// Meant to run on a schedule (see .github/workflows/health-check.yml),
// separate from check-updates.yml's every-30-min notice fetch — this is
// about watcher correctness, not new content.
import { promises as fs } from "fs";
import path from "path";
import { runAudit } from "../lib/audit.js";

const report = await runAudit();

// Counts here exclude already-investigated KNOWN_ISSUES (see lib/audit.js)
// — the banner on the main page should only ever flag something genuinely
// new, not re-alarm on the same handful of understood trade-offs every
// single check.
const unknownOnly = (status) => report.byStatus[status].filter((r) => !r.known).length;

const summary = {
  checkedAt: report.checkedAt,
  healthy: report.healthy,
  errorCount: unknownOnly("ERROR"),
  emptyCount: unknownOnly("EMPTY"),
  orderMismatchCount: unknownOnly("ORDER"),
  knownIssueCount: report.knownIssueCount,
};

await fs.writeFile(
  path.join(process.cwd(), "data", "health-status.json"),
  JSON.stringify(summary, null, 2) + "\n",
  "utf-8"
);

console.log(
  `Health check saved: healthy=${summary.healthy} (${summary.errorCount} error, ${summary.emptyCount} empty, ${summary.orderMismatchCount} order mismatch, ${summary.knownIssueCount} known/already-understood)`
);
