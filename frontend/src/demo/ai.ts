/**
 * SIMULATED analysis ("Jev" stand-in). No network, no tokens: the judgments are computed from the
 * same deterministic physiology the dashboard shows, with a small seeded variation. Output shapes
 * are exactly those of backend/src/analysis/runner.ts (QuestionResult / RunResults).
 */
import type { Catalog, QuestionResult, Run, RunResults, RunStatus, RunSummary } from './types.ts'
import { CATALOG, WELLNESS_DISCLAIMER, publicCatalog, type CatalogEntry } from './catalog.ts'
import {
  DAY, HOUR, MIN, coreAt, dayOf, gapsBetween, hrvForDay, nightOf, restingForDay, stepsOfDay,
  type Profile,
} from './model.ts'
import { clamp, gauss, r2 } from './rng.ts'
import type { SimRun } from './state.ts'

export const SIM_MODEL = 'jev-demo (simulated)'
export const ALLOWED_WINDOWS = [24, 168, 720]
export const MAX_RUNS_PER_HOUR = 10

export function catalogPayload(): Catalog {
  return {
    configured: true,
    disclaimer: WELLNESS_DISCLAIMER,
    windows: ALLOWED_WINDOWS,
    maxRunsPerHour: MAX_RUNS_PER_HOUR,
    items: publicCatalog(),
  }
}

export type Metrics = {
  days: number
  restAvg: number
  restSlopePerDay: number | null
  hrvAvg: number
  sleepAvg: number
  sleepStartStdMin: number | null
  stressAvg: number
  elevatedShare: number
  stepsPerDay: number
  dipPercent: number
  coverage: number
  partSteps: { morning: number; afternoon: number; evening: number }
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)

