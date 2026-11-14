import { getDb, prep } from "../db/database.js";

/** Retention: rows older than this are purged, and at most MAX_ROWS_PER_DEVICE are kept per device. */
export const INGEST_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_ROWS_PER_DEVICE = 5000;

export type IngestLogEntry = {
  deviceId?: string | null;
  crewMemberId: string;
  batchId?: string | null;
  readingsReceived: number;
  readingsAccepted: number;
  assessmentsReceived: number;
  status: "ok" | "rechazado";
  errorCode?: string | null;
  errorDetail?: string | null;
  bytes?: number | null;
  appVersion?: string | null;
};

/** Device id for a crew member (used when the request did not carry one, e.g. dev legacy ingest). */
function deviceIdForCrew(crewMemberId: string): string | null {
  const row = prep(`SELECT device_id FROM devices WHERE crew_member_id = ?`)
    .get(crewMemberId) as { device_id: string } | undefined;
  return row?.device_id ?? null;
}

/** Appends one ingest-log row. Safe inside a caller's transaction. No-op if no device is known (seed data). */
export function recordIngest(e: IngestLogEntry): void {
  const deviceId = e.deviceId ?? deviceIdForCrew(e.crewMemberId);
  if (!deviceId) return;
  prep(
      `INSERT INTO ingest_log (device_id, crew_member_id, received_at_epoch_ms, batch_id,
         readings_received, readings_accepted, duplicates, assessments_received,
         status, error_code, error_detail, bytes, app_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      deviceId,
      e.crewMemberId,
      Date.now(),
      e.batchId ?? null,
      e.readingsReceived,
      e.readingsAccepted,
      e.status === "ok" ? Math.max(0, e.readingsReceived - e.readingsAccepted) : 0,
      e.assessmentsReceived,
      e.status,
      e.errorCode ?? null,
      e.errorDetail ? e.errorDetail.slice(0, 300) : null,
      e.bytes ?? null,
      e.appVersion ?? null,
    );
}

/** Never lets a logging failure break ingestion of a rejected request. */
export function recordIngestSafe(e: IngestLogEntry): void {
  try {
    recordIngest(e);
  } catch (err) {
    console.error("[ingest_log]", err);
  }
}

export function purgeIngestLog(now = Date.now()): number {
  const db = getDb();
  const old = prep(`DELETE FROM ingest_log WHERE received_at_epoch_ms < ?`)
    .run(now - INGEST_LOG_RETENTION_MS).changes;
  const over = prep(
      `DELETE FROM ingest_log WHERE id IN (
         SELECT id FROM (
           SELECT id, ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY id DESC) AS rn
           FROM ingest_log
         ) WHERE rn > ?)`,
    )
    .run(MAX_ROWS_PER_DEVICE).changes;
  return old + over;
}
