export type CrewSummaryDto = {
  crewMemberId: string
  profileUpdatedAtEpochMs: number | null
  latestReadingAtEpochMs: number | null
  overallLevel: string | null
  headline: string | null
}

export type SymptomDto = {
  id: string
  label: string
  severity: string
}

export type SensorReadingDto = {
  recordedAtEpochMs: number
  heartRateBpm: number
  restingHeartRateBpm: number
  hrvMs: number
  spO2Percent: number
  stepsToday: number
  sleepHoursLastNight: number
  skinTempCelsius: number
  stressScore: number
  missionDay: number
  microgravity: boolean
  isolationIndex: number
  radiationDoseMilliSvProxy: number
  selfReportedSymptoms: SymptomDto[]
}

export type ConditionAssessmentDto = {
  conditionId: string
  title: string
  category: string
  summary: string
  confidence: number
  severity: string
  symptoms: SymptomDto[]
  recommendedActions: { id: string; title: string; detail: string }[]
}

export type HealthAssessmentDto = {
  assessedAtEpochMs: number
  overallLevel: string
  headline: string
  disclaimer: string
  conditions: ConditionAssessmentDto[]
}

export type CrewLatestDto = {
  crewMemberId: string
  profile: {
    crewMemberId: string
    snapshotAtEpochMs: number
    imc?: number | null
    pesoKg?: number | null
  } | null
  latestReading: SensorReadingDto | null
  latestAssessment: HealthAssessmentDto | null
}
