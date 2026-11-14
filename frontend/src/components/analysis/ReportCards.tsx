import type { CatalogItem, QuestionResult, Run } from '../../api/analysis'

export const WINDOW_LABEL: Record<number, string> = {
  24: 'Last 24 hours',
  168: 'Last 7 days',
  720: 'Last 30 days',
}

const CHOICE_LABEL: Record<string, string> = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  high: 'High',
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Early evening',
  unclear: 'Unclear',
  improving: 'Improving',
  stable: 'Steady',
  worsening: 'More load',
}

function confidenceLabel(c: number | null): string | null {
  if (c == null) return null
  return c >= 0.75 ? 'high' : c >= 0.5 ? 'medium' : 'low'
}

type Ok = Extract<QuestionResult, { status: 'ok' }>

function Meter({ r }: { r: Ok }) {
  const v = Number(r.value)
  const levels = r.levels ?? 5
  return (
    <div
      className="ay-meter"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={v}
      aria-valuetext={`Level ${(r.level ?? 0) + 1} of ${levels}`}
    >
      <div className="ay-meter-track">
        {Array.from({ length: levels }, (_, i) => (
          <span key={i} className="ay-meter-seg" data-on={i <= (r.level ?? 0)} />
        ))}
      </div>
      <p className="ay-big an-mono">
        {Math.round(v * 100)}
        <span className="an-unit"> / 100</span>
      </p>
    </div>
  )
}

function Prob({ r }: { r: Ok }) {
  const p = Number(r.value)
  return (
    <div className="ay-prob">
      <div className="ay-prob-bar" role="img" aria-label={`Likelihood of yes: ${Math.round(p * 100)}%`}>
        <span style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
      <p className="ay-big an-mono">
        {Math.round(p * 100)}
        <span className="an-unit"> % likely</span>
      </p>
    </div>
  )
}

function ChoiceChip({ r }: { r: Ok }) {
  const v = String(r.value)
  return (
    <div>
      <span className="ay-chip">{CHOICE_LABEL[v] ?? v}</span>
    </div>
  )
}

export function ResultCard({ item, result }: { item: CatalogItem; result: QuestionResult | undefined }) {
  const conf = result?.status === 'ok' ? confidenceLabel(result.confidence) : null
  return (
    <article className="ay-card" data-state={result?.status ?? 'pending'} aria-busy={result?.status === 'pending'}>
      <header>
        <h3>{item.title}</h3>
        <span className="ay-kind an-mono">{item.kind}</span>
      </header>
      {!result || result.status === 'pending' ? (
        <div className="ay-skel" role="status">
          <span className="ay-spin" aria-hidden /> Analyzing…
        </div>
      ) : result.status === 'error' ? (
        <p className="ay-retry">
          This question did not finish this time. Run the analysis again to retry it.
        </p>
      ) : (
        <>
          {result.kind === 'score' && <Meter r={result} />}
          {result.kind === 'noul' && <Prob r={result} />}
          {result.kind === 'choice' && <ChoiceChip r={result} />}
          <p className="ay-reading">{result.reading}</p>
          {conf && <p className="ay-conf an-sub">Confidence: {conf}</p>}
        </>
      )}
      <footer className="an-sub">{item.description}</footer>
    </article>
  )
}

export function ReportHeader({ run }: { run: Run }) {
  const p = run.results?.progress
  const when = new Date(run.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <header className="ay-report-head">
      <div>
        <p className="ay-eyebrow an-mono">{WINDOW_LABEL[run.windowHours] ?? `${run.windowHours} h`} · {when}</p>
        <h2>{run.status === 'error' ? 'No answers this time' : run.results?.headline ?? 'Analyzing your data…'}</h2>
        {p && (
          <p className="an-sub">
            {p.done} of {p.total} analyses completed{p.failed > 0 ? ` · ${p.failed} to retry` : ''}
            {run.results?.model ? ` · model ${run.results.model}` : ''}
          </p>
        )}
      </div>
    </header>
  )
}
