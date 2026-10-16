package xyz.targapps.rahel.seed

import xyz.targapps.rahel.domain.HealthSnapshot
import xyz.targapps.rahel.domain.MissionContext
import xyz.targapps.rahel.domain.Symptom
import xyz.targapps.rahel.domain.SymptomSeverity
import xyz.targapps.rahel.domain.VitalSigns
import java.time.Instant

enum class SeedProfile(
    val id: String,
    val displayName: String,
    val description: String,
) {
    HEALTHY_CREW(
        id = "healthy_crew",
        displayName = "Tripulación nominal",
        description = "Vitals dentro de rangos esperados en órbita estable.",
    ),
    EARLY_BONE_DEMINERALIZATION(
        id = "early_bone_demineralization",
        displayName = "Pérdida ósea temprana",
        description = "Baja carga mecánica y actividad — proxy de desmineralización.",
    ),
    SLEEP_DEPRIVATION_STRESS(
        id = "sleep_deprivation_stress",
        displayName = "Sueño / estrés",
        description = "Privación de sueño e HRV baja — salud conductual.",
    ),
    CARDIOVASCULAR_STRAIN(
        id = "cardiovascular_strain",
        displayName = "Estrés cardiovascular",
        description = "FC elevada y desacondicionamiento en microgravedad.",
    ),
    IMMUNE_SUPPRESSION_PROXY(
        id = "immune_suppression_proxy",
        displayName = "Inmunidad (proxy)",
        description = "Fatiga, estrés y sueño pobre — riesgo inmune relativo.",
    ),
}

object SeedData {
    fun snapshot(profile: SeedProfile, crewMemberId: String = "CMD-01"): HealthSnapshot {
        val now = Instant.now()
        return when (profile) {
            SeedProfile.HEALTHY_CREW -> HealthSnapshot(
                timestamp = now,
                crewMemberId = crewMemberId,
                vitals = VitalSigns(
                    heartRateBpm = 72,
                    restingHeartRateBpm = 58,
                    hrvMs = 48,
                    spO2Percent = 97,
                    stepsToday = 8200,
                    sleepHoursLastNight = 7.2f,
                    skinTempCelsius = 36.4f,
                    stressScore = 28,
                ),
                mission = MissionContext(
                    missionDay = 45,
                    isolationIndex = 0.35f,
                    radiationDoseMilliSvProxy = 12f,
                ),
            )

            SeedProfile.EARLY_BONE_DEMINERALIZATION -> HealthSnapshot(
                timestamp = now,
                crewMemberId = crewMemberId,
                vitals = VitalSigns(
                    heartRateBpm = 78,
                    restingHeartRateBpm = 62,
                    hrvMs = 42,
                    spO2Percent = 96,
                    stepsToday = 2100,
                    sleepHoursLastNight = 6.5f,
                    skinTempCelsius = 36.3f,
                    stressScore = 40,
                ),
                mission = MissionContext(missionDay = 120, isolationIndex = 0.5f, radiationDoseMilliSvProxy = 28f),
                selfReportedSymptoms = listOf(
                    Symptom("bone_ache", "Molestia muscular / huesos", SymptomSeverity.MILD),
                ),
            )

            SeedProfile.SLEEP_DEPRIVATION_STRESS -> HealthSnapshot(
                timestamp = now,
                crewMemberId = crewMemberId,
                vitals = VitalSigns(
                    heartRateBpm = 88,
                    restingHeartRateBpm = 70,
                    hrvMs = 22,
                    spO2Percent = 97,
                    stepsToday = 4500,
                    sleepHoursLastNight = 4.1f,
                    skinTempCelsius = 36.6f,
                    stressScore = 78,
                ),
                mission = MissionContext(missionDay = 80, isolationIndex = 0.72f, radiationDoseMilliSvProxy = 18f),
                selfReportedSymptoms = listOf(
                    Symptom("irritability", "Irritabilidad", SymptomSeverity.MODERATE),
                    Symptom("anxiety", "Ansiedad", SymptomSeverity.MILD),
                ),
            )

            SeedProfile.CARDIOVASCULAR_STRAIN -> HealthSnapshot(
                timestamp = now,
                crewMemberId = crewMemberId,
                vitals = VitalSigns(
                    heartRateBpm = 102,
                    restingHeartRateBpm = 78,
                    hrvMs = 30,
                    spO2Percent = 94,
                    stepsToday = 3200,
                    sleepHoursLastNight = 5.8f,
                    skinTempCelsius = 36.5f,
                    stressScore = 55,
                ),
                mission = MissionContext(missionDay = 200, isolationIndex = 0.45f, radiationDoseMilliSvProxy = 35f),
                selfReportedSymptoms = listOf(
                    Symptom("palpitations", "Palpitaciones leves", SymptomSeverity.MILD),
                ),
            )

            SeedProfile.IMMUNE_SUPPRESSION_PROXY -> HealthSnapshot(
                timestamp = now,
                crewMemberId = crewMemberId,
                vitals = VitalSigns(
                    heartRateBpm = 82,
                    restingHeartRateBpm = 66,
                    hrvMs = 26,
                    spO2Percent = 96,
                    stepsToday = 3800,
                    sleepHoursLastNight = 5.2f,
                    skinTempCelsius = 37.1f,
                    stressScore = 65,
                ),
                mission = MissionContext(missionDay = 150, isolationIndex = 0.6f, radiationDoseMilliSvProxy = 42f),
                selfReportedSymptoms = listOf(
                    Symptom("fatigue", "Fatiga persistente", SymptomSeverity.MODERATE),
                ),
            )
        }
    }

    fun historyFor(profile: SeedProfile): List<HealthSnapshot> {
        val base = snapshot(profile)
        val v = base.vitals
        return listOf(
            base.copy(
                vitals = v.copy(restingHeartRateBpm = v.restingHeartRateBpm - 4, stepsToday = v.stepsToday + 500),
            ),
            base,
        )
    }

    val allProfiles: List<SeedProfile> = SeedProfile.entries
}
