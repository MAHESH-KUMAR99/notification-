import { NextResponse } from "next/server";
import { runAudit } from "@/lib/audit";

// Vercel Hobby allows up to 60s for a function with this set (default is
// 10s) — 39 watchers at bounded concurrency (see lib/audit.js) should
// finish well inside that, but a handful of slow/unresponsive government
// sites could still push close to it.
export const maxDuration = 60;

export async function GET() {
  const report = await runAudit();
  return NextResponse.json(report);
}
