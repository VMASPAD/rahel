import {
  HR_MAX_BPM,
  HR_MIN_BPM,
  SAMPLE_INTERVAL_MS,
  SLEEP_HR_MARGIN,
  SLEEP_MAX_HOURS,
  SLEEP_MAX_TOLERATED_BREAK_MS,
  SLEEP_MAX_TOLERATED_GAP_MS,
  SLEEP_MEDIUM_COVERAGE,
  SLEEP_MIN_BLOCK_MS,
  HOUR_MS,
} from "./constants.js";
import { stillSamples } from "./stats.js";
import type { EstimateResult, Sample } from "./types.js";

/**
 * Longest continuous "probable sleep" block in the window.
 *
 * A sample qualifies if HR <= restingHR * 1.10 and steps are not growing.
 * Within a block: a time gap < 10 min with no samples is tolerated; a gap
 * >= 10 min (watch off wrist) cuts it; a run of non-qualifying samples
 * shorter than 3 min is tolerated (restlessness), longer cuts it. Blocks
 * start/end on qualifying samples. Only blocks >= 2 h count. Hours =
 * (end - start) / 1 h, one decimal.
 * Confidence "medium" if samples cover > 80 % of the expected count, else "low".
 */
export function estimateSleepHours(window: Sample[], restingHr: number | null): EstimateResult | null {
  if (restingHr == null) return null;
  const threshold = restingHr * (1 + SLEEP_HR_MARGIN);
  const still = new Set(stillSamples(window).map((s) => s.t));

  type Block = { start: number; end: number; count: number };
  let best: Block | null = null;
  let cur: Block | null = null;
  let breakStart: number | null = null; // first non-qualifying sample time since cur.end
  let prevT: number | null = null;

  const close = () => {
    if (cur && (!best || cur.end - cur.start > best.end - best.start)) best = cur;
    cur = null;
    breakStart = null;
  };

  for (const s of window) {
    if (prevT != null && s.t - prevT >= SLEEP_MAX_TOLERATED_GAP_MS) close();
    prevT = s.t;
    const ok =
      s.hr != null && s.hr >= HR_MIN_BPM && s.hr <= HR_MAX_BPM && s.hr <= threshold && still.has(s.t);
    if (ok) {
      if (cur && breakStart != null && s.t - cur.end >= SLEEP_MAX_TOLERATED_BREAK_MS) close();
      if (!cur) cur = { start: s.t, end: s.t, count: 0 };
      cur.end = s.t;
      cur.count++;
      breakStart = null;
    } else if (cur) {
      if (breakStart == null) breakStart = s.t;
      if (s.t - cur.end >= SLEEP_MAX_TOLERATED_BREAK_MS) close();
    }
  }
  close();

  const b = best as Block | null;
  if (!b) return null;
  const duration = b.end - b.start;
  if (duration < SLEEP_MIN_BLOCK_MS) return null;
  const expected = duration / SAMPLE_INTERVAL_MS + 1;
  const coverage = b.count / expected;
  const hours = Math.min(SLEEP_MAX_HOURS, Math.round((duration / HOUR_MS) * 10) / 10);
  return {
    value: hours,
    estimate: {
      method: "sleep-block-low-hr-no-steps",
      confidence: coverage > SLEEP_MEDIUM_COVERAGE ? "medium" : "low",
      sampleCount: b.count,
    },
  };
}
