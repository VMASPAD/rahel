/** Simulated /api/analytics/*: every number is derived from the same deterministic data. */
import type {
  DeviceAnalytics, FieldReport, FieldsAnalytics, IngestLogItem, IngestLogPage, SensorReport,
  SensorStatus, SensorsAnalytics, TimelineData,
} from '../api/analytics.ts'
import {
  ESTIMABLE_FIELDS, FIELD_KEYS, FIELD_LABELS, SENSOR_FEEDS, SENSOR_NOT_UPLOADED, assessField,
  type FieldKey,
} from './fieldQuality.ts'
import {
  HOUR, MIN, SEC, countReadings, gapsBetween, getProfile, latestSecond, readingFor, type Profile,
} from './model.ts'
import { r2, u01 } from './rng.ts'
import type { DemoDevice } from './state.ts'

export const GAP_THRESHOLD_MS = 120_000
export const NOMINAL_SPM = 60
export const APP_VERSION = '1.0.13'
const BATCH_MS = 5 * MIN
const FIELDS_MAX_ROWS = 50_000

export function clampWindowHours(raw: unknown): number {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 1) return 24
  return Math.min(n, 720)
}

function profileOf(d: DemoDevice): Profile {
  const p = getProfile(d.crewMemberId)
  if (!p) throw new Error(`no profile for ${d.crewMemberId}`)
  return p
}

// ---- ingest batches (one every 5 minutes, deterministic) ---------------------------

type Batch = { idx: number; receivedAt: number; received: number; accepted: number; dup: number; ok: boolean; bytes: number }

const REJECT_DETAILS = [
  'readings[41].heartRateBpm: Too big: expected number to be <=300',
  'readings[7].recordedAtEpochMs: Invalid input: expected number, received string',
  'clientBatchId: Too small: expected string to have >=8 characters',
]

function batchAt(p: Profile, d: DemoDevice, idx: number, now: number): Batch | null {
  const receivedAt = idx * BATCH_MS + 1000 + Math.floor(u01(p.seed, idx, 81) * 3000)
  if (receivedAt > now || receivedAt < d.pairedAt) return null
  const from = idx * BATCH_MS - BATCH_MS
  const received = countReadings(p, Math.max(from, d.pairedAt), idx * BATCH_MS, now)
  if (received <= 0) return null
  const ok = u01(p.seed, idx, 82) >= 0.012
  const dup = ok && u01(p.seed, idx, 83) < 0.08 ? 1 + Math.floor(u01(p.seed, idx, 84) * 4) : 0
  return { idx, receivedAt, received, accepted: ok ? received - dup : 0, dup, ok, bytes: received * 118 + 240 }
}

function batchesBetween(p: Profile, d: DemoDevice, from: number, to: number, now: number): Batch[] {
  const out: Batch[] = []
  for (let i = Math.floor(from / BATCH_MS); i <= Math.floor(to / BATCH_MS) + 1; i++) {
    const b = batchAt(p, d, i, now)
    if (b && b.receivedAt >= from && b.receivedAt < to) out.push(b)
  }
  return out
}

export function deviceAnalytics(d: DemoDevice, now: number): DeviceAnalytics {
  const p = profileOf(d)
  const last = latestSecond(now)
  const since = Math.max(now - 24 * HOUR, d.pairedAt)
  const n24 = countReadings(p, since, last + SEC, now)
  const gaps = gapsBetween(p, since, now, now).filter((g) => g.to - g.from > GAP_THRESHOLD_MS)
  const gapMs = gaps.reduce((s, g) => s + (g.to - g.from), 0)
  const bs = batchesBetween(p, d, now - 24 * HOUR, now, now)
  const lastOk = batchesBetween(p, d, now - 2 * HOUR, now, now).filter((b) => b.ok).pop()
  const activeMs = last - since - gapMs
  const rate = n24 > 1 && activeMs > 0 ? Math.round(((n24 - 1) / (activeMs / MIN)) * 100) / 100 : null
  return {
    deviceId: d.deviceId,
    crewMemberId: d.crewMemberId,
    pairedAt: d.pairedAt,
    totalReadings: countReadings(p, d.pairedAt, last + SEC, now),
    firstReadingAt: d.pairedAt,
    lastReadingAt: last,
    lastReceivedAt: lastOk?.receivedAt ?? null,
    readingsLast24h: n24,
    samplesPerMinute: rate,
    nominalSamplesPerMinute: NOMINAL_SPM,
    gaps24h: gaps.length,
    gapMs24h: gapMs,
    maxGapMs24h: gaps.reduce((m, g) => Math.max(m, g.to - g.from), 0),
    gapThresholdMs: GAP_THRESHOLD_MS,
    batchesOk24h: bs.filter((b) => b.ok).length,
    batchesRejected24h: bs.filter((b) => !b.ok).length,
    appVersion: APP_VERSION,
  }
}

