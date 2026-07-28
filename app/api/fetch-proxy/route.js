import { NextResponse } from "next/server";
import { BROWSER_HEADERS } from "@/lib/browserHeaders";

// Fetches a source page on the scheduled cron's behalf, from Vercel's IP
// range instead of GitHub Actions' — several .gov.in sources this app
// scrapes intermittently or permanently refuse/stall connections
// specifically from GitHub Actions' well-known CI IP ranges (reproduces
// reliably in the scheduled workflow, works fine from other networks),
// consistent with an IP-range block rather than anything about the request
// itself. Routing just those watchers through this endpoint (see
// `viaProxy` in data/watchers.json / lib/watcher.js) moves the fetch to a
// different, less commonly-blocklisted IP range at zero extra cost.
//
// Deliberately a strict hostname allowlist, not a general-purpose proxy:
// this route has no auth and is publicly reachable, so without the
// allowlist it would be an open URL-fetch relay (a classic SSRF/abuse
// vector) rather than a narrow fix for specific known sources.
const ALLOWED_HOSTS = new Set([
  "www.jkbopee.gov.in",
  "dme.tripura.gov.in",
  "afmc.nic.in",
  "cetonline.karnataka.gov.in",
  "dme.assam.gov.in",
  "www.meghealth.gov.in",
  "dmetrap.in",
]);

export async function GET(request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    const res = await fetch(parsed.href, { headers: BROWSER_HEADERS });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "text/html; charset=utf-8" },
    });
  } catch (err) {
    return NextResponse.json({ error: `Proxy fetch failed: ${err.message}` }, { status: 502 });
  }
}
