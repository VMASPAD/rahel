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
        displayName = "Nominal crew",
        description = "Vitals within expected ranges in stable orbit.",
    ),
    EARLY_BONE_DEMINERALIZATION(
        id = "early_bone_demineralization",
        displayName = "Early bone loss",
        description = "Low mechanical load and activity — demineralization proxy.",
    ),
    SLEEP_DEPRIVATION_STRESS(
        id = "sleep_deprivation_stress",
        displayName = "Sleep / stress",
        description = "Sleep deprivation and low HRV — behavioral health.",
    ),
    CARDIOVASCULAR_STRAIN(
        id = "cardiovascular_strain",
        displayName = "Cardiovascular strain",
        description = "Elevated HR and deconditioning in microgravity.",
    ),
    IMMUNE_SUPPRESSION_PROXY(
        id = "immune_suppression_proxy",
        displayName = "Immunity (proxy)",
        description = "Fatigue, stress, and poor sleep — relative immune risk.",
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
                mission = MissionContext(
                    missionDay = 120,
                    isolationIndex = 0.5f,
                    radiationDoseMilliSvProxy = 28f,
                    hoursSinceLastWaterIntake = 3,
                    calciumConsumedMg = 400,
                    calciumTargetMg = 1200,
                    hoursSinceLastCalciumIntake = 5,
                    inactivityMinutes = 75,
                ),
                selfReportedSymptoms = listOf(
                    Symptom("bone_ache", "Muscle / bone discomfort", SymptomSeverity.MILD),
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
                mission = MissionContext(
                    missionDay = 80,
                    isolationIndex = 0.72f,
                    radiationDoseMilliSvProxy = 18f,
                    crewScheduleWork = 0,
                    nightAwakenings = 4,
                    ambientLightLux = 280f,
                ),
                selfReportedSymptoms = listOf(
                    Symptom("irritability", "Irritability", SymptomSeverity.MODERATE),
                    Symptom("anxiety", "Anxiety", SymptomSeverity.MILD),
                ),
            )

            SeedProfile.CARDIOVASCULAR_STRAIN -> HealthSnapshot(
                timestamp = now,
                crewMemberId = crewMemberId,
                vitals = VitalSigns(
                    heartRateBpm = 102,
                    restingHeartRateBpm = 78,
                    hrvMs = 20,
                    spO2Percent = 93,
                    stepsToday = 3200,
                    sleepHoursLastNight = 5.8f,
                    skinTempCelsius = 36.5f,
                    stressScore = 55,
                ),
                mission = MissionContext(
                    missionDay = 200,
                    isolationIndex = 0.45f,
                    radiationDoseMilliSvProxy = 35f,
                    cabinCo2Ppm = 4200,
                    solarRadiationFluxPfu = 12.0,
                ),
                selfReportedSymptoms = listOf(
                    Symptom("palpitations", "Mild palpitations", SymptomSeverity.MILD),
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
                mission = MissionContext(
                    missionDay = 150,
                    isolationIndex = 0.6f,
                    radiationDoseMilliSvProxy = 42f,
                    solarRadiationFluxPfu = 15.0,
                ),
                selfReportedSymptoms = listOf(
                    Symptom("fatigue", "Persistent fatigue", SymptomSeverity.MODERATE),
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
