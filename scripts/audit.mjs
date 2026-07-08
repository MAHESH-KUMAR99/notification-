// Compares each watcher's LIVE source against data/authorities.json.
// Run anytime with: node scripts/audit.mjs
// Same check is also available as a "Check now" button at /health,
// backed by app/api/audit/route.js — both call lib/audit.js.
import { runAudit } from "../lib/audit.js";

const { watcherCount, byStatus, totalNewNotSaved, unknownIssueCount, knownIssueCount, healthy } = await runAudit();

console.log(`\nAudited ${watcherCount} watcher(s).\n`);

function printGroup(status, label) {
  const unknown = byStatus[status].filter((r) => !r.known);
  const known = byStatus[status].filter((r) => r.known);

  if (unknown.length > 0) {
    console.log(`${label} — NEW/UNEXPECTED (${unknown.length}):`);
    for (const r of unknown) {
      console.log(`  [${r.key}] ${r.detail ?? `${r.inversions ?? ""} inversion(s) across ${r.overlapping ?? ""} item(s)`.trim()}`);
      if (r.example) console.log(`    e.g. ${r.example}`);
    }
    console.log();
  }
  if (known.length > 0) {
    console.log(`${label} — known/already understood (${known.length}):`);
    for (const r of known) console.log(`  [${r.key}] ${r.knownReason}`);
    console.log();
  }
}

printGroup("ERROR", "ERROR");
printGroup("EMPTY", "EMPTY");
printGroup("ORDER", "ORDER MISMATCH");

console.log(`OK (${byStatus.OK.length}): ${byStatus.OK.map((r) => r.key).join(", ")}\n`);
console.log(`Informational: ${totalNewNotSaved} item(s) live but not yet in storage.`);
console.log(`${unknownIssueCount} new/unexpected issue(s), ${knownIssueCount} known/already-understood issue(s).`);

if (!healthy) process.exit(1);
