import { getStoredToken } from './auth'

const base = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

export class AnalysisApiError extends Error {
  status: number
  code: string
  runId?: string
  constructor(status: number, code: string, runId?: string) {
    super(code)
    this.status = status
    this.code = code
    this.runId = runId
  }
}

export type Kind = 'choice' | 'noul' | 'score'
export type RunStatus = 'queued' | 'running' | 'done' | 'error'

export type CatalogItem = { id: string; title: string; kind: Kind; description: string }
export type Catalog = {
  configured: boolean
  disclaimer: string
  windows: number[]
  maxRunsPerHour: number
  items: CatalogItem[]
}

export type QuestionResult =
  | { status: 'pending' }
  | {
      status: 'ok'
      kind: Kind
      value: number | string
      level?: number
      levels?: number
      confidence: number | null
      reading: string
      probabilities?: Record<string, number>
    }
  | { status: 'error'; code: string; retry: true }

export type RunResults = {
  model: string | null
  windowHours: number
  progress: { total: number; done: number; failed: number }
  questions: Record<string, QuestionResult>
  headline: string | null
}

export type RunSummary = {
  id: string
  deviceId: string
  windowHours: number
  status: RunStatus
  consentAt: number
  error: string | null
  createdAt: number
  finishedAt: number | null
}
export type Run = RunSummary & { results: RunResults | null; disclaimer?: string }

async function call<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const token = getStoredToken()
  const res = await fetch(`${base}${path}`, {
    cache: 'no-store',
    signal,
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; runId?: string }
    throw new AnalysisApiError(res.status, body.error ?? `http_${res.status}`, body.runId)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

export const analysisApi = {
  catalog: (signal?: AbortSignal) => call<Catalog>('/api/analysis/catalog', {}, signal),
  list: (before?: number, signal?: AbortSignal) =>
    call<{ items: RunSummary[]; next: number | null }>(
      `/api/analysis/runs?limit=10${before ? `&before=${before}` : ''}`,
      {},
      signal,
    ),
  get: (id: string, signal?: AbortSignal) => call<Run>(`/api/analysis/runs/${encodeURIComponent(id)}`, {}, signal),
  start: (deviceId: string, windowHours: number) =>
    call<{ id: string; status: RunStatus }>('/api/analysis/runs', {
      method: 'POST',
      body: JSON.stringify({
        deviceId,
        windowHours,
        consent: true,
        tzOffsetMinutes: -new Date().getTimezoneOffset(),
      }),
    }),
  remove: (id: string) => call<void>(`/api/analysis/runs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}
