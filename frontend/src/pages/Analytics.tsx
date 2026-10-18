import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { analyticsApi } from '../api/analytics'
import { PageHeader } from '../components/dashboard/PageHeader'
import { ArrivalTimeline } from '../components/analytics/ArrivalTimeline'
import { FieldsTable } from '../components/analytics/FieldsTable'
import { IngestLog } from '../components/analytics/IngestLog'
import { SensorsPanel } from '../components/analytics/SensorsPanel'
import { SummaryCards } from '../components/analytics/SummaryCards'
import { relTime } from '../components/analytics/format'
import { useLiveResource } from '../components/analytics/useLiveResource'
import { usePageMeta } from '../lib/usePageMeta'
import { useAppBase } from '../components/dashboard/appSession'
import '../components/analytics/analytics.css'

const WINDOWS = [
  { hours: 24, label: 'Last 24 hours' },
  { hours: 168, label: 'Last 7 days' },
  { hours: 720, label: 'Last 30 days' },
]

function Block({
  title,
  hint,
  loading,
  error,
  children,
}: {
  title: string
  hint?: string
  loading: boolean
  error: string | null
  children: ReactNode
}) {
  const id = useId()
  return (
    <section className="an-section" aria-labelledby={id} aria-busy={loading}>
      <header className="an-sechead">
        <h2 id={id}>{title}</h2>
        {hint && <p className="an-sub">{hint}</p>}
      </header>
      {loading ? (
        <p className="an-empty" role="status">
          Loading…
        </p>
      ) : error ? (
        <p className="an-error" role="alert">
          This section did not load ({error}). We will retry automatically.
        </p>
      ) : (
        children
      )}
    </section>
  )
}

export default function Analytics() {
  usePageMeta({ title: 'Sensor analytics', noindex: true })
  const { base } = useAppBase()
  const [selected, setSelected] = useState<string | null>(null)
  const [hours, setHours] = useState(168)
  const selId = useId()
  const winId = useId()

  const devices = useLiveResource('devices', (s) => analyticsApi.devices(s))
  const list = devices.data

  useEffect(() => {
    if (!list || list.length === 0) return
    if (!selected || !list.some((d) => d.deviceId === selected)) setSelected(list[0].deviceId)
  }, [list, selected])

  const device = list?.find((d) => d.deviceId === selected) ?? null
  const key = device ? `${device.deviceId}|${hours}` : null
  const fields = useLiveResource(key, (s) => analyticsApi.fields(device!.deviceId, hours, s))
  const sensors = useLiveResource(key, (s) => analyticsApi.sensors(device!.deviceId, hours, s))
  const timeline = useLiveResource(device ? device.deviceId : null, (s) =>
    analyticsApi.timeline(device!.deviceId, 24, s),
  )

  return (
    <div className="an-page an-embedded">
      <PageHeader
        title="Sensor analytics"
        subtitle="What each watch sends, how good it is, and which sensors are worth keeping or dropping."
        onRefresh={() => devices.reload()}
        refreshing={devices.loading}
      />
      <div className="an-wrap">
        <header className="an-head">
          <div className="an-toolbar">
            <label className="an-field" htmlFor={selId}>
              <span>Watch</span>
              <select
                id={selId}
                value={selected ?? ''}
                onChange={(e) => setSelected(e.target.value)}
                disabled={!list || list.length === 0}
              >
                {(list ?? []).map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.crewMemberId} · {d.deviceId.slice(0, 12)}…
                  </option>
                ))}
              </select>
            </label>
            <label className="an-field" htmlFor={winId}>
              <span>Fields window</span>
              <select id={winId} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                {WINDOWS.map((w) => (
                  <option key={w.hours} value={w.hours}>
                    {w.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="an-live an-mono" aria-live="off">
              <span className="an-dot an-dot--live" aria-hidden="true" />
              {devices.updatedAt ? `updated ${relTime(devices.updatedAt)} · every 10 s` : 'not updated yet'}
            </span>
          </div>
        </header>

        {devices.loading ? (
          <p className="an-empty" role="status">
            Loading watches…
          </p>
        ) : devices.error && !list ? (
          <p className="an-error" role="alert">
            We could not reach the server ({devices.error}). Check that the backend is running.
          </p>
        ) : !list || list.length === 0 ? (
          <p className="an-empty">
            No watch is linked yet. Link one from the{' '}
            <Link to={base} className="an-link">
              dashboard
            </Link>{' '}
            to start recording its sensors.
          </p>
        ) : device ? (
          <>
            <SummaryCards device={device} />

            <Block
              title="Fields received"
              hint={`Coverage across ${fields.data?.totalReadings.toLocaleString('en-US') ?? '…'} readings. "Estimated" means filled in by the server rather than measured by the watch.`}
              loading={fields.loading}
              error={fields.error && !fields.data ? fields.error : null}
            >
              {fields.data &&
                (fields.data.totalReadings === 0 ? (
                  <p className="an-empty">No readings in this window yet. Widen the window or wait for the watch to sync.</p>
                ) : (
                  <FieldsTable fields={fields.data.fields} windowHours={fields.data.windowHours} />
                ))}
            </Block>

            <Block
              title="Sensors detected on the watch"
              hint="The SensorManager inventory, cross-checked against what actually arrives."
              loading={sensors.loading}
              error={sensors.error && !sensors.data ? sensors.error : null}
            >
              {sensors.data && <SensorsPanel data={sensors.data} />}
            </Block>

            <Block
              title="Data arrival (24 h)"
              hint="Gaps show up in pink."
              loading={timeline.loading}
              error={timeline.error && !timeline.data ? timeline.error : null}
            >
              {timeline.data && <ArrivalTimeline data={timeline.data} />}
            </Block>

            <section className="an-section" aria-labelledby="an-log-h">
              <header className="an-sechead">
                <h2 id="an-log-h">Ingest log</h2>
                <p className="an-sub">Every batch received or rejected, newest first (kept for 30 days).</p>
              </header>
              <IngestLog deviceId={device.deviceId} />
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
