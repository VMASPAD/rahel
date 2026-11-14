/**
 * Read-time estimation of metrics the watch does not send. Pure functions: raw
 * stored data is never modified; only null fields of the returned copy are
 * filled, and each filled field is flagged in `estimates`. skinTempCelsius is
 * deliberately never estimated (see docs/estimation.md).
 */
import { ANALYSIS_WINDOW_MS, ANCHOR_INTERVAL_MS } from "./constants.js";
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
 * Enriches readings. `windowAsc`: history ascending, resampled to ~30 s
 * (<= MAX_WINDOW_ROWS). `targetsAsc`: the readings to fill, ascending; they need
 * not be members of the window (raw 1 Hz readings are fine): each target uses the
 * window samples up to its own timestamp, never future data.
 *
 * Decision for /readings: estimates are computed at "anchors" every
 * ANCHOR_INTERVAL_MS (~10 min of data time) plus the newest target, each over
 * its own 24 h window (a few ms each), and the targets between anchors inherit
 * the previous anchor's values. Targets older than the first window sample get none.
 */
export function enrichReadings<T extends EstimableReading>(windowAsc: T[], targetsAsc: T[]): T[] {
  if (targetsAsc.length === 0) return [];
  const samples = windowAsc.map(toSample);
  let current: Computed | null = null;
  let anchorT = -Infinity;
  let j = 0; // index of the last sample with t <= target time
  return targetsAsc.map((r, i) => {
    const t = r.recordedAtEpochMs;
    if (samples.length === 0 || samples[0].t > t) return r;
    while (j + 1 < samples.length && samples[j + 1].t <= t) j++;
    if (current === null || t - anchorT >= ANCHOR_INTERVAL_MS || i === targetsAsc.length - 1) {
      current = computeEstimatesAt(samples, j);
      anchorT = t;
    }
    return applyTo(r, current);
  });
}
