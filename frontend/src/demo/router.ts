/**
 * Pure request router: (method, url, body) -> { status, body }. No fetch, no network, no timers.
 * Mirrors the status codes and JSON shapes of the real backend routes.
 */
import { ALLOWED_WINDOWS, MAX_RUNS_PER_HOUR, catalogPayload, finalAnswers, isActive, runSummary, runView, statusOf } from './ai.ts'
import { clampWindowHours, deviceAnalytics, fieldsAnalytics, ingestLogPage, sensorsAnalytics, timeline } from './analytics.ts'
import { MAX_BUCKET_SECONDS, MAX_READINGS_LIMIT, assessmentFor, crewLatest, crewReadings, listCrew } from './crew.ts'
import { DAY, HOUR, getProfile, makeProfile, registerProfile, type ProfileKind } from './model.ts'
import { hash32 } from './rng.ts'
import { DEMO_TOKEN, DEMO_USER, deviceIdFor, now as clockNow, state, type DemoDevice, type SimRun } from './state.ts'

export type Routed = { status: number; body: unknown }
const ok = (body: unknown, status = 200): Routed => ({ status, body })
const err = (status: number, error: string, extra: Record<string, unknown> = {}): Routed => ({ status, body: { error, ...extra } })
export const NOT_FOUND: Routed = err(404, 'not_found')

/** True when the URL path is under /api (any origin / base). */
export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

export function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw, 'http://demo.local')
  } catch {
    return null
  }
}

function deviceById(id: string): DemoDevice | undefined {
  return state.devices.find((d) => d.deviceId === id)
}
function deviceByCrew(id: string): DemoDevice | undefined {
  return state.devices.find((d) => d.crewMemberId === id)
}

const KINDS: ProfileKind[] = ['fit', 'stressed', 'sedentary']
let runCounter = 0

function claim(body: unknown, now: number): Routed {
  const code = (body as { code?: unknown } | null)?.code
  if (typeof code !== 'string' || !code) return err(400, 'code required')
  const digits = code.replace(/[\s-]/g, '')
  if (!/^\d{6}$/.test(digits)) return err(404, 'code_not_found')
  state.claimed += 1
  let n = hash32(Number(digits), state.claimed) % 900000
  let id = `CREW-${100000 + n}`
  while (getProfile(id)) id = `CREW-${100000 + ++n % 900000}`
  registerProfile(makeProfile(id, KINDS[(state.claimed - 1) % 3], state.claimed))
  const device: DemoDevice = { deviceId: deviceIdFor(id), crewMemberId: id, pairedAt: now - 3 * DAY }
  state.devices.push(device)
  return ok({ crewMemberId: id, deviceId: device.deviceId })
}

function startRun(body: unknown, now: number): Routed {
  const b = (body ?? {}) as { deviceId?: unknown; windowHours?: unknown; consent?: unknown }
  if (b.consent !== true) return err(400, 'consent_required')
  if (
    typeof b.deviceId !== 'string' || !b.deviceId || b.deviceId.length > 100 ||
    typeof b.windowHours !== 'number' || !ALLOWED_WINDOWS.includes(b.windowHours)
  ) return err(400, 'invalid_payload')
  const device = deviceById(b.deviceId)
  if (!device) return err(404, 'device not found')
  const p = getProfile(device.crewMemberId)
  if (!p) return err(404, 'device not found')
  if (now - device.pairedAt < HOUR) return err(422, 'insufficient_data')
  const active = state.runs.find((r) => isActive(statusOf(r, now)))
  if (active) return err(409, 'analysis_in_progress', { runId: active.id })
  if (state.runs.filter((r) => now - r.createdAt < HOUR).length >= MAX_RUNS_PER_HOUR) return err(429, 'too_many_requests')
  const seed = hash32(p.seed, b.windowHours, Math.floor(now / 1000))
  const run: SimRun = {
    id: `demo-run-${now.toString(36)}-${++runCounter}`,
    deviceId: device.deviceId,
    crewMemberId: device.crewMemberId,
    windowHours: b.windowHours,
    consentAt: now,
    createdAt: now,
    startedAt: now + 700,
    durationMs: 5000 + Math.floor((hash32(seed, 3) / 4294967296) * 3000),
    seed,
    final: finalAnswers(p, b.windowHours, now, device.pairedAt, seed),
  }
  state.runs.unshift(run)
  return ok({ id: run.id, status: 'queued' }, 202)
}

