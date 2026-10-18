import type { EstimatedField, SensorReadingDto } from '../types/health'
import './dashboard.css'

const fmt = (v: number | null | undefined, unit: string) =>
  v == null ? 'Sin dato' : `${v}${unit}`

export function VitalSummary({ reading }: { reading: SensorReadingDto | null }) {
  if (!reading) return <p className="muted">Sin lecturas aún.</p>
  const est = (field: EstimatedField) => reading.estimates?.[field]
  const rows: [string, string, EstimatedField?][] = [
    ['FC', fmt(reading.heartRateBpm, ' bpm')],
    ['FC reposo', fmt(reading.restingHeartRateBpm, ' bpm'), 'restingHeartRateBpm'],
    ['HRV', fmt(reading.hrvMs, ' ms'), 'hrvMs'],
    ['SpO₂', fmt(reading.spO2Percent, '%')],
    ['Sueño', fmt(reading.sleepHoursLastNight, ' h'), 'sleepHoursLastNight'],
    ['Temp. piel', fmt(reading.skinTempCelsius, ' °C')],
    ['Estrés', fmt(reading.stressScore, '/100'), 'stressScore'],
    ['Día misión', fmt(reading.missionDay, '')],
  ]
  return (
    <dl className="vitals">
      {rows.map(([k, v, field]) => {
        const e = field ? est(field) : undefined
        return (
        <div key={k} className="vital-row">
          <dt>{k}</dt>
          <dd>
            {v}
            {e && (
              <span
                className="est-tag"
                title={`Estimado a partir del historial del reloj (${e.sampleCount} muestras, confianza ${e.confidence === 'low' ? 'baja' : 'media'}). No es una medición.`}
              >
                est.
              </span>
            )}
          </dd>
        </div>
        )
      })}
    </dl>
  )
}
