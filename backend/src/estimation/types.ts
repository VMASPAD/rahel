export type EstimateConfidence = "low" | "medium"; // never "high"

export type Estimate = {
  /** Short method id, e.g. "hr-p10-still-24h". */
  method: string;
  confidence: EstimateConfidence;
  sampleCount: number;
};

export type EstimateKey =
  | "hrvMs"
  | "restingHeartRateBpm"
  | "sleepHoursLastNight"
  | "stressScore";

export type EstimateResult = { value: number; estimate: Estimate };

export type Estimates = Partial<Record<EstimateKey, Estimate>>;

/** Minimal reading shape the estimators need. */
export type Sample = {
  t: number;
  hr: number | null;
  steps: number | null;
};

/** A sample with valid HR and "still" flag (steps not growing). */
export type StillSample = { t: number; hr: number };
