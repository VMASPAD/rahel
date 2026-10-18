import {
  RESTING_MIN_COVERAGE_MS,
  RESTING_MIN_SAMPLES,
  RESTING_PERCENTILE,
} from "./constants.js";
import { percentile, stillSamples } from "./stats.js";
import type { EstimateResult, Sample } from "./types.js";

/**
 * Resting HR = 10th percentile of HR over the (<=24 h) window, using only
 * "still" samples (steps not growing). Needs >= RESTING_MIN_SAMPLES samples
 * spanning >= 1 h; otherwise null. Supportive estimate, not a clinical value.
 * Confidence: always "low" (wrist optical HR, no posture info).
 */
export function estimateRestingHeartRate(window: Sample[]): EstimateResult | null {
  const still = stillSamples(window);
  if (still.length < RESTING_MIN_SAMPLES) return null;
  if (still[still.length - 1].t - still[0].t < RESTING_MIN_COVERAGE_MS) return null;
  const value = Math.round(percentile(still.map((s) => s.hr), RESTING_PERCENTILE));
  return {
    value,
    estimate: { method: "hr-p10-still-24h", confidence: "low", sampleCount: still.length },
  };
}
