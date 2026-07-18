import { NextResponse } from "next/server";
import { getTickerPayload } from "@/lib/ticker";

export const dynamic = "force-dynamic";

// Public, read-only, cross-origin by design — this is what MBBS Lighthouse's
// ticker and the support dashboard's Counselling Pulse widget both fetch.
// Open to any origin ("*") rather than an allowlist: the payload carries no
// credentials or per-user data, so there's nothing a third-party embed could
// leak, and it avoids a repeat of having to patch this file every time a new
// subdomain (or an external partner site) wants to embed the feed.
export async function GET() {
  try {
    const items = await getTickerPayload();
    return NextResponse.json({ items }, { headers: { "Access-Control-Allow-Origin": "*" } });
  } catch (err) {
    // Never let the feed 500 into visitors' faces — an unreachable/misconfigured
    // GitHub read should degrade to "no ticker items" rather than break the
    // page embedding this feed (see Ticker.js's own catch, which treats a
    // non-ok or malformed response the same way).
    console.error("[/api/ticker]", err.message);
    return NextResponse.json({ items: [] }, { headers: { "Access-Control-Allow-Origin": "*" } });
  }
}
