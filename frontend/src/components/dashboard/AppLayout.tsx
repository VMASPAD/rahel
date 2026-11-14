import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AuthPanel } from '../AuthPanel'
import { UNAUTHORIZED_EVENT } from '../../api/client'
import { authApi, getStoredToken, setStoredToken, type AuthUser, type DeviceSummary } from '../../api/auth'
import { AppBaseContext, AppSessionContext } from './appSession'
import { Shell } from './Shell'
import '../../App.css'

const SESSION_POLL_MS = 10_000
const REAL_BASE = { base: '/app', demo: false } as const

/** Shared layout for /app, /app/analitica and /app/analisis: session, login and navigation. */
export default function AppLayout() {
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [user, setUser] = useState<AuthUser | null>(null)
  const [devices, setDevices] = useState<DeviceSummary[]>([])
  const [authLoading, setAuthLoading] = useState(Boolean(getStoredToken()))
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null)

  const loadSession = useCallback(async (t: string, silent = false) => {
    if (!silent) setAuthLoading(true)
    try {
      const me = await authApi.me(t)
      setUser(me.user)
      setDevices(me.devices)
      setToken(t)
    } catch {
      if (!silent) {
        setStoredToken(null)
        setToken(null)
        setUser(null)
        setDevices([])
      }
    } finally {
      if (!silent) setAuthLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setStoredToken(null)
    setToken(null)
    setUser(null)
    setDevices([])
  }, [])

  useEffect(() => {
    const t = getStoredToken()
    if (t) void loadSession(t)
    else setAuthLoading(false)
  }, [loadSession])

  useEffect(() => {
    if (!token) return
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadSession(token, true)
    }, SESSION_POLL_MS)
    return () => window.clearInterval(timer)
  }, [token, loadSession])

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout)
  }, [logout])

  const session = useMemo(
    () =>
      token && user
        ? { token, user, devices, headerSlot, logout, reloadSession: () => loadSession(token) }
        : null,
    [token, user, devices, headerSlot, logout, loadSession],
  )

  if (authLoading) {
    return (
      <div className="dx dx-splash" role="status" aria-live="polite">
        <img src="/logo.svg" alt="" width="48" height="48" />
        <p>Loading your session…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <AuthPanel
        onAuthenticated={(t, u) => {
          setToken(t)
          setUser(u)
          void loadSession(t)
        }}
      />
    )
  }

  return (
    <AppBaseContext.Provider value={REAL_BASE}>
      <AppSessionContext.Provider value={session}>
        <Shell email={session.user.email} onLogout={logout} headerRef={setHeaderSlot}>
          <Suspense fallback={<p className="dx-sub" role="status">Loading…</p>}>
            <Outlet />
          </Suspense>
        </Shell>
      </AppSessionContext.Provider>
    </AppBaseContext.Provider>
  )
}
