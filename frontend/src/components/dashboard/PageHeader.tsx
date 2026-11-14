import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw } from 'lucide-react'
import { useAppSession } from './appSession'

type Props = {
  title: string
  subtitle?: ReactNode
  status?: ReactNode
  onRefresh?: () => void
  refreshing?: boolean
}

/** Renders the page title, status and refresh button into the shared top bar. */
export function PageHeader({ title, subtitle, status, onRefresh, refreshing = false }: Props) {
  const { headerSlot } = useAppSession()
  if (!headerSlot) return null
  return createPortal(
    <>
      <div className="dx-top-title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="dx-top-actions">
        {status}
        {onRefresh && (
          <button
            type="button"
            className="dx-btn dx-btn--soft"
            onClick={onRefresh}
            aria-label="Refresh data"
            aria-busy={refreshing}
          >
            <RefreshCw size={16} aria-hidden className={refreshing ? 'dx-spin' : undefined} />
            <span className="dx-hide-sm">Refresh</span>
          </button>
        )}
      </div>
    </>,
    headerSlot,
  )
}
