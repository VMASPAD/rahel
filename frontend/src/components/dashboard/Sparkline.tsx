import { useId } from 'react'

type Props = {
  values: (number | null | undefined)[]
  color?: string
  width?: number
  height?: number
  label: string
}

/** Lightweight SVG sparkline (no dependencies). Skips gaps. */
export function Sparkline({ values, color = '#5EE0A0', width = 120, height = 36, label }: Props) {
  const id = useId()
  const pts = values.filter((v): v is number => v != null && Number.isFinite(v))
  if (pts.length < 2) {
    return (
      <svg className="dx-spark dx-spark--empty" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}: no trend yet`}>
        <line x1="0" x2={width} y1={height - 3} y2={height - 3} stroke="currentColor" strokeDasharray="2 4" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const pad = 3
  const step = (width - pad * 2) / (pts.length - 1)
  const xy = pts.map((v, i) => [pad + i * step, pad + (1 - (v - min) / span) * (height - pad * 2)] as const)
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)} ${height} L${xy[0][0].toFixed(1)} ${height} Z`
  const [lx, ly] = xy[xy.length - 1]
  return (
    <svg className="dx-spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} trend`}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.6" fill={color} />
    </svg>
  )
}
