import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { checkAllWatchers } from "@/lib/watcher";

async function isAuthorized(request) {
  const cookieStore = await cookies();
  if (verifySessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) return true;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await checkAllWatchers();
  return NextResponse.json({ results });
}
