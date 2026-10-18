import { getDb, prep } from "../db/database.js";
import { enrichReadings } from "../estimation/index.js";
import { NOMINAL_APP_SAMPLES_PER_MINUTE } from "../estimation/constants.js";
import {
  assessField,
  ESTIMABLE_FIELDS,
  FIELD_KEYS,
  FIELD_LABELS,
  SENSOR_FEEDS,
  SENSOR_NOT_UPLOADED,
  sensorStatus,
  type FieldAssessment,
  type FieldKey,
} from "../analytics/fieldQuality.js";
import { readingWindowAsc } from "./telemetryStore.js";
import type { SensorReadingDto } from "../types/health.js";

const HOUR_MS = 3_600_000;
/** A gap between consecutive readings above this counts as a hole (app nominal: 1 reading/s). */
export const GAP_THRESHOLD_MS = 120_000;
/**
 * Default /fields window. At 1 Hz, 24 h = 86 400 rows/device; 7 days would be ~600k.
 * Longer windows are allowed (up to MAX_WINDOW_HOURS) but are time-sampled in SQL.
 */
export const DEFAULT_WINDOW_HOURS = 24;
export const MAX_WINDOW_HOURS = 720;
/** /fields aggregates at most about this many rows (longer windows use one reading per bucket). */
export const FIELDS_MAX_ROWS = 50_000;

/** Bucket (seconds) used to sample a window of `hours` down to ~FIELDS_MAX_ROWS rows. */
export function fieldsSampleSeconds(hours: number): number {
  return Math.max(1, Math.ceil((hours * 3600) / FIELDS_MAX_ROWS));
}

export function clampWindowHours(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return DEFAULT_WINDOW_HOURS;
  return Math.min(n, MAX_WINDOW_HOURS);
}

export type OwnedDevice = { deviceId: string; crewMemberId: string; pairedAt: number };

/** Ownership check: null when the device is not the user's (or is revoked) => route answers 404. */
export function ownedDevice(userId: string, deviceId: string): OwnedDevice | null {
  const row = prep(
      `SELECT device_id, crew_member_id, paired_at_epoch_ms FROM devices
       WHERE device_id = ? AND user_id = ? AND revoked_at_epoch_ms IS NULL`,
    )
    .get(deviceId, userId) as
    | { device_id: string; crew_member_id: string; paired_at_epoch_ms: number }
    | undefined;
  return row
    ? { deviceId: row.device_id, crewMemberId: row.crew_member_id, pairedAt: row.paired_at_epoch_ms }
    : null;
}

// ---- /devices --------------------------------------------------------------

export type DeviceAnalyticsSummary = {
  deviceId: string;
  crewMemberId: string;
  pairedAt: number;
  totalReadings: number;
  firstReadingAt: number | null;
  lastReadingAt: number | null;
  lastReceivedAt: number | null;
  readingsLast24h: number;
  /** Real rate while the watch was sending (gaps excluded). */
  samplesPerMinute: number | null;
  nominalSamplesPerMinute: number;
  gaps24h: number;
  gapMs24h: number;
  maxGapMs24h: number;
  gapThresholdMs: number;
  batchesOk24h: number;
  batchesRejected24h: number;
  appVersion: string | null;
};

