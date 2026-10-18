import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { analyticsApi } from '../api/analytics'
import { getStoredToken } from '../api/auth'
import { ArrivalTimeline } from '../components/analytics/ArrivalTimeline'
import { FieldsTable } from '../components/analytics/FieldsTable'
import { IngestLog } from '../components/analytics/IngestLog'
import { SensorsPanel } from '../components/analytics/SensorsPanel'
import { SummaryCards } from '../components/analytics/SummaryCards'
import { relTime } from '../components/analytics/format'
import { useLiveResource } from '../components/analytics/useLiveResource'
import { usePageMeta } from '../lib/usePageMeta'
import '../components/analytics/analytics.css'

const WINDOWS = [
  { hours: 24, label: 'Últimas 24 h' },
  { hours: 168, label: 'Últimos 7 días' },
  { hours: 720, label: 'Últimos 30 días' },
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
          Cargando…
        </p>
      ) : error ? (
        <p className="an-error" role="alert">
          No se pudo cargar esta sección ({error}). Se reintentará automáticamente.
        </p>
      ) : (
        children
      )}
    </section>
  )
}

export default function Analytics() {
  usePageMeta({ title: 'Analítica de sensores', noindex: true })
  const hasToken = Boolean(getStoredToken())
  const [selected, setSelected] = useState<string | null>(null)
  const [hours, setHours] = useState(168)
  const selId = useId()
  const winId = useId()

  const devices = useLiveResource(hasToken ? 'devices' : null, (s) => analyticsApi.devices(s))
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

  if (!hasToken || (devices.error && /401/.test(devices.error))) {
    return (
      <main className="an-page">
        <div className="an-wrap">
          <h1 className="an-title">Analítica de sensores</h1>
          <p className="an-empty">
            Necesitas iniciar sesión para ver la analítica de tus relojes.{' '}
            <Link to="/app" className="an-link">
              Ir al panel e iniciar sesión
            </Link>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="an-page">
      <div className="an-wrap">
        <header className="an-head">
          <p className="an-eyebrow">
            <Link to="/app" className="an-link">
              ← Panel
            </Link>{' '}
            · RaHel
          </p>
          <h1 className="an-title">Analítica de sensores</h1>
          <p className="an-lead">
            Qué llega de cada reloj, con qué calidad, y qué sensores conviene usar o descartar.
          </p>
          <div className="an-toolbar">
            <label className="an-field" htmlFor={selId}>
              <span>Reloj</span>
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
              <span>Ventana de campos</span>
              <select id={winId} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                {WINDOWS.map((w) => (
                  <option key={w.hours} value={w.hours}>
                    {w.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="an-btn"
              onClick={() => {
                devices.reload()
              }}
            >
              Actualizar
            </button>
            <span className="an-live an-mono" aria-live="off">
              <span className="an-dot an-dot--live" aria-hidden="true" />
              {devices.updatedAt ? `actualizado ${relTime(devices.updatedAt)} · cada 10 s` : 'sin actualizar'}
            </span>
          </div>
        </header>

        {devices.loading ? (
          <p className="an-empty" role="status">
            Cargando relojes…
          </p>
        ) : devices.error && !list ? (
          <p className="an-error" role="alert">
            No se pudo contactar con el servidor ({devices.error}). Comprueba que el backend esté en marcha.
          </p>
        ) : !list || list.length === 0 ? (
          <p className="an-empty">
            Todavía no hay ningún reloj vinculado. Vincula uno desde el{' '}
            <Link to="/app" className="an-link">
              panel
            </Link>{' '}
            para empezar a registrar sus sensores.
          </p>
        ) : device ? (
          <>
            <SummaryCards device={device} />

            <Block
              title="Campos recibidos"
              hint={`Cobertura sobre ${fields.data?.totalReadings.toLocaleString('es') ?? '…'} lecturas. «Estimado» = rellenado por el servidor (no medido).`}
              loading={fields.loading}
              error={fields.error && !fields.data ? fields.error : null}
            >
              {fields.data &&
                (fields.data.totalReadings === 0 ? (
                  <p className="an-empty">No hay lecturas en esta ventana. Amplía la ventana o espera a que el reloj sincronice.</p>
                ) : (
                  <FieldsTable fields={fields.data.fields} windowHours={fields.data.windowHours} />
                ))}
            </Block>

            <Block
              title="Sensores detectados en el reloj"
              hint="Inventario de SensorManager cruzado con lo que realmente llega."
              loading={sensors.loading}
              error={sensors.error && !sensors.data ? sensors.error : null}
            >
              {sensors.data && <SensorsPanel data={sensors.data} />}
            </Block>

            <Block
              title="Llegada de datos (24 h)"
              hint="Los huecos aparecen en rosado."
              loading={timeline.loading}
              error={timeline.error && !timeline.data ? timeline.error : null}
            >
              {timeline.data && <ArrivalTimeline data={timeline.data} />}
            </Block>

            <section className="an-section" aria-labelledby="an-log-h">
              <header className="an-sechead">
                <h2 id="an-log-h">Registro de ingesta</h2>
                <p className="an-sub">Cada lote recibido o rechazado, del más reciente al más antiguo (retención 30 días).</p>
              </header>
              <IngestLog deviceId={device.deviceId} />
            </section>
          </>
        ) : null}
      </div>
    </main>
  )
}
