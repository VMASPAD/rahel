import { useEffect, useState } from 'react'

/** Local clock that ticks every `ms` (visible tabs only). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => {
      if (!document.hidden) setNow(Date.now())
    }, ms)
    return () => window.clearInterval(t)
  }, [ms])
  return now
}
