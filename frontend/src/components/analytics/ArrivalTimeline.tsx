import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TimelineData } from '../../api/analytics'
import { fmtDuration } from './format'

type Row = { label: string; t: number; readings: number; gap: number; rejected: number }

function toRows(data: TimelineData): { rows: Row[]; gapBuckets: number; max: number } {
  const first = data.buckets.findIndex((b) => b.readings > 0)
  const max = Math.max(1, ...data.buckets.map((b) => b.readings))
  let gapBuckets = 0
  const rows = data.buckets.map((b, i) => {
    const isGap = first >= 0 && i >= first && b.readings === 0
    if (isGap) gapBuckets++
    const d = new Date(b.t)
    return {
      t: b.t,
      label: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      readings: b.readings,
      gap: isGap ? max : 0,
      rejected: b.batchesRejected,
    }
  })
  return { rows, gapBuckets, max }
}

export function ArrivalTimeline({ data }: { data: TimelineData }) {
  const { rows, gapBuckets } = toRows(data)
  const total = rows.reduce((a, r) => a + r.readings, 0)
  const summary =
    total === 0
      ? 'No readings in this period.'
      : `${total} readings in ${data.hours} h; ${gapBuckets} ${fmtDuration(data.bucketMs)} interval${gapBuckets === 1 ? '' : 's'} without data.`
  return (
    <div>
      <div role="img" aria-label={`Readings arriving per interval. ${summary}`} className="an-chart">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={1}>
            <CartesianGrid stroke="rgba(94,224,160,0.12)" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#8fb9a3"
              tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
              interval="preserveStartEnd"
              minTickGap={32}
            />
            <YAxis
              stroke="#8fb9a3"
              tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(94,224,160,0.08)' }}
              contentStyle={{
                background: '#04281A',
                border: '1px solid #1c5a3d',
                borderRadius: 8,
                fontFamily: 'IBM Plex Mono, monospace',
                fontSize: 12,
              }}
              labelStyle={{ color: '#5EE0A0' }}
              formatter={(value, name) => {
                if (name === 'gap') return ['no data', 'Gap']
                return [String(value), name === 'readings' ? 'Readings' : 'Rejected batches']
              }}
            />
            <Bar dataKey="readings" stackId="a" fill="#5EE0A0" isAnimationActive={false} />
            <Bar dataKey="gap" stackId="a" fill="#FFE5E7" fillOpacity={0.22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="an-legend">
        <span className="an-dot an-dot--live" aria-hidden="true" /> Readings per{' '}
        {fmtDuration(data.bucketMs)}
        <span className="an-dot an-dot--gap" aria-hidden="true" /> Gap (no readings since the first one received)
      </p>
      <p className="an-sr">{summary}</p>
    </div>
  )
}
