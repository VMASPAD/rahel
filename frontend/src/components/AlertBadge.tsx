import { LEVEL_LABEL } from './dashboard/format'
import './dashboard.css'

const levelClass: Record<string, string> = {
  NOMINAL: 'nominal',
  WATCH: 'watch',
  ELEVATED: 'elevated',
  CRITICAL: 'critical',
}

export function AlertBadge({ level, size = 'md' }: { level: string | null; size?: 'md' | 'lg' }) {
  const cls = `badge ${size === 'lg' ? 'badge--lg' : ''}`
  if (!level) return <span className={`${cls} unknown`} aria-label="No assessment">--</span>
  return (
    <span className={`${cls} ${levelClass[level] ?? 'unknown'}`}>
      <span className="badge-dot" aria-hidden />
      {LEVEL_LABEL[level] ?? level}
    </span>
  )
}
