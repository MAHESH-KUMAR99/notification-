import { NextResponse } from "next/server";
import { getAuthorities } from "@/lib/data";

export async function GET() {
  const authorities = await getAuthorities();
  return NextResponse.json(authorities);
}
