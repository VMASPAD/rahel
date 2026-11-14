import { getStoredToken } from './auth'

const base = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

export const UNAUTHORIZED_EVENT = 'rahel:unauthorized'

async function getJson<T>(path: string): Promise<T> {
  const token = getStoredToken()
  const res = await fetch(`${base}${path}`, {
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export const api = {
  health: () => getJson<{ status: string; service: string }>('/api/health'),
  crew: () => getJson<import('../types/health').CrewSummaryDto[]>('/api/crew'),
  crewLatest: (id: string) =>
    getJson<import('../types/health').CrewLatestDto>(`/api/crew/${encodeURIComponent(id)}/latest`),
  /** `bucketSeconds` (1..3600): last reading of each bucket instead of raw rows (for charts). */
  crewReadings: (id: string, limit = 200, bucketSeconds?: number) =>
    getJson<import('../types/health').SensorReadingDto[]>(
      `/api/crew/${encodeURIComponent(id)}/readings?limit=${limit}` +
        (bucketSeconds ? `&bucketSeconds=${bucketSeconds}` : ''),
    ),
}
