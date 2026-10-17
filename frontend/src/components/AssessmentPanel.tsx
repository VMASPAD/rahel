import type { HealthAssessmentDto } from '../types/health'
import { AlertBadge } from './AlertBadge'
import './dashboard.css'

export function AssessmentPanel({ assessment }: { assessment: HealthAssessmentDto | null }) {
  if (!assessment) return <p className="muted">Sin evaluación.</p>
  return (
    <div className="assessment">
      <div className="assessment-head">
        <h3>{assessment.headline}</h3>
        <AlertBadge level={assessment.overallLevel} />
      </div>
      <p className="disclaimer">{assessment.disclaimer}</p>
      {assessment.conditions.length === 0 ? (
        <p className="muted">Sin condiciones activas.</p>
      ) : (
        <ul className="conditions">
          {assessment.conditions.map((c) => (
            <li key={c.conditionId}>
              <strong>{c.title}</strong>
              <span className="cond-meta">{c.category} · {Math.round(c.confidence * 100)}%</span>
              <p>{c.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
