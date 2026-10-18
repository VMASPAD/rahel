import { relTimeEn } from './format'
import { useNow } from './useNow'

export function RelTime({ at, className }: { at: number | null | undefined; className?: string }) {
  const now = useNow(1000)
  if (at == null) return <span className={`dx-dash ${className ?? ''}`}>--</span>
  return (
    <time className={className} dateTime={new Date(at).toISOString()} title={new Date(at).toLocaleString('en-US')}>
      {relTimeEn(at, now)}
    </time>
  )
}
