import { useEffect, useRef } from 'react'
import { FlaskConical, LogOut, RotateCcw } from 'lucide-react'

type Props = { onExit: () => void; onReset: () => void }

/** Banner permanente del modo demo. Publica su alto en --dx-banner-h para los elementos sticky. */
export function DemoBanner({ onExit, onReset }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    const root = el?.closest<HTMLElement>('.dx')
    if (!el || !root) return
    const sync = () => root.style.setProperty('--dx-banner-h', `${el.offsetHeight}px`)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} className="dx-demo-banner" role="status">
      <p className="dx-demo-banner-text">
        <FlaskConical size={16} aria-hidden />
        <span>
          <strong>Demo mode</strong> — simulated data. No real watch, no account, and no AI is called.
        </span>
      </p>
      <div className="dx-demo-banner-actions">
        <button type="button" className="dx-btn dx-btn--ghost dx-demo-btn" onClick={onReset}>
          <RotateCcw size={14} aria-hidden /> Reset demo
        </button>
        <button type="button" className="dx-btn dx-demo-btn dx-demo-btn--exit" onClick={onExit}>
          <LogOut size={14} aria-hidden /> Exit demo
        </button>
      </div>
    </div>
  )
}
