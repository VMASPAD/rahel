import type { CrewSummaryDto } from '../types/health'
import { AlertBadge } from './AlertBadge'
import './dashboard.css'

type Props = {
  crew: CrewSummaryDto[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function CrewList({ crew, selectedId, onSelect }: Props) {
  return (
    <ul className="crew-list">
      {crew.map((c) => (
        <li key={c.crewMemberId}>
          <button
            type="button"
            className={c.crewMemberId === selectedId ? 'crew-btn active' : 'crew-btn'}
            onClick={() => onSelect(c.crewMemberId)}
          >
            <span className="crew-id">{c.crewMemberId}</span>
            <AlertBadge level={c.overallLevel} />
          </button>
          {c.headline && <p className="crew-headline">{c.headline}</p>}
        </li>
      ))}
    </ul>
  )
}
