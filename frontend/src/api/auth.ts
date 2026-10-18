const base = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

const TOKEN_KEY = 'rahel_auth_token'

export type AuthUser = {
  id: string
  email: string
  displayName: string | null
}

export type DeviceSummary = {
  deviceId: string
  crewMemberId: string
  pairedAt: number
  backupCode: string | null
  linkExpiresAt: number | null
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function postJson<T>(path: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function delJson<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

async function getJson<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export const authApi = {
  register: (email: string, password: string, displayName?: string) =>
    postJson<{ token: string; user: AuthUser }>('/api/auth/register', {
      email,
      password,
      displayName,
    }),
  login: (email: string, password: string) =>
    postJson<{ token: string; user: AuthUser }>('/api/auth/login', { email, password }),
  me: (token: string) =>
    getJson<{ user: AuthUser; devices: DeviceSummary[] }>('/api/auth/me', token),
  unpair: (token: string, deviceId: string) =>
    delJson<{ revoked: boolean }>(`/api/pairing/devices/${encodeURIComponent(deviceId)}`, token),
  claimPairing: (token: string, code: string) =>
    postJson<{ crewMemberId: string; deviceId: string; relinked?: boolean }>(
      '/api/pairing/claim',
      { code },
      token,
    ),
}
