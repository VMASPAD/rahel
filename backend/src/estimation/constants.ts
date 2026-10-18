/**
 * Named windows and thresholds for the backend estimators.
 * All values are heuristics for supportive, non-clinical estimates.
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;

/** Nominal watch sampling interval (~30 s). */
export const SAMPLE_INTERVAL_MS = 30_000;

/** Max rows read per request (about 25 h at 30 s). One query, no N+1. */
export const MAX_WINDOW_ROWS = 3000;
/** History window used by resting HR / HRV / sleep. */
export const ANALYSIS_WINDOW_MS = 24 * HOUR_MS;

/** A sample is "still" if stepsToday did not grow during this look-back. */
export const STILL_LOOKBACK_MS = 60_000;
/** Valid HR range for samples used in estimation (bpm). */
export const HR_MIN_BPM = 30;
export const HR_MAX_BPM = 220;

// --- Resting heart rate ---
export const RESTING_PERCENTILE = 0.1;
export const RESTING_MIN_SAMPLES = 30;
export const RESTING_MIN_COVERAGE_MS = HOUR_MS;

// --- HRV proxy ---
export const HRV_MIN_SAMPLES = 40;
/** Consecutive still samples further apart than this are not paired. */
export const HRV_MAX_PAIR_GAP_MS = 60_000;
/** Log-linear HR->RMSSD curve anchor: 70 ms at 50 bpm, -0.025 ln-units per bpm. */
export const HRV_ANCHOR_HR = 50;
export const HRV_ANCHOR_LN = Math.log(70);
export const HRV_LN_SLOPE_PER_BPM = -0.025;
/** Typical RMS of successive HR differences (bpm) for 30 s samples at rest. */
export const HRV_REF_HR_DISPERSION = 1.5;
export const HRV_DISPERSION_EXPONENT = 0.25;
export const HRV_DISPERSION_FACTOR_MIN = 0.7;
export const HRV_DISPERSION_FACTOR_MAX = 1.3;
export const HRV_MIN_MS = 10;
export const HRV_MAX_MS = 120;

// --- Sleep ---
/** Qualifying HR: <= resting * (1 + this). */
export const SLEEP_HR_MARGIN = 0.1;
/** Gaps shorter than this inside a block are tolerated (sample missing). */
export const SLEEP_MAX_TOLERATED_GAP_MS = 10 * MINUTE_MS;
/** Runs of non-qualifying samples shorter than this (restlessness) are tolerated. */
export const SLEEP_MAX_TOLERATED_BREAK_MS = 3 * MINUTE_MS;
export const SLEEP_MIN_BLOCK_MS = 2 * HOUR_MS;
export const SLEEP_MEDIUM_COVERAGE = 0.8;
export const SLEEP_MAX_HOURS = 24;

// --- Stress ---
export const STRESS_WINDOW_MS = 10 * MINUTE_MS;
export const STRESS_MIN_SAMPLES = 5;
export const STRESS_MEDIUM_MIN_SAMPLES = 15;
/** HR elevation over resting (fraction) mapping to a score of 100. */
export const STRESS_FULL_ELEVATION = 0.35;
/** HRV (ms) mapping to component 0 and 100. */
export const STRESS_HRV_LOW_STRESS_MS = 60;
export const STRESS_HRV_HIGH_STRESS_MS = 10;
export const STRESS_WEIGHT_HR = 0.7;
export const STRESS_WEIGHT_HRV = 0.3;

// --- Windowed application to /readings ---
/** Estimates are recomputed every N readings (~10 min) and inherited by the ones in between. */
export const ANCHOR_STRIDE = 20;
