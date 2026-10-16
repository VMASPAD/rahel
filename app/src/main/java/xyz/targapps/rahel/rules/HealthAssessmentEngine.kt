package xyz.targapps.rahel.rules

import xyz.targapps.rahel.domain.AlertLevel
import xyz.targapps.rahel.domain.AssessmentResult
import xyz.targapps.rahel.domain.ConditionAssessment
import xyz.targapps.rahel.domain.HealthSnapshot
import xyz.targapps.rahel.domain.NasaRiskCategory
import xyz.targapps.rahel.domain.RecommendedAction
import xyz.targapps.rahel.domain.Symptom
import xyz.targapps.rahel.domain.SymptomSeverity

/**
 * Rule-based assessment aligned with NASA HRP risk themes.
 * Threshold constants: [SpaceHealthThresholds]; citations: project docs/SOURCES.md.
 * Not for clinical use or flight certification.
 */
class HealthAssessmentEngine {

    fun assess(current: HealthSnapshot, history: List<HealthSnapshot>): AssessmentResult {
        val conditions = buildList {
            addAll(behavioralRules(current))
            addAll(cardioRules(current, history))
            addAll(boneRules(current))
            addAll(immuneProxyRules(current))
            addAll(radiationProxyRules(current))
            addAll(environmentRules(current))
        }.sortedByDescending { severityRank(it.severity) }

        val overall = conditions.maxOfOrNull { severityRank(it.severity) }?.let { rank ->
            when (rank) {
                3 -> AlertLevel.CRITICAL
                2 -> AlertLevel.ELEVATED
                1 -> AlertLevel.WATCH
                else -> AlertLevel.NOMINAL
            }
        } ?: AlertLevel.NOMINAL

        val headline = when (overall) {
            AlertLevel.NOMINAL -> "Estado nominal"
            AlertLevel.WATCH -> "Vigilar tendencias"
            AlertLevel.ELEVATED -> "Atención recomendada"
            AlertLevel.CRITICAL -> "Acción prioritaria"
        }

        return AssessmentResult(overallLevel = overall, headline = headline, conditions = conditions)
    }

