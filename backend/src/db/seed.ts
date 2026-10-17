import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TelemetryBatchRequest, UserProfileSnapshotDto } from "../types/health.js";
import { isDatabaseEmpty } from "./database.js";
import { loadSeed } from "../store/telemetryStore.js";

export function seedIfEmpty(): void {
  if (!isDatabaseEmpty()) {
    console.log("SQLite already has data — skip seed");
    return;
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const seedPath = join(here, "../../data/seed-dashboard.json");
  const seed = JSON.parse(readFileSync(seedPath, "utf8")) as {
    profiles: UserProfileSnapshotDto[];
    batches: TelemetryBatchRequest[];
  };
  loadSeed(seed);
  console.log(`Seeded ${seed.profiles.length} profiles, ${seed.batches.length} batches`);
}
