import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { SensorReadingDto } from '../types/health'

const LIVE_POLL_MS = 5_000

export function useCrewReadings(crewMemberId: string | null) {
  const [readings, setReadings] = useState<SensorReadingDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const inFlight = useRef(false)

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false
      if (!crewMemberId) {
        setReadings([])
        setUpdatedAt(null)
        return
      }
      if (inFlight.current) return
      inFlight.current = true
      if (!silent) setLoading(true)
      try {
        const rows = await api.crewReadings(crewMemberId, 300)
        setReadings(rows.slice().reverse())
        setUpdatedAt(Date.now())
        setError(null)
      } catch (e) {
        if (!silent) {
          setError(e instanceof Error ? e.message : 'Error')
          setReadings([])
        }
      } finally {
        inFlight.current = false
        if (!silent) setLoading(false)
      }
    },
    [crewMemberId],
  )

  useEffect(() => {
    void load({ silent: false })
    const timer = window.setInterval(() => {
      if (!document.hidden) void load({ silent: true })
    }, LIVE_POLL_MS)
    return () => window.clearInterval(timer)
  }, [load])

  return { readings, loading, error, updatedAt, reload: () => load() }
}
