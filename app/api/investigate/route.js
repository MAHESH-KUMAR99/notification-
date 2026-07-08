import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { investigateUrl } from "@/lib/investigate";

export const maxDuration = 30;

function watcherKey(watcher) {
  return `${watcher.authorityId}${watcher.id ? `/${watcher.id}` : ""}`;
}

export async function GET(request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing ?key=" }, { status: 400 });
  }

  const watchers = JSON.parse(
    await fs.readFile(path.join(process.cwd(), "data", "watchers.json"), "utf-8")
  );
  const watcher = watchers.find((w) => watcherKey(w) === key);
  if (!watcher) {
    return NextResponse.json({ error: `No watcher found for key "${key}"` }, { status: 404 });
  }

  try {
    const result = await investigateUrl(watcher.url, { insecureTls: watcher.insecureTls });
    return NextResponse.json({ key, currentSelector: watcher.itemSelector ?? null, ...result });
  } catch (err) {
    return NextResponse.json({ key, error: err.message }, { status: 502 });
  }
}
