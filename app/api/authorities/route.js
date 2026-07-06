import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthorities, updateAuthority } from "@/lib/data";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function GET() {
  const authorities = await getAuthorities();
  return NextResponse.json(authorities);
}

export async function PATCH(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!verifySessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const updates = {};
  if ("latestUpdate" in body) updates.latestUpdate = body.latestUpdate;

  try {
    const updated = await updateAuthority(id, updates);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Authority not found" }, { status: 404 });
  }
}