function slope(ys: number[]): number | null {
  if (ys.length < 3) return null
  const xs = ys.map((_, i) => i)
  const mx = mean(xs)
  const my = mean(ys)
  let num = 0
  let den = 0
  for (let i = 0; i < ys.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  return den ? num / den : null
}

/** Aggregates the simulated physiology over the window (10-minute sampling). */
export function metricsFor(p: Profile, windowHours: number, now: number, pairedAt: number): Metrics {
  const avail = Math.min(windowHours * HOUR, Math.max(HOUR, now - pairedAt))
  const since = now - avail
  const days = Math.max(1, Math.round(avail / DAY))
  const todayIdx = dayOf(now)
  const dayIdxs: number[] = []
  for (let d = dayOf(since); d <= todayIdx; d++) dayIdxs.push(d)
  const rest = dayIdxs.map((d) => restingForDay(p, d))
  const hrv = dayIdxs.map((d) => hrvForDay(p, d))
  const nights = dayIdxs.slice(0, -1).map((d) => nightOf(p, d))
  const startMin = nights.map((n) => (n.bedMs - Math.floor(n.bedMs / DAY) * DAY) / MIN)
  // bed times after midnight are the same night: unwrap around 22:00
  const unwrapped = startMin.map((m) => (m < 12 * 60 ? m + 24 * 60 : m))
  const sm = mean(unwrapped)
  const sleepStd = unwrapped.length >= 3 ? Math.sqrt(mean(unwrapped.map((x) => (x - sm) ** 2))) : null

  let awake = 0
  let awakeHr = 0
  let asleepN = 0
  let asleepHr = 0
  let elev = 0
  let awakeStill = 0
  let stressSum = 0
  const part = { morning: 0, afternoon: 0, evening: 0 }
  for (let t = since; t <= now; t += 10 * MIN) {
    const c = coreAt(p, t)
    if (c.asleep) {
      asleepN++
      asleepHr += c.hr
      continue
    }
    awake++
    awakeHr += c.hr
    stressSum += c.stress
    if (c.rate === 0) {
      awakeStill++
      if (c.hr - restingForDay(p, c.day) > 22) elev++
    }
    const steps = c.rate * 600
    if (c.hourOfDay >= 6 && c.hourOfDay < 12) part.morning += steps
    else if (c.hourOfDay >= 12 && c.hourOfDay < 18) part.afternoon += steps
    else if (c.hourOfDay >= 18) part.evening += steps
  }
  const completed = dayIdxs.slice(0, -1)
  const stepDays = completed.length ? completed.map((d) => stepsOfDay(p, d)) : [coreAt(p, now).steps]
  const gapSec = gapsBetween(p, since, now, now).reduce((s, g) => s + (Math.min(g.to, now) - Math.max(g.from, since)) / 1000, 0)
  const dayMean = awake ? awakeHr / awake : 70
  const nightMean = asleepN ? asleepHr / asleepN : dayMean
  return {
    days,
    restAvg: mean(rest),
    restSlopePerDay: slope(rest),
    hrvAvg: mean(hrv),
    sleepAvg: nights.length ? mean(nights.map((n) => n.durH)) : 7,
    sleepStartStdMin: sleepStd,
    stressAvg: awake ? stressSum / awake : 30,
    elevatedShare: awakeStill ? elev / awakeStill : 0,
    stepsPerDay: mean(stepDays),
    dipPercent: asleepN ? ((dayMean - nightMean) / dayMean) * 100 : 8,
    coverage: clamp(1 - gapSec / (avail / 1000), 0, 1),
    partSteps: part,
  }
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

type Raw =
  | { kind: 'noul'; p: number }
  | { kind: 'score'; position: number; levels: number; confidence: number }
  | { kind: 'choice'; scores: Record<string, number>; temp: number }

function judge(id: string, m: Metrics): Raw {
  switch (id) {
    case 'recovery': {
      const a = (60 - m.restAvg) / 6
      const b = (m.hrvAvg - 45) / 20
      const c = (m.sleepAvg - 7) / 1.2
      const d = (m.dipPercent - 8) / 6
      return { kind: 'score', position: 2 + 1.4 * (0.3 * a + 0.3 * b + 0.2 * c + 0.2 * d), levels: 5, confidence: 0.78 }
    }
    case 'sustained_stress': {
      if (m.days < 2 && m.stressAvg < 45) return { kind: 'noul', p: 0.14 + (m.stressAvg - 20) / 200 }
      return { kind: 'noul', p: sigmoid(1.5 * ((m.stressAvg - 45) / 12 + (m.elevatedShare - 0.1) * 12)) }
    }
    case 'resting_hr_trend_up': {
      if (m.restSlopePerDay === null || m.days < 3) return { kind: 'noul', p: 0.5 }
      return { kind: 'noul', p: sigmoid((m.restSlopePerDay - 0.12) * (m.days >= 20 ? 14 : 8)) }
    }
    case 'sleep_regularity': {
      if (m.sleepStartStdMin === null) return { kind: 'score', position: 2, levels: 5, confidence: 0.45 }
      return { kind: 'score', position: clamp(4 - (m.sleepStartStdMin - 25) / 25, 0, 4), levels: 5, confidence: 0.7 }
    }
    case 'activity_level': {
      const s = m.stepsPerDay
      return {
        kind: 'choice',
        temp: 1300,
        scores: { sedentary: -Math.abs(s - 2500), light: -Math.abs(s - 6000), moderate: -Math.abs(s - 10000), high: -Math.abs(s - 14500) },
      }
    }
    case 'unexplained_elevated_hr':
      return { kind: 'noul', p: sigmoid((m.elevatedShare - 0.1) * 24) }
    case 'data_quality': {
      const cap = m.days < 3 ? 3 : 4
      return { kind: 'score', position: clamp((m.coverage - 0.9) * 40 + 0.4, 0, cap), levels: 5, confidence: 0.85 }
    }
    case 'best_activity_window': {
      const { morning, afternoon, evening } = m.partSteps
      const total = morning + afternoon + evening
      const top = Math.max(morning, afternoon, evening)
      const flat = total < 1 || m.stepsPerDay < 2500 || top / Math.max(1, total) < 0.42
      const sh = (x: number) => (total ? (x / total) * 6 : 0)
      return {
        kind: 'choice',
        temp: 1,
        scores: { morning: sh(morning), afternoon: sh(afternoon), evening: sh(evening), unclear: flat ? 2.6 : 0.8 },
      }
    }
    case 'night_dip':
      return { kind: 'noul', p: sigmoid((m.dipPercent - 9) / 2) }
    case 'wellbeing_trend': {
      if (m.days < 3 || m.restSlopePerDay === null) return { kind: 'choice', temp: 1, scores: { unclear: 3, stable: 0.6, improving: 0.2, worsening: 0.2 } }
      const w = m.restSlopePerDay * 3 + (m.stressAvg - 40) / 25
      return {
        kind: 'choice',
        temp: 1,
        scores: { worsening: w * 2.2, improving: -w * 2.2 - 0.5, stable: 1.2 - Math.abs(w) * 1.5, unclear: -1.5 },
      }
    }
    default:
      return { kind: 'noul', p: 0.5 }
  }
}

function softmax(scores: Record<string, number>, temp: number, noise: (k: string) => number) {
  const keys = Object.keys(scores)
  const ex = keys.map((k) => Math.exp((scores[k] + noise(k)) / temp))
  const sum = ex.reduce((a, b) => a + b, 0)
  const probs = ex.map((e) => r2(e / sum))
  const drift = r2(1 - probs.reduce((a, b) => a + b, 0))
  const top = probs.indexOf(Math.max(...probs))
  probs[top] = r2(probs[top] + drift)
  return Object.fromEntries(keys.map((k, i) => [k, probs[i]])) as Record<string, number>
}

/** Same interpretation rules as runner.ts `interpret`. */
export function interpretSim(c: CatalogEntry, raw: Raw, seed: number): QuestionResult {
  const n = (k: number) => gauss(seed, c.id.length * 131 + c.id.charCodeAt(0), k)
  if (raw.kind === 'noul') {
    const p = clamp(raw.p + n(1) * 0.035, 0.02, 0.98)
    const r = c.readings.noul!
    return {
      status: 'ok', kind: 'noul', value: r2(p), confidence: r2(Math.abs(p - 0.5) * 2),
      reading: p < 0.35 ? r[0] : p > 0.65 ? r[2] : r[1],
    }
  }
  if (raw.kind === 'choice') {
    const probs = softmax(raw.scores, raw.temp, (k) => n(k.length + 10) * (raw.temp * 0.08))
    const choice = Object.keys(probs).reduce((a, b) => (probs[b] > probs[a] ? b : a))
    return {
      status: 'ok', kind: 'choice', value: choice, confidence: probs[choice],
      reading: c.readings.choice![choice] ?? '', probabilities: probs,
    }
  }
  const position = clamp(raw.position + n(2) * 0.15, 0, raw.levels - 1)
  const level = Math.round(position)
  return {
    status: 'ok', kind: 'score', value: r2(position / (raw.levels - 1)), level, levels: raw.levels,
    confidence: r2(clamp(raw.confidence + n(3) * 0.05, 0.3, 0.97)), reading: c.readings.score![level] ?? '',
  }
}

export function finalAnswers(p: Profile, windowHours: number, now: number, pairedAt: number, seed: number): Record<string, QuestionResult> {
  const m = metricsFor(p, windowHours, now, pairedAt)
  return Object.fromEntries(CATALOG.map((c) => [c.id, interpretSim(c, judge(c.id, m), seed)]))
}

// ---- run lifecycle (progress is a pure function of time) ---------------------------

export const isActive = (s: RunStatus) => s === 'queued' || s === 'running'

function doneCount(r: SimRun, now: number): number {
  const n = CATALOG.length
  const elapsed = now - r.startedAt
  if (elapsed < 0) return 0
  return Math.min(n, Math.floor((elapsed / r.durationMs) * n))
}

export function statusOf(r: SimRun, now: number): RunStatus {
  if (now >= r.startedAt + r.durationMs) return 'done'
  return now >= r.startedAt ? 'running' : 'queued'
}

export function resultsOf(r: SimRun, now: number): RunResults {
  const done = statusOf(r, now) === 'queued' ? 0 : doneCount(r, now)
  const questions: Record<string, QuestionResult> = {}
  CATALOG.forEach((c, i) => {
    questions[c.id] = i < done ? r.final[c.id] : { status: 'pending' }
  })
  const all = done >= CATALOG.length
  return {
    model: done > 0 ? SIM_MODEL : null,
    windowHours: r.windowHours,
    progress: { total: CATALOG.length, done, failed: 0 },
    questions,
    headline: all ? 'Full analysis' : null,
  }
}

export const runSummary = (r: SimRun, now: number): RunSummary => {
  const status = statusOf(r, now)
  return {
    id: r.id,
    deviceId: r.deviceId,
    windowHours: r.windowHours,
    status,
    consentAt: r.consentAt,
    error: null,
    createdAt: r.createdAt,
    finishedAt: status === 'done' ? r.startedAt + r.durationMs : null,
  }
}

export type SimRunView = Run & { simulated: true }
export const runView = (r: SimRun, now: number): SimRunView => ({
  ...runSummary(r, now),
  results: { ...resultsOf(r, now), simulated: true } as RunResults,
  disclaimer: `SIMULATION (demo mode): no AI was called and no data left your browser. ${WELLNESS_DISCLAIMER}`,
  simulated: true,
})
