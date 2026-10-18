import { getDb, prep } from "../db/database.js";
import { ANALYSIS_WINDOW_MS, MAX_WINDOW_ROWS, SAMPLE_INTERVAL_MS } from "../estimation/constants.js";
import { enrichReadings } from "../estimation/index.js";
import { recordIngest } from "./ingestLogStore.js";
import type {
  CrewLatestDto,
  CrewSummaryDto,
  HealthAssessmentDto,
  SensorReadingDto,
  TelemetryBatchRequest,
  UserProfileSnapshotDto,
} from "../types/health.js";

export function upsertProfile(body: UserProfileSnapshotDto): void {
  prep(
      `INSERT INTO profiles (crew_member_id, data_json) VALUES (?, ?)
       ON CONFLICT(crew_member_id) DO UPDATE SET data_json = excluded.data_json`,
    )
    .run(body.crewMemberId, JSON.stringify(body));
}

export type IngestMeta = {
  deviceId?: string | null;
  bytes?: number | null;
  appVersion?: string | null;
};

type IngestResult = { acceptedReadings: number; acceptedAssessments: number };

let ingestTx: { db: ReturnType<typeof getDb>; run: (b: TelemetryBatchRequest, m: IngestMeta) => IngestResult } | null = null;

/** Built once per DB handle: db.transaction() prepares BEGIN/COMMIT statements on every call. */
function ingestTransaction() {
  const db = getDb();
  if (ingestTx && ingestTx.db === db) return ingestTx.run;
  const run = db.transaction((body: TelemetryBatchRequest, meta: IngestMeta): IngestResult => {
    const logBase = {
      deviceId: meta.deviceId,
      crewMemberId: body.crewMemberId,
      batchId: body.clientBatchId,
      readingsReceived: body.readings.length,
      assessmentsReceived: body.assessments.length,
      bytes: meta.bytes,
      appVersion: meta.appVersion ?? body.appVersion ?? null,
    };
    // Batch marker and data share one transaction: a failure leaves the batch retryable.
    if (
      prep(`INSERT OR IGNORE INTO processed_batches (crew_member_id, client_batch_id) VALUES (?, ?)`).run(
        body.crewMemberId,
        body.clientBatchId,
      ).changes === 0
    ) {
      recordIngest({ ...logBase, readingsAccepted: 0, status: "ok", errorCode: "duplicate_batch" });
      return { acceptedReadings: 0, acceptedAssessments: 0 };
    }
    // UNIQUE(crew_member_id, recorded_at_epoch_ms) + OR IGNORE = idempotent dedupe.
    const insertReading = prep(
      `INSERT OR IGNORE INTO sensor_readings (crew_member_id, recorded_at_epoch_ms, data_json)
       VALUES (?, ?, ?)`,
    );
    const insertAssessment = prep(
      `INSERT OR IGNORE INTO health_assessments (crew_member_id, assessed_at_epoch_ms, data_json)
       VALUES (?, ?, ?)`,
    );
    let acceptedReadings = 0;
    let acceptedAssessments = 0;
    for (const r of body.readings) {
      acceptedReadings += insertReading.run(
        body.crewMemberId,
        r.recordedAtEpochMs,
        JSON.stringify(r),
      ).changes;
    }
    for (const a of body.assessments) {
      acceptedAssessments += insertAssessment.run(
        body.crewMemberId,
        a.assessedAtEpochMs,
        JSON.stringify(a),
      ).changes;
    }
    recordIngest({ ...logBase, readingsAccepted: acceptedReadings, status: "ok" });
    return { acceptedReadings, acceptedAssessments };
  });
  ingestTx = { db, run };
  return run;
}

export function ingestBatch(body: TelemetryBatchRequest, meta: IngestMeta = {}): IngestResult {
  return ingestTransaction()(body, meta);
}

/** True when the crew member belongs to the user (non-revoked device). */
export function userOwnsCrew(userId: string, crewMemberId: string): boolean {
  return Boolean(
    prep(
        `SELECT 1 FROM devices
         WHERE user_id = ? AND crew_member_id = ? AND revoked_at_epoch_ms IS NULL`,
      )
      .get(userId, crewMemberId),
  );
}

function getProfile(crewMemberId: string): UserProfileSnapshotDto | null {
  const row = prep(`SELECT data_json FROM profiles WHERE crew_member_id = ?`)
    .get(crewMemberId) as { data_json: string } | undefined;
  return row ? (JSON.parse(row.data_json) as UserProfileSnapshotDto) : null;
}

