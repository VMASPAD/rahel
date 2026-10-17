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
  heartRateBpm: number;
  restingHeartRateBpm: number;
  hrvMs: number;
  spO2Percent: number;
  stepsToday: number;
  sleepHoursLastNight: number;
  skinTempCelsius: number;
  stressScore: number;
  missionDay: number;
  microgravity: boolean;
  isolationIndex: number;
  radiationDoseMilliSvProxy: number;
  selfReportedSymptoms: SymptomDto[];
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
