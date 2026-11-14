import { EvilLineChart } from '@/components/evilcharts/charts/recharts-line-chart'
import { type ChartConfig } from '@/components/evilcharts/ui/recharts-chart'
import type { SensorReadingDto } from '../types/health'
import { useState } from 'react'
import { CloudOff, RefreshCw, Watch } from 'lucide-react'
import { Skeleton } from './dashboard/Skeleton'
import './dashboard.css'

type ChartRow = {
  time: string
  heartRateBpm: number | null
  restingHeartRateBpm: number | null
  hrvMs: number | null
  spO2Percent: number | null
  stressScore: number
  stepsToday: number | null
  sleepHoursLastNight: number | null
  skinTempCelsius: number | null
  isolationIndex: number
  radiationDoseMilliSvProxy: number
}

function toRows(readings: SensorReadingDto[]): ChartRow[] {
  return readings.map((r) => {
    const d = new Date(r.recordedAtEpochMs)
    return {
      time: d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }),
      heartRateBpm: r.heartRateBpm,
      restingHeartRateBpm: r.restingHeartRateBpm,
      hrvMs: r.hrvMs,
      spO2Percent: r.spO2Percent,
      stressScore: r.stressScore,
      stepsToday: r.stepsToday,
      sleepHoursLastNight: r.sleepHoursLastNight,
      skinTempCelsius: r.skinTempCelsius,
      isolationIndex: r.isolationIndex,
      radiationDoseMilliSvProxy: r.radiationDoseMilliSvProxy,
    }
  })
}

const RANGES = [
  { id: '30m', label: '30 min', points: 60 },
  { id: '1h', label: '1 h', points: 120 },
  { id: 'all', label: 'All', points: Infinity },
] as const

type Range = (typeof RANGES)[number]['id']

function EvilTelemetryLineChart({
  title,
  data,
  config,
  series,
  wide,
  index,
}: {
  title: string
  data: ChartRow[]
  config: ChartConfig
  series: (keyof ChartRow & string)[]
  wide?: boolean
  index: number
}) {
  if (data.length === 0) return null
  const hasData = series.some((k) => data.some((r) => r[k] != null))
  const lastRow = data[data.length - 1]
  return (
    <figure
      className={`chart-block dark dx-rise ${wide ? 'chart-block--wide' : ''}`}
      style={{ ['--i' as string]: index }}
    >
      <figcaption>
        <h3>{title}</h3>
        <ul className="chart-now" aria-label={`Latest value of ${title}`}>
          {series.map((key) => {
            const v = lastRow[key]
            const entry = (config as Record<string, { label?: string; colors?: { dark?: string[] } }>)[key]
            return (
              <li key={key}>
                <span className="chart-swatch" style={{ background: entry?.colors?.dark?.[0] }} aria-hidden />
                <span className="chart-now-label">{entry?.label ?? key}</span>
                <span className="chart-now-val">{v == null ? '--' : v}</span>
              </li>
            )
          })}
        </ul>
      </figcaption>
      {!hasData ? (
        <div className="chart-empty">
          <span className="dx-dash">--</span>
          <p>This chart draws itself as soon as the watch sends this data.</p>
        </div>
      ) : (
      <EvilLineChart
        data={data}
        // Config keys are validated at runtime; the TS generic is overly strict here.
        config={config as never}
        xDataKey="time"
        curveType="monotone"
        animationType="left-to-right"
        className={wide ? 'h-[280px] w-full' : 'h-[240px] w-full'}
      >
        <EvilLineChart.Grid />
        <EvilLineChart.XAxis dataKey="time" />
        <EvilLineChart.YAxis />
        <EvilLineChart.Tooltip />
        {data.length > 12 && <EvilLineChart.Brush formatLabel={(v) => String(v)} />}
        {series.map((key) => (
          <EvilLineChart.Line key={key} dataKey={key} strokeVariant="solid" isClickable>
            <EvilLineChart.ActiveDot variant="colored-border" />
          </EvilLineChart.Line>
        ))}
      </EvilLineChart>
      )}
    </figure>
  )
}

const heartConfig: ChartConfig = {
  heartRateBpm: { label: 'HR (bpm)', colors: { dark: ['#5EE0A0'] } },
  restingHeartRateBpm: { label: 'Resting HR', colors: { dark: ['#FFE5E7'] } },
}

const hrvConfig: ChartConfig = {
  hrvMs: { label: 'HRV (ms)', colors: { dark: ['#8fd3ff', '#5db8f0'] } },
  spO2Percent: { label: 'SpO₂ (%)', colors: { dark: ['#5EE0A0'] } },
}

