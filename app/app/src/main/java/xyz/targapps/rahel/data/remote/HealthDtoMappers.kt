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

/**
 * Maps to the upload DTO using the real sample timestamp and nullable vitals.
 * Sleep and stress are not measured by the watch, so they are always null.
 */
fun HealthSnapshot.toSensorReadingDto(): SensorReadingDto {
    val sv = sensorVitals
    return SensorReadingDto(
    recordedAtEpochMs = sv?.sampleAtEpochMs ?: timestamp.toEpochMilli(),
    heartRateBpm = if (sv != null) sv.heartRateBpm else vitals.heartRateBpm.takeIf { it > 0 },
    restingHeartRateBpm = if (sv != null) sv.restingHeartRateBpm else vitals.restingHeartRateBpm.takeIf { it > 0 },
    hrvMs = if (sv != null) sv.hrvMs else vitals.hrvMs.takeIf { it > 0 },
    spO2Percent = if (sv != null) sv.spO2Percent else vitals.spO2Percent.takeIf { it > 0 },
    stepsToday = if (sv != null) sv.stepsToday else null,
    sleepHoursLastNight = null,
    skinTempCelsius = if (sv != null) sv.skinTempCelsius else null,
    stressScore = null,
    missionDay = mission.missionDay,
    microgravity = mission.microgravity,
    isolationIndex = mission.isolationIndex,
    radiationDoseMilliSvProxy = mission.radiationDoseMilliSvProxy,
    selfReportedSymptoms = selfReportedSymptoms.map { it.toDto() },
    )
}

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
        disclaimer = "Educational prototype — not a medical diagnosis. Consult your flight surgeon.",
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