// ---- fields ------------------------------------------------------------------------

type Num = (r: ReturnType<typeof readingFor>) => number | null
const ACCESS: Record<FieldKey, Num> = {
  heartRateBpm: (r) => r.heartRateBpm,
  restingHeartRateBpm: () => null, // estimated on the server, not sent by the watch
  hrvMs: () => null,
  spO2Percent: (r) => r.spO2Percent,
  stepsToday: (r) => r.stepsToday,
  sleepHoursLastNight: () => null,
  skinTempCelsius: (r) => r.skinTempCelsius,
  stressScore: () => null,
  missionDay: (r) => r.missionDay,
  microgravity: (r) => (r.microgravity ? 1 : 0),
  isolationIndex: (r) => r.isolationIndex,
  radiationDoseMilliSvProxy: (r) => r.radiationDoseMilliSvProxy,
}

export function fieldsSampleSeconds(hours: number): number {
  return Math.max(1, Math.ceil((hours * 3600) / FIELDS_MAX_ROWS))
}

export function fieldsAnalytics(d: DemoDevice, windowHours: number, now: number): FieldsAnalytics {
  const p = profileOf(d)
  const last = latestSecond(now)
  const since = Math.max(now - windowHours * HOUR, d.pairedAt)
  const realTotal = countReadings(p, since, last + SEC, now)
  const bucketSec = fieldsSampleSeconds(windowHours)
  const total = bucketSec === 1 ? realTotal : Math.ceil(realTotal / bucketSec)

  // Evenly spaced probe of at most ~1200 instants; shares are scaled to `total`.
  const probes = Math.min(1200, Math.max(2, Math.floor((last - since) / SEC)))
  const stepMs = (last - since) / probes
  const vals: Record<string, number[]> = Object.fromEntries(FIELD_KEYS.map((k) => [k, []]))
  const lastSeen: Record<string, number | null> = Object.fromEntries(FIELD_KEYS.map((k) => [k, null]))
  for (let i = 0; i <= probes; i++) {
    const t = Math.floor((since + i * stepMs) / SEC) * SEC
    if (gapsBetween(p, t, t + 1, now).length) continue
    const r = readingFor(p, t)
    for (const k of FIELD_KEYS) {
      const v = ACCESS[k](r)
      if (v !== null) {
        vals[k].push(v)
        lastSeen[k] = t
      }
    }
  }
  const present = Math.max(1, vals.heartRateBpm.length)
  const estimationWindowReadings = Math.min(2881, Math.round((Math.min(24 * HOUR, last - since) / (30 * SEC)) * 0.998))

  const fields = FIELD_KEYS.map((key): FieldReport => {
    const arr = vals[key]
    const nonNull = Math.min(total, Math.round((arr.length / present) * total))
    const mn = arr.length ? Math.min(...arr) : null
    const mx = arr.length ? Math.max(...arr) : null
    const mean = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
    const std = mean !== null ? Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length) : null
    const estimatedCount = ESTIMABLE_FIELDS.has(key) ? estimationWindowReadings : 0
    const a = assessField({
      key, total, nonNull, min: mn, max: mx, std, lastSeenMs: lastSeen[key], deviceLastMs: last, estimatedCount,
    })
    const rr = (v: number | null) => (v === null ? null : r2(v))
    return {
      key, label: FIELD_LABELS[key], total, nonNull, measuredCount: nonNull, estimatedCount,
      min: rr(mn), max: rr(mx), mean: rr(mean), std: rr(std), lastSeenAt: lastSeen[key], ...a,
    }
  })
  return {
    deviceId: d.deviceId,
    windowHours,
    totalReadings: realTotal,
    deviceLastReadingAt: last,
    estimationWindowReadings,
    fields,
    // extra fields the real endpoint also returns
    ...({ sampledReadings: total, sampleBucketSeconds: bucketSec } as object),
  } as FieldsAnalytics
}

