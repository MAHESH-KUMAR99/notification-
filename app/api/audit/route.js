import { NextResponse } from "next/server";
import { runAudit } from "@/lib/audit";

// Vercel Hobby allows up to 60s for a function with this set (default is
// 10s). The defaults in lib/audit.js (8 concurrent, 2 retries, 15s each)
// hit a real 504 here in production — several government sites reachable
// fine locally/from GitHub's runners are much slower from Vercel's
// network. Tuned tighter specifically for this route: more concurrency (2
// rounds instead of 5 for 39 watchers), a shorter per-fetch timeout, and
// only 1 retry — worst case is roughly 2 rounds x (8s + 300ms + 8s) ≈ 33s,
// leaving real margin under the 60s cap. The CLI/scheduled workflow
// (scripts/audit.mjs) keeps the original, more patient defaults since it
// isn't racing a hard deadline.
export const maxDuration = 60;

export async function GET() {
  const report = await runAudit({ concurrency: 20, retryCount: 1, retryDelayMs: 300, timeoutMs: 8000 });
  return NextResponse.json(report);
}
