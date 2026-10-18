/** Dashboard formatting helpers (no React dependencies). */

export function relTimeEn(epochMs: number | null | undefined, now: number): string {
  if (epochMs == null) return '--'
  const s = Math.max(0, Math.round((now - epochMs) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/** Initials of an id such as "CREW-398816" -> "C3". */
export function initialsOf(id: string): string {
  const parts = id.split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return id.slice(0, 2).toUpperCase()
}

/** Stable hue (greens/teals) for each crew member avatar. */
export function hueOf(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return 120 + (h % 90)
}

export const LEVEL_LABEL: Record<string, string> = {
  NOMINAL: 'Stable',
  WATCH: 'Watch',
  ELEVATED: 'Elevated',
  CRITICAL: 'Critical',
}

export type Freshness = 'live' | 'recent' | 'idle'

export function freshnessOf(epochMs: number | null | undefined, now: number): Freshness | null {
  if (epochMs == null) return null
  const s = (now - epochMs) / 1000
  if (s <= 30) return 'live'
  if (s <= 300) return 'recent'
  return 'idle'
}

export const FRESH_LABEL: Record<Freshness, string> = {
  live: 'Live',
  recent: 'Recent',
  idle: 'Paused',
}