/** Three grouped queries for all of the user's devices (no per-device queries). */
export function listDeviceAnalytics(userId: string, now = Date.now()): DeviceAnalyticsSummary[] {
  const db = getDb();
  const devices = prep(
      `SELECT device_id, crew_member_id, paired_at_epoch_ms FROM devices
       WHERE user_id = ? AND revoked_at_epoch_ms IS NULL ORDER BY paired_at_epoch_ms DESC`,
    )
    .all(userId) as { device_id: string; crew_member_id: string; paired_at_epoch_ms: number }[];
  if (devices.length === 0) return [];
  const since = now - 24 * HOUR_MS;

  const totals = prep(
      `SELECT r.crew_member_id AS crew, COUNT(*) AS n,
              MIN(r.recorded_at_epoch_ms) AS first_at, MAX(r.recorded_at_epoch_ms) AS last_at
       FROM sensor_readings r
       JOIN devices d ON d.crew_member_id = r.crew_member_id
       WHERE d.user_id = ? AND d.revoked_at_epoch_ms IS NULL
       GROUP BY r.crew_member_id`,
    )
    .all(userId) as { crew: string; n: number; first_at: number; last_at: number }[];

  const win = prep(
      `WITH g AS (
         SELECT r.crew_member_id AS crew, r.recorded_at_epoch_ms AS t,
                r.recorded_at_epoch_ms - LAG(r.recorded_at_epoch_ms)
                  OVER (PARTITION BY r.crew_member_id ORDER BY r.recorded_at_epoch_ms) AS d
         FROM sensor_readings r
         JOIN devices dv ON dv.crew_member_id = r.crew_member_id
         WHERE dv.user_id = ? AND dv.revoked_at_epoch_ms IS NULL AND r.recorded_at_epoch_ms >= ?
       )
       SELECT crew, COUNT(*) AS n, MIN(t) AS first_t, MAX(t) AS last_t,
              SUM(CASE WHEN d > @gap THEN 1 ELSE 0 END) AS gaps,
              SUM(CASE WHEN d > @gap THEN d ELSE 0 END) AS gap_ms,
              MAX(d) AS max_gap
       FROM g GROUP BY crew`,
    )
    .all({ gap: GAP_THRESHOLD_MS }, userId, since) as never as {
    crew: string; n: number; first_t: number; last_t: number;
    gaps: number | null; gap_ms: number | null; max_gap: number | null;
  }[];

  const logs = prep(
      `SELECT l.device_id AS device,
              SUM(CASE WHEN l.status = 'ok' THEN 1 ELSE 0 END) AS ok,
              SUM(CASE WHEN l.status = 'rechazado' THEN 1 ELSE 0 END) AS rej,
              MAX(CASE WHEN l.status = 'ok' THEN l.received_at_epoch_ms END) AS last_ok,
              (SELECT x.app_version FROM ingest_log x WHERE x.device_id = l.device_id
                 AND x.app_version IS NOT NULL ORDER BY x.id DESC LIMIT 1) AS app_version
       FROM ingest_log l
       JOIN devices d ON d.device_id = l.device_id
       WHERE d.user_id = ? AND l.received_at_epoch_ms >= ?
       GROUP BY l.device_id`,
    )
    .all(userId, since) as {
    device: string; ok: number; rej: number; last_ok: number | null; app_version: string | null;
  }[];

  const lastOkAll = prep(
      `SELECT l.device_id AS device, MAX(l.received_at_epoch_ms) AS last_ok
       FROM ingest_log l JOIN devices d ON d.device_id = l.device_id
       WHERE d.user_id = ? AND l.status = 'ok' GROUP BY l.device_id`,
    )
    .all(userId) as { device: string; last_ok: number }[];

  const tMap = new Map(totals.map((r) => [r.crew, r]));
  const wMap = new Map(win.map((r) => [r.crew, r]));
  const lMap = new Map(logs.map((r) => [r.device, r]));
  const oMap = new Map(lastOkAll.map((r) => [r.device, r.last_ok]));

  return devices.map((d) => {
    const t = tMap.get(d.crew_member_id);
    const w = wMap.get(d.crew_member_id);
    const l = lMap.get(d.device_id);
    let rate: number | null = null;
    if (w && w.n > 1) {
      const activeMs = w.last_t - w.first_t - (w.gap_ms ?? 0);
      if (activeMs > 0) rate = Math.round(((w.n - 1) / (activeMs / 60_000)) * 100) / 100;
    }
    return {
      deviceId: d.device_id,
      crewMemberId: d.crew_member_id,
      pairedAt: d.paired_at_epoch_ms,
      totalReadings: t?.n ?? 0,
      firstReadingAt: t?.first_at ?? null,
      lastReadingAt: t?.last_at ?? null,
      lastReceivedAt: oMap.get(d.device_id) ?? null,
      readingsLast24h: w?.n ?? 0,
      samplesPerMinute: rate,
      nominalSamplesPerMinute: NOMINAL_APP_SAMPLES_PER_MINUTE,
      gaps24h: w?.gaps ?? 0,
      gapMs24h: w?.gap_ms ?? 0,
      maxGapMs24h: w?.max_gap && w.max_gap > GAP_THRESHOLD_MS ? w.max_gap : 0,
      gapThresholdMs: GAP_THRESHOLD_MS,
      batchesOk24h: l?.ok ?? 0,
      batchesRejected24h: l?.rej ?? 0,
      appVersion: l?.app_version ?? null,
    };
  });
}

