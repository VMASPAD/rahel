import './dashboard.css'

const levelClass: Record<string, string> = {
  NOMINAL: 'badge nominal',
  WATCH: 'badge watch',
  ELEVATED: 'badge elevated',
  CRITICAL: 'badge critical',
}

export function AlertBadge({ level }: { level: string | null }) {
  if (!level) return <span className="badge unknown">—</span>
  return <span className={levelClass[level] ?? 'badge unknown'}>{level}</span>
}
