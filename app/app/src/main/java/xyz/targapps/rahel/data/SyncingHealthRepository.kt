package xyz.targapps.rahel.data

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import retrofit2.HttpException
import xyz.targapps.rahel.data.local.QueueItemKind
import xyz.targapps.rahel.data.local.QueuedReadingDao
import xyz.targapps.rahel.data.local.QueuedReadingEntity
import xyz.targapps.rahel.data.local.RahelDatabase
import xyz.targapps.rahel.BuildConfig
import xyz.targapps.rahel.data.remote.DeviceSensorsRequest
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
import java.security.MessageDigest

/**
 * Offline-first repository: samples are persisted in Room and uploaded in batches by a single
 * chained WorkManager job (never one POST per sample).
 *
 * Failure contract of [syncPending]: returns the number of rows acknowledged by the server;
 * throws on network errors and 5xx (so callers/WorkManager retry); on 401 it calls
 * [onAuthFailure] and returns 0.
 */
class SyncingHealthRepository(
    private val context: Context,
    private val delegate: HealthRepository,
    private val userProfileRepository: UserProfileRepository,
    private val dao: QueuedReadingDao,
    private val api: HealthApiService,
    private val gson: Gson = Gson(),
    private val onAuthFailure: (() -> Unit)? = null,
    private val hasCredentials: () -> Boolean = { true },
    /** Returns the detected-sensor inventory, or null when collection has not warmed up yet. */
    private val sensorInventoryProvider: (() -> DeviceSensorsRequest?)? = null,
) : HealthRepository {

    constructor(context: Context, initialProfile: SeedProfile = SeedProfile.HEALTHY_CREW) : this(
        context = context,
        delegate = SeedHealthRepository(initialProfile),
        userProfileRepository = UserProfileRepository(context),
        dao = RahelDatabase.get(context).queuedReadingDao(),
        api = RemoteApiFactory.createHealthApiService(),
    )

    private companion object {
        const val TAG = "SyncingHealthRepo"
        const val MAX_QUEUE_ROWS = 5_000
        const val BATCH_SIZE = 100
        const val MAX_BATCHES_PER_RUN = 100
        const val MAX_SAMPLE_AGE_MS = 120_000L

        /** Statuses where retrying the same payload can never succeed: drop it so it cannot block the queue. */
        val DROP_STATUS = setOf(400, 403, 413, 422)

        /** Already accepted earlier (idempotent replay of the same clientBatchId). */
        const val STATUS_DUPLICATE = 409

        /** Sensor inventory is re-sent about every 6 hours (and once after each process start). */
        const val INVENTORY_INTERVAL_MS = 6 * 60 * 60 * 1000L
    }

    @Volatile
    private var lastInventoryUploadAt: Long = 0L

    private val syncMutex = Mutex()

    @Volatile
    private var lastEnqueuedSampleAt: Long = 0L

    override val currentSnapshot: Flow<HealthSnapshot> = delegate.currentSnapshot

    override val history: List<HealthSnapshot>
        get() = delegate.history

    override fun setSeedProfile(profile: SeedProfile) {
        delegate.setSeedProfile(profile)
    }

    /** Validates the sample (real HR, on wrist, paired, fresh, not already queued). */
    private fun isRecordable(snapshot: HealthSnapshot): Boolean {
        if (snapshot.crewMemberId.isBlank()) return false
        val sv = snapshot.sensorVitals ?: return false
        if (sv.heartRateBpm == null) return false
        if (sv.onWrist == false) return false
        val sampleAt = sv.sampleAtEpochMs ?: return false
        if (System.currentTimeMillis() - sampleAt > MAX_SAMPLE_AGE_MS) return false
        if (sampleAt == lastEnqueuedSampleAt) return false
        return true
    }

    override suspend fun enqueueReading(snapshot: HealthSnapshot) {
        if (!isRecordable(snapshot)) return
        insertReading(snapshot)
        trimAndSchedule()
    }

    private suspend fun insertReading(snapshot: HealthSnapshot) {
        val dto = snapshot.toSensorReadingDto()
        dao.insert(
            QueuedReadingEntity(
                itemKind = QueueItemKind.SENSOR_READING,
                crewMemberId = snapshot.crewMemberId,
                payloadJson = gson.toJson(dto),
                createdAtEpochMs = dto.recordedAtEpochMs,
            ),
        )
        lastEnqueuedSampleAt = dto.recordedAtEpochMs
    }

    private suspend fun trimAndSchedule() {
        dao.trimToNewest(MAX_QUEUE_ROWS)
        HealthSyncScheduler.enqueueImmediate(context)
    }

    override suspend fun enqueueProfileSnapshot(crewMemberId: String) {
        if (crewMemberId.isBlank()) return
        if (dao.profileRowCount() > 0) return
        val profile = userProfileRepository.userProfile.first()
        if (!profile.onboardingComplete) return
        val now = System.currentTimeMillis()
        dao.insert(
            QueuedReadingEntity(
                itemKind = QueueItemKind.PROFILE_SNAPSHOT,
                crewMemberId = crewMemberId,
                payloadJson = gson.toJson(profile.toProfileSnapshotDto(crewMemberId, now)),
                createdAtEpochMs = now,
            ),
        )
        HealthSyncScheduler.enqueueImmediate(context)
    }

    override suspend fun recordAssessmentCycle(
        snapshot: HealthSnapshot,
        assessment: HealthAssessment,
    ): Boolean {
        if (!isRecordable(snapshot)) return false
        insertReading(snapshot)
        dao.insert(
            QueuedReadingEntity(
                itemKind = QueueItemKind.HEALTH_ASSESSMENT,
                crewMemberId = snapshot.crewMemberId,
                payloadJson = gson.toJson(assessment.toApiPayload()),
                createdAtEpochMs = lastEnqueuedSampleAt,
            ),
        )
        trimAndSchedule()
        return true
    }

    override suspend fun syncPending(): Int = syncMutex.withLock {
        if (!hasCredentials()) return@withLock 0
        try {
            var uploaded = uploadProfiles()
            var batches = 0
            while (batches++ < MAX_BATCHES_PER_RUN) {
                uploaded += uploadNextBatch() ?: break
            }
            uploadSensorInventoryIfDue()
            uploaded
        } catch (e: CancellationException) {
            throw e
        } catch (e: HttpException) {
            if (e.code() == 401) {
                onAuthFailure?.invoke()
                0
            } else {
                throw e
            }
        }
    }

    /**
     * Sends the sensor inventory at most every [INVENTORY_INTERVAL_MS]. Same failure contract as the rest:
     * network errors/5xx throw (WorkManager retries), 401 is handled by [syncPending], and statuses that
     * can never succeed are logged and skipped until the next interval.
     */
    private suspend fun uploadSensorInventoryIfDue() {
        val provider = sensorInventoryProvider ?: return
        val now = System.currentTimeMillis()
        if (lastInventoryUploadAt != 0L && now - lastInventoryUploadAt < INVENTORY_INTERVAL_MS) return
        val request = provider() ?: return
        try {
            api.postDeviceSensors(request)
        } catch (e: HttpException) {
            if (e.code() in DROP_STATUS || e.code() == 404) {
                Log.w(TAG, "Sensor inventory rejected (${e.code()}); will retry in 6 h")
                lastInventoryUploadAt = now
                return
            }
            throw e
        }
        lastInventoryUploadAt = now
    }

    private suspend fun uploadProfiles(): Int {
        var uploaded = 0
        for (row in dao.profileRows()) {
            val dto = try {
                gson.fromJson(row.payloadJson, UserProfileSnapshotDto::class.java)
            } catch (e: Exception) {
                null
            }
            if (dto == null) {
                dao.deleteByIds(listOf(row.id))
                continue
            }
            try {
                api.upsertProfile(dto)
            } catch (e: HttpException) {
                if (e.code() in DROP_STATUS) {
                    Log.w(TAG, "Dropping rejected profile snapshot (${e.code()})")
                    dao.deleteByIds(listOf(row.id))
                    continue
                }
                throw e
            }
            dao.deleteByIds(listOf(row.id))
            uploaded++
        }
        return uploaded
    }

    /**
     * Uploads one batch. The batch (id + member rows) is frozen in the DB the first time it is built, so a
     * retry after a lost response re-sends exactly the same rows with the same clientBatchId.
     * Returns null when nothing is left to upload, otherwise the number of rows acknowledged/dropped.
     */
    private suspend fun uploadNextBatch(): Int? {
        val rows: List<QueuedReadingEntity>
        val batchId: String
        val inFlight = dao.inFlightBatchId()
        if (inFlight != null) {
            batchId = inFlight
            rows = dao.rowsOfBatch(inFlight)
        } else {
            val crew = dao.oldestUnassignedCrew() ?: return null
            val candidates = dao.unassignedForCrew(crew, BATCH_SIZE)
            if (candidates.isEmpty()) return null
            val ids = candidates.map { it.id }
            batchId = deterministicBatchId(crew, ids)
            dao.assignBatch(ids, batchId)
            rows = candidates
        }
        if (rows.isEmpty()) return 0

        val readings = mutableListOf<SensorReadingDto>()
        val assessments = mutableListOf<HealthAssessmentDto>()
        val corruptIds = mutableListOf<Long>()
        for (row in rows) {
            try {
                when (row.itemKind) {
                    QueueItemKind.SENSOR_READING -> {
                        val dto = gson.fromJson(row.payloadJson, SensorReadingDto::class.java)
                        if (dto == null) corruptIds.add(row.id) else readings.add(dto)
                    }
                    QueueItemKind.HEALTH_ASSESSMENT ->
                        assessments.add(healthAssessmentDtoFromApiPayload(row.payloadJson, gson))
                    else -> corruptIds.add(row.id)
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "Discarding corrupt queue row ${row.id}", e)
                corruptIds.add(row.id)
            }
        }
        if (corruptIds.isNotEmpty()) dao.deleteByIds(corruptIds)
        val allIds = rows.map { it.id }
        if (readings.isEmpty() && assessments.isEmpty()) {
            dao.deleteByIds(allIds - corruptIds.toSet())
            return 0
        }

        try {
            api.postTelemetryBatch(
                TelemetryBatchRequest(
                    crewMemberId = rows.first().crewMemberId,
                    clientBatchId = batchId,
                    readings = readings,
                    assessments = assessments,
                    appVersion = BuildConfig.VERSION_NAME,
                ),
            )
        } catch (e: HttpException) {
            val code = e.code()
            if (code == STATUS_DUPLICATE) {
                dao.deleteByIds(allIds - corruptIds.toSet())
                return rows.size - corruptIds.size
            }
            if (code in DROP_STATUS) {
                Log.w(TAG, "Dropping rejected batch $batchId ($code)")
                dao.deleteByIds(allIds - corruptIds.toSet())
                return 0
            }
            throw e
        }
        dao.deleteByIds(allIds - corruptIds.toSet())
        return readings.size + assessments.size
    }

    private fun deterministicBatchId(crewMemberId: String, rowIds: List<Long>): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest("$crewMemberId|${rowIds.joinToString(",")}".toByteArray())
        return "rb-" + digest.joinToString("") { "%02x".format(it) }.take(32)
    }
}