// ---- /fields ---------------------------------------------------------------

export type FieldReport = FieldAssessment & {
  key: FieldKey;
  label: string;
  total: number;
  nonNull: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  std: number | null;
  lastSeenAt: number | null;
  estimatedCount: number;
  measuredCount: number;
};

export type FieldsAnalytics = {
  deviceId: string;
  windowHours: number;
  /** Real number of stored readings in the window. */
  totalReadings: number;
  /** Rows actually aggregated (== totalReadings unless the window is time-sampled). */
  sampledReadings: number;
  /** 1 = every reading; N > 1 = last reading of every N-second bucket. */
  sampleBucketSeconds: number;
  deviceLastReadingAt: number | null;
  /** Rows (30 s resampled) of the series used for estimates. */
  estimationWindowReadings: number;
  fields: FieldReport[];
};

type AggRow = Record<string, number | null>;

/** One aggregation over the window using json_extract; field names come from a fixed whitelist. */
export function fieldsAnalytics(
  device: OwnedDevice,
  windowHours: number,
  now = Date.now(),
): FieldsAnalytics {
  const db = getDb();
  const since = now - windowHours * HOUR_MS;
  const cols = FIELD_KEYS.map((k, i) => `json_extract(data_json, '$.${k}') AS f${i}`).join(", ");
  const aggs = FIELD_KEYS.map((_, i) =>
    [
      `COUNT(f${i}) AS n${i}`,
      `MIN(f${i}) AS mn${i}`,
      `MAX(f${i}) AS mx${i}`,
      `AVG(f${i}) AS av${i}`,
      `AVG(f${i} * f${i}) AS sq${i}`,
      `MAX(CASE WHEN f${i} IS NOT NULL THEN t END) AS ls${i}`,
    ].join(", "),
  ).join(", ");
  const bucketSec = fieldsSampleSeconds(windowHours);
  // Unsampled: one pass over the (crew, time) range. Sampled: the inner SELECT walks only
  // the covering index to pick the last reading of each bucket, then one row lookup per bucket.
  const source =
    bucketSec === 1
      ? `SELECT recorded_at_epoch_ms AS t, ${cols}
         FROM sensor_readings WHERE crew_member_id = @crew AND recorded_at_epoch_ms >= @since`
      : `SELECT s.recorded_at_epoch_ms AS t, ${cols.replaceAll("data_json", "s.data_json")}
         FROM (
           SELECT MAX(recorded_at_epoch_ms) AS bt FROM sensor_readings
           WHERE crew_member_id = @crew AND recorded_at_epoch_ms >= @since
           GROUP BY recorded_at_epoch_ms / CAST(@bucket AS INTEGER)
         ) b JOIN sensor_readings s ON s.crew_member_id = @crew AND s.recorded_at_epoch_ms = b.bt`;
  const params: Record<string, string | number> = { crew: device.crewMemberId, since };
  if (bucketSec !== 1) params.bucket = bucketSec * 1000;
  const row = prep(
      `WITH r AS (${source})
       SELECT COUNT(*) AS total, MAX(t) AS last_t, ${aggs} FROM r`,
    )
    .get(params) as AggRow;

  const sampled = Number(row.total ?? 0);
  const total = sampled;
  const realTotal =
    bucketSec === 1
      ? sampled
      : Number(
          (
            prep(
                `SELECT COUNT(*) AS n FROM sensor_readings
                 WHERE crew_member_id = ? AND recorded_at_epoch_ms >= ?`,
              )
              .get(device.crewMemberId, since) as { n: number }
          ).n,
        );
  const deviceLast = row.last_t ?? null;

  // Read-time estimates (only the 4 estimable fields), over the same window the API uses.
  const estWindow = readingWindowAsc(device.crewMemberId);
  const enriched: SensorReadingDto[] = enrichReadings(estWindow, estWindow);
  const estCounts: Record<string, number> = {};
  for (const r of enriched) {
    if (!r.estimates) continue;
    for (const k of Object.keys(r.estimates)) estCounts[k] = (estCounts[k] ?? 0) + 1;
  }

  const fields = FIELD_KEYS.map((key, i): FieldReport => {
    const nonNull = Number(row[`n${i}`] ?? 0);
    const mean = (row[`av${i}`] as number | null) ?? null;
    const sq = (row[`sq${i}`] as number | null) ?? null;
    const std =
      mean !== null && sq !== null ? Math.sqrt(Math.max(0, sq - mean * mean)) : null;
    const min = (row[`mn${i}`] as number | null) ?? null;
    const max = (row[`mx${i}`] as number | null) ?? null;
    const lastSeen = (row[`ls${i}`] as number | null) ?? null;
    const estimatedCount = ESTIMABLE_FIELDS.has(key) ? estCounts[key] ?? 0 : 0;
    const a = assessField({
      key,
      total,
      nonNull,
      min,
      max,
      std,
      lastSeenMs: lastSeen,
      deviceLastMs: deviceLast,
      estimatedCount,
    });
    const r2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);
    return {
      key,
      label: FIELD_LABELS[key],
      total,
      nonNull,
      measuredCount: nonNull,
      estimatedCount,
      min: r2(min),
      max: r2(max),
      mean: r2(mean),
      std: r2(std),
      lastSeenAt: lastSeen,
      ...a,
    };
  });

  return {
    deviceId: device.deviceId,
    windowHours,
    totalReadings: realTotal,
    sampledReadings: sampled,
    sampleBucketSeconds: bucketSec,
    deviceLastReadingAt: deviceLast,
    estimationWindowReadings: estWindow.length,
    fields,
  };
}

