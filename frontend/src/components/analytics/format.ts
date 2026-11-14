/** "just now", "35s ago", "3 min ago", "2h ago", "4d ago"; null => "--". */
export function relTime(ms: number | null | undefined, now = Date.now()): string {
  if (ms == null) return '--'
  const s = Math.max(0, Math.round((now - ms) / 1000))
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function clock(ms: number): string {
  const d = new Date(ms)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function fullDate(ms: number | null | undefined): string {
  return ms == null ? '--' : new Date(ms).toLocaleString('en-US')
}

export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return '--'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export function fmtNum(v: number | null | undefined): string {
  if (v == null) return '--'
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString('en-US')
  return String(Math.round(v * 100) / 100)
}

export function fmtDuration(ms: number): string {
  const m = Math.round(ms / 60_000)
  if (m < 1) return `${Math.round(ms / 1000)}s`
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}min`
}
