import { NextResponse } from "next/server";
import { getTickerPayload } from "@/lib/ticker";

export const dynamic = "force-dynamic";

// Public, read-only, cross-origin by design — this is what MBBS Lighthouse's
// ticker fetches. Locked to that one origin rather than "*" so no other
// site can quietly piggyback on the feed. In local dev only, "*" is used
// instead so MBBS Lighthouse's own dev server (a different localhost port)
// can be tested end-to-end without needing prod deployed first.
const ALLOWED_ORIGIN =
  process.env.NODE_ENV === "production" ? "https://mbbslighthouse.in" : "*";

export async function GET() {
  try {
    const items = await getTickerPayload();
    return NextResponse.json(
      { items },
      { headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN } }
    );
  } catch (err) {
    // Never let the feed 500 into visitors' faces — an unreachable/misconfigured
    // GitHub read should degrade to "no ticker items" rather than break the
    // page embedding this feed (see Ticker.js's own catch, which treats a
    // non-ok or malformed response the same way).
    console.error("[/api/ticker]", err.message);
    return NextResponse.json(
      { items: [] },
      { headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN } }
    );
  }
}
