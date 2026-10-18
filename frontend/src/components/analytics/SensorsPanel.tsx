import type { SensorReport, SensorsAnalytics } from '../../api/analytics'
import { fullDate, relTime } from './format'

function Flag({ label, value }: { label: string; value: boolean | null }) {
  const text = value === null ? 'n/a' : value ? 'sí' : 'no'
  return (
    <span className="an-flag" data-v={value === null ? 'na' : value ? 'yes' : 'no'}>
      {label}: <b>{text}</b>
    </span>
  )
}

function SensorItem({ s }: { s: SensorReport }) {
  return (
    <li className="an-sensor">
      <div className="an-sensor-head">
        <div>
          <code className="an-key an-key--lg">{s.typeName}</code>
          <p className="an-sensor-name">
            {s.name ?? s.sensorKey}
            {s.vendor ? ` · ${s.vendor}` : ''}
            {s.wakeUp ? ' · wake-up' : ''}
          </p>
        </div>
        <span className="an-status" data-s={s.status}>
          {s.status}
        </span>
      </div>
      <div className="an-flags">
        <Flag label="Disponible" value={s.available} />
        <Flag label="Permiso" value={s.permissionGranted} />
        <Flag label="Entregando" value={s.delivering} />
        <Flag label="En uso" value={s.inUse} />
      </div>
      <p className="an-sub an-mono" title={fullDate(s.lastEventAt)}>
        Último evento: {relTime(s.lastEventAt)}
        {s.resolution != null ? ` · resolución ${s.resolution}` : ''}
      </p>
      {s.feeds.length > 0 ? (
        <ul className="an-feeds" aria-label="Campos que alimenta">
          {s.feeds.map((f) => (
            <li key={f.key}>
              → {f.label} <span className="an-mono">({f.quality}, {f.coveragePct}%)</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="an-sub">
          {s.uploadsToServer ? '' : 'No alimenta ningún campo que se suba al servidor.'}
        </p>
      )}
    </li>
  )
}

export function SensorsPanel({ data }: { data: SensorsAnalytics }) {
  if (data.sensors.length === 0) {
    return (
      <p className="an-empty">
        El reloj aún no ha enviado su inventario de sensores. Lo envía unos 2 minutos después de iniciar la
        recolección y después cada ~6 h (requiere la versión de la app con esta función).
      </p>
    )
  }
  return (
    <>
      <p className="an-sub an-mono">
        Inventario enviado {relTime(data.reportedAt)}
        {data.appVersion ? ` · app ${data.appVersion}` : ''}
      </p>
      <ul className="an-sensors">
        {data.sensors.map((s) => (
          <SensorItem key={s.sensorKey} s={s} />
        ))}
      </ul>
      {data.fieldsWithoutSensor.length > 0 && (
        <div className="an-callout">
          <h3>Campos sin sensor que los alimente</h3>
          <ul>
            {data.fieldsWithoutSensor.map((f) => (
              <li key={f.key}>
                <strong>{f.label}</strong> <code className="an-key">{f.key}</code>: {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
