import { getDb } from "../db/database.js";
import { MAX_WINDOW_ROWS } from "../estimation/constants.js";
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
  getDb()
    .prepare(
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

export function ingestBatch(
  body: TelemetryBatchRequest,
  meta: IngestMeta = {},
): {
  acceptedReadings: number;
  acceptedAssessments: number;
} {
  const db = getDb();
  const insertBatch = db.prepare(
    `INSERT OR IGNORE INTO processed_batches (crew_member_id, client_batch_id) VALUES (?, ?)`,
  );
  const insertReading = db.prepare(
    `INSERT OR IGNORE INTO sensor_readings (crew_member_id, recorded_at_epoch_ms, data_json)
     VALUES (?, ?, ?)`,
  );
  const insertAssessment = db.prepare(
    `INSERT OR IGNORE INTO health_assessments (crew_member_id, assessed_at_epoch_ms, data_json)
     VALUES (?, ?, ?)`,
  );

  // Batch marker and data share one transaction: a failure leaves the batch retryable.
  const logBase = {
    deviceId: meta.deviceId,
    crewMemberId: body.crewMemberId,
    batchId: body.clientBatchId,
    readingsReceived: body.readings.length,
    assessmentsReceived: body.assessments.length,
    bytes: meta.bytes,
    appVersion: meta.appVersion ?? body.appVersion ?? null,
  };

  return db.transaction(() => {
    if (insertBatch.run(body.crewMemberId, body.clientBatchId).changes === 0) {
      recordIngest({
        ...logBase,
        readingsAccepted: 0,
        status: "ok",
        errorCode: "duplicate_batch",
      });
      return { acceptedReadings: 0, acceptedAssessments: 0 };
    }
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
  })();
}

/** True when the crew member belongs to the user (non-revoked device). */
export function userOwnsCrew(userId: string, crewMemberId: string): boolean {
  return Boolean(
    getDb()
      .prepare(
        `SELECT 1 FROM devices
         WHERE user_id = ? AND crew_member_id = ? AND revoked_at_epoch_ms IS NULL`,
      )
      .get(userId, crewMemberId),
  );
}

function getProfile(crewMemberId: string): UserProfileSnapshotDto | null {
  const row = getDb()
    .prepare(`SELECT data_json FROM profiles WHERE crew_member_id = ?`)
    .get(crewMemberId) as { data_json: string } | undefined;
  return row ? (JSON.parse(row.data_json) as UserProfileSnapshotDto) : null;
}

export function latestReadingFor(crewMemberId: string): SensorReadingDto | null {
  const row = getDb()
    .prepare(
      `SELECT data_json FROM sensor_readings
       WHERE crew_member_id = ? ORDER BY recorded_at_epoch_ms DESC LIMIT 1`,
    )
    .get(crewMemberId) as { data_json: string } | undefined;
  return row ? (JSON.parse(row.data_json) as SensorReadingDto) : null;
}

export function latestAssessmentFor(crewMemberId: string): HealthAssessmentDto | null {
  const row = getDb()
    .prepare(
      `SELECT data_json FROM health_assessments
       WHERE crew_member_id = ? ORDER BY assessed_at_epoch_ms DESC LIMIT 1`,
    )
    .get(crewMemberId) as { data_json: string } | undefined;
  return row ? (JSON.parse(row.data_json) as HealthAssessmentDto) : null;
}

/** Single aggregated query (no N+1), scoped to the user's devices. */
export function listCrew(userId: string): CrewSummaryDto[] {
  const rows = getDb()
    .prepare(
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
 * One query: newest MAX_WINDOW_ROWS raw readings, returned ascending.
 * Raw data stays untouched in the DB; estimation happens only on the copies.
 */
export function readingWindowAsc(crewMemberId: string): SensorReadingDto[] {
  const rows = getDb()
    .prepare(
      `SELECT data_json FROM sensor_readings
       WHERE crew_member_id = ? ORDER BY recorded_at_epoch_ms DESC LIMIT ?`,
    )
    .all(crewMemberId, MAX_WINDOW_ROWS) as { data_json: string }[];
  return rows.map((r) => JSON.parse(r.data_json) as SensorReadingDto).reverse();
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

/** Newest-first, enriched with read-time estimates (see estimation/index.ts). */
export function getReadings(crewMemberId: string, rawLimit: number): SensorReadingDto[] {
  const limit = Math.max(1, Math.min(Math.floor(rawLimit) || 100, 500));
  const window = readingWindowAsc(crewMemberId);
  const targets = window.slice(-limit);
  return enrichReadings(window, targets).reverse();
}

export function loadSeed(data: {
  profiles: UserProfileSnapshotDto[];
  batches: TelemetryBatchRequest[];
}): void {
  for (const p of data.profiles) upsertProfile(p);
  for (const b of data.batches) ingestBatch(b);
}
