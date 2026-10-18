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

/** Real-time sensor fields aligned with datos.md dynamic variables. */
data class MissionDynamicVitals(
    val hrResting: Int? = null,
    val motion: Int = 0,
    val hrvMs: Int? = null,
    val spo2Pct: Int? = null,
    val deltaAz: Float = 0f,
    /** Latest accelerometer Z (m/s²) for orthostatic delta processing. */
    val accelZMps2: Float? = null,
    val ecgFlag: Boolean? = null,
    val activityLevel: ApproximateActivityLevel = ApproximateActivityLevel.STATIONARY,
    val stepsSession: Long = 0L,
    val offBody: Boolean? = null,
)

enum class ApproximateActivityLevel {
    STATIONARY,
    LIGHT,
    MODERATE,
    VIGOROUS,
}

data class MissionContext(
    val missionDay: Int,
    val microgravity: Boolean = true,
    val isolationIndex: Float,
    val radiationDoseMilliSvProxy: Float,
    /** api_crew_schedule: 0 = rest, 1 = work (PrimerVersionNASA Parts II–IV). */
    val crewScheduleWork: Int = 1,
    /** NASA DONKI-style proton flux (pfu); Part I Event 2. */
    val solarRadiationFluxPfu: Double? = null,
    /** Cabin CO₂ (ppm); Part I Event 5. */
    val cabinCo2Ppm: Int? = null,
    /** Part III — hours since last logged water intake. */
    val hoursSinceLastWaterIntake: Int = 0,
    val calciumConsumedMg: Int = 0,
    val calciumTargetMg: Int = 1200,
    val hoursSinceLastCalciumIntake: Int = 0,
    /** Part II / IV — night awakenings (accelerometer proxy in demo). */
    val nightAwakenings: Int = 0,
    /** Part II / IV — ambient light (lux). */
    val ambientLightLux: Float? = null,
    /** Part IV — minutes without significant motion. */
    val inactivityMinutes: Int = 0,
)

data class Symptom(
    val id: String,
    val label: String,
    val severity: SymptomSeverity,
)

/**
 * Measured values as the sensors reported them; `null` means "not measured" (never 0).
 * Used for telemetry upload. [VitalSigns] keeps non-null ints only for on-device rules/UI.
 */
data class SensorVitals(
    val heartRateBpm: Int? = null,
    val restingHeartRateBpm: Int? = null,
    val hrvMs: Int? = null,
    val spO2Percent: Int? = null,
    val stepsToday: Int? = null,
    val skinTempCelsius: Float? = null,
    /** true = on wrist, false = off wrist, null = unknown (no off-body sensor). */
    val onWrist: Boolean? = null,
    /** Real timestamp of the heart-rate sample (epoch ms); null when no HR sample yet. */
    val sampleAtEpochMs: Long? = null,
)

data class HealthSnapshot(
    val timestamp: Instant,
    val crewMemberId: String,
    val vitals: VitalSigns,
    val mission: MissionContext,
    val selfReportedSymptoms: List<Symptom> = emptyList(),
    val sensorVitals: SensorVitals? = null,
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
        "Educational prototype — not a medical diagnosis. Consult your flight surgeon.",
)

/** Z-score band per datos.md §3 (|Z| thresholds). */
enum class ZScoreBand {
    NORMAL,
    YELLOW,
    RED,
}

enum class PhysiologicalMetric {
    RESTING_HEART_RATE,
    HEART_RATE,
    HRV_7D_MEAN,
    SPO2,
    SKIN_TEMPERATURE,
}

data class MetricBaseline(
    val mu: Double,
    val sigma: Double,
)

data class ZScoreEvaluation(
    val metric: PhysiologicalMetric,
    val measured: Double,
    val muBase: Double,
    val sigmaBase: Double,
    val zScore: Double,
    val band: ZScoreBand,
)

/** Part I cardiovascular event identifiers (PrimerVersionNASA). */
enum class SpaceCardioEventId {
    POSSIBLE_AFIB,
    RADIATION_HRV_RESPONSE,
    ORTHOSTATIC_SYNCOPE_RISK,
    CIRCADIAN_STRESS,
    CO2_RESPIRATORY_STRESS,
    HYDRATION_REMINDER,
    CALCIUM_REMINDER,
    INACTIVITY_REMINDER,
    REST_LIGHT_DISRUPTION,
}

data class HealthEventAlert(
    val eventId: SpaceCardioEventId,
    val level: AlertLevel,
    val title: String,
    val message: String,
    val suggestedAction: String,
    val triggerHaptic: Boolean = false,
)

/**
 * Structured assessment for UI and API export (space cardiovascular module + legacy HRP rules).
 */
data class HealthAssessment(
    val timestamp: Instant,
    val crewMemberId: String,
    val baseRiskIndex: Float,
    val zScores: List<ZScoreEvaluation>,
    val eventAlerts: List<HealthEventAlert>,
    val processedVitals: ProcessedVitalsSnapshot,
    val legacyAssessment: AssessmentResult,
) {
    fun toApiPayload(): Map<String, Any?> = mapOf(
        "timestamp" to timestamp.toString(),
        "crewMemberId" to crewMemberId,
        "baseRiskIndex" to baseRiskIndex,
        "overallLevel" to legacyAssessment.overallLevel.name,
        "headline" to legacyAssessment.headline,
        "zScores" to zScores.map {
            mapOf(
                "metric" to it.metric.name,
                "measured" to it.measured,
                "muBase" to it.muBase,
                "sigmaBase" to it.sigmaBase,
                "z" to it.zScore,
                "band" to it.band.name,
            )
        },
        "events" to eventAlerts.map {
            mapOf(
                "id" to it.eventId.name,
                "level" to it.level.name,
                "title" to it.title,
                "message" to it.message,
                "action" to it.suggestedAction,
                "haptic" to it.triggerHaptic,
            )
        },
        "vitals" to mapOf(
            "hrRestingSmoothed" to processedVitals.hrRestingSmoothedBpm,
            "hrv7dMeanMs" to processedVitals.hrv7dMeanMs,
            "motion" to processedVitals.motionActive,
            "deltaAz" to processedVitals.deltaAzMps2,
            "deltaHr5s" to processedVitals.deltaHeartRate5sBpm,
            "deltaSpo2" to processedVitals.deltaSpO2Percent,
        ),
        "conditions" to legacyAssessment.conditions.map { c ->
            mapOf(
                "id" to c.conditionId,
                "severity" to c.severity.name,
                "title" to c.title,
                "category" to c.category.name,
            )
        },
    )
}

/** Output of [xyz.targapps.rahel.rules.SensorStreamProcessor]. */
data class ProcessedVitalsSnapshot(
    val hrRestingSmoothedBpm: Int,
    val hrv7dMeanMs: Int,
    val motionActive: Boolean,
    val deltaAzMps2: Float,
    val deltaHeartRate5sBpm: Int,
    val deltaSpO2Percent: Float,
    val nocturnalMotionScore: Float,
)

/** Single sensor tick for stream processing. */
data class SensorSample(
    val timestampMillis: Long,
    val heartRateBpm: Int?,
    val hrvMs: Int?,
    val spO2Percent: Int?,
    val accelZMps2: Float?,
    val skinTempCelsius: Float?,
    /** datos.md `motion` (0 = stationary, 1 = moving); overrides accel-derived motion when set. */
    val motion: Int? = null,
    /** datos.md `ecg_flag` when supplied by the ECG channel. */
    val ecgAnomaly: Boolean? = null,
    val isSleepWindow: Boolean = false,
)
