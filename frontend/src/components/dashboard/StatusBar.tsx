import { WifiOff } from 'lucide-react'
import { RelTime } from './RelTime'
import { useNow } from './useNow'

export function StatusBar({ error, updatedAt }: { error: string | null; updatedAt: number | null }) {
  const now = useNow(1000)
  if (error) {
    return (
      <span className="dx-chip dx-chip--warn" role="status">
        <WifiOff size={13} aria-hidden /> Reconnecting
      </span>
    )
  }
  const live = updatedAt != null && now - updatedAt < 20_000
  return (
    <span className={`dx-chip ${live ? 'dx-chip--live' : 'dx-chip--idle'}`} role="status">
      <span className="dx-chip-dot" aria-hidden />
      {live ? 'Live' : 'Syncing'}
      <span className="dx-hide-sm dx-chip-sep" aria-hidden>·</span>
      <span className="dx-hide-sm">
        {updatedAt != null ? <>updated <RelTime at={updatedAt} /></> : 'waiting for data'}
      </span>
    </span>
  )
}