export function route(method: string, rawUrl: string, body: unknown, now = clockNow()): Routed {
  const url = parseUrl(rawUrl)
  if (!url || !isApiPath(url.pathname)) return NOT_FOUND
  const m = method.toUpperCase()
  const path = url.pathname.replace(/\/+$/, '')
  const q = url.searchParams
  let g: RegExpMatchArray | null

  if (m === 'GET' && path === '/api/health') {
    return ok({ status: 'ok', service: 'rahel-demo', timestamp: new Date(now).toISOString() })
  }

  // ---- auth / pairing
  if (m === 'POST' && path === '/api/auth/login') return ok({ token: DEMO_TOKEN, user: DEMO_USER })
  if (m === 'POST' && path === '/api/auth/register') return ok({ token: DEMO_TOKEN, user: DEMO_USER }, 201)
  if (m === 'GET' && path === '/api/auth/me') {
    return ok({
      user: DEMO_USER,
      devices: state.devices.map((d) => ({
        deviceId: d.deviceId, crewMemberId: d.crewMemberId, pairedAt: d.pairedAt, backupCode: null, linkExpiresAt: null,
      })),
    })
  }
  if (m === 'POST' && path === '/api/pairing/code') {
    return ok({ code: '123456', secondaryCode: '654321', expiresAt: new Date(now + 600_000).toISOString(), ttlSeconds: 600 })
  }
  if (m === 'GET' && path === '/api/pairing/status') {
    const dev = deviceById(q.get('deviceId') ?? '')
    return ok(dev ? { status: 'paired', crewMemberId: dev.crewMemberId } : { status: 'pending' })
  }
  if (m === 'POST' && path === '/api/pairing/claim') return claim(body, now)
  if (m === 'DELETE' && (g = path.match(/^\/api\/pairing\/devices\/([^/]+)$/))) {
    const id = decodeURIComponent(g[1])
    const i = state.devices.findIndex((d) => d.deviceId === id)
    if (i < 0) return err(404, 'device_not_found')
    state.devices.splice(i, 1)
    return ok({ revoked: true })
  }

  // ---- crew
  if (m === 'GET' && path === '/api/crew') return ok(listCrew(state.devices, now))
  if (m === 'GET' && (g = path.match(/^\/api\/crew\/([^/]+)\/(latest|readings|assessment\/latest)$/))) {
    const d = deviceByCrew(decodeURIComponent(g[1]))
    if (!d) return err(404, 'crew not found')
    if (g[2] === 'latest') return ok(crewLatest(d, now))
    if (g[2] === 'assessment/latest') return ok(assessmentFor(getProfile(d.crewMemberId)!, now))
    const limit = Math.max(1, Math.min(Math.floor(Number(q.get('limit'))) || 100, MAX_READINGS_LIMIT))
    let bucket: number | null = null
    if (q.has('bucketSeconds')) {
      const b = Number(q.get('bucketSeconds'))
      if (!Number.isInteger(b) || b < 1 || b > MAX_BUCKET_SECONDS) {
        return err(400, 'invalid_query', { details: [{ path: 'bucketSeconds', message: `integer 1..${MAX_BUCKET_SECONDS}` }] })
      }
      bucket = b
    }
    return ok(crewReadings(d, limit, bucket, now))
  }

  // ---- analytics
  if (m === 'GET' && path === '/api/analytics/devices') return ok(state.devices.map((d) => deviceAnalytics(d, now)))
  if (m === 'GET' && (g = path.match(/^\/api\/analytics\/devices\/([^/]+)\/(fields|sensors|log|timeline)$/))) {
    const d = deviceById(decodeURIComponent(g[1]))
    if (!d) return err(404, 'device not found')
    if (g[2] === 'fields') return ok(fieldsAnalytics(d, clampWindowHours(q.get('hours')), now))
    if (g[2] === 'sensors') return ok(sensorsAnalytics(d, fieldsAnalytics(d, clampWindowHours(q.get('hours')), now), now))
    if (g[2] === 'log') return ok(ingestLogPage(d, { limit: q.get('limit'), before: q.get('before'), status: q.get('status') }, now))
    const h = Math.floor(Number(q.get('hours')))
    return ok(timeline(d, Number.isFinite(h) && h >= 1 ? Math.min(h, 168) : 24, now))
  }

  // ---- analysis (simulated AI)
  if (m === 'GET' && path === '/api/analysis/catalog') return ok(catalogPayload())
  if (m === 'POST' && path === '/api/analysis/runs') return startRun(body, now)
  if (m === 'GET' && path === '/api/analysis/runs') {
    const lim = Math.max(1, Math.min(50, Math.floor(Number(q.get('limit'))) || 10))
    const beforeN = Number(q.get('before'))
    const before = Number.isFinite(beforeN) && beforeN > 0 ? beforeN : Infinity
    const rows = state.runs.filter((r) => r.createdAt < before).sort((a, b) => b.createdAt - a.createdAt)
    const page = rows.slice(0, lim)
    return ok({ items: page.map((r) => runSummary(r, now)), next: rows.length > lim ? page[page.length - 1].createdAt : null })
  }
  if ((m === 'GET' || m === 'DELETE') && (g = path.match(/^\/api\/analysis\/runs\/([^/]+)$/))) {
    const id = decodeURIComponent(g[1])
    const i = state.runs.findIndex((r) => r.id === id)
    if (i < 0) return NOT_FOUND
    const run = state.runs[i]
    if (m === 'GET') return ok(runView(run, now))
    if (isActive(statusOf(run, now))) return err(409, 'analysis_in_progress')
    state.runs.splice(i, 1)
    return { status: 204, body: undefined }
  }

  return NOT_FOUND
}
