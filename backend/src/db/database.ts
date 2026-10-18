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
  db.pragma("foreign_keys = ON");
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
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      created_at_epoch_ms INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS devices (
      device_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      crew_member_id TEXT NOT NULL UNIQUE,
      token_hash TEXT NOT NULL,
      paired_at_epoch_ms INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_devices_user ON devices (user_id);
    CREATE TABLE IF NOT EXISTS pairing_codes (
      code TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      secondary_code TEXT,
      expires_at_epoch_ms INTEGER NOT NULL,
      claimed_by_user_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pairing_device ON pairing_codes (device_id);
  `);
  migrate(db);
  console.log(`SQLite ready at ${dbPath}`);
}

function columns(db: Database.Database, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
    (c) => c.name,
  );
}

function addColumn(db: Database.Database, table: string, col: string, ddl: string): void {
  if (!columns(db, table).includes(col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
  }
}

function migrate(db: Database.Database): void {
  addColumn(db, "pairing_codes", "secondary_code", "TEXT");
  addColumn(db, "pairing_codes", "created_at_epoch_ms", "INTEGER");
  addColumn(db, "devices", "revoked_at_epoch_ms", "INTEGER");

  // Pending tokens used to be stored in plaintext: drop the legacy table (transient data).
  const pending = columns(db, "device_token_pending");
  if (pending.includes("token_plain")) {
    db.exec(`DROP TABLE device_token_pending`);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS device_token_pending (
      device_id TEXT PRIMARY KEY,
      token_enc TEXT NOT NULL,
      created_at_epoch_ms INTEGER NOT NULL
    );
  `);

  // Analytics: ingest log + detected-sensor inventory (idempotent, additive).
  db.exec(`
    CREATE TABLE IF NOT EXISTS ingest_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT NOT NULL,
      crew_member_id TEXT NOT NULL,
      received_at_epoch_ms INTEGER NOT NULL,
      batch_id TEXT,
      readings_received INTEGER NOT NULL DEFAULT 0,
      readings_accepted INTEGER NOT NULL DEFAULT 0,
      duplicates INTEGER NOT NULL DEFAULT 0,
      assessments_received INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      error_code TEXT,
      error_detail TEXT,
      bytes INTEGER,
      app_version TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_ingest_log_device_id
      ON ingest_log (device_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_ingest_log_device_time
      ON ingest_log (device_id, received_at_epoch_ms DESC);
    CREATE TABLE IF NOT EXISTS device_sensor_inventory (
      device_id TEXT NOT NULL,
      sensor_key TEXT NOT NULL,
      type_name TEXT NOT NULL,
      type_id INTEGER,
      sensor_name TEXT,
      vendor TEXT,
      wake_up INTEGER,
      resolution REAL,
      available INTEGER NOT NULL,
      permission_granted INTEGER,
      in_use INTEGER,
      delivering INTEGER NOT NULL,
      last_event_at INTEGER,
      reported_at INTEGER NOT NULL,
      app_version TEXT,
      PRIMARY KEY (device_id, sensor_key)
    );
  `);

  // Dedupe existing rows, then enforce uniqueness.
  db.transaction(() => {
    db.exec(`
      DELETE FROM sensor_readings WHERE id NOT IN (
        SELECT MIN(id) FROM sensor_readings GROUP BY crew_member_id, recorded_at_epoch_ms);
      DELETE FROM health_assessments WHERE id NOT IN (
        SELECT MIN(id) FROM health_assessments GROUP BY crew_member_id, assessed_at_epoch_ms);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_readings_crew_time
        ON sensor_readings (crew_member_id, recorded_at_epoch_ms);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_assessments_crew_time
        ON health_assessments (crew_member_id, assessed_at_epoch_ms);
    `);
  })();
}

export function isDatabaseEmpty(): boolean {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM profiles")
    .get() as { n: number };
  return row.n === 0;
}
