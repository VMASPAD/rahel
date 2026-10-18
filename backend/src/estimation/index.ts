/**
 * Read-time estimation of metrics the watch does not send. Pure functions: raw
 * stored data is never modified; only null fields of the returned copy are
 * filled, and each filled field is flagged in `estimates`. skinTempCelsius is
 * deliberately never estimated (see docs/estimation.md).
 */
import { ANALYSIS_WINDOW_MS, ANCHOR_STRIDE } from "./constants.js";
import { estimateHrv } from "./hrv.js";
import { estimateRestingHeartRate } from "./restingHeartRate.js";
import { estimateSleepHours } from "./sleep.js";
import { estimateStress } from "./stress.js";
import type { Estimates, EstimateKey, Sample } from "./types.js";

export type { Estimate, Estimates } from "./types.js";

/** Subset of SensorReadingDto used here (kept structural to avoid a cycle). */
export type EstimableReading = {
  recordedAtEpochMs: number;
  heartRateBpm?: number | null;
  stepsToday?: number | null;
  restingHeartRateBpm?: number | null;
  hrvMs?: number | null;
  sleepHoursLastNight?: number | null;
  stressScore?: number | null;
  estimates?: Estimates;
};

type Values = Partial<Record<EstimateKey, number>>;
type Computed = { values: Values; estimates: Estimates };

export function toSample(r: EstimableReading): Sample {
  return { t: r.recordedAtEpochMs, hr: r.heartRateBpm ?? null, steps: r.stepsToday ?? null };
}

/** Estimates as of samples[end]; uses the (<=24 h) window ending there. samples ascending. */
export function computeEstimatesAt(samples: Sample[], end: number): Computed {
  const tEnd = samples[end].t;
  let start = end;
  while (start > 0 && tEnd - samples[start - 1].t <= ANALYSIS_WINDOW_MS) start--;
  const window = samples.slice(start, end + 1);

  const values: Values = {};
  const estimates: Estimates = {};
  const put = (k: EstimateKey, r: { value: number; estimate: Estimates[EstimateKey] } | null) => {
    if (!r) return;
    values[k] = r.value;
    estimates[k] = r.estimate;
  };
  const resting = estimateRestingHeartRate(window);
  put("restingHeartRateBpm", resting);
  const hrv = estimateHrv(window, resting?.value ?? null);
  put("hrvMs", hrv);
  put("sleepHoursLastNight", estimateSleepHours(window, resting?.value ?? null));
  put("stressScore", estimateStress(window, resting?.value ?? null, hrv?.value ?? null));
  return { values, estimates };
}

const KEYS: EstimateKey[] = ["hrvMs", "restingHeartRateBpm", "sleepHoursLastNight", "stressScore"];

function applyTo<T extends EstimableReading>(r: T, c: Computed): T {
  const out: T = { ...r };
  const est: Estimates = {};
  for (const k of KEYS) {
    if (r[k] != null) continue; // measured value: never replaced nor flagged
    const v = c.values[k];
    if (v === undefined) continue;
    out[k] = v;
    est[k] = c.estimates[k];
  }
  if (Object.keys(est).length > 0) out.estimates = est;
  return out;
}

/**
 * Enriches readings. `windowAsc`: history ascending (<= MAX_WINDOW_ROWS), whose
 * tail contains every reading in `targetsAsc` (same objects/timestamps, ascending).
 *
 * Decision for /readings: estimates are computed at "anchors" every
 * ANCHOR_STRIDE readings (~10 min) plus the newest, each over its own 24 h
 * window (cost ~ (n/20) * window, a few ms), and the readings between anchors
 * inherit the previous anchor's values (never using future data). One DB query.
 */
export function enrichReadings<T extends EstimableReading>(windowAsc: T[], targetsAsc: T[]): T[] {
  if (targetsAsc.length === 0) return [];
  const samples = windowAsc.map(toSample);
  const idxByT = new Map<number, number>();
  windowAsc.forEach((r, i) => idxByT.set(r.recordedAtEpochMs, i));
  let current: Computed | null = null;
  return targetsAsc.map((r, i) => {
    const idx = idxByT.get(r.recordedAtEpochMs);
    if (idx === undefined) return r;
    if (current === null || i % ANCHOR_STRIDE === 0 || i === targetsAsc.length - 1) {
      current = computeEstimatesAt(samples, idx);
    }
    return applyTo(r, current);
  });
}
