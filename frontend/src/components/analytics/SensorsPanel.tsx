import type { SensorReport, SensorsAnalytics } from '../../api/analytics'
import { fullDate, relTime } from './format'
import { sensorStatusLabel } from './labels'
import { qualityLabel } from './labels'

function Flag({ label, value }: { label: string; value: boolean | null }) {
  const text = value === null ? 'n/a' : value ? 'yes' : 'no'
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
          {sensorStatusLabel(s.status)}
        </span>
      </div>
      <div className="an-flags">
        <Flag label="Available" value={s.available} />
        <Flag label="Permission" value={s.permissionGranted} />
        <Flag label="Delivering" value={s.delivering} />
        <Flag label="In use" value={s.inUse} />
      </div>
      <p className="an-sub an-mono" title={fullDate(s.lastEventAt)}>
        Last event: {relTime(s.lastEventAt)}
        {s.resolution != null ? ` · resolution ${s.resolution}` : ''}
      </p>
      {s.feeds.length > 0 ? (
        <ul className="an-feeds" aria-label="Fields it feeds">
          {s.feeds.map((f) => (
            <li key={f.key}>
              → {f.label} <span className="an-mono">({qualityLabel(f.quality)}, {f.coveragePct}%)</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="an-sub">
          {s.uploadsToServer ? '' : 'It does not feed any field that is uploaded to the server.'}
        </p>
      )}
    </li>
  )
}

export function SensorsPanel({ data }: { data: SensorsAnalytics }) {
  if (data.sensors.length === 0) {
    return (
      <p className="an-empty">
        The watch has not sent its sensor inventory yet. It sends it about 2 minutes after collection starts,
        then every ~6 h (requires an app version that includes this feature).
      </p>
    )
  }
  return (
    <>
      <p className="an-sub an-mono">
        Inventory sent {relTime(data.reportedAt)}
        {data.appVersion ? ` · app ${data.appVersion}` : ''}
      </p>
      <ul className="an-sensors">
        {data.sensors.map((s) => (
          <SensorItem key={s.sensorKey} s={s} />
        ))}
      </ul>
      {data.fieldsWithoutSensor.length > 0 && (
        <div className="an-callout">
          <h3>Fields with no sensor feeding them</h3>
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
