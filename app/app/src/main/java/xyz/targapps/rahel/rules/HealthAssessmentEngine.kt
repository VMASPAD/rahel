package xyz.targapps.rahel.rules

import xyz.targapps.rahel.domain.AlertLevel
import xyz.targapps.rahel.domain.AssessmentResult
import xyz.targapps.rahel.domain.AstronautBaselineVector
import xyz.targapps.rahel.domain.BaselineProfileMapper
import xyz.targapps.rahel.domain.BiologicalSex
import xyz.targapps.rahel.domain.ConditionAssessment
import xyz.targapps.rahel.domain.HealthAssessment
import xyz.targapps.rahel.domain.HealthEventAlert
import xyz.targapps.rahel.domain.HealthSnapshot
import xyz.targapps.rahel.domain.MissionDynamicVitals
import xyz.targapps.rahel.domain.NasaRiskCategory
import xyz.targapps.rahel.domain.OnboardingProfileInput
import xyz.targapps.rahel.domain.PhysiologicalMetric
import xyz.targapps.rahel.domain.ProcessedVitalsSnapshot
import xyz.targapps.rahel.domain.RecommendedAction
import xyz.targapps.rahel.domain.SensorSample
import xyz.targapps.rahel.domain.SpaceCardioEventId
import xyz.targapps.rahel.domain.Symptom
import xyz.targapps.rahel.domain.SymptomSeverity
import xyz.targapps.rahel.domain.ZScoreBand
import xyz.targapps.rahel.domain.ZScoreEvaluation

/**
 * Rule-based assessment aligned with NASA HRP risk themes and datos.md cardiovascular module.
 * Threshold constants: [SpaceHealthThresholds]; citations: project docs/SOURCES.md.
 * Not for clinical use or flight certification.
 */
