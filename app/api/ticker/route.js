import { NextResponse } from "next/server";
import { getTickerPayload } from "@/lib/ticker";

export const dynamic = "force-dynamic";

// Public, read-only, cross-origin by design — this is what MBBS Lighthouse's
// ticker fetches. Kept to a specific allowlist (reflected back per-request)
// rather than "*" so no unrelated site can quietly piggyback on the feed —
// but the allowlist includes localhost on any port too, since testing the
// ticker locally (against this deployed API) is a real, recurring need, not
// just a one-time dev-vs-prod split.
const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?mbbslighthouse\.in$/, /^http:\/\/localhost:\d+$/];

function resolveOrigin(request) {
  const origin = request.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.some((pattern) => pattern.test(origin))) return origin;
  return "https://mbbslighthouse.in";
}

export async function GET(request) {
  const allowOrigin = resolveOrigin(request);
  try {
    const items = await getTickerPayload();
    return NextResponse.json({ items }, { headers: { "Access-Control-Allow-Origin": allowOrigin } });
  } catch (err) {
    // Never let the feed 500 into visitors' faces — an unreachable/misconfigured
    // GitHub read should degrade to "no ticker items" rather than break the
    // page embedding this feed (see Ticker.js's own catch, which treats a
    // non-ok or malformed response the same way).
    console.error("[/api/ticker]", err.message);
    return NextResponse.json({ items: [] }, { headers: { "Access-Control-Allow-Origin": allowOrigin } });
  }
}
