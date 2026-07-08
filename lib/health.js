import { promises as fs } from "fs";
import path from "path";

const HEALTH_STATUS_PATH = path.join(process.cwd(), "data", "health-status.json");

// Reads the cached summary scripts/run-health-check.mjs writes on its
// schedule. Never throws: the file won't exist until that job has run at
// least once (e.g. right after this feature is first deployed), and a
// missing health signal shouldn't break the page — it just means no
// banner shows yet.
export async function getHealthStatus() {
  try {
    const raw = await fs.readFile(HEALTH_STATUS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
