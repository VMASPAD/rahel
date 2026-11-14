import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { analysisApi, AnalysisApiError, type Catalog, type Run, type RunSummary } from '../api/analysis'
import { analyticsApi, type DeviceAnalytics } from '../api/analytics'
import { getStoredToken } from '../api/auth'
import { PageHeader } from '../components/dashboard/PageHeader'
import { ReportHeader, ResultCard, WINDOW_LABEL } from '../components/analysis/ReportCards'
import { usePageMeta } from '../lib/usePageMeta'
import { useAppBase } from '../components/dashboard/appSession'
import '../components/analytics/analytics.css'
import '../components/analysis/analysis.css'

const ACTIVE = new Set(['queued', 'running'])

function startError(e: unknown): string {
  if (!(e instanceof AnalysisApiError)) return 'We could not reach the server. Please try again in a few seconds.'
  switch (e.code) {
    case 'insufficient_data':
      return 'There is still little data in this period. Try a longer period or wait for your watch to sync.'
    case 'too_many_requests':
      return 'You have run several analyses in a row. Take a short break: you can run another one in a little while.'
    case 'analysis_not_configured':
      return 'Analysis is ready to be switched on: the Jev key still needs to be added on the server.'
    case 'analysis_in_progress':
      return 'You already have an analysis running; we opened it so you can follow its progress.'
    case 'consent_required':
      return 'Check the consent box to continue.'
    default:
      return 'We could not start the analysis this time. Please try again.'
  }
}

