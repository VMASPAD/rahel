/**
 * Deterministic physiological simulator. Everything is a pure function of (profile, time):
 * no state is stored, so any window (30 min ... 30 days) can be computed lazily and the
 * live "now" simply moves forward. Time is organised in 10-minute blocks (activity episodes)
 * that are blended over ~2.5 minutes, plus per-second noise so the live pulse moves every second.
 */
import type { EstimateInfo, SensorReadingDto } from '../types/health.ts'
import { clamp, gauss, lerp, r1, smooth, strSeed, u01 } from './rng.ts'

export const SEC = 1000
export const MIN = 60_000
export const HOUR = 3_600_000
export const DAY = 86_400_000
export const BLOCK = 10 * MIN
export const BLOCKS_PER_DAY = 144
const SLOT = 30 * MIN

/** Local time zone of the browser, captured once so every function agrees on "midnight". */
export const TZ_MS = -new Date().getTimezoneOffset() * MIN
/** Reference day used to bound slow trends (they ramp over the last 28 days up to this day). */
export const ANCHOR_DAY = Math.floor((Date.now() + TZ_MS) / DAY)

export type ProfileKind = 'fit' | 'stressed' | 'sedentary'
export type Spo2Mode = 'full' | 'partial' | 'denied'

export type Profile = {
  id: string
  kind: ProfileKind
  seed: number
  restHr: number
  hrvBase: number
  sleepH: number
  bedHour: number
  bedStdMin: number
  sleepDip: number
  activeProb: number
  peakHour: number
  stressBase: number
  stressSlope: number
  restSlope: number
  stressEp: number
  spo2: Spo2Mode
  missionDay: number
  imc: number
  pesoKg: number
}

const PRESETS: Record<ProfileKind, Omit<Profile, 'id' | 'kind' | 'seed' | 'missionDay'>> = {
  fit: {
    restHr: 52, hrvBase: 72, sleepH: 7.9, bedHour: 22.6, bedStdMin: 20, sleepDip: 1,
    activeProb: 0.62, peakHour: 7.5, stressBase: 18, stressSlope: 0, restSlope: -0.02,
    stressEp: 0, spo2: 'full', imc: 22.4, pesoKg: 68,
  },
  stressed: {
    restHr: 68, hrvBase: 28, sleepH: 5.9, bedHour: 24.2, bedStdMin: 110, sleepDip: -4,
    activeProb: 0.22, peakHour: 13, stressBase: 62, stressSlope: 0.35, restSlope: 0.3,
    stressEp: 0.16, spo2: 'partial', imc: 27.1, pesoKg: 82,
  },
  sedentary: {
    restHr: 64, hrvBase: 40, sleepH: 7.0, bedHour: 23.4, bedStdMin: 55, sleepDip: -1,
    activeProb: 0.1, peakHour: 19, stressBase: 38, stressSlope: 0, restSlope: 0,
    stressEp: 0.03, spo2: 'denied', imc: 29.3, pesoKg: 90,
  },
}

export function makeProfile(id: string, kind: ProfileKind, variant = 0): Profile {
  const seed = strSeed(id)
  const base = PRESETS[kind]
  const j = (n: number, amp: number) => gauss(seed, n) * amp * (variant ? 1 : 0)
  return {
    ...base,
    id,
    kind,
    seed,
    restHr: Math.round(base.restHr + j(1, 2)),
    hrvBase: Math.round(base.hrvBase + j(2, 4)),
    activeProb: clamp(base.activeProb * (1 + j(3, 0.1)), 0.03, 0.9),
    missionDay: 30 + (seed % 40),
  }
}

export const DEMO_CREW: { id: string; kind: ProfileKind; pairedDaysAgo: number }[] = [
  { id: 'CREW-418302', kind: 'fit', pairedDaysAgo: 12 },
  { id: 'CREW-527941', kind: 'stressed', pairedDaysAgo: 9 },
  { id: 'CREW-336615', kind: 'sedentary', pairedDaysAgo: 6 },
]

const registry = new Map<string, Profile>()
for (const c of DEMO_CREW) registry.set(c.id, makeProfile(c.id, c.kind))

export function registerProfile(p: Profile): void {
  registry.set(p.id, p)
}
export function getProfile(crewId: string): Profile | null {
  return registry.get(crewId) ?? null
}
function need(crewId: string): Profile {
  const p = registry.get(crewId)
  if (!p) throw new Error(`unknown demo crew ${crewId}`)
  return p
}

// ---- per-day figures --------------------------------------------------------------

const ramp = (day: number) => clamp(day - ANCHOR_DAY, -28, 2)

export const dayOf = (t: number) => Math.floor((t + TZ_MS) / DAY)

