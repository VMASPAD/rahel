import { Link } from 'react-router-dom'
import { usePageMeta } from '../lib/usePageMeta'
import { useCallback, useEffect, useState } from 'react'
import { CrewList } from '../components/CrewList'
import { VitalSummary } from '../components/VitalSummary'
import { AssessmentPanel } from '../components/AssessmentPanel'
import { useCrewDashboard } from '../hooks/useCrewDashboard'
import { useCrewReadings } from '../hooks/useCrewReadings'
import { TelemetryCharts } from '../components/TelemetryCharts'
import { AuthPanel } from '../components/AuthPanel'
import { LinkWatchPanel } from '../components/LinkWatchPanel'
import { UNAUTHORIZED_EVENT } from '../api/client'
import { authApi, getStoredToken, setStoredToken, type AuthUser, type DeviceSummary } from '../api/auth'
import '../App.css'

const SESSION_POLL_MS = 10_000

export default function AppPage() {
  usePageMeta({ title: 'Panel de tripulación', noindex: true })
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [user, setUser] = useState<AuthUser | null>(null)
  const [devices, setDevices] = useState<DeviceSummary[]>([])
  const [authLoading, setAuthLoading] = useState(Boolean(getStoredToken()))

  const pairedCrewIds = devices.map((d) => d.crewMemberId)
  const { crew, selectedId, detail, loading, error, refresh, selectCrew } =
    useCrewDashboard(pairedCrewIds)
  const {
    readings,
    loading: readingsLoading,
    error: readingsError,
    reload: reloadReadings,
    updatedAt: readingsUpdatedAt,
  } = useCrewReadings(selectedId)

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
    const onUnauthorized = () => logout()
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  })

  function logout() {
    setStoredToken(null)
    setToken(null)
    setUser(null)
    setDevices([])
  }

  if (authLoading) {
    return (
      <main className="page">
        <p className="muted">Cargando sesión…</p>
      </main>
    )
  }

  if (!token || !user) {
    return (
      <main className="page">
        <header className="header">
          <p className="eyebrow">Mission control · RaHel</p>
          <h1>Cuenta</h1>
        </header>
        <AuthPanel
          onAuthenticated={(t, u) => {
            setToken(t)
            setUser(u)
            void loadSession(t)
          }}
        />
      </main>
    )
  }

  return (
    <main className="page">
      <header className="header">
        <p className="eyebrow">
          <Link to="/" className="linkish">← RaHel</Link> · Panel · <Link to="/app/analitica" className="linkish">Analítica de sensores</Link>
        </p>
        <h1>Tripulación</h1>
        <p className="lead">
          Sesión: {user.email}
          <button type="button" className="linkish logout" onClick={logout}>
            Salir
          </button>
        </p>
        <button
          type="button"
          className="refresh"
          onClick={() => {
            void refresh()
            void reloadReadings()
          }}
        >
          Actualizar
        </button>
      </header>

      <LinkWatchPanel
        token={token}
        devices={devices}
        onLinked={() => void loadSession(token)}
      />

      {loading && crew.length === 0 && <p className="muted">Cargando tripulación…</p>}
      {error && (
        <p className="warn">
          {error}. Inicia el backend: <code>cd backend && npm run dev</code> (puerto 8080).
        </p>
      )}

      {!error && (
        <div className="grid">
          <section className="card">
            <h2>Crew</h2>
            <CrewList crew={crew} selectedId={selectedId} onSelect={(id) => void selectCrew(id)} />
          </section>
          <section className="card">
            <h2>Vitals · {selectedId ?? '—'}</h2>
            <VitalSummary reading={detail?.latestReading ?? null} />
          </section>
          <section className="card wide">
            <h2>Evaluación</h2>
            <AssessmentPanel assessment={detail?.latestAssessment ?? null} />
          </section>
          <section className="card wide">
            <h2>Historial del reloj · {selectedId ?? '—'}</h2>
            <TelemetryCharts
              crewMemberId={selectedId}
              readings={readings}
              loading={readingsLoading}
              error={readingsError}
              updatedAt={readingsUpdatedAt}
            />
          </section>
        </div>
      )}
    </main>
  )
}

