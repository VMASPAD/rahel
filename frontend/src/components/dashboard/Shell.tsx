import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ChartLine, FlaskConical, LayoutDashboard, LogOut, ScanSearch } from 'lucide-react'
import { useAppBase } from './appSession'

const NAV = [
  { path: '', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/analytics', label: 'Analytics', icon: ChartLine, end: false },
  { path: '/analysis', label: 'Analysis', icon: ScanSearch, end: false },
] as const

type Props = {
  email: string
  onLogout: () => void
  headerRef: (el: HTMLElement | null) => void
  children: ReactNode
  /** Banner permanente (solo modo demo). */
  banner?: ReactNode
}

export function Shell({ email, onLogout, headerRef, children, banner }: Props) {
  const { base, demo } = useAppBase()
  const tabCount = NAV.length + 1 + (demo ? 0 : 1)
  return (
    <div className={demo ? 'dx dx-shell dx-shell--demo' : 'dx dx-shell'}>
      {banner}
      <a className="dx-skip" href="#dx-main">Skip to content</a>

      <aside className="dx-side" aria-label="Main navigation">
        <Link to="/" className="dx-brand" aria-label="RaHel, go to home">
          <img src="/logo.svg" alt="" width="32" height="32" />
          <span>RaHel</span>
        </Link>
        <nav className="dx-nav">
          {NAV.map(({ path, label, icon: Icon, end }) => (
            <NavLink key={path} to={base + path} end={end} className="dx-nav-link">
              <Icon size={18} aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
          {!demo && (
            <NavLink to="/demo" className="dx-nav-link dx-nav-link--demo">
              <FlaskConical size={18} aria-hidden />
              <span>Demo mode</span>
            </NavLink>
          )}
        </nav>
        <div className="dx-side-foot">
          <div className="dx-user" title={email}>
            <span className="dx-avatar dx-avatar--sm" aria-hidden>{email.slice(0, 1).toUpperCase()}</span>
            <span className="dx-user-mail">{email}</span>
          </div>
          <button type="button" className="dx-btn dx-btn--ghost dx-btn--block" onClick={onLogout}>
            <LogOut size={16} aria-hidden /> {demo ? 'Exit demo' : 'Sign out'}
          </button>
        </div>
      </aside>

      <div className="dx-body">
        <header className="dx-top">
          <Link to="/" className="dx-brand dx-brand--top" aria-label="RaHel, go to home">
            <img src="/logo.svg" alt="" width="28" height="28" />
          </Link>
          <div className="dx-top-slot" ref={headerRef} />
        </header>

        <main id="dx-main" className="dx-main" tabIndex={-1}>
          {children}
        </main>
      </div>

      <nav
        className="dx-tabbar"
        aria-label="Mobile navigation"
        style={{ gridTemplateColumns: `repeat(${tabCount}, 1fr)` }}
      >
        {NAV.map(({ path, label, icon: Icon, end }) => (
          <NavLink key={path} to={base + path} end={end} className="dx-tab">
            <Icon size={20} aria-hidden />
            <span>{label}</span>
          </NavLink>
        ))}
        {!demo && (
          <NavLink to="/demo" className="dx-tab">
            <FlaskConical size={20} aria-hidden />
            <span>Demo</span>
          </NavLink>
        )}
        <button type="button" className="dx-tab" onClick={onLogout}>
          <LogOut size={20} aria-hidden />
          <span>{demo ? 'Exit demo' : 'Sign out'}</span>
        </button>
      </nav>
    </div>
  )
}
