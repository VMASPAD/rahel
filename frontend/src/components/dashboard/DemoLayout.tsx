import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { setDemoMode } from '../../api/auth'
import { DEMO_TOKEN, DEMO_USER, installDemoFetch, resetDemo } from '../../demo'
import { AppBaseContext, AppSessionContext } from './appSession'
import { DemoBanner } from './DemoBanner'
import { Shell } from './Shell'
import '../../App.css'

const DEMO_BASE = { base: '/demo', demo: true } as const

/** Mismo panel que /app, atendido por el fetch simulado: sin red, sin cuenta y sin IA. */
export default function DemoLayout() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null)
  const [epoch, setEpoch] = useState(0)

  // Los efectos de los hijos corren antes que los del padre: no se renderizan hasta instalar el fetch.
  useEffect(() => {
    const uninstall: unknown = installDemoFetch()
    setDemoMode(true, DEMO_TOKEN)
    setReady(true)
    return () => {
      setReady(false)
      setDemoMode(false)
      if (typeof uninstall === 'function') uninstall()
    }
  }, [])

  const exit = useCallback(() => navigate('/'), [navigate])
  const reset = useCallback(() => {
    resetDemo()
    setEpoch((n) => n + 1)
  }, [])

  const session = useMemo(
    () => ({
      token: DEMO_TOKEN,
      user: DEMO_USER,
      devices: [],
      headerSlot,
      logout: exit,
      reloadSession: async () => {},
    }),
    [headerSlot, exit],
  )

  return (
    <AppBaseContext.Provider value={DEMO_BASE}>
      <AppSessionContext.Provider value={session}>
        <Shell
          email={DEMO_USER.email}
          onLogout={exit}
          headerRef={setHeaderSlot}
          banner={<DemoBanner onExit={exit} onReset={reset} />}
        >
          {ready && (
            <Suspense fallback={<p className="dx-sub" role="status">Loading…</p>}>
              <Outlet key={epoch} />
            </Suspense>
          )}
        </Shell>
      </AppSessionContext.Provider>
    </AppBaseContext.Provider>
  )
}