export function latestReadingFor(crewMemberId: string): SensorReadingDto | null {
  const row = prep(
      `SELECT data_json FROM sensor_readings
       WHERE crew_member_id = ? ORDER BY recorded_at_epoch_ms DESC LIMIT 1`,
    )
    .get(crewMemberId) as { data_json: string } | undefined;
  return row ? (JSON.parse(row.data_json) as SensorReadingDto) : null;
}

export function latestAssessmentFor(crewMemberId: string): HealthAssessmentDto | null {
  const row = prep(
      `SELECT data_json FROM health_assessments
       WHERE crew_member_id = ? ORDER BY assessed_at_epoch_ms DESC LIMIT 1`,
    )
    .get(crewMemberId) as { data_json: string } | undefined;
  return row ? (JSON.parse(row.data_json) as HealthAssessmentDto) : null;
}

/** Single aggregated query (no N+1), scoped to the user's devices. */
export function listCrew(userId: string): CrewSummaryDto[] {
  const rows = prep(
      `SELECT d.crew_member_id AS crew_member_id,
        (SELECT data_json FROM profiles p WHERE p.crew_member_id = d.crew_member_id) AS profile_json,
        (SELECT data_json FROM sensor_readings r WHERE r.crew_member_id = d.crew_member_id
           ORDER BY r.recorded_at_epoch_ms DESC LIMIT 1) AS reading_json,
        (SELECT data_json FROM health_assessments a WHERE a.crew_member_id = d.crew_member_id
           ORDER BY a.assessed_at_epoch_ms DESC LIMIT 1) AS assessment_json
       FROM devices d
       WHERE d.user_id = ? AND d.revoked_at_epoch_ms IS NULL`,
    )
    .all(userId) as {
    crew_member_id: string;
    profile_json: string | null;
    reading_json: string | null;
    assessment_json: string | null;
  }[];
  return rows
    .map((row) => {
      const profile = row.profile_json
        ? (JSON.parse(row.profile_json) as UserProfileSnapshotDto)
        : null;
      const reading = row.reading_json
        ? (JSON.parse(row.reading_json) as SensorReadingDto)
        : null;
      const assessment = row.assessment_json
        ? (JSON.parse(row.assessment_json) as HealthAssessmentDto)
        : null;
      return {
        crewMemberId: row.crew_member_id,
        profileUpdatedAtEpochMs: profile?.snapshotAtEpochMs ?? null,
        latestReadingAtEpochMs: reading?.recordedAtEpochMs ?? null,
        overallLevel: assessment?.overallLevel ?? null,
        headline: assessment?.headline ?? null,
      };
    })
    .sort((a, b) => (b.latestReadingAtEpochMs ?? 0) - (a.latestReadingAtEpochMs ?? 0));
}

/**
 * Last reading of every `bucketMs` bucket inside [sinceMs, ∞), ascending, at most
 * `maxRows` newest buckets. One query: the inner SELECT only touches the covering
 * unique index (crew, recorded_at), the join then fetches one row per bucket.
 */
export function bucketedReadingsAsc(
  crewMemberId: string,
  sinceMs: number,
  bucketMs: number,
  maxRows: number,
): SensorReadingDto[] {
  const rows = prep(
      `SELECT r.data_json AS data_json
       FROM (
         SELECT MAX(recorded_at_epoch_ms) AS t
         FROM sensor_readings
         WHERE crew_member_id = @crew AND recorded_at_epoch_ms >= @since
         GROUP BY recorded_at_epoch_ms / CAST(@bucket AS INTEGER)
         ORDER BY t DESC LIMIT @max
       ) b
       JOIN sensor_readings r ON r.crew_member_id = @crew AND r.recorded_at_epoch_ms = b.t
       ORDER BY b.t DESC`,
    )
    .all({ crew: crewMemberId, since: sinceMs, bucket: bucketMs, max: maxRows }) as {
    data_json: string;
  }[];
  return rows.map((r) => JSON.parse(r.data_json) as SensorReadingDto).reverse();
}

/**
 * Estimation input: the last ANALYSIS_WINDOW_MS (24 h) of the crew member's
 * readings resampled to SAMPLE_INTERVAL_MS (last reading per 30 s bucket, so
 * stepsToday is the latest one), <= MAX_WINDOW_ROWS rows, ascending. A single
 * query regardless of the watch rate (1 Hz => 86 400 raw rows/day -> <= 2 881).
 * Raw data stays untouched in the DB; estimation happens only on the copies.
 */
