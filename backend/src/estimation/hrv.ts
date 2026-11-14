import {
  HRV_ANCHOR_HR,
  HRV_ANCHOR_LN,
  HRV_DISPERSION_EXPONENT,
  HRV_DISPERSION_FACTOR_MAX,
  HRV_DISPERSION_FACTOR_MIN,
  HRV_LN_SLOPE_PER_BPM,
  HRV_MAX_MS,
  HRV_MAX_PAIR_GAP_MS,
  HRV_MIN_MS,
  HRV_MIN_SAMPLES,
  HRV_REF_HR_DISPERSION,
} from "./constants.js";
import { clamp, stillSamples } from "./stats.js";
import type { EstimateResult, Sample } from "./types.js";

/**
 * RMSSD-like PROXY (not a measurement: there is no beat-to-beat data).
 *
 *   base   = exp(ln70 - 0.025 * (restingHR - 50))      inverse HR/HRV relation
 *   disp   = RMS of successive HR differences (bpm) between consecutive
 *            still samples <= 60 s apart
 *   factor = clamp((disp / 1.5)^0.25, 0.7, 1.3)
 *   hrv    = clamp(base * factor, 10, 120) ms
 *
 * Needs >= 40 still samples and a resting HR (supplied by the caller).
 * Confidence is always "low".
 */
export function estimateHrv(window: Sample[], restingHr: number | null): EstimateResult | null {
  if (restingHr == null) return null;
  const still = stillSamples(window);
  if (still.length < HRV_MIN_SAMPLES) return null;
  let sumSq = 0;
  let pairs = 0;
  for (let i = 1; i < still.length; i++) {
    if (still[i].t - still[i - 1].t > HRV_MAX_PAIR_GAP_MS) continue;
    const d = still[i].hr - still[i - 1].hr;
    sumSq += d * d;
    pairs++;
  }
  if (pairs < HRV_MIN_SAMPLES - 1) return null;
  const disp = Math.sqrt(sumSq / pairs);
  const base = Math.exp(HRV_ANCHOR_LN + HRV_LN_SLOPE_PER_BPM * (restingHr - HRV_ANCHOR_HR));
  const factor = clamp(
    Math.pow(Math.max(disp, 1e-6) / HRV_REF_HR_DISPERSION, HRV_DISPERSION_EXPONENT),
    HRV_DISPERSION_FACTOR_MIN,
    HRV_DISPERSION_FACTOR_MAX,
  );
  const value = Math.round(clamp(base * factor, HRV_MIN_MS, HRV_MAX_MS));
  return {
    value,
    estimate: { method: "hrv-proxy-hr-dispersion", confidence: "low", sampleCount: still.length },
  };
}
