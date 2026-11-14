import { CircleCheck, ClipboardList } from 'lucide-react'
import type { HealthAssessmentDto } from '../types/health'
import { AlertBadge } from './AlertBadge'
import './dashboard.css'

export function AssessmentPanel({ assessment }: { assessment: HealthAssessmentDto | null }) {
  if (!assessment) {
    return (
      <div className="dx-empty dx-empty--inline">
        <span className="dx-empty-ico" aria-hidden><ClipboardList size={22} /></span>
        <p>The assessment appears on its own once the watch has sent enough readings.</p>
      </div>
    )
  }
  return (
    <div className="assessment">
      <div className="assessment-head">
        <h3>{assessment.headline}</h3>
        <AlertBadge level={assessment.overallLevel} />
      </div>
      {assessment.conditions.length === 0 ? (
        <p className="assessment-ok">
          <CircleCheck size={16} aria-hidden /> All good: no active conditions.
        </p>
      ) : (
        <ul className="conditions">
          {assessment.conditions.map((c) => (
            <li key={c.conditionId}>
              <div className="cond-top">
                <strong>{c.title}</strong>
                <span className="cond-meta">{c.category} · {Math.round(c.confidence * 100)}%</span>
              </div>
              <p>{c.summary}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="disclaimer">{assessment.disclaimer}</p>
    </div>
  )
}
