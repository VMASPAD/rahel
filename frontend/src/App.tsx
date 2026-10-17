import { CrewList } from './components/CrewList'
import { VitalSummary } from './components/VitalSummary'
import { AssessmentPanel } from './components/AssessmentPanel'
import { useCrewDashboard } from './hooks/useCrewDashboard'
import './App.css'

function App() {
  const { crew, selectedId, detail, loading, error, refresh, selectCrew } = useCrewDashboard()

  return (
    <main className="page">
      <header className="header">
        <p className="eyebrow">Mission control · RaHel</p>
        <h1>Tripulación</h1>
        <p className="lead">
          Telemetría y evaluaciones enviadas desde el reloj Wear OS.
        </p>
        <button type="button" className="refresh" onClick={() => void refresh()}>
          Actualizar
        </button>
      </header>

      {loading && <p className="muted">Cargando…</p>}
      {error && (
        <p className="warn">
          {error}. Inicia el backend: <code>cd backend && npm run dev</code> (puerto 8080).
        </p>
      )}

      {!loading && !error && (
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
        </div>
      )}
    </main>
  )
}

export default App
