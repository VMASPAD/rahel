package xyz.targapps.rahel.domain

import java.time.Instant

enum class NasaRiskCategory {
    IMMUNE,
    BONE,
    CARDIO,
    BEHAVIORAL,
    RADIATION_PROXY,
}

enum class AlertLevel {
    NOMINAL,
    WATCH,
    ELEVATED,
    CRITICAL,
}

enum class SymptomSeverity {
    MILD,
    MODERATE,
    SEVERE,
}

data class VitalSigns(
    val heartRateBpm: Int,
    val restingHeartRateBpm: Int,
    val hrvMs: Int,
    val spO2Percent: Int,
    val stepsToday: Int,
    val sleepHoursLastNight: Float,
    val skinTempCelsius: Float,
    val stressScore: Int,
)

data class MissionContext(
    val missionDay: Int,
    val microgravity: Boolean = true,
    val isolationIndex: Float,
    val radiationDoseMilliSvProxy: Float,
)

data class Symptom(
    val id: String,
    val label: String,
    val severity: SymptomSeverity,
)

data class HealthSnapshot(
    val timestamp: Instant,
    val crewMemberId: String,
    val vitals: VitalSigns,
    val mission: MissionContext,
    val selfReportedSymptoms: List<Symptom> = emptyList(),
)

data class RecommendedAction(
    val id: String,
    val title: String,
    val detail: String,
)

data class ConditionAssessment(
    val conditionId: String,
    val title: String,
    val category: NasaRiskCategory,
    val summary: String,
    val confidence: Float,
    val severity: AlertLevel,
    val symptoms: List<Symptom>,
    val recommendedActions: List<RecommendedAction>,
)

data class AssessmentResult(
    val overallLevel: AlertLevel,
    val headline: String,
    val conditions: List<ConditionAssessment>,
    val disclaimer: String =
        "Prototipo educativo — no es diagnóstico médico. Consulte al médico de vuelo.",
)
