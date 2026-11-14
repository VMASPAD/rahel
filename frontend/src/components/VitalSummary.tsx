import { Activity, Brain, HeartPulse, Moon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { EstimatedField, SensorReadingDto } from '../types/health'
import { EstTag } from './dashboard/EstTag'
import './dashboard.css'

type Row = {
  key: string
  label: string
  value: number | null
  unit: string
  icon: ReactNode
  field?: EstimatedField
}

export function VitalSummary({ reading }: { reading: SensorReadingDto | null }) {
  if (!reading) {
    return (
      <div className="dx-empty dx-empty--inline">
        <span className="dx-empty-ico" aria-hidden><HeartPulse size={22} /></span>
        <p>Vital signs will appear here as soon as the watch sends its first reading.</p>
      </div>
    )
  }
  const rows: Row[] = [
    { key: 'hr', label: 'HR', value: reading.heartRateBpm, unit: 'bpm', icon: <HeartPulse size={16} /> },
    { key: 'rhr', label: 'Resting HR', value: reading.restingHeartRateBpm, unit: 'bpm', icon: <Moon size={16} />, field: 'restingHeartRateBpm' },
    { key: 'hrv', label: 'HRV', value: reading.hrvMs, unit: 'ms', icon: <Activity size={16} />, field: 'hrvMs' },
    { key: 'sleep', label: 'Sleep', value: reading.sleepHoursLastNight, unit: 'h', icon: <Moon size={16} />, field: 'sleepHoursLastNight' },
    { key: 'stress', label: 'Stress', value: reading.stressScore, unit: '/100', icon: <Brain size={16} />, field: 'stressScore' },
  ]
  return (
    <dl className="vitals">
      {rows.map((r) => {
        const e = r.field ? reading.estimates?.[r.field] : undefined
        return (
          <div key={r.key} className={`vital-row ${r.value == null ? 'is-empty' : ''}`}>
            <dt>
              <span className="vital-ico" aria-hidden>{r.icon}</span>
              {r.label}
            </dt>
            <dd>
              {r.value == null ? (
                <span className="dx-dash" aria-label="No data">--</span>
              ) : (
                <>
                  <span className="dx-num dx-num--md">{r.value}</span>
                  {r.unit && <span className="dx-unit">{r.unit}</span>}
                  {e && <EstTag info={e} />}
                </>
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