// ---- sensors -----------------------------------------------------------------------

type SensorSeed = {
  key: string
  type: string
  name: string | null
  vendor: string | null
  wakeUp: boolean | null
  resolution: number | null
  available: boolean
  permission: boolean | null
  inUse: boolean | null
  delivering: boolean
}

function inventory(p: Profile): SensorSeed[] {
  const s = (key: string, type: string, name: string, o: Partial<SensorSeed> = {}): SensorSeed => ({
    key, type, name, vendor: 'Samsung Electronics', wakeUp: false, resolution: 1, available: true,
    permission: true, inUse: true, delivering: true, ...o,
  })
  return [
    s('android.sensor.heart_rate', 'heart_rate', 'Samsung HR Sensor', { wakeUp: true, permission: true }),
    s('android.sensor.step_counter', 'step_counter', 'Step Counter', { resolution: 1 }),
    s('android.sensor.step_detector', 'step_detector', 'Step Detector', { inUse: false, delivering: false }),
    s('android.sensor.accelerometer', 'accelerometer', 'LSM6DSO Accelerometer', { resolution: 0.0012, vendor: 'STMicroelectronics', inUse: true }),
    s('android.sensor.gyroscope', 'gyroscope', 'LSM6DSO Gyroscope', { resolution: 0.0005, vendor: 'STMicroelectronics', inUse: false, delivering: true }),
    s('android.sensor.pressure', 'pressure', 'LPS22HH Barometer', { resolution: 0.0002, vendor: 'STMicroelectronics', inUse: false, delivering: false }),
    s('android.sensor.light', 'light', 'Ambient Light', { resolution: 1, inUse: false, delivering: false }),
    s('android.sensor.ambient_temperature', 'ambient_temperature', 'Ambient Temperature', { available: false, permission: null, inUse: null, delivering: false }),
    s('android.sensor.significant_motion', 'significant_motion', 'Significant Motion', { inUse: false, delivering: false }),
    s('android.sensor.low_latency_offbody_detect', 'low_latency_offbody_detect', 'Off-body Detect', { wakeUp: true, inUse: true, delivering: true }),
    s('com.samsung.sensor.hs_spo2', 'hs_spo2', 'Samsung SpO2 Sensor', {
      permission: p.spo2 === 'denied' ? false : true,
      inUse: p.spo2 !== 'denied',
      delivering: p.spo2 !== 'denied',
    }),
  ]
}

function sensorStatus(
  s: { available: boolean; permissionGranted: boolean | null; inUse: boolean | null; delivering: boolean },
  feedsReceived: boolean,
): SensorStatus {
  if (!s.available) return 'no disponible'
  if (s.permissionGranted === false) return 'sin permiso'
  if (feedsReceived) return 'enviando datos'
  if (s.delivering) return 'entrega pero no se sube'
  if (s.inUse === false) return 'no usado por la app'
  return 'no entrega'
}

