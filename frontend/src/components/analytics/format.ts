const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('es', { numeric: 'auto' }) : null

/** "hace 3 min", "hace 2 h"; null => "—". */
export function relTime(ms: number | null | undefined, now = Date.now()): string {
  if (ms == null) return '—'
  const s = Math.round((ms - now) / 1000)
  const a = Math.abs(s)
  if (!rtf) return new Date(ms).toLocaleString('es')
  if (a < 10) return 'ahora mismo'
  if (a < 60) return rtf.format(s, 'second')
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute')
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour')
  return rtf.format(Math.round(s / 86400), 'day')
}

export function clock(ms: number): string {
  const d = new Date(ms)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function fullDate(ms: number | null | undefined): string {
  return ms == null ? '—' : new Date(ms).toLocaleString('es')
}

export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export function fmtNum(v: number | null | undefined): string {
  if (v == null) return '—'
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString('es')
  return String(Math.round(v * 100) / 100)
}

export function fmtDuration(ms: number): string {
  const m = Math.round(ms / 60_000)
  if (m < 1) return `${Math.round(ms / 1000)} s`
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return `${h} h ${m % 60} min`
}