// ---- sensors inventory -----------------------------------------------------

export type InventorySensorInput = {
  sensorKey: string;
  typeName: string;
  typeId?: number | null;
  name?: string | null;
  vendor?: string | null;
  wakeUp?: boolean | null;
  resolution?: number | null;
  available: boolean;
  permissionGranted?: boolean | null;
  inUse?: boolean | null;
  delivering: boolean;
  lastEventAtEpochMs?: number | null;
};

/** Full report replaces the device's inventory (sensors no longer reported are removed). */
export function replaceSensorInventory(
  deviceId: string,
  sensors: InventorySensorInput[],
  appVersion: string | null,
  now = Date.now(),
): number {
  const db = getDb();
  const upsert = prep(
    `INSERT INTO device_sensor_inventory
       (device_id, sensor_key, type_name, type_id, sensor_name, vendor, wake_up, resolution,
        available, permission_granted, in_use, delivering, last_event_at, reported_at, app_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(device_id, sensor_key) DO UPDATE SET
       type_name = excluded.type_name, type_id = excluded.type_id,
       sensor_name = excluded.sensor_name, vendor = excluded.vendor,
       wake_up = excluded.wake_up, resolution = excluded.resolution,
       available = excluded.available, permission_granted = excluded.permission_granted,
       in_use = excluded.in_use, delivering = excluded.delivering,
       last_event_at = excluded.last_event_at, reported_at = excluded.reported_at,
       app_version = excluded.app_version`,
  );
  const bool = (v: boolean | null | undefined) => (v == null ? null : v ? 1 : 0);
  db.transaction(() => {
    prep(`DELETE FROM device_sensor_inventory WHERE device_id = ?`).run(deviceId);
    for (const s of sensors) {
      upsert.run(
        deviceId, s.sensorKey, s.typeName, s.typeId ?? null, s.name ?? null, s.vendor ?? null,
        bool(s.wakeUp), s.resolution ?? null, s.available ? 1 : 0, bool(s.permissionGranted),
        bool(s.inUse), s.delivering ? 1 : 0, s.lastEventAtEpochMs ?? null, now, appVersion,
      );
    }
  })();
  return sensors.length;
}