export function sensorsAnalytics(d: DemoDevice, fields: FieldsAnalytics, now: number): SensorsAnalytics {
  const p = profileOf(d)
  const byKey = new Map(fields.fields.map((f) => [f.key, f]))
  const last = latestSecond(now)
  const reportedAt = last - 90 * SEC
  const sensors: SensorReport[] = inventory(p).map((r) => {
    const feedKeys = SENSOR_FEEDS[r.type] ?? []
    const feeds = feedKeys.map((k) => {
      const f = byKey.get(k)!
      return { key: k, label: f.label, quality: f.quality, coveragePct: f.coveragePct }
    })
    const feedsReceived = feeds.some((f) => f.quality === 'medido')
    return {
      sensorKey: r.key, typeName: r.type, name: r.name, vendor: r.vendor, wakeUp: r.wakeUp,
      resolution: r.resolution, available: r.available, permissionGranted: r.permission, inUse: r.inUse,
      delivering: r.delivering, lastEventAt: r.delivering ? last - Math.floor(u01(p.seed, r.key.length, 91) * 4000) : null,
      reportedAt,
      status: sensorStatus({ available: r.available, permissionGranted: r.permission, inUse: r.inUse, delivering: r.delivering }, feedsReceived),
      uploadsToServer: feedKeys.length > 0 && !SENSOR_NOT_UPLOADED.has(r.type),
      feeds,
    }
  })
  const feedable = new Set<string>()
  for (const s of sensors) if (s.available) for (const f of SENSOR_FEEDS[s.typeName] ?? []) feedable.add(f)
  return {
    deviceId: d.deviceId,
    reportedAt,
    appVersion: APP_VERSION,
    sensors,
    fieldsWithoutSensor: fields.fields
      .filter((f) => f.quality !== 'medido' && !feedable.has(f.key))
      .map((f) => ({ key: f.key, label: f.label, reason: 'None of the detected sensors feeds this field.' })),
  }
}

// ---- log + timeline ----------------------------------------------------------------

export function ingestLogPage(
  d: DemoDevice,
  opts: { limit?: unknown; before?: unknown; status?: unknown },
  now: number,
): IngestLogPage {
  const p = profileOf(d)
  const limit = Math.max(1, Math.min(Math.floor(Number(opts.limit)) || 50, 200))
  const beforeN = Number(opts.before)
  const before = Number.isFinite(beforeN) && beforeN > 0 ? beforeN : Infinity
  const status = opts.status === 'ok' || opts.status === 'rechazado' ? opts.status : null
  const minIdx = Math.floor(d.pairedAt / BATCH_MS)
  const rows: IngestLogItem[] = []
  let idx = Math.min(Math.floor(now / BATCH_MS), before - 1)
  let more = false
  for (; idx >= minIdx; idx--) {
    const b = batchAt(p, d, idx, now)
    if (!b) continue
    if (status && (b.ok ? 'ok' : 'rechazado') !== status) continue
    if (rows.length === limit) {
      more = true
      break
    }
    rows.push({
      id: b.idx,
      receivedAt: b.receivedAt,
      batchId: `b-${p.seed.toString(16).slice(0, 4)}-${b.idx.toString(36)}`,
      readingsReceived: b.received,
      readingsAccepted: b.accepted,
      duplicates: b.dup,
      assessmentsReceived: b.ok && b.idx % 12 === 0 ? 1 : 0,
      status: b.ok ? 'ok' : 'rechazado',
      errorCode: b.ok ? null : 'invalid_payload',
      errorDetail: b.ok ? null : REJECT_DETAILS[b.idx % REJECT_DETAILS.length],
      bytes: b.bytes,
      appVersion: APP_VERSION,
    })
  }
  return { items: rows, nextBefore: more ? rows[rows.length - 1].id : null }
}

export function timeline(d: DemoDevice, hours: number, now: number): TimelineData {
  const p = profileOf(d)
  const bucketMs = Math.max(MIN, Math.round((hours * HOUR) / 96 / MIN) * MIN)
  const end = Math.ceil(now / bucketMs) * bucketMs
  const start = end - Math.ceil((hours * HOUR) / bucketMs) * bucketMs
  const last = latestSecond(now) + SEC
  const batches = batchesBetween(p, d, start, end, now)
  const buckets: TimelineData['buckets'] = []
  for (let t = start; t < end; t += bucketMs) {
    const from = Math.max(t, d.pairedAt)
    const to = Math.min(t + bucketMs, last)
    const inB = batches.filter((b) => b.receivedAt >= t && b.receivedAt < t + bucketMs)
    buckets.push({
      t,
      readings: countReadings(p, from, to, now),
      batchesOk: inB.filter((b) => b.ok).length,
      batchesRejected: inB.filter((b) => !b.ok).length,
    })
  }
  return { deviceId: d.deviceId, hours, bucketMs, buckets }
}

