import { promises as fs } from "fs";
import path from "path";

const STATE_PATH = path.join(process.cwd(), "data", "watch-state.json");

export async function getWatchState() {
  const raw = await fs.readFile(STATE_PATH, "utf-8");
  return JSON.parse(raw);
}

export async function setWatchEntry(authorityId, entry) {
  const state = await getWatchState();
  state[authorityId] = entry;
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf-8");
}
