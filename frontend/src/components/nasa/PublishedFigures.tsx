/**
 * Bar chart of the figures PUBLISHED in Buxton, West, Kalogera & Hanson (2016),
 * https://ntrs.nasa.gov/citations/20150021215 . These are the numbers printed in the report's
 * abstract, not raw data. Rendered as an accessible list: every bar has its value as text.
 */
type Row = { id: string; kind: 'chest' | 'optical'; pct: number }

// Verified against the NTRS abstract (see the record). Do not edit without re-checking the source.
const ROWS: Row[] = [
  { id: 'CS1', kind: 'chest', pct: 1.6 },
  { id: 'CS4', kind: 'chest', pct: 3.3 },
  { id: 'CS3', kind: 'chest', pct: 6.4 },
  { id: 'CS2', kind: 'chest', pct: 9.2 },
  { id: 'OS1', kind: 'optical', pct: 10.4 },
  { id: 'OS2', kind: 'optical', pct: 14.9 },
]
const AXIS_MAX = 16

const GROUPS = [
  { kind: 'chest', title: 'Electrode chest straps' },
  { kind: 'optical', title: 'Optical sensors' },
] as const

export default function PublishedFigures() {
  return (
    <figure className="ns-fig" aria-labelledby="ns-fig-cap">
      <figcaption id="ns-fig-cap" className="ns-fig-head">
        <span className="ns-tag">Values published in the report</span>
        <strong>Share of samples more than ±5 bpm from a 12-lead ECG</strong>
      </figcaption>

      {GROUPS.map((g) => (
        <div key={g.kind} className="ns-fig-group" role="group" aria-label={g.title}>
          <p className="ns-fig-group-title">{g.title}</p>
          <ul className="ns-bars">
            {ROWS.filter((r) => r.kind === g.kind).map((r) => (
              <li key={r.id}>
                <span className="ns-bar-id">{r.id}</span>
                <span className="ns-bar-track" aria-hidden="true">
                  <span className={`ns-bar ns-bar-${r.kind}`} style={{ width: `${(r.pct / AXIS_MAX) * 100}%` }} />
                </span>
                <span className="ns-bar-val">{r.pct.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="ns-fig-note">
        19 subjects, 30 treadmill and cycle sessions, each data set time-matched to the ECG. Lower is
        better. These are the figures printed in the report, not raw data.{' '}
        <a href="https://ntrs.nasa.gov/citations/20150021215" target="_blank" rel="noreferrer noopener">
          Buxton et al., 2016 (NASA NTRS)
        </a>
      </p>
    </figure>
  )
}
