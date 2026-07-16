import { NextResponse } from "next/server";
import { isValidAdminPin } from "@/lib/adminAuth";
import { toggleApproval } from "@/lib/ticker";

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body || !body.id || !["add", "remove"].includes(body.action)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!isValidAdminPin(body.pin)) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  try {
    const items = await toggleApproval(body.id, body.action);
    return NextResponse.json({ ok: true, count: items.length });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
