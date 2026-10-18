import { Clock, Footprints, HeartPulse, ShieldCheck, Moon } from 'lucide-react'
import type { ReactNode } from 'react'
import type { HealthAssessmentDto, SensorReadingDto } from '../../types/health'
import { AlertBadge } from '../AlertBadge'
import { EstTag } from './EstTag'
import { FRESH_LABEL, freshnessOf } from './format'
import { RelTime } from './RelTime'
import { Skeleton } from './Skeleton'
import { Sparkline } from './Sparkline'
import { useNow } from './useNow'

type Props = {
  reading: SensorReadingDto | null
  assessment: HealthAssessmentDto | null
  history: SensorReadingDto[]
  loading: boolean
}

function Kpi({
  index,
  icon,
  label,
  children,
  foot,
  tone,
}: {
  index: number
  icon: ReactNode
  label: string
  children: ReactNode
  foot?: ReactNode
  tone?: string
}) {
  return (
    <li className={`dx-card dx-kpi dx-rise ${tone ?? ''}`} style={{ ['--i' as string]: index }}>
      <div className="dx-kpi-head">
        <span className="dx-kpi-icon" aria-hidden>{icon}</span>
        <span className="dx-kpi-label">{label}</span>
      </div>
      <div className="dx-kpi-value">{children}</div>
      <div className="dx-kpi-foot">{foot}</div>
    </li>
  )
}

function Value({ v, unit }: { v: number | null | undefined; unit?: string }) {
  if (v == null) return <span className="dx-dash" aria-label="No data">--</span>
  return (
    <>
      <span className="dx-num">{v}</span>
      {unit && <span className="dx-unit">{unit}</span>}
    </>
  )
}

export function KpiCards({ reading, assessment, history, loading }: Props) {
  const now = useNow(1000)
  if (loading && !reading) {
    return (
      <ul className="dx-kpis" aria-busy="true" aria-label="Loading indicators">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="dx-card dx-kpi">
            <Skeleton h={14} w="55%" />
            <Skeleton h={32} w="40%" r={10} />
            <Skeleton h={30} />
          </li>
        ))}
      </ul>
    )
  }
  const at = reading?.recordedAtEpochMs ?? null
  const fresh = freshnessOf(at, now)
  const restEst = reading?.estimates?.restingHeartRateBpm
  const last = history.slice(-60)
  return (
    <ul className="dx-kpis" aria-label="Key indicators">
      <Kpi
        index={0}
        icon={<HeartPulse size={16} />}
        label="Heart rate"
        foot={<Sparkline values={last.map((r) => r.heartRateBpm)} label="heart rate" />}
      >
        <Value v={reading?.heartRateBpm} unit="bpm" />
      </Kpi>
      <Kpi
        index={1}
        icon={<Moon size={16} />}
        label="Resting HR"
        foot={<Sparkline values={last.map((r) => r.restingHeartRateBpm)} color="#FFE5E7" label="resting heart rate" />}
      >
        <Value v={reading?.restingHeartRateBpm} unit="bpm" />
        {restEst && reading?.restingHeartRateBpm != null && <EstTag info={restEst} />}
      </Kpi>
      <Kpi
        index={2}
        icon={<Footprints size={16} />}
        label="Steps today"
        foot={<Sparkline values={last.map((r) => r.stepsToday)} color="#8fd3ff" label="steps" />}
      >
        <Value v={reading?.stepsToday} />
      </Kpi>
      <Kpi
        index={3}
        icon={<ShieldCheck size={16} />}
        label="Assessment"
        foot={
          <p className="dx-kpi-note">
            {assessment ? assessment.headline : <span className="dx-dash">--</span>}
          </p>
        }
      >
        {assessment ? <AlertBadge level={assessment.overallLevel} size="lg" /> : <AlertBadge level={null} size="lg" />}
      </Kpi>
      <Kpi
        index={4}
        icon={<Clock size={16} />}
        label="Last reading"
        foot={
          fresh ? (
            <span className={`dx-chip dx-chip--${fresh}`}>
              <span className="dx-chip-dot" aria-hidden />
              {FRESH_LABEL[fresh]}
            </span>
          ) : (
            <span className="dx-dash">--</span>
          )
        }
      >
        {at != null ? <RelTime at={at} className="dx-num dx-num--sm" /> : <span className="dx-dash">--</span>}
      </Kpi>
    </ul>
  )
}
