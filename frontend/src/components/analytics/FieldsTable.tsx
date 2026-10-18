import type { FieldReport, Quality, Recommendation } from '../../api/analytics'
import { fmtNum, fullDate, relTime } from './format'
import { qualityLabel, recommendationLabel } from './labels'

/** Mission-context and sensor fields RaHel does not work with are not listed. */
const OUT_OF_SCOPE_FIELDS = new Set([
  'missionDay',
  'microgravity',
  'isolationIndex',
  'radiationDoseMilliSvProxy',
  'skinTempCelsius',
  'spO2Percent',
])

const QUALITY_ICON: Record<Quality, string> = { medido: '●', estimado: '◐', 'no recibido': '○' }
const REC_ICON: Record<Recommendation, string> = {
  mantener: '✓',
  'usar con cautela': '!',
  'candidato a descartar': '✕',
  'requiere sensor': '＋',
}

export function QualityBadge({ q }: { q: Quality }) {
  return (
    <span className="an-badge" data-q={q}>
      <span aria-hidden="true">{QUALITY_ICON[q]}</span> {qualityLabel(q)}
    </span>
  )
}

export function FieldsTable({ fields, windowHours }: { fields: FieldReport[]; windowHours: number }) {
  return (
    <div className="an-tablewrap" tabIndex={0} role="region" aria-label="Received fields table">
      <table className="an-table">
        <caption className="an-sr">
          Reading fields received from the watch in the last {windowHours} hours, with coverage, quality and
          recommendation.
        </caption>
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Coverage</th>
            <th scope="col">Quality</th>
            <th scope="col" className="an-num">
              Measured / estimated
            </th>
            <th scope="col">Range</th>
            <th scope="col">Last seen</th>
            <th scope="col">Recommendation</th>
          </tr>
        </thead>
        <tbody>
          {fields.filter((f) => !OUT_OF_SCOPE_FIELDS.has(f.key)).map((f) => (
            <tr key={f.key}>
              <th scope="row">
                <span className="an-fname">{f.label}</span>
                <code className="an-key">{f.key}</code>
              </th>
              <td>
                <div
                  className="an-bar"
                  role="img"
                  aria-label={`Coverage ${f.coveragePct}%`}
                  data-q={f.quality}
                >
                  <span style={{ width: `${Math.min(100, f.coveragePct)}%` }} />
                </div>
                <span className="an-mono an-pct">{f.coveragePct}%</span>
              </td>
              <td>
                <QualityBadge q={f.quality} />
              </td>
              <td className="an-num an-mono">
                {f.measuredCount.toLocaleString('en-US')} / {f.estimatedCount.toLocaleString('en-US')}
              </td>
              <td className="an-mono an-range">
                {f.nonNull === 0 ? (
                  '--'
                ) : (
                  <>
                    {fmtNum(f.min)}–{fmtNum(f.max)}
                    <small>
                      μ {fmtNum(f.mean)} · σ {fmtNum(f.std)}
                    </small>
                  </>
                )}
              </td>
              <td className="an-mono" title={fullDate(f.lastSeenAt)}>
                {relTime(f.lastSeenAt)}
              </td>
              <td className="an-rec-cell">
                <span className="an-rec" data-r={f.recommendation}>
                  <span aria-hidden="true">{REC_ICON[f.recommendation]}</span> {recommendationLabel(f.recommendation)}
                </span>
                <p className="an-reason">{f.reason}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
