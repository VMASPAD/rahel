import type { FieldReport, Quality, Recommendation } from '../../api/analytics'
import { fmtNum, fullDate, relTime } from './format'

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
      <span aria-hidden="true">{QUALITY_ICON[q]}</span> {q}
    </span>
  )
}

export function FieldsTable({ fields, windowHours }: { fields: FieldReport[]; windowHours: number }) {
  return (
    <div className="an-tablewrap" tabIndex={0} role="region" aria-label="Tabla de campos recibidos">
      <table className="an-table">
        <caption className="an-sr">
          Campos de lectura recibidos del reloj en las últimas {windowHours} horas, con cobertura, calidad y
          recomendación.
        </caption>
        <thead>
          <tr>
            <th scope="col">Campo</th>
            <th scope="col">Cobertura</th>
            <th scope="col">Calidad</th>
            <th scope="col" className="an-num">
              Medidos / estimados
            </th>
            <th scope="col">Rango</th>
            <th scope="col">Visto</th>
            <th scope="col">Recomendación</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.key}>
              <th scope="row">
                <span className="an-fname">{f.label}</span>
                <code className="an-key">{f.key}</code>
              </th>
              <td>
                <div
                  className="an-bar"
                  role="img"
                  aria-label={`Cobertura ${f.coveragePct}%`}
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
                {f.measuredCount.toLocaleString('es')} / {f.estimatedCount.toLocaleString('es')}
              </td>
              <td className="an-mono an-range">
                {f.nonNull === 0 ? (
                  '—'
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
                  <span aria-hidden="true">{REC_ICON[f.recommendation]}</span> {f.recommendation}
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
