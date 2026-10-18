package xyz.targapps.rahel.data

import android.content.Context
import android.content.ContextWrapper
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import xyz.targapps.rahel.data.local.QueuedReadingDao
import xyz.targapps.rahel.data.local.QueuedReadingEntity
import xyz.targapps.rahel.data.local.QueueItemKind
import xyz.targapps.rahel.data.remote.DeviceSensorsRequest
import xyz.targapps.rahel.data.remote.DeviceSensorsResponse
import xyz.targapps.rahel.data.remote.HealthApiService
import xyz.targapps.rahel.data.remote.TelemetryBatchRequest
import xyz.targapps.rahel.data.remote.TelemetryBatchResponse
import xyz.targapps.rahel.data.remote.UserProfileSnapshotDto
import xyz.targapps.rahel.domain.AlertLevel
import xyz.targapps.rahel.domain.AssessmentResult
import xyz.targapps.rahel.domain.ConditionAssessment
import xyz.targapps.rahel.domain.HealthAssessment
import xyz.targapps.rahel.domain.HealthSnapshot
import xyz.targapps.rahel.domain.MissionContext
import xyz.targapps.rahel.domain.NasaRiskCategory
import xyz.targapps.rahel.domain.ProcessedVitalsSnapshot
import xyz.targapps.rahel.domain.RecommendedAction
import xyz.targapps.rahel.domain.SensorVitals
import xyz.targapps.rahel.domain.VitalSigns
import xyz.targapps.rahel.domain.ZScoreBand
import xyz.targapps.rahel.domain.ZScoreEvaluation
import xyz.targapps.rahel.domain.PhysiologicalMetric
import xyz.targapps.rahel.seed.SeedProfile
import java.time.Instant

/** Fixed "now" used across the data-chain tests (2026-06-01T12:00:00Z). */
const val T0 = 1_780_315_200_000L
const val CREW = "crew-test-0001"

fun fakeContext(): Context = object : ContextWrapper(null) {
    override fun getApplicationContext(): Context = this
}

/** What DeviceSensorHealthRepository builds from sensors: nullable [SensorVitals] + placeholder VitalSigns. */
fun snapshot(
    sampleAt: Long?,
    hr: Int? = 72,
    steps: Int? = null,
    hrv: Int? = null,
    spo2: Int? = null,
    skinTemp: Float? = null,
    resting: Int? = null,
    onWrist: Boolean? = true,
    crew: String = CREW,
    timestampMs: Long = sampleAt ?: T0,
) = HealthSnapshot(
    timestamp = Instant.ofEpochMilli(timestampMs),
    crewMemberId = crew,
    vitals = VitalSigns(hr ?: 0, resting ?: 0, hrv ?: 0, spo2 ?: 0, steps ?: 0, 0f, 0f, 0),
    mission = MissionContext(missionDay = 1, isolationIndex = 0.3f, radiationDoseMilliSvProxy = 0f),
    sensorVitals = SensorVitals(
        heartRateBpm = hr,
        restingHeartRateBpm = resting,
        hrvMs = hrv,
        spO2Percent = spo2,
        stepsToday = steps,
        skinTempCelsius = skinTemp,
        onWrist = onWrist,
        sampleAtEpochMs = sampleAt,
    ),
)

fun assessment(at: Long, crew: String = CREW) = HealthAssessment(
    timestamp = Instant.ofEpochMilli(at),
    crewMemberId = crew,
    baseRiskIndex = 0.12f,
    zScores = listOf(ZScoreEvaluation(PhysiologicalMetric.HEART_RATE, 80.0, 70.0, 8.0, 1.25, ZScoreBand.NORMAL)),
    eventAlerts = emptyList(),
    processedVitals = ProcessedVitalsSnapshot(70, 40, false, 0.1f, 2, 0f, 0f),
    legacyAssessment = AssessmentResult(
        overallLevel = AlertLevel.WATCH,
        headline = "Heart rate slightly elevated",
        conditions = listOf(
            ConditionAssessment(
                conditionId = "cardio-hr",
                title = "Elevated heart rate",
                category = NasaRiskCategory.CARDIO,
                summary = "s",
                confidence = 0.6f,
                severity = AlertLevel.WATCH,
                symptoms = emptyList(),
                recommendedActions = listOf(RecommendedAction("a", "Rest", "Sit down")),
            ),
        ),
    ),
)

