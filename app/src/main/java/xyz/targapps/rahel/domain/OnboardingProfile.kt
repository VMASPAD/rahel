package xyz.targapps.rahel.domain

/**
 * Fields collected during onboarding (subset of x₁–x₁₁ in datos.md).
 * Unanswered items fall back to [AstronautBaselineDefaults].
 */
data class OnboardingProfileInput(
    val biologicalSex: BiologicalSex,
    val weightKg: Float,
    val heightCm: Float,
    val ageYears: Float? = null,
    val geneticCardiacRisk: Boolean = false,
    val medicalHistoryFlags: Set<MedicalHistoryFlag> = emptySet(),
    val syncopeHistory: Boolean = false,
    val activeMedication: Boolean = false,
    val restingHeartRateBpm: Float? = null,
    val systolicBpMmHg: Float? = null,
    val diastolicBpMmHg: Float? = null,
    val hrvBaselineMs: Float? = null,
    val weeklyExerciseLevel: WeeklyExerciseLevel? = null,
)

enum class BiologicalSex(val encoded: Int) {
    FEMALE(0),
    MALE(1),
}

enum class MedicalHistoryFlag {
    HYPERTENSION,
    ARRHYTHMIA,
    CHOLESTEROL,
}

/** x₁₁ ordinal: weekly exercise hours band. */
enum class WeeklyExerciseLevel(val encoded: Int) {
    UNDER_3H(1),
    THREE_TO_6H(2),
    OVER_6H(3),
}

/**
 * Static baseline vector **x** ∈ ℝ¹¹ from datos.md / PrimerVersionNASA Part I.
 */
data class AstronautBaselineVector(
    val ageYears: Float,
    val biologicalSex: BiologicalSex,
    val bmi: Float,
    val geneticCardiacRisk: Int,
    val medicalHistoryBitmask: Int,
    val syncopeHistory: Int,
    val activeMedication: Int,
    val restingHeartRateBpm: Float,
    val systolicBpMmHg: Float,
    val diastolicBpMmHg: Float,
    val hrvBaselineMs: Float,
    val weeklyExerciseLevel: Int,
) {
    /** datos.md x₉ — scalar encoding of habitual BP pair (MAP mmHg). */
    fun meanArterialPressureMmHg(): Float =
        (systolicBpMmHg + 2f * diastolicBpMmHg) / 3f

    fun asFeatureList(): List<Float> = listOf(
        ageYears,
        biologicalSex.encoded.toFloat(),
        bmi,
        geneticCardiacRisk.toFloat(),
        medicalHistoryBitmask.toFloat(),
        syncopeHistory.toFloat(),
        activeMedication.toFloat(),
        restingHeartRateBpm,
        meanArterialPressureMmHg(),
        hrvBaselineMs,
        weeklyExerciseLevel.toFloat(),
    )

    companion object {
        fun bmiFrom(weightKg: Float, heightCm: Float): Float {
            val heightM = heightCm / 100f
            require(heightM > 0f && weightKg > 0f) { "weight and height must be positive" }
            return weightKg / (heightM * heightM)
        }
    }
}

object AstronautBaselineDefaults {
    const val DEFAULT_AGE_YEARS = 38f
    const val DEFAULT_RESTING_HR_FEMALE = 68f
    const val DEFAULT_RESTING_HR_MALE = 62f
    const val DEFAULT_SYSTOLIC_BP = 120f
    const val DEFAULT_DIASTOLIC_BP = 80f
    const val DEFAULT_HRV_MS = 45f
    val DEFAULT_EXERCISE_LEVEL = WeeklyExerciseLevel.THREE_TO_6H
}

object BaselineProfileMapper {
    fun fromOnboarding(input: OnboardingProfileInput): AstronautBaselineVector {
        val bmi = AstronautBaselineVector.bmiFrom(input.weightKg, input.heightCm)
        val defaultHr = when (input.biologicalSex) {
            BiologicalSex.FEMALE -> AstronautBaselineDefaults.DEFAULT_RESTING_HR_FEMALE
            BiologicalSex.MALE -> AstronautBaselineDefaults.DEFAULT_RESTING_HR_MALE
        }
        val bitmask = input.medicalHistoryFlags.fold(0) { acc, flag ->
            acc or (1 shl flag.ordinal)
        }
        return AstronautBaselineVector(
            ageYears = input.ageYears ?: AstronautBaselineDefaults.DEFAULT_AGE_YEARS,
            biologicalSex = input.biologicalSex,
            bmi = bmi,
            geneticCardiacRisk = if (input.geneticCardiacRisk) 1 else 0,
            medicalHistoryBitmask = bitmask,
            syncopeHistory = if (input.syncopeHistory) 1 else 0,
            activeMedication = if (input.activeMedication) 1 else 0,
            restingHeartRateBpm = input.restingHeartRateBpm ?: defaultHr,
            systolicBpMmHg = input.systolicBpMmHg ?: AstronautBaselineDefaults.DEFAULT_SYSTOLIC_BP,
            diastolicBpMmHg = input.diastolicBpMmHg ?: AstronautBaselineDefaults.DEFAULT_DIASTOLIC_BP,
            hrvBaselineMs = input.hrvBaselineMs ?: AstronautBaselineDefaults.DEFAULT_HRV_MS,
            weeklyExerciseLevel = (input.weeklyExerciseLevel ?: AstronautBaselineDefaults.DEFAULT_EXERCISE_LEVEL).encoded,
        )
    }
}
