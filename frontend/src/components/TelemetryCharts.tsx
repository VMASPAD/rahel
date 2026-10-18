import { EvilLineChart } from '@/components/evilcharts/charts/recharts-line-chart'
import { type ChartConfig } from '@/components/evilcharts/ui/recharts-chart'
import type { SensorReadingDto } from '../types/health'
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
      time: d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
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

function EvilTelemetryLineChart({
  title,
  data,
  config,
  series,
}: {
  title: string
  data: ChartRow[]
  config: ChartConfig
  series: (keyof ChartRow & string)[]
}) {
  if (data.length === 0) return null
  return (
    <div className="chart-block dark">
      <h3>{title}</h3>
      <EvilLineChart
        data={data}
        // EvilCharts validates config keys at runtime; TS generic is overly strict here.
        config={config as never}
        xDataKey="time"
        curveType="monotone"
        animationType="left-to-right"
        className="h-[260px] w-full"
      >
        <EvilLineChart.Grid />
        <EvilLineChart.XAxis dataKey="time" />
        <EvilLineChart.YAxis />
        <EvilLineChart.Tooltip />
        <EvilLineChart.Legend isClickable />
        {data.length > 12 && <EvilLineChart.Brush formatLabel={(v) => String(v)} />}
        {series.map((key) => (
          <EvilLineChart.Line key={key} dataKey={key} strokeVariant="solid" isClickable>
            <EvilLineChart.Dot variant="border" />
            <EvilLineChart.ActiveDot variant="colored-border" />
          </EvilLineChart.Line>
        ))}
      </EvilLineChart>
    </div>
  )
}

const heartConfig: ChartConfig = {
  heartRateBpm: { label: 'FC (bpm)', colors: { dark: ['#ef5350'] } },
  restingHeartRateBpm: { label: 'FC reposo', colors: { dark: ['#ff8a65'] } },
}

const hrvConfig: ChartConfig = {
  hrvMs: { label: 'HRV (ms)', colors: { dark: ['#64b5f6', '#42a5f5'] } },
  spO2Percent: { label: 'SpO₂ (%)', colors: { dark: ['#4dd0e1'] } },
}

const stressConfig: ChartConfig = {
  stressScore: { label: 'Estrés', colors: { dark: ['#ffb74d'] } },
  skinTempCelsius: { label: 'Temp. piel (°C)', colors: { dark: ['#ba68c8'] } },
}

const activityConfig: ChartConfig = {
  stepsToday: { label: 'Pasos', colors: { dark: ['#81c784'] } },
  sleepHoursLastNight: { label: 'Sueño (h)', colors: { dark: ['#7986cb'] } },
}

const missionConfig: ChartConfig = {
  isolationIndex: { label: 'Aislamiento', colors: { dark: ['#90a4ae'] } },
  radiationDoseMilliSvProxy: {
    label: 'Radiación (proxy)',
    colors: { dark: ['#fff176', '#fdd835'] },
  },
}

export function TelemetryCharts({
  readings,
  loading,
  error,
  crewMemberId,
  updatedAt,
}: {
  readings: SensorReadingDto[]
  loading: boolean
  error: string | null
  crewMemberId: string | null
  updatedAt: number | null
}) {
  if (!crewMemberId) {
    return <p className="muted">Selecciona un miembro de crew para ver el historial.</p>
  }
  if (error) return <p className="warn">{error}</p>
  if (loading && readings.length === 0) {
    return <p className="muted">Cargando historial del reloj…</p>
  }
  if (readings.length === 0) {
    return <p className="muted">Aún no hay lecturas sincronizadas desde el reloj.</p>
  }

  const data = toRows(readings)

  return (
    <div className="charts-panel">
      <p className="muted chart-meta">
        <span className="live-pill">
          <span className="live-pill-dot" aria-hidden />
          Tiempo real · cada 5 s
        </span>
        {updatedAt != null && (
          <span className="chart-updated">
            Última actualización: {new Date(updatedAt).toLocaleTimeString()}
          </span>
        )}
        <span>
          {readings.length} lectura{readings.length === 1 ? '' : 's'} ·{' '}
          <a href="https://evilcharts.com" className="evilcharts-credit" target="_blank" rel="noreferrer">
            EvilCharts
          </a>
        </span>
      </p>
      <EvilTelemetryLineChart
        title="Frecuencia cardíaca"
        data={data}
        config={heartConfig}
        series={['heartRateBpm', 'restingHeartRateBpm']}
      />
      <EvilTelemetryLineChart
        title="HRV y SpO₂"
        data={data}
        config={hrvConfig}
        series={['hrvMs', 'spO2Percent']}
      />
      <EvilTelemetryLineChart
        title="Estrés y temperatura cutánea"
        data={data}
        config={stressConfig}
        series={['stressScore', 'skinTempCelsius']}
      />
      <EvilTelemetryLineChart
        title="Actividad y sueño"
        data={data}
        config={activityConfig}
        series={['stepsToday', 'sleepHoursLastNight']}
      />
      <EvilTelemetryLineChart
        title="Contexto de misión"
        data={data}
        config={missionConfig}
        series={['isolationIndex', 'radiationDoseMilliSvProxy']}
      />
    </div>
  )
}
