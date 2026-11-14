/**
 * Self-check for the demo simulator. Run with:  node --experimental-strip-types src/demo/selfcheck.ts
 * (Node >= 22.6; plain `node src/demo/selfcheck.ts` on Node >= 23.6) or `npx tsx src/demo/selfcheck.ts`.
 * No test runner and no network: a fake "original fetch" that throws proves nothing leaves the browser.
 */
import type { Catalog, Run, RunSummary } from '../api/analysis.ts'
import type {
  DeviceAnalytics, FieldsAnalytics, IngestLogPage, SensorsAnalytics, TimelineData,
} from '../api/analytics.ts'
import type { AuthUser, DeviceSummary } from '../api/auth.ts'
import type { CrewLatestDto, CrewSummaryDto, SensorReadingDto } from '../types/health.ts'
import { DEMO_TOKEN, DEMO_USER, demoStats, installDemoFetch, isDemoRequest, reading, resetDemo, setLatency } from './index.ts'
import { setClock } from './state.ts'
import { CATALOG } from './catalog.ts'

declare const process: { exit(code: number): never }

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail = ''): void {
  if (cond) passed++
  else {
    failed++
    console.error(`  FAIL ${name} ${detail}`)
  }
}
function isNumOrNull(v: unknown) {
  return v === null || (typeof v === 'number' && Number.isFinite(v))
}

const CREW = ['CREW-418302', 'CREW-527941', 'CREW-336615']
let realFetchCalls = 0
const fakeOriginal = (async (input: RequestInfo | URL) => {
  const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  realFetchCalls++
  if (u.includes('/api')) throw new Error(`NETWORK LEAK: ${u}`)
  return new Response('asset', { status: 200 })
}) as typeof fetch
globalThis.fetch = fakeOriginal

async function call<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(`http://localhost:8080${path}`, init)
  const text = await res.text()
  return { status: res.status, body: (text ? JSON.parse(text) : undefined) as T }
}
const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })

function checkReading(r: SensorReadingDto, label: string) {
  check(`${label} recordedAt`, Number.isInteger(r.recordedAtEpochMs))
  check(`${label} hr`, typeof r.heartRateBpm === 'number' && r.heartRateBpm >= 36 && r.heartRateBpm <= 205)
  for (const k of ['restingHeartRateBpm', 'hrvMs', 'spO2Percent', 'stepsToday', 'sleepHoursLastNight', 'skinTempCelsius'] as const) {
    check(`${label} ${k}`, isNumOrNull(r[k]))
  }
  check(`${label} stress`, typeof r.stressScore === 'number' && r.stressScore >= 0 && r.stressScore <= 100)
  check(`${label} mission`, typeof r.missionDay === 'number' && typeof r.microgravity === 'boolean')
  check(`${label} symptoms`, Array.isArray(r.selfReportedSymptoms))
  for (const [k, e] of Object.entries(r.estimates ?? {})) {
    check(`${label} estimate ${k}`, typeof e.method === 'string' && (e.confidence === 'low' || e.confidence === 'medium') && e.sampleCount > 0)
  }
}

