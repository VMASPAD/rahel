import { useCallback, useEffect, useMemo, useState } from 'react'
import { analyticsApi, type IngestLogItem } from '../../api/analytics'
import { clock, fmtBytes } from './format'
import { ingestStatusLabel } from './labels'
import { useLiveResource } from './useLiveResource'

type StatusFilter = 'all' | 'ok' | 'rechazado'
const PAGE = 25

export function IngestLog({ deviceId }: { deviceId: string }) {
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [older, setOlder] = useState<IngestLogItem[]>([])
  const [nextBefore, setNextBefore] = useState<number | null>(null)
  const [moreLoading, setMoreLoading] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)

  const status = filter === 'all' ? null : filter
  const key = `${deviceId}|${filter}`
  const head = useLiveResource(key, (signal) =>
    analyticsApi.log(deviceId, { limit: PAGE, status }, signal),
  )

  // Reset the appended pages whenever device/filter changes.
  useEffect(() => {
    setOlder([])
    setNextBefore(null)
    setMoreError(null)
  }, [key])

  const headItems = head.data?.items
  const headNext = head.data?.nextBefore ?? null
  const cursor = older.length > 0 ? nextBefore : headNext

  const items = useMemo(() => {
    const seen = new Set<number>()
    return [...(headItems ?? []), ...older].filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
  }, [headItems, older])

  const loadMore = useCallback(async () => {
    if (cursor == null) return
    setMoreLoading(true)
    setMoreError(null)
    try {
      const page = await analyticsApi.log(deviceId, { limit: PAGE, before: cursor, status })
      setOlder((o) => [...o, ...page.items])
      setNextBefore(page.nextBefore)
    } catch (e) {
      setMoreError(e instanceof Error ? e.message : 'Error')
    } finally {
      setMoreLoading(false)
    }
  }, [cursor, deviceId, status])

  return (
    <div>
      <div className="an-toolbar">
        <label className="an-field">
          <span>Status</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value as StatusFilter)}>
            <option value="all">All</option>
            <option value="ok">Successful only</option>
            <option value="rechazado">Rejected only</option>
          </select>
        </label>
        <span className="an-sub an-mono" aria-live="polite">
          {items.length} entr{items.length === 1 ? 'y' : 'ies'} loaded
        </span>
      </div>

      {head.loading && items.length === 0 && <p className="an-empty">Loading log…</p>}
      {head.error && items.length === 0 && (
        <p className="an-error" role="alert">
          The log did not load ({head.error}).
        </p>
      )}
      {!head.loading && !head.error && items.length === 0 && (
        <p className="an-empty">
          {filter === 'rechazado'
            ? 'No rejected batches: everything the watch sends passes validation.'
            : 'No batches logged for this watch yet.'}
        </p>
      )}

      {items.length > 0 && (
        <ol className="an-log" aria-label="Received batches log">
          {items.map((i) => (
            <li key={i.id} className="an-logrow" data-status={i.status}>
              <time className="an-mono an-logtime" dateTime={new Date(i.receivedAt).toISOString()}>
                {clock(i.receivedAt)}
              </time>
              <span className="an-logstatus" data-status={i.status}>
                <span aria-hidden="true">{i.status === 'ok' ? '✓' : '✕'}</span> {ingestStatusLabel(i.status)}
              </span>
              <span className="an-mono an-logcounts">
                {i.readingsAccepted}/{i.readingsReceived} readings
                {i.duplicates > 0 ? ` · ${i.duplicates} dup.` : ''}
                {i.assessmentsReceived > 0 ? ` · ${i.assessmentsReceived} assess.` : ''}
              </span>
              <span className="an-mono an-logbytes">{fmtBytes(i.bytes)}</span>
              <span className="an-mono an-logmsg">
                {i.batchId ? <span className="an-logbatch">{i.batchId.slice(0, 14)}</span> : null}
                {i.errorCode ? <b> {i.errorCode}</b> : null}
                {i.errorDetail ? ` — ${i.errorDetail}` : ''}
                {i.appVersion ? ` · v${i.appVersion}` : ''}
              </span>
            </li>
          ))}
        </ol>
      )}

      {moreError && (
        <p className="an-error" role="alert">
          More entries did not load ({moreError}).
        </p>
      )}
      {cursor != null && (
        <button type="button" className="an-btn" onClick={() => void loadMore()} disabled={moreLoading}>
          {moreLoading ? 'Loading…' : 'Load older entries'}
        </button>
      )}
    </div>
  )
}
