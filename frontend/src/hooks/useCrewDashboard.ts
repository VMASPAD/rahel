import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { CrewLatestDto, CrewSummaryDto } from '../types/health'

export function useCrewDashboard() {
  const [crew, setCrew] = useState<CrewSummaryDto[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CrewLatestDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await api.crew()
      setCrew(list)
      const id = selectedId ?? list[0]?.crewMemberId ?? null
      setSelectedId(id)
      if (id) {
        setDetail(await api.crewLatest(id))
      } else {
        setDetail(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    void refresh()
  }, [])

  const selectCrew = useCallback(async (id: string) => {
    setSelectedId(id)
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

  return { crew, selectedId, detail, loading, error, refresh, selectCrew }
}
