/** In-memory demo state (never touches localStorage / real session keys). */
import { DAY, DEMO_CREW } from './model.ts'
import type { QuestionResult } from './types.ts'

export const DEMO_TOKEN = 'demo-token'
export const DEMO_USER = { id: 'demo-user', email: 'demo@rahel.test', displayName: 'Demo crew' } as const

export type DemoDevice = { deviceId: string; crewMemberId: string; pairedAt: number }

export type SimRun = {
  id: string
  deviceId: string
  crewMemberId: string
  windowHours: number
  consentAt: number
  createdAt: number
  startedAt: number
  durationMs: number
  seed: number
  /** Final answers (computed when the run is created; revealed progressively). */
  final: Record<string, QuestionResult>
}

export type DemoStats = {
  /** Requests under /api answered by the simulator (includes the 404s). */
  simulatedRequests: number
  /** /api requests that were stopped from reaching the network. Equals simulatedRequests while installed. */
  blockedNetworkRequests: number
  /** /api requests answered 404 not_found. */
  notFound: number
  /** Non-/api requests handed to the original fetch. */
  passthrough: number
  lastRequest: string | null
}

export const demoStats: DemoStats = {
  simulatedRequests: 0,
  blockedNetworkRequests: 0,
  notFound: 0,
  passthrough: 0,
  lastRequest: null,
}

export const config = { minLatencyMs: 60, maxLatencyMs: 250, clock: () => Date.now() }

/** Test hook / tuning: latency range in ms (0,0 disables the delay). */
export function setLatency(minMs: number, maxMs: number): void {
  config.minLatencyMs = Math.max(0, minMs)
  config.maxLatencyMs = Math.max(config.minLatencyMs, maxMs)
}
export function setClock(fn: (() => number) | null): void {
  config.clock = fn ?? (() => Date.now())
}
export const now = () => config.clock()

export const state: { devices: DemoDevice[]; runs: SimRun[]; claimed: number } = {
  devices: [],
  runs: [],
  claimed: 0,
}

export const deviceIdFor = (crewId: string) => `rahel-demo-watch-${crewId.replace(/\D/g, '')}`

export function initState(): void {
  const t = now()
  state.devices = DEMO_CREW.map((c) => ({
    deviceId: deviceIdFor(c.id),
    crewMemberId: c.id,
    pairedAt: t - c.pairedDaysAgo * DAY,
  }))
  state.runs = []
  state.claimed = 0
}

export function resetStats(): void {
  demoStats.simulatedRequests = 0
  demoStats.blockedNetworkRequests = 0
  demoStats.notFound = 0
  demoStats.passthrough = 0
  demoStats.lastRequest = null
}

initState()
