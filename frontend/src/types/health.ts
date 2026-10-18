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

export type EstimateInfo = {
  method: string
  confidence: 'low' | 'medium'
  sampleCount: number
}

export type EstimatedField = 'hrvMs' | 'restingHeartRateBpm' | 'sleepHoursLastNight' | 'stressScore'

export type SensorReadingDto = {
  estimates?: Partial<Record<EstimatedField, EstimateInfo>>
  recordedAtEpochMs: number
  heartRateBpm: number | null
  restingHeartRateBpm: number | null
  hrvMs: number | null
  spO2Percent: number | null
  stepsToday: number | null
  sleepHoursLastNight: number | null
  skinTempCelsius: number | null
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
