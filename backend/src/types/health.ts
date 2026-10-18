/** Mirrors app/.../HealthApiDtos.kt */

export type UserProfileSnapshotDto = {
  crewMemberId: string;
  sexoBiologico?: number | null;
  imc?: number | null;
  pesoKg?: number | null;
  alturaM?: number | null;
  snapshotAtEpochMs: number;
};

export type SymptomDto = {
  id: string;
  label: string;
  severity: string;
};

export type SensorReadingDto = {
  recordedAtEpochMs: number;
  heartRateBpm?: number | null;
  restingHeartRateBpm?: number | null;
  hrvMs?: number | null;
  spO2Percent?: number | null;
  stepsToday?: number | null;
  sleepHoursLastNight?: number | null;
  skinTempCelsius?: number | null;
  stressScore?: number | null;
  missionDay?: number | null;
  microgravity?: boolean | null;
  isolationIndex?: number | null;
  radiationDoseMilliSvProxy?: number | null;
  selfReportedSymptoms: SymptomDto[];
  /** Read-time only (never stored): present for fields filled by backend estimation. */
  estimates?: {
    hrvMs?: EstimateDto;
    restingHeartRateBpm?: EstimateDto;
    sleepHoursLastNight?: EstimateDto;
    stressScore?: EstimateDto;
  };
};

export type EstimateDto = {
  method: string;
  confidence: "low" | "medium";
  sampleCount: number;
};

export type RecommendedActionDto = {
  id: string;
  title: string;
  detail: string;
};

export type ConditionAssessmentDto = {
  conditionId: string;
  title: string;
  category: string;
  summary: string;
  confidence: number;
  severity: string;
  symptoms: SymptomDto[];
  recommendedActions: RecommendedActionDto[];
};

export type HealthAssessmentDto = {
  assessedAtEpochMs: number;
  overallLevel: string;
  headline: string;
  disclaimer: string;
  conditions: ConditionAssessmentDto[];
};

export type TelemetryBatchRequest = {
  crewMemberId: string;
  clientBatchId: string;
  appVersion?: string | null;
  readings: SensorReadingDto[];
  assessments: HealthAssessmentDto[];
};

export type TelemetryBatchResponse = {
  acceptedReadings: number;
  acceptedAssessments: number;
};

export type CrewSummaryDto = {
  crewMemberId: string;
  profileUpdatedAtEpochMs: number | null;
  latestReadingAtEpochMs: number | null;
  overallLevel: string | null;
  headline: string | null;
};

export type CrewLatestDto = {
  crewMemberId: string;
  profile: UserProfileSnapshotDto | null;
  latestReading: SensorReadingDto | null;
  latestAssessment: HealthAssessmentDto | null;
};
