import {
  STRESS_FULL_ELEVATION,
  STRESS_HRV_HIGH_STRESS_MS,
  STRESS_HRV_LOW_STRESS_MS,
  STRESS_MEDIUM_MIN_SAMPLES,
  STRESS_MIN_SAMPLES,
  STRESS_WEIGHT_HR,
  STRESS_WEIGHT_HRV,
  STRESS_WINDOW_MS,
} from "./constants.js";
import { clamp, mean, stillSamples } from "./stats.js";
import type { EstimateResult, Sample } from "./types.js";

/**
 * Stress index 0-100 (a physiological-arousal proxy, not a psychological measure).
 *
 *   hrPart  = clamp(((meanHR - resting) / resting) / 0.35, 0, 1) * 100
 *             over still samples of the last 10 min (mean = smoothing)
 *   hrvPart = clamp((60 - hrv) / 50, 0, 1) * 100      (only if estimated HRV exists)
 *   score   = 0.7 * hrPart + 0.3 * hrvPart            (hrPart alone without HRV)
 *
 * Needs a resting HR and >= 5 still samples in the last 10 min.
 * Confidence "medium" with >= 15 samples, otherwise "low".
 * `window` must end at the reference reading.
 */
export function estimateStress(
  window: Sample[],
  restingHr: number | null,
  hrvMs: number | null,
): EstimateResult | null {
  if (restingHr == null || window.length === 0) return null;
  const end = window[window.length - 1].t;
  const recent = stillSamples(window).filter((s) => end - s.t <= STRESS_WINDOW_MS);
  if (recent.length < STRESS_MIN_SAMPLES) return null;
  const elevation = (mean(recent.map((s) => s.hr)) - restingHr) / restingHr;
  const hrPart = clamp(elevation / STRESS_FULL_ELEVATION, 0, 1) * 100;
  let score = hrPart;
  let method = "stress-hr-elevation-10m";
  if (hrvMs != null) {
    const hrvPart =
      clamp(
        (STRESS_HRV_LOW_STRESS_MS - hrvMs) / (STRESS_HRV_LOW_STRESS_MS - STRESS_HRV_HIGH_STRESS_MS),
        0,
        1,
      ) * 100;
    score = STRESS_WEIGHT_HR * hrPart + STRESS_WEIGHT_HRV * hrvPart;
    method = "stress-hr-elevation-hrv-10m";
  }
  return {
    value: Math.round(clamp(score, 0, 100)),
    estimate: {
      method,
      confidence: recent.length >= STRESS_MEDIUM_MIN_SAMPLES ? "medium" : "low",
      sampleCount: recent.length,
    },
  };
}
