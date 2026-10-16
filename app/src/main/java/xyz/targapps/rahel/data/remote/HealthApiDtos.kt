package xyz.targapps.rahel.data.remote

/**
 * JSON contract for the RaHel health backend.
 *
 * **Profile** — baseline crew snapshot (POST /profile).
 * **SensorReadingDto** — time-series vitals + mission context (batched).
 * **HealthAssessmentDto** — rule-engine output + per-condition alerts (batched).
 */
data class UserProfileSnapshotDto(
    val crewMemberId: String,
    val sexoBiologico: Int? = null,
    val imc: Float? = null,
    val pesoKg: Float? = null,
    val alturaM: Float? = null,
    val snapshotAtEpochMs: Long,
)

data class TelemetryBatchRequest(
    val crewMemberId: String,
    val clientBatchId: String,
    val readings: List<SensorReadingDto> = emptyList(),
    val assessments: List<HealthAssessmentDto> = emptyList(),
)

data class TelemetryBatchResponse(
    val acceptedReadings: Int = 0,
    val acceptedAssessments: Int = 0,
)

data class SensorReadingDto(
    val recordedAtEpochMs: Long,
    val heartRateBpm: Int,
    val restingHeartRateBpm: Int,
    val hrvMs: Int,
    val spO2Percent: Int,
    val stepsToday: Int,
    val sleepHoursLastNight: Float,
    val skinTempCelsius: Float,
    val stressScore: Int,
    val missionDay: Int,
    val microgravity: Boolean,
    val isolationIndex: Float,
    val radiationDoseMilliSvProxy: Float,
    val selfReportedSymptoms: List<SymptomDto> = emptyList(),
)

data class SymptomDto(
    val id: String,
    val label: String,
    val severity: String,
)

data class HealthAssessmentDto(
    val assessedAtEpochMs: Long,
    val overallLevel: String,
    val headline: String,
    val disclaimer: String,
    val conditions: List<ConditionAssessmentDto>,
)

data class ConditionAssessmentDto(
    val conditionId: String,
    val title: String,
    val category: String,
    val summary: String,
    val confidence: Float,
    val severity: String,
    val symptoms: List<SymptomDto>,
    val recommendedActions: List<RecommendedActionDto>,
)

data class RecommendedActionDto(
    val id: String,
    val title: String,
    val detail: String,
)
