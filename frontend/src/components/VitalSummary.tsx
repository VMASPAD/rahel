import type { SensorReadingDto } from '../types/health'
import './dashboard.css'

export function VitalSummary({ reading }: { reading: SensorReadingDto | null }) {
  if (!reading) return <p className="muted">Sin lecturas aún.</p>
  const rows = [
    ['FC', `${reading.heartRateBpm} bpm`],
    ['FC reposo', `${reading.restingHeartRateBpm} bpm`],
    ['HRV', `${reading.hrvMs} ms`],
    ['SpO₂', `${reading.spO2Percent}%`],
    ['Sueño', `${reading.sleepHoursLastNight} h`],
    ['Estrés', `${reading.stressScore}/100`],
    ['Día misión', String(reading.missionDay)],
  ]
  return (
    <dl className="vitals">
      {rows.map(([k, v]) => (
        <div key={k} className="vital-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}
