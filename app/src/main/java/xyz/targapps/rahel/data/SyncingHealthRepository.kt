package xyz.targapps.rahel.data

import android.content.Context
import com.google.gson.Gson
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import xyz.targapps.rahel.data.local.QueueItemKind
import xyz.targapps.rahel.data.local.QueuedReadingDao
import xyz.targapps.rahel.data.local.QueuedReadingEntity
import xyz.targapps.rahel.data.local.RahelDatabase
import xyz.targapps.rahel.data.remote.HealthApiService
import xyz.targapps.rahel.data.remote.HealthAssessmentDto
import xyz.targapps.rahel.data.remote.RemoteApiFactory
import xyz.targapps.rahel.data.remote.SensorReadingDto
import xyz.targapps.rahel.data.remote.TelemetryBatchRequest
import xyz.targapps.rahel.data.remote.UserProfileSnapshotDto
import xyz.targapps.rahel.data.remote.healthAssessmentDtoFromApiPayload
import xyz.targapps.rahel.data.remote.toProfileSnapshotDto
import xyz.targapps.rahel.data.remote.toSensorReadingDto
import xyz.targapps.rahel.data.sync.HealthSyncScheduler
import xyz.targapps.rahel.domain.HealthAssessment
import xyz.targapps.rahel.domain.HealthSnapshot
import xyz.targapps.rahel.seed.SeedProfile
import java.util.UUID

class SyncingHealthRepository(
    private val context: Context,
    private val delegate: HealthRepository,
    private val userProfileRepository: UserProfileRepository,
    private val dao: QueuedReadingDao,
    private val api: HealthApiService,
    private val gson: Gson = Gson(),
) : HealthRepository {

    constructor(context: Context, initialProfile: SeedProfile = SeedProfile.HEALTHY_CREW) : this(
        context = context,
        delegate = SeedHealthRepository(initialProfile),
        userProfileRepository = UserProfileRepository(context),
        dao = RahelDatabase.get(context).queuedReadingDao(),
        api = RemoteApiFactory.createHealthApiService(),
    )

    override val currentSnapshot: Flow<HealthSnapshot> = delegate.currentSnapshot

    override val history: List<HealthSnapshot>
        get() = delegate.history

    override fun setSeedProfile(profile: SeedProfile) {
        delegate.setSeedProfile(profile)
    }

    override suspend fun enqueueReading(snapshot: HealthSnapshot) {
        val payload = gson.toJson(snapshot.toSensorReadingDto())
        dao.insert(
            QueuedReadingEntity(
                itemKind = QueueItemKind.SENSOR_READING,
                crewMemberId = snapshot.crewMemberId,
                payloadJson = payload,
                createdAtEpochMs = snapshot.timestamp.toEpochMilli(),
            ),
        )
    }

    override suspend fun enqueueProfileSnapshot(crewMemberId: String) {
        if (dao.peekPending().any { it.itemKind == QueueItemKind.PROFILE_SNAPSHOT }) return
        val profile = userProfileRepository.userProfile.first()
        if (!profile.onboardingComplete) return
        val payload = gson.toJson(
            profile.toProfileSnapshotDto(crewMemberId, System.currentTimeMillis()),
        )
        dao.insert(
            QueuedReadingEntity(
                itemKind = QueueItemKind.PROFILE_SNAPSHOT,
                crewMemberId = crewMemberId,
                payloadJson = payload,
                createdAtEpochMs = System.currentTimeMillis(),
            ),
        )
        syncPending()
        HealthSyncScheduler.enqueueImmediate(context)
    }

    override suspend fun recordAssessmentCycle(snapshot: HealthSnapshot, assessment: HealthAssessment) {
        enqueueReading(snapshot)
        val assessmentPayload = gson.toJson(assessment.toApiPayload())
        dao.insert(
            QueuedReadingEntity(
                itemKind = QueueItemKind.HEALTH_ASSESSMENT,
                crewMemberId = snapshot.crewMemberId,
                payloadJson = assessmentPayload,
                createdAtEpochMs = snapshot.timestamp.toEpochMilli(),
            ),
        )
        syncPending()
        HealthSyncScheduler.enqueueImmediate(context)
    }

    override suspend fun syncPending(): Int {
        val pending = dao.peekPending()
        if (pending.isEmpty()) return 0

        var uploaded = 0
        val profiles = pending.filter { it.itemKind == QueueItemKind.PROFILE_SNAPSHOT }
        val profileIds = mutableListOf<Long>()
        for (row in profiles) {
            val dto = gson.fromJson(row.payloadJson, UserProfileSnapshotDto::class.java)
            api.upsertProfile(dto)
            profileIds.add(row.id)
            uploaded++
        }
        if (profileIds.isNotEmpty()) {
            dao.deleteByIds(profileIds)
        }

        val remaining = dao.peekPending()
        if (remaining.isEmpty()) return uploaded

        val crewMemberId = remaining.first().crewMemberId
        val readings = mutableListOf<SensorReadingDto>()
        val assessments = mutableListOf<HealthAssessmentDto>()
        val batchRowIds = mutableListOf<Long>()

        for (row in remaining) {
            when (row.itemKind) {
                QueueItemKind.SENSOR_READING -> {
                    readings.add(gson.fromJson(row.payloadJson, SensorReadingDto::class.java))
                    batchRowIds.add(row.id)
                }
                QueueItemKind.HEALTH_ASSESSMENT -> {
                    assessments.add(healthAssessmentDtoFromApiPayload(row.payloadJson, gson))
                    batchRowIds.add(row.id)
                }
                QueueItemKind.PROFILE_SNAPSHOT -> Unit
            }
        }

        if (readings.isEmpty() && assessments.isEmpty()) return uploaded

        api.postTelemetryBatch(
            TelemetryBatchRequest(
                crewMemberId = crewMemberId,
                clientBatchId = UUID.randomUUID().toString(),
                readings = readings,
                assessments = assessments,
            ),
        )
        dao.deleteByIds(batchRowIds)
        uploaded += batchRowIds.size
        return uploaded
    }
}
