import { useCallback, useEffect, useRef, useState } from 'react'

export type LiveState<T> = {
  data: T | null
  error: string | null
  loading: boolean
  updatedAt: number | null
  reload: () => void
}

const POLL_MS = 10_000

/**
 * Loads `loader` when `key` changes and then every 10 s, only while the tab is visible.
 * Errors keep the last data on screen (soft failure); a failed first load shows the error.
 * `key === null` disables the resource.
 */
export function useLiveResource<T>(
  key: string | null,
  loader: (signal: AbortSignal) => Promise<T>,
): LiveState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(key !== null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const loaderRef = useRef(loader)
  loaderRef.current = loader
  const ctl = useRef<AbortController | null>(null)
  const [tick, setTick] = useState(0)

  const run = useCallback(async (initial: boolean) => {
    ctl.current?.abort()
    const c = new AbortController()
    ctl.current = c
    if (initial) setLoading(true)
    try {
      const d = await loaderRef.current(c.signal)
      if (c.signal.aborted) return
      setData(d)
      setError(null)
      setUpdatedAt(Date.now())
    } catch (e) {
      if (c.signal.aborted) return
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      if (!c.signal.aborted && initial) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (key === null) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    setData(null)
    setError(null)
    void run(true)
    const id = window.setInterval(() => {
      if (!document.hidden) void run(false)
    }, POLL_MS)
    const onVisible = () => {
      if (!document.hidden) void run(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      ctl.current?.abort()
    }
  }, [key, run, tick])

  return { data, error, loading, updatedAt, reload: () => setTick((t) => t + 1) }
}