export function restingForDay(p: Profile, day: number): number {
  return p.restHr + p.restSlope * ramp(day) + gauss(p.seed, day, 11) * 0.9
}
export function hrvForDay(p: Profile, day: number): number {
  return Math.max(10, p.hrvBase - p.restSlope * ramp(day) * 1.4 + gauss(p.seed, day, 12) * 2.5)
}
export function stressForDay(p: Profile, day: number): number {
  return clamp(p.stressBase + p.stressSlope * ramp(day) + gauss(p.seed, day, 13) * 3, 4, 95)
}
/** Night that starts on local day `d` (bed time in local ms since epoch and duration). */
export function nightOf(p: Profile, d: number): { bedMs: number; durH: number } {
  const bedMs = d * DAY + (p.bedHour + (gauss(p.seed, d, 21) * p.bedStdMin) / 60) * HOUR
  const durH = clamp(p.sleepH + gauss(p.seed, d, 22) * 0.6, 3, 10)
  return { bedMs, durH }
}
function asleepAtLocal(p: Profile, local: number): boolean {
  const day = Math.floor(local / DAY)
  for (const d of [day, day - 1]) {
    const n = nightOf(p, d)
    if (local >= n.bedMs && local < n.bedMs + n.durH * HOUR) return true
  }
  return false
}

// ---- blocks -----------------------------------------------------------------------

type BlockKind = 'sleep' | 'still' | 'walk' | 'exercise' | 'stress'
type Block = { kind: BlockKind; rate: number; hr: number; stress: number; asleep: boolean }

function blockAt(p: Profile, B: number): Block {
  const day = Math.floor(B / BLOCKS_PER_DAY)
  const blk = B - day * BLOCKS_PER_DAY
  const h = (blk + 0.5) / 6
  const rest = restingForDay(p, day)
  const sDay = stressForDay(p, day)
  const circStress = 6 * Math.sin((2 * Math.PI * (h - 12)) / 24)
  const asleep = asleepAtLocal(p, B * BLOCK + BLOCK / 2)
  if (asleep) {
    const hr = rest + 6 - p.sleepDip + 1.8 * Math.sin((2 * Math.PI * B * 10) / 90)
    return { kind: 'sleep', rate: 0, hr, stress: sDay - 22 + circStress, asleep }
  }
  const baseHr = rest + 9 + 4.5 * Math.cos((2 * Math.PI * (h - 15)) / 24)
  const daytime = h >= 7 && h < 22
  const bump = Math.exp(-((h - p.peakHour) ** 2) / (2 * 2.6 ** 2))
  const pAct = clamp(p.activeProb * (daytime ? 0.35 + 0.65 * bump : 0.04) * 0.55, 0, 0.95)
  const u = u01(p.seed, B, 31)
  const v = u01(p.seed, B, 33)
  if (u < pAct * 0.1) {
    return { kind: 'exercise', rate: 2.4 + 0.5 * v, hr: baseHr + 50 + 25 * v, stress: sDay + 6 + circStress, asleep }
  }
  if (u < pAct) {
    return { kind: 'walk', rate: 0.7 + 0.9 * v, hr: baseHr + 16 + 14 * v, stress: sDay + 4 + circStress, asleep }
  }
  const epWeight = h >= 8 && h < 21 ? 1 : 0.2
  if (u01(p.seed, B, 32) < p.stressEp * epWeight) {
    return { kind: 'stress', rate: 0, hr: baseHr + 15 + 9 * v, stress: sDay + 22 + circStress, asleep }
  }
  return { kind: 'still', rate: 0, hr: baseHr, stress: sDay + circStress, asleep }
}

const prefixCache = new Map<string, Float64Array>()
function stepPrefix(p: Profile, day: number): Float64Array {
  const key = `${p.seed}:${day}`
  let a = prefixCache.get(key)
  if (!a) {
    if (prefixCache.size > 600) prefixCache.clear()
    a = new Float64Array(BLOCKS_PER_DAY + 1)
    for (let i = 0; i < BLOCKS_PER_DAY; i++) {
      a[i + 1] = a[i] + blockAt(p, day * BLOCKS_PER_DAY + i).rate * (BLOCK / SEC)
    }
    prefixCache.set(key, a)
  }
  return a
}
/** Total steps of a full local day. */
export function stepsOfDay(p: Profile, day: number): number {
  return Math.floor(stepPrefix(p, day)[BLOCKS_PER_DAY])
}

// ---- core signal ------------------------------------------------------------------

export type Core = {
  t: number
  hr: number
  steps: number
  stress: number
  asleep: boolean
  kind: BlockKind
  rate: number
  day: number
  hourOfDay: number
}