export type SensorReport = {
  sensorKey: string;
  typeName: string;
  name: string | null;
  vendor: string | null;
  wakeUp: boolean | null;
  resolution: number | null;
  available: boolean;
  permissionGranted: boolean | null;
  inUse: boolean | null;
  delivering: boolean;
  lastEventAt: number | null;
  reportedAt: number;
  status: ReturnType<typeof sensorStatus>;
  uploadsToServer: boolean;
  feeds: { key: FieldKey; label: string; quality: string; coveragePct: number }[];
};

export type SensorsAnalytics = {
  deviceId: string;
  reportedAt: number | null;
  appVersion: string | null;
  sensors: SensorReport[];
  /** Fields that never arrive and that no detected, available sensor can feed. */
  fieldsWithoutSensor: { key: FieldKey; label: string; reason: string }[];
};

export function sensorsAnalytics(device: OwnedDevice, fields: FieldsAnalytics): SensorsAnalytics {
  const rows = prep(
      `SELECT * FROM device_sensor_inventory WHERE device_id = ? ORDER BY available DESC, type_name, sensor_key`,
    )
    .all(device.deviceId) as {
    sensor_key: string; type_name: string; sensor_name: string | null; vendor: string | null;
    wake_up: number | null; resolution: number | null; available: number;
    permission_granted: number | null; in_use: number | null; delivering: number;
    last_event_at: number | null; reported_at: number; app_version: string | null;
  }[];
  const byKey = new Map(fields.fields.map((f) => [f.key, f]));
  const tri = (v: number | null) => (v === null ? null : v === 1);

  const sensors: SensorReport[] = rows.map((r) => {
    const feedKeys = SENSOR_FEEDS[r.type_name] ?? [];
    const feeds = feedKeys.map((k) => {
      const f = byKey.get(k)!;
      return { key: k, label: f.label, quality: f.quality, coveragePct: f.coveragePct };
    });
    const feedsReceived = feeds.some((f) => f.quality === "medido");
    return {
      sensorKey: r.sensor_key,
      typeName: r.type_name,
      name: r.sensor_name,
      vendor: r.vendor,
      wakeUp: tri(r.wake_up),
      resolution: r.resolution,
      available: r.available === 1,
      permissionGranted: tri(r.permission_granted),
      inUse: tri(r.in_use),
      delivering: r.delivering === 1,
      lastEventAt: r.last_event_at,
      reportedAt: r.reported_at,
      status: sensorStatus(
        {
          typeName: r.type_name,
          available: r.available === 1,
          permissionGranted: tri(r.permission_granted),
          inUse: tri(r.in_use),
          delivering: r.delivering === 1,
        },
        feedsReceived,
      ),
      uploadsToServer: feedKeys.length > 0 && !SENSOR_NOT_UPLOADED.has(r.type_name),
      feeds,
    };
  });

  const feedable = new Set<string>();
  for (const s of sensors) {
    if (s.available) for (const f of SENSOR_FEEDS[s.typeName] ?? []) feedable.add(f);
  }
  const fieldsWithoutSensor = fields.fields
    .filter((f) => f.quality !== "medido" && !feedable.has(f.key))
    .map((f) => ({
      key: f.key,
      label: f.label,
      reason:
        rows.length === 0
          ? "El reloj aún no ha enviado su inventario de sensores."
          : "Ningún sensor detectado disponible alimenta este campo.",
    }));

  return {
    deviceId: device.deviceId,
    reportedAt: rows.length ? Math.max(...rows.map((r) => r.reported_at)) : null,
    appVersion: rows.find((r) => r.app_version)?.app_version ?? null,
    sensors,
    fieldsWithoutSensor,
  };
}

// ---- log -------------------------------------------------------------------

