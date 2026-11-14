import { getStoredToken } from './auth'
import { UNAUTHORIZED_EVENT } from './client'

const base = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

export class AnalyticsApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type Quality = 'medido' | 'estimado' | 'no recibido'
export type Recommendation =
  | 'mantener'
  | 'usar con cautela'
  | 'candidato a descartar'
  | 'requiere sensor'

export type DeviceAnalytics = {
  deviceId: string
  crewMemberId: string
  pairedAt: number
  totalReadings: number
  firstReadingAt: number | null
  lastReadingAt: number | null
  lastReceivedAt: number | null
  readingsLast24h: number
  samplesPerMinute: number | null
  nominalSamplesPerMinute: number
  gaps24h: number
  gapMs24h: number
  maxGapMs24h: number
  gapThresholdMs: number
  batchesOk24h: number
  batchesRejected24h: number
  appVersion: string | null
}

export type FieldReport = {
  key: string
  label: string
  total: number
  nonNull: number
  measuredCount: number
  estimatedCount: number
  min: number | null
  max: number | null
  mean: number | null
  std: number | null
  lastSeenAt: number | null
  coveragePct: number
  quality: Quality
  recommendation: Recommendation
  reasonCode: string
  reason: string
}

export type FieldsAnalytics = {
  deviceId: string
  windowHours: number
  totalReadings: number
  deviceLastReadingAt: number | null
  estimationWindowReadings: number
  fields: FieldReport[]
}

export type SensorStatus =
  | 'enviando datos'
  | 'entrega pero no se sube'
  | 'sin permiso'
  | 'no disponible'
  | 'no entrega'
  | 'no usado por la app'

export type SensorReport = {
  sensorKey: string
  typeName: string
  name: string | null
  vendor: string | null
  wakeUp: boolean | null
  resolution: number | null
  available: boolean
  permissionGranted: boolean | null
  inUse: boolean | null
  delivering: boolean
  lastEventAt: number | null
  reportedAt: number
  status: SensorStatus
  uploadsToServer: boolean
  feeds: { key: string; label: string; quality: Quality; coveragePct: number }[]
}

export type SensorsAnalytics = {
  deviceId: string
  reportedAt: number | null
  appVersion: string | null
  sensors: SensorReport[]
  fieldsWithoutSensor: { key: string; label: string; reason: string }[]
}

export type IngestLogItem = {
  id: number
  receivedAt: number
  batchId: string | null
  readingsReceived: number
  readingsAccepted: number
  duplicates: number
  assessmentsReceived: number
  status: 'ok' | 'rechazado'
  errorCode: string | null
  errorDetail: string | null
  bytes: number | null
  appVersion: string | null
}

export type IngestLogPage = { items: IngestLogItem[]; nextBefore: number | null }

export type TimelineBucket = {
  t: number
  readings: number
  batchesOk: number
  batchesRejected: number
}

export type TimelineData = {
  deviceId: string
  hours: number
  bucketMs: number
  buckets: TimelineBucket[]
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const token = getStoredToken()
  const res = await fetch(`${base}${path}`, {
    cache: 'no-store',
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  if (!res.ok) throw new AnalyticsApiError(res.status, `HTTP ${res.status}`)
  return res.json() as Promise<T>
}

const dev = (id: string) => `/api/analytics/devices/${encodeURIComponent(id)}`

export const analyticsApi = {
  devices: (signal?: AbortSignal) => getJson<DeviceAnalytics[]>('/api/analytics/devices', signal),
  fields: (id: string, hours: number, signal?: AbortSignal) =>
    getJson<FieldsAnalytics>(`${dev(id)}/fields?hours=${hours}`, signal),
  sensors: (id: string, hours: number, signal?: AbortSignal) =>
    getJson<SensorsAnalytics>(`${dev(id)}/sensors?hours=${hours}`, signal),
  timeline: (id: string, hours: number, signal?: AbortSignal) =>
    getJson<TimelineData>(`${dev(id)}/timeline?hours=${hours}`, signal),
  log: (
    id: string,
    opts: { limit?: number; before?: number | null; status?: 'ok' | 'rechazado' | null },
    signal?: AbortSignal,
  ) => {
    const q = new URLSearchParams({ limit: String(opts.limit ?? 25) })
    if (opts.before) q.set('before', String(opts.before))
    if (opts.status) q.set('status', opts.status)
    return getJson<IngestLogPage>(`${dev(id)}/log?${q}`, signal)
  },
}