export function coreAt(p: Profile, t: number): Core {
  const ts = Math.floor(t / SEC) * SEC
  const local = ts + TZ_MS
  const B = Math.floor(local / BLOCK)
  const sec = (local - B * BLOCK) / SEC
  const day = Math.floor(B / BLOCKS_PER_DAY)
  const cur = blockAt(p, B)
  const prev = blockAt(p, B - 1)
  const w = smooth(sec / 150)
  const ph = (p.seed % 628) / 100
  const noise =
    2.2 * Math.sin(ts / 7000 + ph) + 1.4 * Math.sin(ts / 2300 + ph * 1.7) + (u01(p.seed, ts / SEC, 51) - 0.5) * 3
  const hr = Math.round(clamp(lerp(prev.hr, cur.hr, w) + noise, 36, 205))
  const stress = Math.round(clamp(lerp(prev.stress, cur.stress, w) + gauss(p.seed, ts / MIN, 52) * 1.2, 3, 98))
  const blk = B - day * BLOCKS_PER_DAY
  const steps = Math.floor(stepPrefix(p, day)[blk] + cur.rate * sec)
  return {
    t: ts, hr, steps, stress, asleep: cur.asleep, kind: cur.kind, rate: cur.rate, day,
    hourOfDay: (local - day * DAY) / HOUR,
  }
}

// ---- gaps (small holes in the 1 Hz stream) ---------------------------------------

export type Gap = { from: number; to: number }

/** Gaps of 2.5-5.5 min in ~10% of the 30-minute slots. Only fully elapsed slots can have one. */
export function gapsBetween(p: Profile, from: number, to: number, now: number): Gap[] {
  const out: Gap[] = []
  const lastSlot = Math.floor(now / SLOT) - 1
  for (let s = Math.floor(from / SLOT) - 1; s <= Math.min(Math.floor(to / SLOT), lastSlot); s++) {
    if (u01(p.seed, s, 41) >= 0.1) continue
    const start = s * SLOT + Math.floor(u01(p.seed, s, 42) * 20 * 60) * SEC
    const end = start + (150 + Math.floor(u01(p.seed, s, 43) * 180)) * SEC
    if (end > from && start < to) out.push({ from: start, to: end })
  }
  return out
}

export function inGap(p: Profile, ts: number, now: number): boolean {
  return gapsBetween(p, ts, ts + 1, now).length > 0
}

/** Readings expected at 1 Hz in [from, to) minus the gap seconds. */
export function countReadings(p: Profile, from: number, to: number, now: number): number {
  if (to <= from) return 0
  let n = Math.floor((to - from) / SEC)
  for (const g of gapsBetween(p, from, to, now)) {
    n -= Math.max(0, Math.floor((Math.min(g.to, to) - Math.max(g.from, from)) / SEC))
  }
  return Math.max(0, n)
}

/** Newest reading second that exists at `now` (never inside a gap by construction). */
export const latestSecond = (now: number) => Math.floor(now / SEC) * SEC

// ---- full reading -----------------------------------------------------------------

export function readingFor(p: Profile, t: number): SensorReadingDto {
  const c = coreAt(p, t)
  const local = c.t + TZ_MS
  const minute = Math.floor(local / MIN)
  const spo2 =
    p.spo2 === 'denied' ? null
    : p.spo2 === 'full' ? 1
    : u01(p.seed, minute, 61) < 0.45 ? 1 : null
  const spo2Value =
    spo2 === null ? null : Math.round(clamp(97.4 + gauss(p.seed, c.t / SEC, 62) * 0.7 - (c.asleep ? 0.8 : 0), 90, 100))
  const blk10 = Math.floor(local / BLOCK)
  const sc = (n: number, lo: number, span: number) => lo + Math.floor(u01(p.seed, blk10, n) * span)
  const estimates: Record<string, EstimateInfo> = {
    restingHeartRateBpm: { method: 'hr-p10-still-24h', confidence: 'low', sampleCount: sc(71, 1100, 900) },
    hrvMs: { method: 'hrv-proxy-hr-dispersion', confidence: 'low', sampleCount: sc(72, 1000, 900) },
    sleepHoursLastNight: { method: 'sleep-block-low-hr-no-steps', confidence: 'low', sampleCount: sc(73, 600, 300) },
    stressScore: { method: 'stress-hr-elevation-hrv-10m', confidence: 'medium', sampleCount: sc(74, 18, 3) },
  }
  return {
    estimates,
    recordedAtEpochMs: c.t,
    heartRateBpm: c.hr,
    restingHeartRateBpm: Math.round(restingForDay(p, c.day)),
    hrvMs: r1(hrvForDay(p, c.day)),
    spO2Percent: spo2Value,
    stepsToday: c.steps,
    sleepHoursLastNight: r1(nightOf(p, c.day - 1).durH),
    skinTempCelsius: null,
    stressScore: c.stress,
    missionDay: p.missionDay,
    microgravity: false,
    isolationIndex: 0,
    radiationDoseMilliSvProxy: 0,
    selfReportedSymptoms: [],
  }
}

/** Deterministic: same (crewId, t) always gives the same reading (t is floored to the second). */
export function reading(crewId: string, t: number): SensorReadingDto {
  return readingFor(need(crewId), t)
}