async function main() {
  setLatency(0, 0)

  // ---- pure model
  const t0 = Date.now()
  for (const id of CREW) {
    const a = reading(id, t0)
    const b = reading(id, t0)
    check(`determinism ${id}`, JSON.stringify(a) === JSON.stringify(b))
    check(`floor to second ${id}`, JSON.stringify(reading(id, t0 + 300)) === JSON.stringify(reading(id, t0 + 10)) || Math.floor((t0 + 300) / 1000) !== Math.floor((t0 + 10) / 1000))
    const hrs = new Set(Array.from({ length: 20 }, (_, i) => reading(id, t0 + i * 1000).heartRateBpm))
    check(`live pulse moves ${id}`, hrs.size >= 5, `distinct=${hrs.size}`)
    checkReading(a, `reading ${id}`)
  }
  const dayStart = Math.floor(t0 / 86_400_000) * 86_400_000
  let mono = true
  let prev = -1
  for (let t = dayStart; t < dayStart + 86_400_000; t += 300_000) {
    const s = reading(CREW[0], t).stepsToday ?? 0
    if (s < prev && s > 200) mono = false // drops only at local midnight (reset)
    prev = s
  }
  check('steps accumulate through the day', mono)
  const avgHr = (id: string) => Array.from({ length: 48 }, (_, i) => reading(id, dayStart - 86_400_000 + i * 1_800_000).heartRateBpm ?? 0).reduce((a, b) => a + b, 0) / 48
  check('stressed has higher mean HR than fit', avgHr(CREW[1]) > avgHr(CREW[0]) + 8)

  // ---- fetch install / restore
  const restore = installDemoFetch()
  const restore2 = installDemoFetch() // StrictMode-style double install
  check('fetch replaced', globalThis.fetch !== fakeOriginal)
  check('isDemoRequest', isDemoRequest('/api/crew') && isDemoRequest('https://x.io/api/crew?a=1') && isDemoRequest('http://localhost:8080/api/x') && !isDemoRequest('/assets/app.js') && !isDemoRequest('/apiary'))

  for (const url of ['/api/nope', 'http://localhost:8080/api/unknown/deep', 'https://api.rahel.app/api/analytics/zzz', 'https://api.rahel.app/api/crew/CREW-1/readings/extra']) {
    const res = await fetch(url)
    const body = (await res.json()) as { error?: string }
    check(`404 ${url}`, res.status === 404 && body.error === 'not_found')
  }
  check('no network used for unknown /api', realFetchCalls === 0)
  const asset = await fetch('/assets/index.js')
  check('non-api passes through', realFetchCalls === 1 && (await asset.text()) === 'asset')
  check('crew of unknown id 404', (await call('/api/crew/CREW-000000/latest')).status === 404)

  // abort
  const ac = new AbortController()
  ac.abort()
  let aborted = false
  try {
    await fetch('/api/crew', { signal: ac.signal })
  } catch (e) {
    aborted = e instanceof DOMException && e.name === 'AbortError'
  }
  check('AbortSignal respected', aborted)
  setLatency(40, 60)
  const ac2 = new AbortController()
  const p2 = fetch('/api/crew', { signal: ac2.signal })
  ac2.abort()
  check('abort during latency', await p2.then(() => false, (e) => e instanceof DOMException))
  setLatency(0, 0)

  // ---- auth
  const me = await call<{ user: AuthUser; devices: DeviceSummary[] }>('/api/auth/me')
  check('me user', me.status === 200 && me.body.user.email === 'demo@rahel.test' && me.body.user.displayName === 'Demo crew' && me.body.user.id === DEMO_USER.id)
  check('me devices', me.body.devices.length === 3 && me.body.devices.every((d) => d.deviceId && d.crewMemberId && typeof d.pairedAt === 'number' && 'backupCode' in d && 'linkExpiresAt' in d))
  const login = await call<{ token: string; user: AuthUser }>('/api/auth/login', post({ email: 'x', password: 'y' }))
  check('login', login.status === 200 && login.body.token === DEMO_TOKEN)
  check('register 201', (await call('/api/auth/register', post({ email: 'a@b.c', password: '12345678' }))).status === 201)

  // ---- crew
  const crew = await call<CrewSummaryDto[]>('/api/crew')
  check('crew list', crew.status === 200 && crew.body.length === 3 && CREW.every((id) => crew.body.some((c) => c.crewMemberId === id)))
  check('crew summary fields', crew.body.every((c) => typeof c.latestReadingAtEpochMs === 'number' && typeof c.overallLevel === 'string' && typeof c.headline === 'string' && 'profileUpdatedAtEpochMs' in c))
  check('crew freshness', crew.body.every((c) => Date.now() - (c.latestReadingAtEpochMs ?? 0) < 10_000))
  const lat = await call<CrewLatestDto>(`/api/crew/${CREW[1]}/latest`)
  checkReading(lat.body.latestReading!, 'latest')
  check('latest assessment stressed', lat.body.latestAssessment?.overallLevel === 'WATCH' && lat.body.latestAssessment.conditions.length === 1 && lat.body.latestAssessment.conditions[0].severity === 'MODERATE')
  const latFit = await call<CrewLatestDto>(`/api/crew/${CREW[0]}/latest`)
  check('latest assessment nominal', latFit.body.latestAssessment?.overallLevel === 'NOMINAL' && latFit.body.latestAssessment.conditions.length === 0)
  check('profile', typeof latFit.body.profile?.imc === 'number' && typeof latFit.body.profile?.pesoKg === 'number')
  const rd = await call<SensorReadingDto[]>(`/api/crew/${CREW[0]}/readings?limit=300&bucketSeconds=30`)
  check('readings 300 buckets', rd.status === 200 && rd.body.length === 300)
  check('readings newest first, 30 s apart', rd.body.every((r, i) => i === 0 || (rd.body[i - 1].recordedAtEpochMs > r.recordedAtEpochMs)))
  check('readings bucket spacing', rd.body.slice(1, 100).every((r, i) => i === 0 || rd.body[i].recordedAtEpochMs - r.recordedAtEpochMs >= 29_000))
  rd.body.slice(0, 5).forEach((r, i) => checkReading(r, `readings[${i}]`))
  const raw = await call<SensorReadingDto[]>(`/api/crew/${CREW[2]}/readings?limit=50`)
  check('raw readings 1 Hz', raw.body.length === 50 && raw.body[0].recordedAtEpochMs - raw.body[1].recordedAtEpochMs === 1000)
  const month = await call<SensorReadingDto[]>(`/api/crew/${CREW[0]}/readings?limit=720&bucketSeconds=3600`)
  check('30-day window by hour', month.body.length >= 280 && month.body.length <= 290, `n=${month.body.length}`) // limited by pairing (12 d)
  check('bad bucket 400', (await call(`/api/crew/${CREW[0]}/readings?bucketSeconds=0`)).status === 400)
  check('bad bucket 400 (too big)', (await call(`/api/crew/${CREW[0]}/readings?bucketSeconds=9999`)).status === 400)

  // ---- analytics
  const devs = await call<DeviceAnalytics[]>('/api/analytics/devices')
  check('analytics devices', devs.status === 200 && devs.body.length === 3)
  for (const d of devs.body) {
    check(`device ${d.crewMemberId} figures`, d.readingsLast24h > 80_000 && d.readingsLast24h <= 86_400 + 5 && d.nominalSamplesPerMinute === 60 && d.samplesPerMinute !== null && d.samplesPerMinute > 55 && d.samplesPerMinute <= 61, JSON.stringify(d))
    check(`device ${d.crewMemberId} ts`, d.lastReadingAt !== null && Date.now() - d.lastReadingAt < 5000 && d.totalReadings >= d.readingsLast24h)
    check(`device ${d.crewMemberId} batches`, d.batchesOk24h > 250 && d.batchesRejected24h >= 0 && d.gapThresholdMs === 120_000)
  }
  check('some small gaps exist', devs.body.some((d) => d.gaps24h > 0))
  const dev = devs.body[0]
  const fields = await call<FieldsAnalytics>(`/api/analytics/devices/${dev.deviceId}/fields?hours=24`)
  check('fields 12 keys', fields.status === 200 && fields.body.fields.length === 12)
  const f = (k: string) => fields.body.fields.find((x) => x.key === k)!
  check('hr measured/mantener', f('heartRateBpm').quality === 'medido' && f('heartRateBpm').recommendation === 'mantener' && f('heartRateBpm').coveragePct > 95)
  check('estimated fields', ['hrvMs', 'stressScore', 'restingHeartRateBpm', 'sleepHoursLastNight'].every((k) => f(k).quality === 'estimado' && f(k).estimatedCount > 0 && f(k).reasonCode === 'estimated_only'))
  check('skin temp needs sensor', f('skinTempCelsius').quality === 'no recibido' && f('skinTempCelsius').recommendation === 'requiere sensor')
  check('constant context field', f('missionDay').reasonCode === 'constant_value')
  check('field stats', typeof f('heartRateBpm').min === 'number' && f('heartRateBpm').min! < f('heartRateBpm').max! && f('heartRateBpm').std! > 0)
  check('reasons in English', fields.body.fields.every((x) => x.reason.length > 10 && !/[áéíóúñ]/i.test(x.reason)))
  const spo2Partial = await call<FieldsAnalytics>(`/api/analytics/devices/${devs.body[1].deviceId}/fields?hours=24`)
  const sp = spo2Partial.body.fields.find((x) => x.key === 'spO2Percent')!
  check('stressed spo2 partial coverage', sp.reasonCode === 'partial_coverage' || sp.reasonCode === 'low_coverage', sp.reasonCode)
  const f720 = await call<FieldsAnalytics>(`/api/analytics/devices/${dev.deviceId}/fields?hours=720`)
  check('fields 720 h', f720.status === 200 && f720.body.windowHours === 720 && f720.body.totalReadings > fields.body.totalReadings)
  const sens = await call<SensorsAnalytics>(`/api/analytics/devices/${dev.deviceId}/sensors?hours=24`)
  check('sensors', sens.status === 200 && sens.body.sensors.length >= 8 && sens.body.sensors.some((s) => s.typeName === 'heart_rate' && s.status === 'enviando datos'))
  check('sensors statuses', ['accelerometer', 'ambient_temperature', 'pressure'].every((t) => sens.body.sensors.some((s) => s.typeName === t)) && sens.body.sensors.find((s) => s.typeName === 'accelerometer')!.status === 'entrega pero no se sube')
  check('fieldsWithoutSensor', sens.body.fieldsWithoutSensor.some((x) => x.key === 'skinTempCelsius'))
  const sens3 = await call<SensorsAnalytics>(`/api/analytics/devices/${devs.body[2].deviceId}/sensors`)
  check('denied spo2 permission', sens3.body.sensors.find((s) => s.typeName === 'hs_spo2')!.status === 'sin permiso')
  const log = await call<IngestLogPage>(`/api/analytics/devices/${dev.deviceId}/log?limit=25`)
  check('log page', log.status === 200 && log.body.items.length === 25 && log.body.nextBefore === log.body.items[24].id)
  check('log item fields', log.body.items.every((i) => typeof i.readingsReceived === 'number' && (i.status === 'ok' || i.status === 'rechazado') && i.appVersion === '1.0.13'))
  const log2 = await call<IngestLogPage>(`/api/analytics/devices/${dev.deviceId}/log?limit=25&before=${log.body.nextBefore}`)
  check('log paging', log2.body.items[0].id < log.body.items[24].id)
  const rej = await call<IngestLogPage>(`/api/analytics/devices/${devs.body[1].deviceId}/log?limit=50&status=rechazado`)
  check('rejected batches with detail', rej.body.items.length >= 1 && rej.body.items.every((i) => i.status === 'rechazado' && i.errorCode === 'invalid_payload' && !!i.errorDetail && i.readingsAccepted === 0))
  const tl = await call<TimelineData>(`/api/analytics/devices/${dev.deviceId}/timeline?hours=24`)
  check('timeline', tl.status === 200 && tl.body.buckets.length >= 90 && tl.body.buckets.length <= 100 && tl.body.bucketMs === 900_000 && tl.body.buckets.some((b) => b.readings > 800))
  check('analytics unknown device 404', (await call('/api/analytics/devices/nope/fields')).status === 404)

  // ---- pairing
  check('claim without code 400', (await call('/api/pairing/claim', post({}))).status === 400)
  check('claim bad code 404', (await call('/api/pairing/claim', post({ code: '12ab' }))).status === 404)
  const claimed = await call<{ crewMemberId: string; deviceId: string }>('/api/pairing/claim', post({ code: '482 913' }))
  check('claim ok', claimed.status === 200 && claimed.body.crewMemberId.startsWith('CREW-'))
  check('crew now 4', (await call<CrewSummaryDto[]>('/api/crew')).body.length === 4)
  const newLatest = await call<CrewLatestDto>(`/api/crew/${claimed.body.crewMemberId}/latest`)
  checkReading(newLatest.body.latestReading!, 'claimed latest')
  check('analytics for claimed', (await call<DeviceAnalytics[]>('/api/analytics/devices')).body.length === 4)
  const unp = await call<{ revoked: boolean }>(`/api/pairing/devices/${claimed.body.deviceId}`, { method: 'DELETE' })
  check('unpair', unp.status === 200 && unp.body.revoked === true)
  check('unpair again 404', (await call(`/api/pairing/devices/${claimed.body.deviceId}`, { method: 'DELETE' })).status === 404)
  check('crew back to 3', (await call<CrewSummaryDto[]>('/api/crew')).body.length === 3)

  // ---- analysis (simulated AI), with a controlled clock
  let clock = Date.now()
  setClock(() => clock)
  const cat = await call<Catalog>('/api/analysis/catalog')
  check('catalog', cat.status === 200 && cat.body.configured === true && cat.body.items.length === 10 && cat.body.windows.join() === '24,168,720')
  check('catalog ids match backend', cat.body.items.map((i) => i.id).join() === CATALOG.map((c) => c.id).join() && cat.body.items.every((i) => i.title && i.description && ['choice', 'noul', 'score'].includes(i.kind)))
  const devCrew = Object.fromEntries(devs.body.map((d) => [d.crewMemberId, d.deviceId]))
  check('no consent 400', (await call<{ error: string }>('/api/analysis/runs', post({ deviceId: devCrew[CREW[0]], windowHours: 168 }))).body.error === 'consent_required')
  check('bad window 400', (await call<{ error: string }>('/api/analysis/runs', post({ deviceId: devCrew[CREW[0]], windowHours: 5, consent: true }))).body.error === 'invalid_payload')
  check('unknown device 404', (await call('/api/analysis/runs', post({ deviceId: 'zzz', windowHours: 168, consent: true }))).status === 404)

  async function runAnalysis(crewId: string, hours: number): Promise<Run> {
    const started = await call<{ id: string; status: string }>('/api/analysis/runs', post({ deviceId: devCrew[crewId], windowHours: hours, consent: true }))
    check(`start ${crewId} 202`, started.status === 202 && started.body.status === 'queued')
    if (crewId === CREW[0] && hours === 168) {
      const dup = await call<{ error: string; runId: string }>('/api/analysis/runs', post({ deviceId: devCrew[CREW[1]], windowHours: 24, consent: true }))
      check('second run 409', dup.status === 409 && dup.body.error === 'analysis_in_progress' && dup.body.runId === started.body.id)
      check('delete active 409', (await call(`/api/analysis/runs/${started.body.id}`, { method: 'DELETE' })).status === 409)
    }
    clock += 200
    const q0 = await call<Run>(`/api/analysis/runs/${started.body.id}`)
    check('queued first', q0.body.status === 'queued' && q0.body.results!.progress.done === 0 && q0.body.results!.model === null)
    clock += 3000
    const mid = await call<Run>(`/api/analysis/runs/${started.body.id}`)
    check('progress midway', mid.body.status === 'running' && mid.body.results!.progress.done > 0 && mid.body.results!.progress.done < 10, JSON.stringify(mid.body.results?.progress))
    check('pending shapes', Object.values(mid.body.results!.questions).some((q) => q.status === 'pending'))
    clock += 6000
    const done = await call<Run>(`/api/analysis/runs/${started.body.id}`)
    check('done', done.body.status === 'done' && done.body.finishedAt !== null && done.body.results!.progress.done === 10 && done.body.results!.progress.failed === 0)
    return done.body
  }

  const fitRun = await runAnalysis(CREW[0], 168)
  const stressRun = await runAnalysis(CREW[1], 168)
  const sedRun = await runAnalysis(CREW[2], 720)
  const r24 = await runAnalysis(CREW[1], 24)
  for (const run of [fitRun, stressRun, sedRun, r24]) {
    const res = run.results!
    check('model jev-demo', res.model === 'jev-demo (simulated)' && (res as unknown as { simulated: boolean }).simulated === true)
    check('simulation disclaimer', /SIMULATION/.test(run.disclaimer ?? ''))
    check('headline', res.headline === 'Full analysis')
    for (const c of CATALOG) {
      const q = res.questions[c.id]
      if (q.status !== 'ok') {
        check(`question ${c.id} ok`, false)
        continue
      }
      check(`${c.id} kind`, q.kind === c.kind)
      check(`${c.id} reading`, typeof q.reading === 'string' && q.reading.length > 5)
      if (q.kind === 'noul') check(`${c.id} noul 0..1`, typeof q.value === 'number' && q.value >= 0 && q.value <= 1 && q.confidence !== null && q.confidence >= 0 && q.confidence <= 1)
      if (q.kind === 'score') check(`${c.id} score`, typeof q.value === 'number' && q.value >= 0 && q.value <= 1 && q.levels === 5 && Number.isInteger(q.level) && q.level! >= 0 && q.level! < 5 && Math.round(q.value * 4) === q.level)
      if (q.kind === 'choice') {
        const probs = q.probabilities!
        const sum = Object.values(probs).reduce((a, b) => a + b, 0)
        check(`${c.id} choice`, Object.keys(c.choiceCriteria!).includes(String(q.value)) && Math.abs(sum - 1) < 0.021 && probs[String(q.value)] === Math.max(...Object.values(probs)) && q.confidence === probs[String(q.value)], `${JSON.stringify(probs)} sum=${sum}`)
        check(`${c.id} reading matches choice`, q.reading === c.readings.choice![String(q.value)])
      }
    }
  }
  const val = (run: Run, id: string) => {
    const q = run.results!.questions[id]
    return q.status === 'ok' ? q.value : null
  }
  check('stressed: sustained_stress high', Number(val(stressRun, 'sustained_stress')) > 0.65, String(val(stressRun, 'sustained_stress')))
  check('fit: sustained_stress low', Number(val(fitRun, 'sustained_stress')) < 0.35, String(val(fitRun, 'sustained_stress')))
  check('fit recovery high / stressed low', Number(val(fitRun, 'recovery')) >= 0.75 && Number(val(stressRun, 'recovery')) <= 0.5, `${val(fitRun, 'recovery')} ${val(stressRun, 'recovery')}`)
  check('stressed: resting hr trend up', Number(val(stressRun, 'resting_hr_trend_up')) > 0.6, String(val(stressRun, 'resting_hr_trend_up')))
  check('fit: not trending up', Number(val(fitRun, 'resting_hr_trend_up')) < 0.5, String(val(fitRun, 'resting_hr_trend_up')))
  check('fit regular sleep > stressed', Number(val(fitRun, 'sleep_regularity')) > Number(val(stressRun, 'sleep_regularity')) + 0.3)
  check('activity: fit>=moderate, sedentary=sedentary/light', ['moderate', 'high'].includes(String(val(fitRun, 'activity_level'))) && ['sedentary', 'light'].includes(String(val(sedRun, 'activity_level'))), `${val(fitRun, 'activity_level')} ${val(sedRun, 'activity_level')}`)
  check('stressed: wellbeing worsening', val(stressRun, 'wellbeing_trend') === 'worsening', String(val(stressRun, 'wellbeing_trend')))
  check('24 h: wellbeing unclear', val(r24, 'wellbeing_trend') === 'unclear')
  check('24 h: trend uncertain', Math.abs(Number(val(r24, 'resting_hr_trend_up')) - 0.5) < 0.1)

  const list = await call<{ items: RunSummary[]; next: number | null }>('/api/analysis/runs?limit=3')
  check('history list', list.status === 200 && list.body.items.length === 3 && list.body.next !== null && list.body.items[0].createdAt >= list.body.items[1].createdAt && !('results' in list.body.items[0]))
  const list2 = await call<{ items: RunSummary[]; next: number | null }>(`/api/analysis/runs?limit=3&before=${list.body.next}`)
  check('history paging', list2.body.items.length === 1 && list2.body.next === null)
  check('get unknown run 404', (await call('/api/analysis/runs/nope')).status === 404)
  check('delete run 204', (await call(`/api/analysis/runs/${fitRun.id}`, { method: 'DELETE' })).status === 204)
  check('deleted run gone', (await call(`/api/analysis/runs/${fitRun.id}`)).status === 404)
  setClock(null)

  // ---- reset + restore
  check('stats counted', demoStats.simulatedRequests > 50 && demoStats.blockedNetworkRequests === demoStats.simulatedRequests && demoStats.notFound >= 5 && demoStats.passthrough === 1, JSON.stringify(demoStats))
  const before = (await call<CrewSummaryDto[]>('/api/crew')).body.length
  await call('/api/pairing/claim', post({ code: '111111' }))
  resetDemo()
  check('resetDemo restores state', before === 3 && (await call<CrewSummaryDto[]>('/api/crew')).body.length === 3 && (await call<{ items: unknown[] }>('/api/analysis/runs')).body.items.length === 0)
  check('resetDemo clears stats', demoStats.simulatedRequests === 2 && demoStats.passthrough === 0)

  restore()
  check('still replaced after first restore (refcount)', globalThis.fetch !== fakeOriginal)
  restore2()
  restore2() // idempotent
  check('original fetch restored', globalThis.fetch === fakeOriginal)
  const again = installDemoFetch()
  again()
  again()
  check('install/restore cycle', globalThis.fetch === fakeOriginal)
  let leaked = false
  try {
    await fetch('http://localhost:8080/api/crew')
  } catch {
    leaked = true // the fake original throws on /api: after restore requests do go to "network"
  }
  check('after restore /api reaches original', leaked)
}

main()
  .then(() => {
    console.log(`selfcheck: ${passed} passed, ${failed} failed`)
    process.exit(failed ? 1 : 0)
  })
  .catch((e) => {
    console.error('selfcheck crashed', e)
    process.exit(1)
  })
