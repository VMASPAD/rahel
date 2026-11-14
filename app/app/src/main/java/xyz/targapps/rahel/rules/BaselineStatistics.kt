package xyz.targapps.rahel.rules

import xyz.targapps.rahel.domain.AstronautBaselineVector
import xyz.targapps.rahel.domain.MetricBaseline
import xyz.targapps.rahel.domain.PhysiologicalMetric
import kotlin.math.max

/**
 * Derives μ_base / σ_base for real-time metrics from the static x vector and datos.md R_base weights.
 */
object BaselineStatistics {
    data class DynamicBaselines(
        val restingHeartRate: MetricBaseline,
        val heartRate: MetricBaseline,
        val hrv7d: MetricBaseline,
        val spO2: MetricBaseline,
        val skinTemperature: MetricBaseline,
    )

    fun dynamicBaselines(vector: AstronautBaselineVector): DynamicBaselines {
        val muHr = vector.restingHeartRateBpm.toDouble()
        val sigmaHr = max(
            SpaceHealthThresholds.SIGMA_HR_MIN,
            muHr * SpaceHealthThresholds.SIGMA_HR_FRACTION,
        )
        val muHrv = vector.hrvBaselineMs.toDouble()
        val sigmaHrv = max(
            SpaceHealthThresholds.SIGMA_HRV_MIN,
            muHrv * SpaceHealthThresholds.SIGMA_HRV_FRACTION,
        )
        return DynamicBaselines(
            restingHeartRate = MetricBaseline(muHr, sigmaHr),
            heartRate = MetricBaseline(muHr + 8.0, sigmaHr),
            hrv7d = MetricBaseline(muHrv, sigmaHrv),
            spO2 = MetricBaseline(97.0, SpaceHealthThresholds.SIGMA_SPO2),
            skinTemperature = MetricBaseline(36.4, SpaceHealthThresholds.SIGMA_SKIN_TEMP),
        )
    }

    fun baselineFor(metric: PhysiologicalMetric, baselines: DynamicBaselines): MetricBaseline =
        when (metric) {
            PhysiologicalMetric.RESTING_HEART_RATE -> baselines.restingHeartRate
            PhysiologicalMetric.HEART_RATE -> baselines.heartRate
            PhysiologicalMetric.HRV_7D_MEAN -> baselines.hrv7d
            PhysiologicalMetric.SPO2 -> baselines.spO2
            PhysiologicalMetric.SKIN_TEMPERATURE -> baselines.skinTemperature
        }

    /**
     * R_base = Wᵀx (datos.md §5.2) — demo weights; higher ⇒ more baseline susceptibility.
     */
    fun baseRiskIndex(vector: AstronautBaselineVector): Float {
        val w = floatArrayOf(
            0.02f, // x₁ age
            0.15f, // x₂ sex
            0.12f, // x₃ bmi
            0.35f, // x₄ genetic
            0.08f, // x₅ medical bitmask (scaled)
            0.40f, // x₆ syncope
            0.10f, // x₇ medication
            0.05f, // x₈ resting HR
            0.07f, // x₉ MAP (pa_reposo_base)
            -0.08f, // x₁₀ HRV (higher HRV mitigates)
            -0.06f, // x₁₁ activity
        )
        val x = vector.asFeatureList()
        var sum = 0f
        for (i in w.indices) {
            sum += w[i] * x[i]
        }
        return sum
    }
}
