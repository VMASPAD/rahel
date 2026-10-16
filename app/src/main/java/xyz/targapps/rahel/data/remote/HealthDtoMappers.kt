package xyz.targapps.rahel.data.remote

import com.google.gson.Gson
import com.google.gson.JsonObject
import java.time.Instant
import xyz.targapps.rahel.data.UserProfile
import xyz.targapps.rahel.domain.AssessmentResult
import xyz.targapps.rahel.domain.ConditionAssessment
import xyz.targapps.rahel.domain.HealthSnapshot
import xyz.targapps.rahel.domain.RecommendedAction
import xyz.targapps.rahel.domain.Symptom

fun HealthSnapshot.toSensorReadingDto(): SensorReadingDto = SensorReadingDto(
    recordedAtEpochMs = timestamp.toEpochMilli(),
    heartRateBpm = vitals.heartRateBpm,
    restingHeartRateBpm = vitals.restingHeartRateBpm,
    hrvMs = vitals.hrvMs,
    spO2Percent = vitals.spO2Percent,
    stepsToday = vitals.stepsToday,
    sleepHoursLastNight = vitals.sleepHoursLastNight,
    skinTempCelsius = vitals.skinTempCelsius,
    stressScore = vitals.stressScore,
    missionDay = mission.missionDay,
    microgravity = mission.microgravity,
    isolationIndex = mission.isolationIndex,
    radiationDoseMilliSvProxy = mission.radiationDoseMilliSvProxy,
    selfReportedSymptoms = selfReportedSymptoms.map { it.toDto() },
)

/** Maps queued [HealthAssessment.toApiPayload] JSON to the batch API DTO. */
fun healthAssessmentDtoFromApiPayload(payloadJson: String, gson: Gson): HealthAssessmentDto {
    val root = gson.fromJson(payloadJson, JsonObject::class.java)
    val assessedAtEpochMs = Instant.parse(root.get("timestamp").asString).toEpochMilli()
    val conditions = root.getAsJsonArray("conditions")?.map { element ->
        val c = element.asJsonObject
        ConditionAssessmentDto(
            conditionId = c.get("id").asString,
            title = c.get("title").asString,
            category = c.get("category").asString,
            summary = "",
            confidence = 0f,
            severity = c.get("severity").asString,
            symptoms = emptyList(),
            recommendedActions = emptyList(),
        )
    } ?: emptyList()
    return HealthAssessmentDto(
        assessedAtEpochMs = assessedAtEpochMs,
        overallLevel = root.get("overallLevel").asString,
        headline = root.get("headline").asString,
        disclaimer = "Prototipo educativo — no es diagnóstico médico. Consulte al médico de vuelo.",
        conditions = conditions,
    )
}

fun UserProfile.toProfileSnapshotDto(
    crewMemberId: String,
    snapshotAtEpochMs: Long,
): UserProfileSnapshotDto = UserProfileSnapshotDto(
    crewMemberId = crewMemberId,
    sexoBiologico = sexoBiologico,
    imc = imc,
    pesoKg = pesoKg,
    alturaM = alturaM,
    snapshotAtEpochMs = snapshotAtEpochMs,
)

fun AssessmentResult.toDto(assessedAtEpochMs: Long): HealthAssessmentDto = HealthAssessmentDto(
    assessedAtEpochMs = assessedAtEpochMs,
    overallLevel = overallLevel.name,
    headline = headline,
    disclaimer = disclaimer,
    conditions = conditions.map { it.toDto() },
)

fun HealthSnapshot.toProfileDto(profile: UserProfile): UserProfileSnapshotDto =
    profile.toProfileSnapshotDto(crewMemberId, timestamp.toEpochMilli())

private fun Symptom.toDto() = SymptomDto(
    id = id,
    label = label,
    severity = severity.name,
)

private fun ConditionAssessment.toDto() = ConditionAssessmentDto(
    conditionId = conditionId,
    title = title,
    category = category.name,
    summary = summary,
    confidence = confidence,
    severity = severity.name,
    symptoms = symptoms.map { it.toDto() },
    recommendedActions = recommendedActions.map { it.toDto() },
)

private fun RecommendedAction.toDto() = RecommendedActionDto(
    id = id,
    title = title,
    detail = detail,
)
