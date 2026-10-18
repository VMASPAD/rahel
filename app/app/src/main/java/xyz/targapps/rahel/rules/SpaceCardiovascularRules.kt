package xyz.targapps.rahel.rules

import xyz.targapps.rahel.domain.AlertLevel
import xyz.targapps.rahel.domain.AstronautBaselineVector
import xyz.targapps.rahel.domain.HealthEventAlert
import xyz.targapps.rahel.domain.PhysiologicalMetric
import xyz.targapps.rahel.domain.ProcessedVitalsSnapshot
import xyz.targapps.rahel.domain.SpaceCardioEventId
import xyz.targapps.rahel.domain.ZScoreEvaluation

/**
 * Part I real-time rules (datos.md / PrimerVersionNASA §4).
 */
object SpaceCardiovascularRules {

    fun evaluate(
        baseline: AstronautBaselineVector,
        processed: ProcessedVitalsSnapshot,
        zScores: List<ZScoreEvaluation>,
        ecgAnomaly: Boolean,
        radiationFluxPfu: Double,
        co2Ppm: Int?,
        spo2Percent: Int,
        skinTempCelsius: Float,
    ): List<HealthEventAlert> = buildList {
        addAll(afibRule(processed, ecgAnomaly))
        addAll(radiationHrvRule(zScores, radiationFluxPfu))
        addAll(orthostaticRule(baseline, processed))
        addAll(circadianStressRule(processed, zScores, skinTempCelsius))
        addAll(co2StressRuleWithSpo2(baseline, processed, co2Ppm, spo2Percent))
    }

    private fun afibRule(processed: ProcessedVitalsSnapshot, ecgAnomaly: Boolean): List<HealthEventAlert> {
        if (!ecgAnomaly) return emptyList()
        if (processed.motionActive) return emptyList()
        if (processed.hrRestingSmoothedBpm <= SpaceHealthThresholds.AFIB_RESTING_HR_BPM) return emptyList()
        return listOf(
            HealthEventAlert(
                eventId = SpaceCardioEventId.POSSIBLE_AFIB,
                level = AlertLevel.WATCH,
                title = "Possible atrial fibrillation",
                message = "Possible atrial fibrillation detected at rest.",
                suggestedAction =
                    "Rest reclined at 30–45°, avoid unsupervised Valsalva, send a manual 60 s ECG to the flight surgeon.",
            ),
        )
    }

    private fun radiationHrvRule(
        zScores: List<ZScoreEvaluation>,
        radiationFluxPfu: Double,
    ): List<HealthEventAlert> {
        val zHrv = zScores.find { it.metric == PhysiologicalMetric.HRV_7D_MEAN }
            ?.zScore
            ?: return emptyList()
        if (zHrv >= SpaceHealthThresholds.RADIATION_HRV_Z_TRIGGER) return emptyList()
        if (radiationFluxPfu <= SpaceHealthThresholds.RADIATION_FLUX_PFU_TRIGGER) return emptyList()
        return listOf(
            HealthEventAlert(
                eventId = SpaceCardioEventId.RADIATION_HRV_RESPONSE,
                level = AlertLevel.ELEVATED,
                title = "HRV and solar radiation",
                message = "HRV drop consistent with a solar radiation event.",
                suggestedAction =
                    "Check module shielding, suspend non-essential EVAs, log hydration with the medical officer.",
            ),
        )
    }

    private fun orthostaticRule(
        baseline: AstronautBaselineVector,
        processed: ProcessedVitalsSnapshot,
    ): List<HealthEventAlert> {
        val azThreshold = if (baseline.syncopeHistory == 1) {
            SpaceHealthThresholds.ORTHOSTATIC_DELTA_AZ_SENSITIZED_MPS2
        } else {
            SpaceHealthThresholds.ORTHOSTATIC_DELTA_AZ_MPS2
        }
        if (processed.deltaAzMps2 <= azThreshold) return emptyList()
        if (processed.deltaHeartRate5sBpm >= SpaceHealthThresholds.ORTHOSTATIC_DELTA_HR_5S_MAX) return emptyList()
        if (processed.deltaSpO2Percent >= SpaceHealthThresholds.ORTHOSTATIC_DELTA_SPO2_MAX) return emptyList()
        return listOf(
            HealthEventAlert(
                eventId = SpaceCardioEventId.ORTHOSTATIC_SYNCOPE_RISK,
                level = AlertLevel.ELEVATED,
                title = "Orthostatic risk",
                message = "Risk of orthostatic fainting. Hold on to the handrails.",
                suggestedAction =
                    "Hold on to restraints, do isometric leg contractions, adjust compression garments.",
                triggerHaptic = true,
            ),
        )
    }

    private fun circadianStressRule(
        processed: ProcessedVitalsSnapshot,
        zScores: List<ZScoreEvaluation>,
        skinTempCelsius: Float,
    ): List<HealthEventAlert> {
        val zHrv = zScores.find { it.metric == PhysiologicalMetric.HRV_7D_MEAN }
            ?.zScore
            ?: return emptyList()
        if (skinTempCelsius <= SpaceHealthThresholds.CIRCADIAN_SKIN_TEMP_C) return emptyList()
        if (processed.nocturnalMotionScore <= SpaceHealthThresholds.CIRCADIAN_NOCTURNAL_MOTION_THRESHOLD) {
            return emptyList()
        }
        if (zHrv >= SpaceHealthThresholds.CIRCADIAN_HRV_Z_TRIGGER) return emptyList()
        return listOf(
            HealthEventAlert(
                eventId = SpaceCardioEventId.CIRCADIAN_STRESS,
                level = AlertLevel.WATCH,
                title = "Circadian stress",
                message = "Fragmented sleep pattern and thermal stress.",
                suggestedAction =
                    "10 min guided relaxation/breathing, switch cabin lighting to red spectrum.",
            ),
        )
    }

    fun co2StressRuleWithSpo2(
        baseline: AstronautBaselineVector,
        processed: ProcessedVitalsSnapshot,
        co2Ppm: Int?,
        spo2Percent: Int,
    ): List<HealthEventAlert> {
        val ppm = co2Ppm ?: return emptyList()
        if (ppm <= SpaceHealthThresholds.CO2_PPM_TRIGGER) return emptyList()
        if (spo2Percent >= SpaceHealthThresholds.CO2_SPO2_PERCENT_MAX) return emptyList()
        val hrThreshold = baseline.restingHeartRateBpm * SpaceHealthThresholds.CO2_HR_BASELINE_MULTIPLIER
        if (processed.hrRestingSmoothedBpm <= hrThreshold) return emptyList()
        return listOf(
            HealthEventAlert(
                eventId = SpaceCardioEventId.CO2_RESPIRATORY_STRESS,
                level = AlertLevel.ELEVATED,
                title = "CO₂ respiratory stress",
                message = "CO₂ buildup in your area.",
                suggestedAction =
                    "Move to another module, turn on forced ventilation, re-measure SpO₂ in 5 minutes.",
                triggerHaptic = true,
            ),
        )
    }
}
