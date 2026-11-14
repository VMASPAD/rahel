/** Simulated /api/crew*: summaries, latest (with assessment) and readings. */
import type {
  ConditionAssessmentDto, CrewLatestDto, CrewSummaryDto, HealthAssessmentDto, SensorReadingDto,
} from '../types/health.ts'
import { SEC, getProfile, inGap, latestSecond, readingFor, type Profile } from './model.ts'
import type { DemoDevice } from './state.ts'

export const MAX_READINGS_LIMIT = 1000
export const MAX_BUCKET_SECONDS = 3600
const DISCLAIMER =
  'Wellness assessment for the demo. Simulated data: not a medical device and not a diagnosis.'

/** Last reading second of a crew member's watch (jitter of 0-2 s between watches). */
function latestTs(d: DemoDevice, p: Profile, now: number): number {
  let t = latestSecond(now) - (p.seed % 3) * SEC
  while (inGap(p, t, now) && t > d.pairedAt) t -= SEC
  return t
}

export function assessmentFor(p: Profile, now: number): HealthAssessmentDto {
  const assessedAt = Math.floor(now / 60_000) * 60_000
  if (p.kind === 'stressed') {
    const cond: ConditionAssessmentDto = {
      conditionId: 'sustained-stress-load',
      title: 'Sustained stress load',
      category: 'Stress',
      summary:
        'Heart rate stays above its resting level for long stretches without activity, resting heart rate is trending up and sleep is short.',
      confidence: 0.72,
      severity: 'MODERATE',
      symptoms: [
        { id: 'elevated-resting-hr', label: 'Elevated resting heart rate', severity: 'MODERATE' },
        { id: 'short-sleep', label: 'Short sleep', severity: 'MILD' },
      ],
      recommendedActions: [
        { id: 'breathing', title: 'Paced breathing', detail: 'Try 5 minutes of slow breathing (6 breaths per minute) twice a day.' },
        { id: 'sleep-window', title: 'Protect your sleep', detail: 'Aim for a fixed bedtime and at least 7 hours of rest this week.' },
      ],
    }
    return {
      assessedAtEpochMs: assessedAt,
      overallLevel: 'WATCH',
      headline: 'Moderate stress signals: worth a break and an earlier night',
      disclaimer: DISCLAIMER,
      conditions: [cond],
    }
  }
  if (p.kind === 'sedentary') {
    return {
      assessedAtEpochMs: assessedAt,
      overallLevel: 'NOMINAL',
      headline: 'Vitals within expected ranges; activity is low',
      disclaimer: DISCLAIMER,
      conditions: [],
    }
  }
  return {
    assessedAtEpochMs: assessedAt,
    overallLevel: 'NOMINAL',
    headline: 'All vitals nominal',
    disclaimer: DISCLAIMER,
    conditions: [],
  }
}

export function listCrew(devices: DemoDevice[], now: number): CrewSummaryDto[] {
  return devices
    .map((d) => {
      const p = getProfile(d.crewMemberId)!
      const a = assessmentFor(p, now)
      return {
        crewMemberId: d.crewMemberId,
        profileUpdatedAtEpochMs: Math.floor(now / 3_600_000) * 3_600_000,
        latestReadingAtEpochMs: latestTs(d, p, now),
        overallLevel: a.overallLevel,
        headline: a.headline,
      }
    })
    .sort((a, b) => (b.latestReadingAtEpochMs ?? 0) - (a.latestReadingAtEpochMs ?? 0))
}

export function crewLatest(d: DemoDevice, now: number): CrewLatestDto {
  const p = getProfile(d.crewMemberId)!
  return {
    crewMemberId: d.crewMemberId,
    profile: {
      crewMemberId: d.crewMemberId,
      snapshotAtEpochMs: Math.floor(now / 3_600_000) * 3_600_000,
      imc: p.imc,
      pesoKg: p.pesoKg,
    },
    latestReading: readingFor(p, latestTs(d, p, now)),
    latestAssessment: assessmentFor(p, now),
  }
}

/** Newest first. Without `bucketSeconds`: raw seconds; with it: the last reading of each bucket. */
export function crewReadings(d: DemoDevice, limit: number, bucketSeconds: number | null, now: number): SensorReadingDto[] {
  const p = getProfile(d.crewMemberId)!
  const newest = latestTs(d, p, now)
  const out: SensorReadingDto[] = []
  const bucketMs = (bucketSeconds ?? 1) * SEC
  let t = newest
  let guard = 0
  while (out.length < limit && t >= d.pairedAt && guard++ < limit * 4 + 50) {
    if (!inGap(p, t, now)) out.push(readingFor(p, t))
    if (bucketSeconds === null) t -= SEC
    else t = Math.floor(t / bucketMs) * bucketMs - SEC
  }
  return out
}

