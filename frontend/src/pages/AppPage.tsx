import { WifiOff } from 'lucide-react'
import { usePageMeta } from '../lib/usePageMeta'
import { useState } from 'react'
import { CrewList } from '../components/CrewList'
import { VitalSummary } from '../components/VitalSummary'
import { AssessmentPanel } from '../components/AssessmentPanel'
import { useCrewDashboard } from '../hooks/useCrewDashboard'
import { useCrewReadings } from '../hooks/useCrewReadings'
import { TelemetryCharts } from '../components/TelemetryCharts'
import { Card } from '../components/dashboard/Card'
import { KpiCards } from '../components/dashboard/KpiCards'
import { PageHeader } from '../components/dashboard/PageHeader'
import { useAppSession } from '../components/dashboard/appSession'
import { Skeleton } from '../components/dashboard/Skeleton'
import { StatusBar } from '../components/dashboard/StatusBar'
import { LinkWatchPanel } from '../components/LinkWatchPanel'

export default function AppPage() {
  usePageMeta({ title: 'Crew dashboard', noindex: true })
  const { token, devices, reloadSession } = useAppSession()
  const [spinning, setSpinning] = useState(false)

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

  const onboarding = devices.length === 0 && crew.length === 0 && !loading
  const refreshing = spinning || loading || readingsLoading
  const hasTitleId = selectedId != null

  return (
    <>
      <PageHeader
        title="Crew dashboard"
        subtitle={hasTitleId ? <>Showing <strong>{selectedId}</strong></> : 'Link a watch to get started'}
        status={<StatusBar error={error} updatedAt={readingsUpdatedAt} />}
        refreshing={refreshing}
        onRefresh={() => {
          setSpinning(true)
          window.setTimeout(() => setSpinning(false), 700)
          void refresh()
          void reloadReadings()
        }}
      />
      {error && (
        <div className="dx-banner" role="alert">
          <WifiOff size={18} aria-hidden />
          <div>
            <strong>We could not reach the server.</strong>
            <span> We keep trying every few seconds, or you can retry now.</span>
          </div>
          <button type="button" className="dx-btn dx-btn--soft dx-btn--sm" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}

      <KpiCards
        reading={detail?.latestReading ?? null}
        assessment={detail?.latestAssessment ?? null}
        history={readings}
        loading={loading && crew.length === 0 && !error}
      />

      <div className={onboarding ? 'dx-grid dx-grid--onboard' : 'dx-grid'}>
        <Card title="Crew" area="crew" index={5} note={crew.length ? `${crew.length}` : undefined}>
          {loading && crew.length === 0 && !error ? (
            <div className="dx-stack" aria-busy="true"><Skeleton h={64} r={12} /><Skeleton h={64} r={12} /></div>
          ) : (
            <CrewList crew={crew} selectedId={selectedId} onSelect={(id) => void selectCrew(id)} />
          )}
        </Card>
        <Card title="Vital signs" area="vitals" index={6} note={selectedId ?? undefined}>
          {loading && !detail && !error ? (
            <div className="dx-stack" aria-busy="true"><Skeleton h={44} r={10} /><Skeleton h={44} r={10} /><Skeleton h={44} r={10} /></div>
          ) : (
            <VitalSummary reading={detail?.latestReading ?? null} />
          )}
        </Card>
        <Card title="Assessment" area="assess" index={7}>
          <AssessmentPanel assessment={detail?.latestAssessment ?? null} />
        </Card>
        <Card title="Your watch" area="link" index={onboarding ? 5 : 8}>
          <LinkWatchPanel token={token} devices={devices} onLinked={() => void reloadSession()} />
        </Card>
        <Card title="Watch history" area="charts" index={9} note={selectedId ?? undefined}>
          <TelemetryCharts
            crewMemberId={selectedId}
            readings={readings}
            loading={readingsLoading}
            error={readingsError}
            updatedAt={readingsUpdatedAt}
            onRetry={() => void reloadReadings()}
          />
        </Card>
      </div>
    </>
  )
}
