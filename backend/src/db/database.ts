import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

export function initDatabase(): void {
  const defaultPath = join(here, "../../data/rahel.db");
  const dbPath = process.env.RAHEL_DB_PATH ?? defaultPath;
  mkdirSync(dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      crew_member_id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crew_member_id TEXT NOT NULL,
      recorded_at_epoch_ms INTEGER NOT NULL,
      data_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_readings_crew_time
      ON sensor_readings (crew_member_id, recorded_at_epoch_ms DESC);
    CREATE TABLE IF NOT EXISTS health_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crew_member_id TEXT NOT NULL,
      assessed_at_epoch_ms INTEGER NOT NULL,
      data_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_assessments_crew_time
      ON health_assessments (crew_member_id, assessed_at_epoch_ms DESC);
    CREATE TABLE IF NOT EXISTS processed_batches (
      crew_member_id TEXT NOT NULL,
      client_batch_id TEXT NOT NULL,
      PRIMARY KEY (crew_member_id, client_batch_id)
    );
  `);
  console.log(`SQLite ready at ${dbPath}`);
}

export function isDatabaseEmpty(): boolean {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM profiles")
    .get() as { n: number };
  return row.n === 0;
}
