const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`)
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export const api = {
  health: () => getJson<{ status: string; service: string }>('/api/health'),
  crew: () => getJson<import('../types/health').CrewSummaryDto[]>('/api/crew'),
  crewLatest: (id: string) =>
    getJson<import('../types/health').CrewLatestDto>(`/api/crew/${encodeURIComponent(id)}/latest`),
}