export default function Analysis() {
  usePageMeta({ title: 'Analysis', noindex: true })
  const { base } = useAppBase()
  const hasToken = Boolean(getStoredToken())
  const devId = useId()
  const winId = useId()

  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [catalogErr, setCatalogErr] = useState(false)
  const [devices, setDevices] = useState<DeviceAnalytics[] | null>(null)
  const [deviceId, setDeviceId] = useState('')
  const [hours, setHours] = useState(168)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [history, setHistory] = useState<RunSummary[]>([])
  const [histLoaded, setHistLoaded] = useState(false)
  const [current, setCurrent] = useState<Run | null>(null)
  const [pollErr, setPollErr] = useState(false)
  const reportRef = useRef<HTMLElement>(null)

  const loadHistory = useCallback(async () => {
    try {
      setHistory((await analysisApi.list()).items)
    } catch {
      /* el historial es secundario */
    } finally {
      setHistLoaded(true)
    }
  }, [])

  const openRun = useCallback(async (id: string) => {
    try {
      setCurrent(await analysisApi.get(id))
      setPollErr(false)
    } catch {
      setMsg('We could not open that report.')
    }
  }, [])

  // carga inicial
  useEffect(() => {
    if (!hasToken) return
    const ac = new AbortController()
    analysisApi.catalog(ac.signal).then(setCatalog).catch(() => !ac.signal.aborted && setCatalogErr(true))
    analyticsApi
      .devices(ac.signal)
      .then((d) => {
        setDevices(d)
        if (d[0]) setDeviceId((cur) => cur || d[0].deviceId)
      })
      .catch(() => !ac.signal.aborted && setDevices([]))
    analysisApi
      .list(undefined, ac.signal)
      .then((r) => {
        setHistory(r.items)
        setHistLoaded(true)
        const active = r.items.find((x) => ACTIVE.has(x.status))
        if (active) void openRun(active.id)
      })
      .catch(() => setHistLoaded(true))
    return () => ac.abort()
  }, [hasToken, openRun])

  // sondeo mientras haya una ejecución en curso
  const currentId = current?.id
  const active = current ? ACTIVE.has(current.status) : false
  useEffect(() => {
    if (!currentId || !active) return
    let stop = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const r = await analysisApi.get(currentId)
        if (stop) return
        setCurrent(r)
        setPollErr(false)
        if (!ACTIVE.has(r.status)) {
          void loadHistory()
          reportRef.current?.focus()
          return
        }
      } catch {
        if (!stop) setPollErr(true)
      }
      if (!stop) timer = setTimeout(tick, 2500)
    }
    timer = setTimeout(tick, 1500)
    return () => {
      stop = true
      clearTimeout(timer)
    }
  }, [currentId, active, loadHistory])

  async function launch() {
    if (!consent || !deviceId || busy) return
    setBusy(true)
    setMsg(null)
    try {
      const { id } = await analysisApi.start(deviceId, hours)
      await openRun(id)
      void loadHistory()
    } catch (e) {
      setMsg(startError(e))
      if (e instanceof AnalysisApiError && e.code === 'analysis_in_progress' && e.runId) void openRun(e.runId)
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this report? It is removed from our database for good.')) return
    try {
      await analysisApi.remove(id)
      setHistory((h) => h.filter((x) => x.id !== id))
      setCurrent((c) => (c?.id === id ? null : c))
    } catch {
      setMsg('We could not delete the report. Please try again.')
    }
  }

  if (!hasToken) {
    return (
      <div className="an-page ay-embed">
        <div className="an-wrap">
          <h2 className="an-title">Analysis powered by Jev</h2>
          <p className="an-empty">
            Sign in to analyze your watch data.{' '}
            <Link to={base} className="an-link">Go to the dashboard and sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  const notConfigured = catalog !== null && !catalog.configured
  const items = catalog?.items ?? []
  const noDevices = devices !== null && devices.length === 0
  const canRun = consent && Boolean(deviceId) && !busy && !active && !notConfigured && catalog !== null
  const prog = current?.results?.progress

  return (
    <div className="an-page ay-embed">
      <PageHeader title="Analysis" subtitle="Powered by Jev" />
      <div className="an-wrap">
        <header className="an-head">
          <h1 className="an-title">Analysis powered by Jev</h1>
          <p className="an-lead">
            Pick a watch and a period: we summarize your data and you get a wellness report with all the answers at
            once. RaHel is a wellness tool, not a medical device.
          </p>
          <section className="ay-how" aria-labelledby="ay-how">
            <h2 id="ay-how">How it works</h2>
            <ul>
              <li>Only an aggregated summary of your data is sent, never names, emails or watch identifiers.</li>
              <li>It is not real time: nothing runs until you press the button.</li>
              <li>You decide when to run it, and you can delete any report at any time.</li>
            </ul>
          </section>
        </header>

        {notConfigured && (
          <div className="ay-note ay-note--hint" role="status">
            <strong>Analysis is ready to be switched on.</strong>{' '}
            As soon as the Jev connection is added on the server, you can run your first report right here.
            Meanwhile, your dashboard and analytics keep working as usual.
          </div>
        )}
        {catalogErr && (
          <p className="an-error" role="alert">We could not load the analysis catalog. Reload the page in a few seconds.</p>
        )}

        <section className="ay-panel" aria-labelledby="ay-new">
          <h2 id="ay-new">New analysis</h2>
          <p className="an-sub">Optional and one-off: every run needs your consent.</p>

          {noDevices ? (
            <p className="an-empty">
              No watch is linked yet. Link one from the <Link to={base} className="an-link">dashboard</Link> to
              analyze it.
            </p>
          ) : (
            <>
              <div className="ay-form">
                <label className="an-field" htmlFor={devId}>
                  <span>Watch</span>
                  <select id={devId} value={deviceId} onChange={(e) => setDeviceId(e.target.value)} disabled={!devices}>
                    {(devices ?? []).map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.crewMemberId} · {d.deviceId.slice(0, 8)}…
                      </option>
                    ))}
                  </select>
                </label>
                <label className="an-field" htmlFor={winId}>
                  <span>Period</span>
                  <select id={winId} value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                    {Object.entries(WINDOW_LABEL).map(([h, l]) => (
                      <option key={h} value={h}>{l}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="ay-sends" aria-label="What will be sent">
                <div>
                  <h3>What is sent</h3>
                  <ul>
                    <li>Aggregated statistics for the period: heart rate by part of the day, steps, trends</li>
                    <li>Episode counts and data coverage</li>
                    <li>Estimates already computed by RaHel (resting, stress, rest)</li>
                  </ul>
                </div>
                <div>
                  <h3>What is NOT sent</h3>
                  <ul>
                    <li>Your email, name or watch identifiers</li>
                    <li>Second-by-second readings or exact dates</li>
                    <li>Your password or location</li>
                  </ul>
                </div>
              </div>

              <label className="ay-consent">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  I agree to send this aggregated, identifier-free summary to Jev (TypeSafe AI), which processes it on
                  behalf of RaHel to generate this report. It is optional and applies to this run only; I can delete
                  the report whenever I want.
                </span>
              </label>

              <div className="ay-actions">
                <button type="button" className="an-btn" onClick={launch} disabled={!canRun} aria-busy={busy}>
                  {busy ? 'Starting…' : active ? 'Analysis in progress…' : 'Run analysis'}
                </button>
                {!consent && !notConfigured && <span className="an-sub">Check the consent box to continue.</span>}
              </div>
              {msg && <p className="ay-msg" role="alert">{msg}</p>}
            </>
          )}
        </section>

        {current && (
          <section ref={reportRef} tabIndex={-1} aria-label="Report" aria-busy={active}>
            <ReportHeader run={current} />
            {active && (
              <div className="ay-panel" role="status" style={{ marginTop: 0, marginBottom: 12 }}>
                <strong>Analyzing your data…</strong>
                <div className="ay-progress" aria-hidden>
                  <span style={{ width: `${prog ? ((prog.done + prog.failed) / Math.max(1, prog.total)) * 100 : 5}%` }} />
                </div>
                <p className="an-sub" style={{ margin: 0 }}>
                  {prog ? `${prog.done + prog.failed} of ${prog.total} questions answered` : 'Getting ready…'}
                  {pollErr ? ' · reconnecting…' : ''}
                </p>
              </div>
            )}
            {current.status === 'error' && !prog?.done && (
              <p className="an-error" role="alert">
                We could not get answers this time. Your data is safe: try again in a few minutes.
              </p>
            )}
            <div className="ay-grid">
              {items.map((it) => (
                <ResultCard key={it.id} item={it} result={current.results?.questions[it.id]} />
              ))}
            </div>
            <p className="ay-disclaimer">
              {catalog?.disclaimer ?? current.disclaimer} If something worries you, talk to a health professional.
            </p>
          </section>
        )}

        <section className="an-section" aria-labelledby="ay-hist">
          <header className="an-sechead">
            <h2 id="ay-hist">Previous reports</h2>
            <p className="an-sub">Saved to your account until you delete them.</p>
          </header>
          {!histLoaded ? (
            <p className="an-empty" role="status">Loading…</p>
          ) : history.length === 0 ? (
            <p className="an-empty">You have not generated a report yet. Your first one is waiting above.</p>
          ) : (
            <ul className="ay-history">
              {history.map((h) => (
                <li key={h.id} data-current={current?.id === h.id}>
                  <span>
                    <strong>{WINDOW_LABEL[h.windowHours] ?? `${h.windowHours} h`}</strong>{' '}
                    <span className="an-sub">
                      · {new Date(h.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
                      {h.status === 'done' ? 'completed' : h.status === 'error' ? 'no answers' : 'in progress'}
                    </span>
                  </span>
                  <span className="ay-h-actions">
                    <button type="button" className="ay-btn-ghost" onClick={() => openRun(h.id)}>Open</button>
                    {!ACTIVE.has(h.status) && (
                      <button type="button" className="ay-btn-ghost" onClick={() => remove(h.id)}>Delete</button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
