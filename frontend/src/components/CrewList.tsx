import { Users } from 'lucide-react'
import type { CrewSummaryDto } from '../types/health'
import { AlertBadge } from './AlertBadge'
import { hueOf, initialsOf } from './dashboard/format'
import { RelTime } from './dashboard/RelTime'
import './dashboard.css'

type Props = {
  crew: CrewSummaryDto[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function CrewList({ crew, selectedId, onSelect }: Props) {
  if (crew.length === 0) {
    return (
      <div className="dx-empty dx-empty--inline">
        <span className="dx-empty-ico" aria-hidden><Users size={22} /></span>
        <p>Once you link a watch, the crew member will show up here.</p>
      </div>
    )
  }
  return (
    <ul className="crew-list">
      {crew.map((c) => {
        const active = c.crewMemberId === selectedId
        return (
          <li key={c.crewMemberId}>
            <button
              type="button"
              className={active ? 'crew-btn active' : 'crew-btn'}
              aria-pressed={active}
              onClick={() => onSelect(c.crewMemberId)}
            >
              <span
                className="dx-avatar"
                aria-hidden
                style={{ ['--h' as string]: hueOf(c.crewMemberId) }}
              >
                {initialsOf(c.crewMemberId)}
              </span>
              <span className="crew-main">
                <span className="crew-id">{c.crewMemberId}</span>
                <span className="crew-headline">
                  {c.headline ?? <span className="dx-dash">--</span>}
                </span>
                <span className="crew-last">
                  Last reading <RelTime at={c.latestReadingAtEpochMs} />
                </span>
              </span>
              <AlertBadge level={c.overallLevel} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