/** Delegate repository that only provides a snapshot flow. */
class FakeDelegate(var snap: HealthSnapshot? = null) : HealthRepository {
    override val currentSnapshot: Flow<HealthSnapshot> = flow { emit(snap!!) }
    override val history: List<HealthSnapshot> = emptyList()
    override fun setSeedProfile(profile: SeedProfile) {}
}

/** In-memory implementation of the Room DAO with the same semantics as the SQL queries. */
class FakeDao : QueuedReadingDao {
    val rows = mutableListOf<QueuedReadingEntity>()
    private var nextId = 1L

    override suspend fun insert(entity: QueuedReadingEntity): Long {
        val id = nextId++
        rows.add(entity.copy(id = id))
        return id
    }

    override suspend fun pendingCount() = rows.size
    override suspend fun deleteByIds(ids: List<Long>) { rows.removeAll { it.id in ids } }
    override suspend fun clearAll() { rows.clear() }
    override suspend fun profileRows() = rows.filter { it.itemKind == QueueItemKind.PROFILE_SNAPSHOT }.sortedBy { it.id }
    override suspend fun profileRowCount() = profileRows().size
    override suspend fun inFlightBatchId() = rows.filter { it.batchId != null }.minByOrNull { it.id }?.batchId
    override suspend fun rowsOfBatch(batchId: String) = rows.filter { it.batchId == batchId }.sortedBy { it.id }
    override suspend fun oldestUnassignedCrew() =
        rows.filter { it.batchId == null && it.itemKind != QueueItemKind.PROFILE_SNAPSHOT }.minByOrNull { it.id }?.crewMemberId
    override suspend fun unassignedForCrew(crew: String, limit: Int) =
        rows.filter { it.batchId == null && it.itemKind != QueueItemKind.PROFILE_SNAPSHOT && it.crewMemberId == crew }
            .sortedBy { it.id }.take(limit)
    override suspend fun assignBatch(ids: List<Long>, batchId: String) {
        for (i in rows.indices) if (rows[i].id in ids) rows[i] = rows[i].copy(batchId = batchId)
    }
    override suspend fun trimToNewest(max: Int) {
        val keep = rows.sortedByDescending { it.id }.drop(max).filter { it.batchId == null }.map { it.id }
        rows.removeAll { it.id in keep }
    }
}

/** Records every batch; [failWith] (when set) is thrown instead of answering. */
class FakeApi : HealthApiService {
    val batches = mutableListOf<TelemetryBatchRequest>()
    var failWith: (() -> Throwable)? = null

    override suspend fun upsertProfile(body: UserProfileSnapshotDto) = TelemetryBatchResponse()
    override suspend fun postTelemetryBatch(body: TelemetryBatchRequest): TelemetryBatchResponse {
        batches.add(body)
        failWith?.let { throw it() }
        return TelemetryBatchResponse(body.readings.size, body.assessments.size)
    }
    override suspend fun postDeviceSensors(body: DeviceSensorsRequest): DeviceSensorsResponse =
        throw UnsupportedOperationException()
}

class RepoFixture(
    val dao: FakeDao = FakeDao(),
    val api: HealthApiService = FakeApi(),
    var now: Long = T0,
    var scheduled: Int = 0,
) {
    val repo = SyncingHealthRepository(
        context = fakeContext(),
        delegate = FakeDelegate(),
        userProfileRepository = UserProfileRepository(fakeContext()),
        dao = dao,
        api = api,
        nowMs = { now },
        scheduleSync = { scheduled++ },
    )
}