    private fun severityRank(level: AlertLevel): Int = when (level) {
        AlertLevel.NOMINAL -> 0
        AlertLevel.WATCH -> 1
        AlertLevel.ELEVATED -> 2
        AlertLevel.CRITICAL -> 3
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
                add(Symptom("poor_sleep", "Sueño insuficiente", SymptomSeverity.MODERATE))
            }
            if (v.hrvMs < SpaceHealthThresholds.HRV_MS_LOW) {
                add(Symptom("low_hrv", "HRV baja", SymptomSeverity.MILD))
            }
            if (v.stressScore >= SpaceHealthThresholds.STRESS_SCORE_HIGH) {
                add(Symptom("high_stress", "Estrés elevado", SymptomSeverity.MODERATE))
            }
            if (m.isolationIndex >= SpaceHealthThresholds.ISOLATION_INDEX_HIGH) {
                add(Symptom("isolation", "Aislamiento prolongado", SymptomSeverity.MILD))
            }
        } + s.selfReportedSymptoms.filter { it.id in setOf("irritability", "anxiety") }

        return listOf(
            ConditionAssessment(
                conditionId = "behavioral_stress",
                title = "Salud conductual / sueño",
                category = NasaRiskCategory.BEHAVIORAL,
                summary = "Patrón compatible con privación de sueño, estrés o confinamiento.",
                confidence = 0.72f,
                severity = severity,
                symptoms = symptoms.distinctBy { it.id },
                recommendedActions = listOf(
                    RecommendedAction("sleep_hygiene", "Higiene del sueño", "Ventana oscura 8h, luz azul mínima pre-sueño."),
                    RecommendedAction("journaling", "Registro emocional", "2 min: estado de ánimo y factores estresores."),
                    RecommendedAction("crew_contact", "Contacto tripulación", "Check-in social con un compañero hoy."),
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
            v.spO2Percent >= SpaceHealthThresholds.SPO2_WATCH &&
            !restingTrendUp
        ) {
            return emptyList()
        }

        val severity = when {
            v.spO2Percent < SpaceHealthThresholds.SPO2_CRITICAL || v.heartRateBpm > 110 -> AlertLevel.ELEVATED
            v.restingHeartRateBpm >= 75 || restingTrendUp -> AlertLevel.WATCH
            else -> AlertLevel.WATCH
        }

        return listOf(
            ConditionAssessment(
                conditionId = "cardio_deconditioning",
                title = "Carga cardiovascular",
                category = NasaRiskCategory.CARDIO,
                summary = "Posible desacondicionamiento o estrés cardiaco en microgravedad.",
                confidence = if (restingTrendUp) 0.68f else 0.55f,
                severity = severity,
                symptoms = listOfNotNull(
                    if (v.restingHeartRateBpm >= SpaceHealthThresholds.RESTING_HR_ELEVATED) {
                        Symptom("high_rhr", "FC reposo elevada", SymptomSeverity.MILD)
                    } else {
                        null
                    },
                    if (restingTrendUp) Symptom("rhr_trend", "Tendencia FC ↑", SymptomSeverity.MODERATE) else null,
                ) + current.selfReportedSymptoms.filter { it.id == "palpitations" },
                recommendedActions = listOf(
                    RecommendedAction("aerobic", "Ejercicio aeróbico", "30 min cinta/ergómetro según protocolo de vuelo."),
                    RecommendedAction("hydration", "Hidratación", "Revisar ingesta hídrica y electrolitos."),
                    RecommendedAction("medical", "Médico de vuelo", "Informar si síntomas persisten >24h."),
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
                title = "Carga ósea insuficiente",
                category = NasaRiskCategory.BONE,
                summary = "Baja actividad mecánica — riesgo de desmineralización en misión larga (~1–1.5% DMO/mes en µG).",
                confidence = 0.61f,
                severity = if (v.stepsToday < SpaceHealthThresholds.STEPS_BONE_ELEVATED) {
                    AlertLevel.ELEVATED
                } else {
                    AlertLevel.WATCH
                },
                symptoms = s.selfReportedSymptoms.filter { it.id == "bone_ache" } +
                    listOf(Symptom("low_activity", "Actividad baja", SymptomSeverity.MILD)),
                recommendedActions = listOf(
                    RecommendedAction("resistance", "Resistencia", "ARED / bandas: sesión prescrita hoy."),
                    RecommendedAction("vit_d_ca", "Nutrición ósea", "Verificar vitamina D y calcio con nutrición."),
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
                title = "Resiliencia inmune (proxy)",
                category = NasaRiskCategory.IMMUNE,
                summary = "Combinación de fatiga, estrés y sueño — asociada a inmunosupresión relativa en espacio.",
                confidence = 0.58f,
                severity = if (score >= 3) AlertLevel.ELEVATED else AlertLevel.WATCH,
                symptoms = s.selfReportedSymptoms.filter { it.id == "fatigue" } +
                    listOf(Symptom("immune_risk", "Marcadores de riesgo inmune", SymptomSeverity.MILD)),
                recommendedActions = listOf(
                    RecommendedAction("rest", "Recuperación", "Priorizar sueño y reducir carga extra."),
                    RecommendedAction("nutrition", "Nutrición", "Comida completa; evitar déficit calórico."),
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
                title = "Exposición radiación (proxy)",
                category = NasaRiskCategory.RADIATION_PROXY,
                summary = "Dosis acumulada elevada en simulación — vigilar síntomas y protocolo de refugio.",
                confidence = 0.5f,
                severity = if (dose >= 40f) AlertLevel.WATCH else AlertLevel.WATCH,
                symptoms = emptyList(),
                recommendedActions = listOf(
                    RecommendedAction("dosimeter", "Dosímetro", "Confirmar lectura con sistema de a bordo."),
                    RecommendedAction("shielding", "Refugio", "Conocer plan de tormenta solar."),
                ),
            ),
        )
    }

    private fun environmentRules(s: HealthSnapshot): List<ConditionAssessment> {
        if (s.vitals.spO2Percent >= SpaceHealthThresholds.SPO2_WATCH) return emptyList()
        return listOf(
            ConditionAssessment(
                conditionId = "hypoxia_env",
                title = "SpO₂ baja",
                category = NasaRiskCategory.CARDIO,
                summary = "Posible hipoxia leve — revisar presión cabin y equipo.",
                confidence = 0.65f,
                severity = if (s.vitals.spO2Percent < SpaceHealthThresholds.SPO2_CRITICAL) {
                    AlertLevel.CRITICAL
                } else {
                    AlertLevel.ELEVATED
                },
                symptoms = listOf(Symptom("low_spo2", "Saturación baja", SymptomSeverity.MODERATE)),
                recommendedActions = listOf(
                    RecommendedAction("cabin_check", "Cabina", "Verificar O₂ y CO₂ con ingeniería."),
                    RecommendedAction("medical", "Médico de vuelo", "Evaluación inmediata si <92%."),
                ),
            ),
        )
    }
}