const stressConfig: ChartConfig = {
  stressScore: { label: 'Stress', colors: { dark: ['#c4b5fd'] } },
  skinTempCelsius: { label: 'Skin temp. (°C)', colors: { dark: ['#f9a8d4'] } },
}

const activityConfig: ChartConfig = {
  stepsToday: { label: 'Steps', colors: { dark: ['#5EE0A0'] } },
  sleepHoursLastNight: { label: 'Sleep (h)', colors: { dark: ['#a5b4fc'] } },
}

const missionConfig: ChartConfig = {
  isolationIndex: { label: 'Isolation', colors: { dark: ['#9fc4b3'] } },
  radiationDoseMilliSvProxy: {
    label: 'Radiation (proxy)',
    colors: { dark: ['#FFE5E7', '#f4c5c9'] },
  },
}

function ChartsSkeleton() {
  return (
    <div className="charts-grid" aria-busy="true" aria-label="Loading history">
      {[0, 1, 2].map((i) => (
        <div key={i} className={`chart-block ${i === 0 ? 'chart-block--wide' : ''}`}>
          <Skeleton h={16} w="40%" />
          <div style={{ height: 14 }} />
          <Skeleton h={i === 0 ? 220 : 180} r={12} />
        </div>
      ))}
    </div>
  )
}

export function TelemetryCharts({
  readings,
  loading,
  error,
  crewMemberId,
  updatedAt,
  onRetry,
}: {
  readings: SensorReadingDto[]
  loading: boolean
  error: string | null
  crewMemberId: string | null
  updatedAt: number | null
  onRetry?: () => void
}) {
  const [range, setRange] = useState<Range>('all')

  if (!crewMemberId) {
    return (
      <div className="dx-empty">
        <span className="dx-empty-ico" aria-hidden><Watch size={26} /></span>
        <h3>Pick a crew member</h3>
        <p>Select someone from the list to see their watch history.</p>
      </div>
    )
  }
  if (error && readings.length === 0) {
    return (
      <div className="dx-empty dx-empty--warn" role="alert">
        <span className="dx-empty-ico" aria-hidden><CloudOff size={26} /></span>
        <h3>The history is taking a short break</h3>
        <p>We could not load it right now. It retries on its own, or you can try again.</p>
        {onRetry && (
          <button type="button" className="dx-btn dx-btn--soft" onClick={onRetry}>
            <RefreshCw size={16} aria-hidden /> Retry
          </button>
        )}
      </div>
    )
  }
  if (loading && readings.length === 0) return <ChartsSkeleton />
  if (readings.length === 0) {
    return (
      <div className="dx-empty">
        <span className="dx-empty-ico" aria-hidden><Watch size={26} /></span>
        <h3>Waiting for the first reading</h3>
        <p>Once the watch syncs its data, charts will draw here in real time. Keep the app open on the watch.</p>
      </div>
    )
  }

  const points = RANGES.find((r) => r.id === range)!.points
  const data = toRows(points === Infinity ? readings : readings.slice(-points))

  return (
    <div className="charts-panel">
      <div className="chart-meta">
        <span className="live-pill">
          <span className="live-pill-dot" aria-hidden />
          Real time · every 5 s
        </span>
        {updatedAt != null && (
          <span className="chart-updated">Updated at {new Date(updatedAt).toLocaleTimeString('en-US')}</span>
        )}
        <span className="chart-count">
          {data.length} point{data.length === 1 ? '' : 's'}
        </span>
        <div className="seg" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={r.id === range ? 'seg-btn is-on' : 'seg-btn'}
              aria-pressed={r.id === range}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="charts-grid">
        <EvilTelemetryLineChart wide index={0} title="Heart rate" data={data} config={heartConfig} series={['heartRateBpm', 'restingHeartRateBpm']} />
        <EvilTelemetryLineChart index={1} title="HRV and SpO₂" data={data} config={hrvConfig} series={['hrvMs', 'spO2Percent']} />
        <EvilTelemetryLineChart index={2} title="Stress and skin temperature" data={data} config={stressConfig} series={['stressScore', 'skinTempCelsius']} />
        <EvilTelemetryLineChart index={3} title="Activity and sleep" data={data} config={activityConfig} series={['stepsToday', 'sleepHoursLastNight']} />
        <EvilTelemetryLineChart index={4} title="Mission context" data={data} config={missionConfig} series={['isolationIndex', 'radiationDoseMilliSvProxy']} />
      </div>
    </div>
  )
}
