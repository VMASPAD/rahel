import { getDb } from "../db/database.js";
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

export function ingestBatch(body: TelemetryBatchRequest): {
  acceptedReadings: number;
  acceptedAssessments: number;
} {
  const insertBatch = getDb().prepare(
    `INSERT OR IGNORE INTO processed_batches (crew_member_id, client_batch_id) VALUES (?, ?)`,
  );
  const result = insertBatch.run(body.crewMemberId, body.clientBatchId);
  if (result.changes === 0) {
    return { acceptedReadings: 0, acceptedAssessments: 0 };
  }

  const insertReading = getDb().prepare(
    `INSERT INTO sensor_readings (crew_member_id, recorded_at_epoch_ms, data_json)
     VALUES (?, ?, ?)`,
  );
  const insertAssessment = getDb().prepare(
    `INSERT INTO health_assessments (crew_member_id, assessed_at_epoch_ms, data_json)
     VALUES (?, ?, ?)`,
  );

  const tx = getDb().transaction(() => {
    for (const r of body.readings) {
      insertReading.run(body.crewMemberId, r.recordedAtEpochMs, JSON.stringify(r));
    }
    for (const a of body.assessments) {
      insertAssessment.run(body.crewMemberId, a.assessedAtEpochMs, JSON.stringify(a));
    }
  });
  tx();

  return {
    acceptedReadings: body.readings.length,
    acceptedAssessments: body.assessments.length,
  };
}

function allCrewIds(): string[] {
  const rows = getDb()
    .prepare(
      `SELECT crew_member_id FROM profiles
       UNION SELECT crew_member_id FROM sensor_readings
       UNION SELECT crew_member_id FROM health_assessments`,
    )
    .all() as { crew_member_id: string }[];
  return rows.map((r) => r.crew_member_id);
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

export function listCrew(): CrewSummaryDto[] {
  return allCrewIds().map((crewMemberId) => {
    const profile = getProfile(crewMemberId);
    const latestReading = latestReadingFor(crewMemberId);
    const latestAssessment = latestAssessmentFor(crewMemberId);
    return {
      crewMemberId,
      profileUpdatedAtEpochMs: profile?.snapshotAtEpochMs ?? null,
      latestReadingAtEpochMs: latestReading?.recordedAtEpochMs ?? null,
      overallLevel: latestAssessment?.overallLevel ?? null,
      headline: latestAssessment?.headline ?? null,
    };
  });
}

export function getCrewLatest(crewMemberId: string): CrewLatestDto | null {
  const profile = getProfile(crewMemberId);
  const latestReading = latestReadingFor(crewMemberId);
  const latestAssessment = latestAssessmentFor(crewMemberId);
  if (!profile && !latestReading && !latestAssessment) return null;
  return {
    crewMemberId,
    profile,
    latestReading,
    latestAssessment,
  };
}

export function getReadings(crewMemberId: string, limit: number): SensorReadingDto[] {
  const rows = getDb()
    .prepare(
      `SELECT data_json FROM sensor_readings
       WHERE crew_member_id = ? ORDER BY recorded_at_epoch_ms DESC LIMIT ?`,
    )
    .all(crewMemberId, limit) as { data_json: string }[];
  return rows.map((r) => JSON.parse(r.data_json) as SensorReadingDto);
}

export function loadSeed(data: {
  profiles: UserProfileSnapshotDto[];
  batches: TelemetryBatchRequest[];
}): void {
  for (const p of data.profiles) upsertProfile(p);
  for (const b of data.batches) ingestBatch(b);
}
