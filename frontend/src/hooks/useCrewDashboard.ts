import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { CrewLatestDto, CrewSummaryDto } from '../types/health'

const LIVE_POLL_MS = 5_000

export function useCrewDashboard(preferredCrewIds: string[] = []) {
  const [crew, setCrew] = useState<CrewSummaryDto[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CrewLatestDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  selectedIdRef.current = selectedId
  const userSelectedRef = useRef(false)
  const preferredRef = useRef<string[]>(preferredCrewIds)
  preferredRef.current = preferredCrewIds
  const inFlight = useRef(false)

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false
    if (inFlight.current) return
    inFlight.current = true
    if (!silent) setLoading(true)
    setError(null)
    try {
      const list = await api.crew()
      list.sort(
        (a, b) => (b.latestReadingAtEpochMs ?? 0) - (a.latestReadingAtEpochMs ?? 0),
      )
      setCrew(list)
      const preferred = preferredRef.current.find((cid) =>
        list.some((c) => c.crewMemberId === cid),
      )
      const id =
        (userSelectedRef.current ? selectedIdRef.current : null) ??
        preferred ??
        selectedIdRef.current ??
        list[0]?.crewMemberId ??
        null
      if (id !== selectedIdRef.current) {
        selectedIdRef.current = id
        setSelectedId(id)
      }
      if (id) {
        setDetail(await api.crewLatest(id))
      } else {
        setDetail(null)
      }
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : 'Error')
      }
    } finally {
      inFlight.current = false
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh({ silent: false })
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh({ silent: true })
    }, LIVE_POLL_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  const selectCrew = useCallback(async (id: string) => {
    userSelectedRef.current = true
    setSelectedId(id)
    selectedIdRef.current = id
    setLoading(true)
    try {
      setDetail(await api.crewLatest(id))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  return { crew, selectedId, detail, loading, error, refresh: () => refresh(), selectCrew }
}