export function readingWindowAsc(crewMemberId: string): SensorReadingDto[] {
  const latest = latestReadingTime(crewMemberId);
  if (latest === null) return [];
  return bucketedReadingsAsc(
    crewMemberId,
    latest - ANALYSIS_WINDOW_MS,
    SAMPLE_INTERVAL_MS,
    MAX_WINDOW_ROWS,
  );
}

function latestReadingTime(crewMemberId: string): number | null {
  const row = prep(
      `SELECT MAX(recorded_at_epoch_ms) AS t FROM sensor_readings WHERE crew_member_id = ?`,
    )
    .get(crewMemberId) as { t: number | null };
  return row.t;
}

export function getCrewLatest(crewMemberId: string): CrewLatestDto {
  const profile = getProfile(crewMemberId);
  const window = readingWindowAsc(crewMemberId);
  const last = window[window.length - 1];
  const latestReading = last ? enrichReadings(window, [last])[0] : null;
  const latestAssessment = latestAssessmentFor(crewMemberId);
  return {
    crewMemberId,
    profile,
    latestReading,
    latestAssessment,
  };
}

export const MAX_READINGS_LIMIT = 1000;
export const MAX_BUCKET_SECONDS = 3600;

/**
 * Newest-first, enriched with read-time estimates (see estimation/index.ts).
 * Without `bucketSeconds`: the newest `limit` raw rows. With it: the last reading
 * of each bucket (for charts), newest `limit` buckets.
 */
export function getReadings(
  crewMemberId: string,
  rawLimit: number,
  bucketSeconds?: number | null,
): SensorReadingDto[] {
  const limit = Math.max(1, Math.min(Math.floor(rawLimit) || 100, MAX_READINGS_LIMIT));
  const window = readingWindowAsc(crewMemberId);
  const bucket =
    bucketSeconds && bucketSeconds >= 1
      ? Math.min(Math.floor(bucketSeconds), MAX_BUCKET_SECONDS)
      : null;
  let targets: SensorReadingDto[];
  if (bucket === null) {
    const rows = prep(
        `SELECT data_json FROM sensor_readings
         WHERE crew_member_id = ? ORDER BY recorded_at_epoch_ms DESC LIMIT ?`,
      )
      .all(crewMemberId, limit) as { data_json: string }[];
    targets = rows.map((r) => JSON.parse(r.data_json) as SensorReadingDto).reverse();
  } else if (bucket * 1000 === SAMPLE_INTERVAL_MS) {
    targets = window.slice(-limit); // same buckets as the estimation window: no extra query
  } else {
    const latest = window.length ? window[window.length - 1].recordedAtEpochMs : null;
    // Bounded scan: only the span the newest `limit` buckets can cover.
    targets =
      latest === null
        ? []
        : bucketedReadingsAsc(crewMemberId, latest - (limit + 1) * bucket * 1000, bucket * 1000, limit);
  }
  return enrichReadings(window, targets).reverse();
}

/** RAHEL_RETENTION_DAYS (default 30; 0 disables the purge). */
export function retentionDays(): number {
  const n = Number(process.env.RAHEL_RETENTION_DAYS);
  return Number.isFinite(n) && n >= 0 ? n : 30;
}

/**
 * Deletes raw readings older than the retention window, in chunks through the
 * (crew, time) index so the write lock is held briefly. Returns deleted rows.
 */
export function purgeOldReadings(now = Date.now(), maxRows = 1_000_000): number {
  const days = retentionDays();
  if (days <= 0) return 0;
  const cutoff = now - days * 86_400_000;
  const db = getDb();
  const crews = prep(
      `SELECT crew_member_id FROM devices UNION SELECT crew_member_id FROM profiles`,
    )
    .all() as { crew_member_id: string }[];
  const chunk = 20_000;
  const del = prep(
    `DELETE FROM sensor_readings WHERE id IN (
       SELECT id FROM sensor_readings
       WHERE crew_member_id = ? AND recorded_at_epoch_ms < ? LIMIT ${chunk})`,
  );
  let total = 0;
  for (const { crew_member_id } of crews) {
    for (;;) {
      const n = del.run(crew_member_id, cutoff).changes;
      total += n;
      if (n < chunk || total >= maxRows) break;
    }
    if (total >= maxRows) break;
  }
  return total;
}

export function loadSeed(data: {
  profiles: UserProfileSnapshotDto[];
  batches: TelemetryBatchRequest[];
}): void {
  for (const p of data.profiles) upsertProfile(p);
  for (const b of data.batches) ingestBatch(b);
}
