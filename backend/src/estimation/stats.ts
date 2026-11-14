import { HR_MAX_BPM, HR_MIN_BPM, STILL_LOOKBACK_MS } from "./constants.js";
import type { Sample, StillSample } from "./types.js";

/** Linear-interpolated percentile (p in 0..1) of a non-empty array. */
export function percentile(values: number[], p: number): number {
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Samples (ascending by time) with valid HR where stepsToday did not grow over
 * the previous STILL_LOOKBACK_MS. Steps unknown (null) => not still, since
 * inactivity cannot be asserted. A decrease (midnight reset) counts as not growing.
 */
export function stillSamples(samples: Sample[]): StillSample[] {
  const out: StillSample[] = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.hr == null || s.hr < HR_MIN_BPM || s.hr > HR_MAX_BPM || s.steps == null) continue;
    let grew = false;
    for (let j = i - 1; j >= 0 && s.t - samples[j].t <= STILL_LOOKBACK_MS; j--) {
      const prev = samples[j].steps;
      if (prev != null && s.steps > prev) {
        grew = true;
        break;
      }
    }
    // First sample has no look-back: accepted only if a following gap-free check is impossible; keep it.
    if (!grew) out.push({ t: s.t, hr: s.hr });
  }
  return out;
}
