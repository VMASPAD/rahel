/**
 * Builds the ONLY thing that is ever sent to Jev: an aggregated, pseudonymous summary.
 * Contains no identifiers (no email, userId, deviceId, crewMemberId), no absolute timestamps
 * and no per-second readings: statistics per day part, per-day figures (relative "days ago"),
 * counts, coverage and the estimates the backend already computes (src/estimation).
 */
import { createHash } from "node:crypto";
import { enrichReadings } from "../estimation/index.js";
import { bucketedReadingsAsc, readingWindowAsc } from "../store/telemetryStore.js";

export const ALLOWED_WINDOWS = [24, 168, 720] as const;
export type WindowHours = (typeof ALLOWED_WINDOWS)[number];

const MIN_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const HR_MIN = 30;
const HR_MAX = 220;
/** Minimum span of data (present buckets x bucket length) to run an analysis. */
export const MIN_DATA_MINUTES = 60;

const BUCKET_MIN: Record<WindowHours, number> = { 24: 5, 168: 15, 720: 30 };

export type AnalysisSummary = Record<string, unknown>;

const r1 = (n: number) => Math.round(n * 10) / 10;
const r0 = (n: number) => Math.round(n);
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
function pct(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[i];
}
const sortedNums = (a: number[]) => [...a].sort((x, y) => x - y);
function std(a: number[]): number | null {
  if (a.length < 2) return null;
  const m = mean(a)!;
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}
function slope(ys: { x: number; y: number }[]): number | null {
  if (ys.length < 3) return null;
  const mx = mean(ys.map((p) => p.x))!;
  const my = mean(ys.map((p) => p.y))!;
  let num = 0;
  let den = 0;
  for (const p of ys) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

type B = { t: number; hr: number | null; delta: number; still: boolean; localHour: number; day: number };

function dayPart(h: number): "night" | "morning" | "afternoon" | "evening" {
  return h < 6 ? "night" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

export type BuiltSummary = {
  summary: AnalysisSummary;
  hash: string;
  presentBuckets: number;
  enoughData: boolean;
};

export function buildSummary(
  crewMemberId: string,
  windowHours: WindowHours,
  opts: { now?: number; tzOffsetMinutes?: number } = {},
): BuiltSummary {
  const now = opts.now ?? Date.now();
  const off = Math.max(-840, Math.min(840, Math.round(opts.tzOffsetMinutes ?? 0)));
  const bucketMin = BUCKET_MIN[windowHours];
  const bucketMs = bucketMin * MIN_MS;
  const since = now - windowHours * HOUR_MS;
  const expected = Math.floor((windowHours * 60) / bucketMin);
  const rows = bucketedReadingsAsc(crewMemberId, since, bucketMs, expected + 2).filter(
    (r) => r.recordedAtEpochMs <= now,
  );

  // --- per-bucket series (internal only; never leaves this function) ---
  const bs: B[] = [];
  let prevSteps: number | null = null;
  let prevT: number | null = null;
  for (const r of rows) {
    const hr =
      r.heartRateBpm != null && r.heartRateBpm >= HR_MIN && r.heartRateBpm <= HR_MAX
        ? r.heartRateBpm
        : null;
    let delta = 0;
    const s = r.stepsToday ?? null;
    if (s != null && prevSteps != null && prevT != null && r.recordedAtEpochMs - prevT <= 2 * bucketMs) {
      delta = s >= prevSteps ? s - prevSteps : s; // drop = midnight reset
    }
    if (s != null) prevSteps = s;
    prevT = r.recordedAtEpochMs;
    const local = r.recordedAtEpochMs + off * MIN_MS;
    bs.push({
      t: r.recordedAtEpochMs,
      hr,
      delta,
      still: delta === 0,
      localHour: (local % DAY_MS) / HOUR_MS,
      day: Math.floor(local / DAY_MS),
    });
  }
  const withHr = bs.filter((b) => b.hr != null);
  const present = bs.length;

  // --- coverage ---
  let longestGap = 0;
  let gapsOver2h = 0;
  const edges = [since, ...bs.map((b) => b.t), now];
  for (let i = 1; i < edges.length; i++) {
    const g = edges[i] - edges[i - 1];
    if (g > 2 * bucketMs) {
      longestGap = Math.max(longestGap, g);
      if (g > 2 * HOUR_MS) gapsOver2h++;
    }
  }
  const days = new Set(bs.map((b) => b.day));
  const coverage = {
    windowHours,
    coveragePercent: expected > 0 ? Math.min(100, r0((present / expected) * 100)) : 0,
    longestGapHours: r1(longestGap / HOUR_MS),
    gapsOver2h,
    daysWithData: days.size,
  };

  // --- heart rate ---
  const hrs = sortedNums(withHr.map((b) => b.hr!));
  const stillHr = sortedNums(withHr.filter((b) => b.still).map((b) => b.hr!));
  const resting = pct(stillHr.length >= 6 ? stillHr : hrs, 0.1);
  const thr = resting != null ? resting + 25 : null;
  const elevatedShare =
    thr != null && withHr.length ? withHr.filter((b) => b.hr! > thr).length / withHr.length : null;

  // --- per day ---
  const lastDay = Math.floor((now + off * MIN_MS) / DAY_MS);
  const byDay = new Map<number, B[]>();
  for (const b of bs) (byDay.get(b.day) ?? byDay.set(b.day, []).get(b.day)!).push(b);
  const daily = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-30)
    .map(([day, list]) => {
      const dh = list.filter((b) => b.hr != null);
      const st = sortedNums(dh.filter((b) => b.still).map((b) => b.hr!));
      const restingDay = st.length >= 6 ? pct(st, 0.1) : null;
      return {
        daysAgo: lastDay - day,
        buckets: list.length,
        restingHr: restingDay != null ? r0(restingDay) : null,
        meanHr: dh.length ? r0(mean(dh.map((b) => b.hr!))!) : null,
        steps: list.reduce((s, b) => s + b.delta, 0),
      };
    });
  const slopeBpm = slope(
    daily.filter((d) => d.restingHr != null).map((d) => ({ x: -d.daysAgo, y: d.restingHr! })),
  );

  // --- day parts ---
  const parts: Record<string, B[]> = { night: [], morning: [], afternoon: [], evening: [] };
  for (const b of bs) parts[dayPart(b.localHour)].push(b);
  const dayParts: Record<string, unknown> = {};
  for (const [name, list] of Object.entries(parts)) {
    const h = sortedNums(list.filter((b) => b.hr != null).map((b) => b.hr!));
    dayParts[name] = {
      buckets: list.length,
      meanHr: h.length ? r0(mean(h)!) : null,
      p90Hr: h.length ? r0(pct(h, 0.9)!) : null,
      stepsPerDay: r0(list.reduce((s, b) => s + b.delta, 0) / Math.max(1, days.size)),
      activeShare: list.length ? r1(list.filter((b) => b.delta > 0).length / list.length) : null,
    };
  }

  // --- activity ---
  const totalSteps = bs.reduce((s, b) => s + b.delta, 0);
  const activity = {
    stepsPerDay: r0(totalSteps / Math.max(1, days.size)),
    activeShare: present ? r1(bs.filter((b) => b.delta > 0).length / present) : null,
  };

  // --- elevated HR without activity (episodes >= 15 min) ---
  const minRun = Math.max(1, Math.ceil(15 / bucketMin));
  let episodes = 0;
  let maxRun = 0;
  const epParts: Record<string, number> = { night: 0, morning: 0, afternoon: 0, evening: 0 };
  let stillElevated = 0;
  if (thr != null) {
    let run: B[] = [];
    const flush = () => {
      if (run.length >= minRun) {
        episodes++;
        maxRun = Math.max(maxRun, run.length);
        epParts[dayPart(run[0].localHour)]++;
      }
      run = [];
    };
    for (const b of bs) {
      const hot = b.hr != null && b.hr > thr && b.still;
      if (hot && (run.length === 0 || b.t - run[run.length - 1].t <= 2 * bucketMs)) run.push(b);
      else {
        flush();
        if (hot) run.push(b);
      }
      if (hot) stillElevated++;
    }
    flush();
  }
  const stillBuckets = withHr.filter((b) => b.still).length;
  const elevatedHr = {
    episodesWithoutActivity: episodes,
    longestEpisodeMinutes: maxRun * bucketMin,
    episodesByDayPart: epParts,
  };

  // --- nights (estimated): longest still run per evening-morning window ---
  const nights = estimateNights(bs, bucketMs, bucketMin, parts, off);

  // --- estimates already computed by the backend (src/estimation) ---
  const win = readingWindowAsc(crewMemberId);
  const latest = win.length ? enrichReadings(win, [win[win.length - 1]])[0] : null;
  const fresh = latest && now - latest.recordedAtEpochMs <= 6 * HOUR_MS;
  const estimates = {
    available: Boolean(fresh),
    restingHrBpm: fresh && latest.restingHeartRateBpm != null ? r0(latest.restingHeartRateBpm) : null,
    hrvMs: fresh && latest.hrvMs != null ? r0(latest.hrvMs) : null,
    sleepHours: fresh && latest.sleepHoursLastNight != null ? r1(latest.sleepHoursLastNight) : null,
    stressScore: fresh && latest.stressScore != null ? r0(latest.stressScore) : null,
    note: "values estimated by the server from heart rate and steps; low to medium confidence",
  };

  const summary: AnalysisSummary = {
    about:
      "Aggregated, anonymous summary from a wellness watch. The data are consumer-grade estimates, not medical.",
    coverage,
    heartRate: {
      mean: hrs.length ? r0(mean(hrs)!) : null,
      p10: hrs.length ? r0(pct(hrs, 0.1)!) : null,
      p50: hrs.length ? r0(pct(hrs, 0.5)!) : null,
      p90: hrs.length ? r0(pct(hrs, 0.9)!) : null,
      resting: resting != null ? r0(resting) : null,
      restingSlopeBpmPerDay: slopeBpm != null ? Math.round(slopeBpm * 100) / 100 : null,
      elevatedShare: elevatedShare != null ? r1(elevatedShare) : null,
    },
    stress: {
      latestEstimate: estimates.stressScore,
      stillWithElevatedHrShare: stillBuckets ? r1(stillElevated / stillBuckets) : null,
    },
    elevatedHr,
    activity,
    dayParts,
    nights,
    sleepStartStdMinutes: nights.startStdMinutes,
    daily,
    estimates,
  };
  const json = JSON.stringify(summary);
  return {
    summary,
    hash: createHash("sha256").update(json).digest("hex"),
    presentBuckets: present,
    enoughData: present * bucketMin >= MIN_DATA_MINUTES && withHr.length > 0,
  };
}

function estimateNights(
  bs: B[],
  bucketMs: number,
  bucketMin: number,
  parts: Record<string, B[]>,
  _off: number,
) {
  // Group by "night id": local day of (localHour >= 12 ? day : day-1).
  const groups = new Map<number, B[]>();
  for (const b of bs) {
    const id = b.localHour >= 12 ? b.day : b.day - 1;
    if (b.localHour >= 20 || b.localHour < 11) (groups.get(id) ?? groups.set(id, []).get(id)!).push(b);
  }
  const dayMeans = new Map<number, number[]>();
  for (const b of bs) {
    if (b.localHour >= 11 && b.localHour < 20 && b.hr != null)
      (dayMeans.get(b.day) ?? dayMeans.set(b.day, []).get(b.day)!).push(b.hr);
  }
  const out: { startHour: number; hours: number; dipPercent: number | null }[] = [];
  for (const [id, list] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    let best: B[] = [];
    let run: B[] = [];
    for (const b of list) {
      const ok = b.hr != null && b.still;
      if (ok && (run.length === 0 || b.t - run[run.length - 1].t <= 2 * bucketMs)) run.push(b);
      else {
        if (run.length > best.length) best = run;
        run = ok ? [b] : [];
      }
    }
    if (run.length > best.length) best = run;
    const hours = (best.length * bucketMin) / 60;
    if (hours < 3) continue;
    const nightHr = mean(best.map((b) => b.hr!))!;
    const dm = dayMeans.get(id + 1) ?? dayMeans.get(id);
    const dayHr = dm && dm.length ? mean(dm)! : null;
    let start = best[0].localHour;
    if (start < 12) start += 24; // keep after-midnight starts contiguous with evening ones
    out.push({
      startHour: r1(start),
      hours: r1(hours),
      dipPercent: dayHr ? r1(((dayHr - nightHr) / dayHr) * 100) : null,
    });
  }
  const last = out.slice(-14);
  const sd = std(last.map((n) => n.startHour));
  void parts;
  return {
    estimatedNights: last.length,
    startStdMinutes: sd != null ? r0(sd * 60) : null,
    dipPercent: mean(last.filter((n) => n.dipPercent != null).map((n) => n.dipPercent!)) != null
      ? r1(mean(last.filter((n) => n.dipPercent != null).map((n) => n.dipPercent!))!)
      : null,
    perNight: last,
  };
}