export type IngestLogItem = {
  id: number;
  receivedAt: number;
  batchId: string | null;
  readingsReceived: number;
  readingsAccepted: number;
  duplicates: number;
  assessmentsReceived: number;
  status: "ok" | "rechazado";
  errorCode: string | null;
  errorDetail: string | null;
  bytes: number | null;
  appVersion: string | null;
};

export function ingestLogPage(
  deviceId: string,
  opts: { limit?: unknown; before?: unknown; status?: unknown },
): { items: IngestLogItem[]; nextBefore: number | null } {
  const limit = Math.max(1, Math.min(Math.floor(Number(opts.limit)) || 50, 200));
  const before = Number(opts.before);
  const status = opts.status === "ok" || opts.status === "rechazado" ? opts.status : null;
  const rows = prep(
      `SELECT * FROM ingest_log
       WHERE device_id = @device
         AND (@before IS NULL OR id < @before)
         AND (@status IS NULL OR status = @status)
       ORDER BY id DESC LIMIT @lim`,
    )
    .all({
      device: deviceId,
      before: Number.isFinite(before) && before > 0 ? before : null,
      status,
      lim: limit + 1,
    }) as {
    id: number; received_at_epoch_ms: number; batch_id: string | null; readings_received: number;
    readings_accepted: number; duplicates: number; assessments_received: number; status: "ok" | "rechazado";
    error_code: string | null; error_detail: string | null; bytes: number | null; app_version: string | null;
  }[];
  const page = rows.slice(0, limit);
  return {
    items: page.map((r) => ({
      id: r.id,
      receivedAt: r.received_at_epoch_ms,
      batchId: r.batch_id,
      readingsReceived: r.readings_received,
      readingsAccepted: r.readings_accepted,
      duplicates: r.duplicates,
      assessmentsReceived: r.assessments_received,
      status: r.status,
      errorCode: r.error_code,
      errorDetail: r.error_detail,
      bytes: r.bytes,
      appVersion: r.app_version,
    })),
    nextBefore: rows.length > limit ? page[page.length - 1].id : null,
  };
}

// ---- timeline --------------------------------------------------------------

export type TimelineBucket = { t: number; readings: number; batchesOk: number; batchesRejected: number };

/** Buckets of readings/batches over the last `hours` (default 24 h => 15 min buckets). Empty buckets are filled with zeros. */
export function timeline(device: OwnedDevice, hours: number, now = Date.now()) {
  const db = getDb();
  const bucketMs = Math.max(60_000, Math.round((hours * HOUR_MS) / 96 / 60_000) * 60_000);
  const end = Math.ceil(now / bucketMs) * bucketMs;
  const start = end - Math.ceil((hours * HOUR_MS) / bucketMs) * bucketMs;
  const rd = prep(
      `SELECT (recorded_at_epoch_ms / CAST(@b AS INTEGER)) * CAST(@b AS INTEGER) AS bt, COUNT(*) AS n
       FROM sensor_readings WHERE crew_member_id = @crew AND recorded_at_epoch_ms >= @s
       GROUP BY bt`,
    )
    .all({ b: bucketMs, crew: device.crewMemberId, s: start }) as { bt: number; n: number }[];
  const lg = prep(
      `SELECT (received_at_epoch_ms / CAST(@b AS INTEGER)) * CAST(@b AS INTEGER) AS bt,
              SUM(status = 'ok') AS ok, SUM(status = 'rechazado') AS rej
       FROM ingest_log WHERE device_id = @dev AND received_at_epoch_ms >= @s GROUP BY bt`,
    )
    .all({ b: bucketMs, dev: device.deviceId, s: start }) as { bt: number; ok: number; rej: number }[];
  const rm = new Map(rd.map((r) => [r.bt, r.n]));
  const lm = new Map(lg.map((r) => [r.bt, r]));
  const buckets: TimelineBucket[] = [];
  for (let t = start; t < end; t += bucketMs) {
    buckets.push({
      t,
      readings: rm.get(t) ?? 0,
      batchesOk: lm.get(t)?.ok ?? 0,
      batchesRejected: lm.get(t)?.rej ?? 0,
    });
  }
  return { deviceId: device.deviceId, hours, bucketMs, buckets };
}