class HealthAssessmentEngine(
    private val ecgProvider: EcgAnomalyProvider = DefaultHealthProviders.ecg,
    private val radiationProvider: SolarRadiationFluxProvider = DefaultHealthProviders.radiation,
    private val co2Provider: CabinCo2Provider = DefaultHealthProviders.co2,
    private val crewScheduleProvider: CrewScheduleProvider = DefaultHealthProviders.crewSchedule,
    private val sensorProcessor: SensorStreamProcessor = SensorStreamProcessor(),
) {

    private var astronautBaseline: AstronautBaselineVector? = null
    private var wellnessReminderFlags = MissionWellnessRules.ReminderFlags()

    fun resetWellnessState() {
        wellnessReminderFlags = MissionWellnessRules.ReminderFlags()
    }

    fun setBaselineFromOnboarding(input: OnboardingProfileInput) {
        astronautBaseline = BaselineProfileMapper.fromOnboarding(input)
    }

    fun setBaselineVector(vector: AstronautBaselineVector) {
        astronautBaseline = vector
    }

    fun ingestSensorSample(sample: SensorSample): ProcessedVitalsSnapshot =
        sensorProcessor.ingest(sample)

    fun assess(current: HealthSnapshot, history: List<HealthSnapshot>): AssessmentResult =
        assessHealth(current, history).legacyAssessment

    fun assessHealth(
        current: HealthSnapshot,
        history: List<HealthSnapshot>,
        processedOverride: ProcessedVitalsSnapshot? = null,
        missionDynamics: MissionDynamicVitals? = null,
    ): HealthAssessment {
        val baseline = resolveBaseline(current)
        val dynamic = BaselineStatistics.dynamicBaselines(baseline)
        val v = current.vitals

        val processed = processedOverride ?: sensorProcessor.snapshotFromInstant(
            heartRateBpm = v.heartRateBpm,
            hrvMs = v.hrvMs,
            spO2Percent = v.spO2Percent,
            skinTempCelsius = v.skinTempCelsius,
            timestampMillis = current.timestamp.toEpochMilli(),
        )

        val hrvMeasured = if (processed.hrv7dMeanMs > 0) processed.hrv7dMeanMs else v.hrvMs
        val zScores = listOf(
            ZScoreEvaluator.evaluate(
                PhysiologicalMetric.RESTING_HEART_RATE,
                processed.hrRestingSmoothedBpm.toDouble(),
                dynamic.restingHeartRate,
            ),
            ZScoreEvaluator.evaluate(
                PhysiologicalMetric.HRV_7D_MEAN,
                hrvMeasured.toDouble(),
                dynamic.hrv7d,
            ),
            ZScoreEvaluator.evaluate(
                PhysiologicalMetric.SPO2,
                v.spO2Percent.toDouble(),
                dynamic.spO2,
            ),
            ZScoreEvaluator.evaluate(
                PhysiologicalMetric.SKIN_TEMPERATURE,
                v.skinTempCelsius.toDouble(),
                dynamic.skinTemperature,
            ),
        )

        val providerFlux = radiationProvider.protonFluxPfu()
        val radiationFlux = when {
            providerFlux > 0.0 -> providerFlux
            current.mission.solarRadiationFluxPfu != null -> current.mission.solarRadiationFluxPfu
            else -> 0.0
        }
        val co2Ppm = current.mission.cabinCo2Ppm ?: co2Provider.co2Ppm()
        val crewSchedule = current.mission.crewScheduleWork.takeIf { it in 0..1 }
            ?: crewScheduleProvider.crewScheduleWork()

        val ecgAnomaly = when (missionDynamics?.ecgFlag) {
            true -> true
            false -> false
            null -> ecgProvider.ecgAnomalyDetected()
        }

        val eventAlerts = SpaceCardiovascularRules.evaluate(
            baseline = baseline,
            processed = processed,
            zScores = zScores,
            ecgAnomaly = ecgAnomaly,
            radiationFluxPfu = radiationFlux,
            co2Ppm = co2Ppm,
            spo2Percent = v.spO2Percent,
            skinTempCelsius = v.skinTempCelsius,
        ) + MissionWellnessRules.evaluate(
            mission = current.mission.copy(crewScheduleWork = crewSchedule),
            vitals = v,
            flags = wellnessReminderFlags,
        )

        val legacyCore = buildLegacyAssessment(current, history)
        val merged = mergeSpaceIntoLegacy(legacyCore, zScores, eventAlerts)

        return HealthAssessment(
            timestamp = current.timestamp,
            crewMemberId = current.crewMemberId,
            baseRiskIndex = BaselineStatistics.baseRiskIndex(baseline),
            zScores = zScores,
            eventAlerts = eventAlerts,
            processedVitals = processed,
            legacyAssessment = merged,
        )
    }

    private fun resolveBaseline(current: HealthSnapshot): AstronautBaselineVector {
        return astronautBaseline ?: BaselineProfileMapper.fromOnboarding(
            OnboardingProfileInput(
                biologicalSex = BiologicalSex.MALE,
                weightKg = 75f,
                heightCm = 175f,
                restingHeartRateBpm = current.vitals.restingHeartRateBpm.toFloat(),
                hrvBaselineMs = current.vitals.hrvMs.toFloat(),
            ),
        )
    }

    private fun mergeSpaceIntoLegacy(
        legacy: AssessmentResult,
        zScores: List<ZScoreEvaluation>,
        events: List<HealthEventAlert>,
    ): AssessmentResult {
        val zConditions = zScores
            .filter { it.band != ZScoreBand.NORMAL }
            .map { z ->
                val severity = when (z.band) {
                    ZScoreBand.YELLOW -> AlertLevel.WATCH
                    ZScoreBand.RED -> AlertLevel.ELEVATED
                    ZScoreBand.NORMAL -> AlertLevel.NOMINAL
                }
                ConditionAssessment(
                    conditionId = "z_${z.metric.name.lowercase()}",
                    title = "Z deviation: ${z.metric.name}",
                    category = NasaRiskCategory.CARDIO,
                    summary = "Z=${"%.2f".format(z.zScore)} vs personal baseline (μ=${"%.1f".format(z.muBase)}, σ=${"%.1f".format(z.sigmaBase)}).",
                    confidence = 0.7f,
                    severity = severity,
                    symptoms = emptyList(),
                    recommendedActions = listOf(
                        RecommendedAction(
                            "trend",
                            "Follow-up",
                            "Log context (sleep, exercise, hydration) and repeat the measurement at rest.",
                        ),
                    ),
                )
            }

        val eventConditions = events.map { event ->
            ConditionAssessment(
                conditionId = "space_${event.eventId.name.lowercase()}",
                title = event.title,
                category = categoryForSpaceEvent(event.eventId),
                summary = event.message,
                confidence = 0.85f,
                severity = event.level,
                symptoms = listOf(
                    Symptom(event.eventId.name.lowercase(), event.title, SymptomSeverity.MODERATE),
                ),
                recommendedActions = listOf(
                    RecommendedAction(
                        event.eventId.name.lowercase(),
                        "Protocol",
                        event.suggestedAction,
                    ),
                ),
            )
        }

        val conditions = (legacy.conditions + zConditions + eventConditions)
            .sortedByDescending { severityRank(it.severity) }

        val overallRank = conditions.maxOfOrNull { severityRank(it.severity) } ?: 0
        val overall = rankToLevel(overallRank)
        val headline = when (overall) {
            AlertLevel.NOMINAL -> legacy.headline
            AlertLevel.WATCH -> "Watch trends"
            AlertLevel.ELEVATED -> "Attention recommended"
            AlertLevel.CRITICAL -> "Priority action"
        }

        return legacy.copy(overallLevel = maxLevel(legacy.overallLevel, overall), headline = headline, conditions = conditions)
    }

    private fun maxLevel(a: AlertLevel, b: AlertLevel): AlertLevel =
        if (severityRank(a) >= severityRank(b)) a else b

    private fun buildLegacyAssessment(current: HealthSnapshot, history: List<HealthSnapshot>): AssessmentResult {
        val conditions = buildList {
            addAll(behavioralRules(current))
            addAll(cardioRules(current, history))
            addAll(boneRules(current))
            addAll(immuneProxyRules(current))
            addAll(radiationProxyRules(current))
            addAll(environmentRules(current))
        }.sortedByDescending { severityRank(it.severity) }

        val overall = conditions.maxOfOrNull { severityRank(it.severity) }?.let { rankToLevel(it) }
            ?: AlertLevel.NOMINAL

        val headline = when (overall) {
            AlertLevel.NOMINAL -> "Nominal status"
            AlertLevel.WATCH -> "Watch trends"
            AlertLevel.ELEVATED -> "Attention recommended"
            AlertLevel.CRITICAL -> "Priority action"
        }

        return AssessmentResult(overallLevel = overall, headline = headline, conditions = conditions)
    }

    private fun categoryForSpaceEvent(id: SpaceCardioEventId): NasaRiskCategory =
        when (id) {
            SpaceCardioEventId.HYDRATION_REMINDER,
            SpaceCardioEventId.CALCIUM_REMINDER,
            -> NasaRiskCategory.BONE
            SpaceCardioEventId.INACTIVITY_REMINDER,
            SpaceCardioEventId.REST_LIGHT_DISRUPTION,
            -> NasaRiskCategory.BEHAVIORAL
            else -> NasaRiskCategory.CARDIO
        }

    private fun severityRank(level: AlertLevel): Int = when (level) {
        AlertLevel.NOMINAL -> 0
        AlertLevel.WATCH -> 1
        AlertLevel.ELEVATED -> 2
        AlertLevel.CRITICAL -> 3
    }

    private fun rankToLevel(rank: Int): AlertLevel = when (rank) {
        3 -> AlertLevel.CRITICAL
        2 -> AlertLevel.ELEVATED
        1 -> AlertLevel.WATCH
        else -> AlertLevel.NOMINAL
    }

    private fun behavioralRules(s: HealthSnapshot): List<ConditionAssessment> {
        val v = s.vitals
        val m = s.mission
        if (v.sleepHoursLastNight >= SpaceHealthThresholds.SLEEP_HOURS_WATCH &&
            v.hrvMs >= 35 &&
            v.stressScore < SpaceHealthThresholds.STRESS_SCORE_HIGH
        ) {
            return emptyList()
        }

        val severity = when {
            v.sleepHoursLastNight < SpaceHealthThresholds.SLEEP_HOURS_ELEVATED &&
                v.stressScore >= SpaceHealthThresholds.STRESS_SCORE_ELEVATED -> AlertLevel.ELEVATED
            v.hrvMs < SpaceHealthThresholds.HRV_MS_BEHAVIORAL ||
                v.stressScore >= 65 -> AlertLevel.WATCH
            else -> AlertLevel.WATCH
        }
        val symptoms = buildList {
            if (v.sleepHoursLastNight < SpaceHealthThresholds.SLEEP_HOURS_WATCH) {
                add(Symptom("poor_sleep", "Insufficient sleep", SymptomSeverity.MODERATE))
            }
            if (v.hrvMs < SpaceHealthThresholds.HRV_MS_LOW) {
                add(Symptom("low_hrv", "Low HRV", SymptomSeverity.MILD))
            }
            if (v.stressScore >= SpaceHealthThresholds.STRESS_SCORE_HIGH) {
                add(Symptom("high_stress", "Elevated stress", SymptomSeverity.MODERATE))
            }
            if (m.isolationIndex >= SpaceHealthThresholds.ISOLATION_INDEX_HIGH) {
                add(Symptom("isolation", "Prolonged isolation", SymptomSeverity.MILD))
            }
        } + s.selfReportedSymptoms.filter { it.id in setOf("irritability", "anxiety") }

        return listOf(
            ConditionAssessment(
                conditionId = "behavioral_stress",
                title = "Behavioral health / sleep",
                category = NasaRiskCategory.BEHAVIORAL,
                summary = "Pattern consistent with sleep deprivation, stress, or confinement.",
                confidence = 0.72f,
                severity = severity,
                symptoms = symptoms.distinctBy { it.id },
                recommendedActions = listOf(
                    RecommendedAction("sleep_hygiene", "Sleep hygiene", "8 h dark window, minimal blue light before sleep."),
                    RecommendedAction("journaling", "Mood log", "2 min: mood and stressors."),
                    RecommendedAction("crew_contact", "Crew contact", "Social check-in with a crewmate today."),
                ),
            ),
        )
    }

    private fun cardioRules(current: HealthSnapshot, history: List<HealthSnapshot>): List<ConditionAssessment> {
        val v = current.vitals
        val restingTrendUp = history.size >= 2 &&
            history.last().vitals.restingHeartRateBpm >
                history.first().vitals.restingHeartRateBpm + SpaceHealthThresholds.RESTING_HR_TREND_BPM

        if (v.restingHeartRateBpm < SpaceHealthThresholds.RESTING_HR_ELEVATED &&
            (v.spO2Percent <= 0 || v.spO2Percent >= SpaceHealthThresholds.SPO2_WATCH) &&
            !restingTrendUp
        ) {
            return emptyList()
        }

        val severity = when {
            (v.spO2Percent in 1 until SpaceHealthThresholds.SPO2_CRITICAL) || v.heartRateBpm > 110 -> AlertLevel.ELEVATED
            v.restingHeartRateBpm >= 75 || restingTrendUp -> AlertLevel.WATCH
            else -> AlertLevel.WATCH
        }

        return listOf(
            ConditionAssessment(
                conditionId = "cardio_deconditioning",
                title = "Cardiovascular load",
                category = NasaRiskCategory.CARDIO,
                summary = "Possible deconditioning or cardiac strain in microgravity.",
                confidence = if (restingTrendUp) 0.68f else 0.55f,
                severity = severity,
                symptoms = listOfNotNull(
                    if (v.restingHeartRateBpm >= SpaceHealthThresholds.RESTING_HR_ELEVATED) {
                        Symptom("high_rhr", "Elevated resting HR", SymptomSeverity.MILD)
                    } else {
                        null
                    },
                    if (restingTrendUp) Symptom("rhr_trend", "HR trend ↑", SymptomSeverity.MODERATE) else null,
                ) + current.selfReportedSymptoms.filter { it.id == "palpitations" },
                recommendedActions = listOf(
                    RecommendedAction("aerobic", "Aerobic exercise", "30 min treadmill/ergometer per flight protocol."),
                    RecommendedAction("hydration", "Hydration", "Review fluid intake and electrolytes."),
                    RecommendedAction("medical", "Flight surgeon", "Report if symptoms persist >24 h."),
                ),
            ),
        )
    }

    private fun boneRules(s: HealthSnapshot): List<ConditionAssessment> {
        val v = s.vitals
        if (v.stepsToday >= 6000 && s.mission.missionDay < 100) return emptyList()

        val lowLoad = v.stepsToday < SpaceHealthThresholds.STEPS_BONE_WATCH && s.mission.microgravity
        if (!lowLoad) return emptyList()

        return listOf(
            ConditionAssessment(
                conditionId = "bone_loading",
                title = "Insufficient bone loading",
                category = NasaRiskCategory.BONE,
                summary = "Low mechanical activity — risk of demineralization on long missions (~1–1.5% BMD/month in µG).",
                confidence = 0.61f,
                severity = if (v.stepsToday < SpaceHealthThresholds.STEPS_BONE_ELEVATED) {
                    AlertLevel.ELEVATED
                } else {
                    AlertLevel.WATCH
                },
                symptoms = s.selfReportedSymptoms.filter { it.id == "bone_ache" } +
                    listOf(Symptom("low_activity", "Low activity", SymptomSeverity.MILD)),
                recommendedActions = listOf(
                    RecommendedAction("resistance", "Resistance", "ARED / bands: prescribed session today."),
                    RecommendedAction("vit_d_ca", "Bone nutrition", "Check vitamin D and calcium with nutrition."),
                ),
            ),
        )
    }

    private fun immuneProxyRules(s: HealthSnapshot): List<ConditionAssessment> {
        val v = s.vitals
        val score = (if (v.sleepHoursLastNight < SpaceHealthThresholds.SLEEP_HOURS_WATCH) 1 else 0) +
            (if (v.stressScore >= SpaceHealthThresholds.STRESS_SCORE_HIGH) 1 else 0) +
            (if (v.hrvMs < SpaceHealthThresholds.HRV_MS_LOW) 1 else 0)
        if (score < 2) return emptyList()

        return listOf(
            ConditionAssessment(
                conditionId = "immune_proxy",
                title = "Immune resilience (proxy)",
                category = NasaRiskCategory.IMMUNE,
                summary = "Combined fatigue, stress, and sleep issues — associated with relative immunosuppression in space.",
                confidence = 0.58f,
                severity = if (score >= 3) AlertLevel.ELEVATED else AlertLevel.WATCH,
                symptoms = s.selfReportedSymptoms.filter { it.id == "fatigue" } +
                    listOf(Symptom("immune_risk", "Immune risk markers", SymptomSeverity.MILD)),
                recommendedActions = listOf(
                    RecommendedAction("rest", "Recovery", "Prioritize sleep and reduce extra workload."),
                    RecommendedAction("nutrition", "Nutrition", "Eat full meals; avoid a calorie deficit."),
                ),
            ),
        )
    }

    private fun radiationProxyRules(s: HealthSnapshot): List<ConditionAssessment> {
        val dose = s.mission.radiationDoseMilliSvProxy
        if (dose < SpaceHealthThresholds.RADIATION_DOSE_PROXY_MSV) return emptyList()

        return listOf(
            ConditionAssessment(
                conditionId = "radiation_exposure",
                title = "Radiation exposure (proxy)",
                category = NasaRiskCategory.RADIATION_PROXY,
                summary = "Elevated cumulative dose in simulation — monitor symptoms and shelter protocol.",
                confidence = 0.5f,
                severity = if (dose >= 40f) AlertLevel.WATCH else AlertLevel.WATCH,
                symptoms = emptyList(),
                recommendedActions = listOf(
                    RecommendedAction("dosimeter", "Dosimeter", "Confirm reading with the onboard system."),
                    RecommendedAction("shielding", "Shelter", "Know the solar storm plan."),
                ),
            ),
        )
    }

    private fun environmentRules(s: HealthSnapshot): List<ConditionAssessment> {
        // spO2 <= 0 means "not measured" (no sensor): never raise a hypoxia alert from it.
        if (s.vitals.spO2Percent <= 0 || s.vitals.spO2Percent >= SpaceHealthThresholds.SPO2_WATCH) return emptyList()
        return listOf(
            ConditionAssessment(
                conditionId = "hypoxia_env",
                title = "Low SpO₂",
                category = NasaRiskCategory.CARDIO,
                summary = "Possible mild hypoxia — check cabin pressure and equipment.",
                confidence = 0.65f,
                severity = if (s.vitals.spO2Percent < SpaceHealthThresholds.SPO2_CRITICAL) {
                    AlertLevel.CRITICAL
                } else {
                    AlertLevel.ELEVATED
                },
                symptoms = listOf(Symptom("low_spo2", "Low saturation", SymptomSeverity.MODERATE)),
                recommendedActions = listOf(
                    RecommendedAction("cabin_check", "Cabin", "Verify O₂ and CO₂ with engineering."),
                    RecommendedAction("medical", "Flight surgeon", "Immediate evaluation if <92%."),
                ),
            ),
        )
    }
}
