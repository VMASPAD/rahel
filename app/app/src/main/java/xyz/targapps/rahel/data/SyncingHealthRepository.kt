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
    /** Injectable for JVM tests; production uses wall-clock time. */
    private val nowMs: () -> Long = System::currentTimeMillis,
    /** Injectable for JVM tests; production schedules the WorkManager one-shot upload. */
    private val scheduleSync: () -> Unit = { HealthSyncScheduler.enqueueImmediate(context) },
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
        /** ~5.5 h of offline buffer at one reading per second. */
        const val MAX_QUEUE_ROWS = 20_000
        /** Server accepts up to 500 readings and 500 assessments per batch. */
        const val BATCH_SIZE = 300
        /** Trim the queue every N inserts instead of on every one-per-second insert. */
        const val TRIM_EVERY_INSERTS = 60
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

    /**
     * Returns the snapshot to queue, or null when it must be skipped (the reason is logged).
     *
     * A fresh heart-rate sample is not required: steps alone make a useful partial reading. A stale
     * heart rate is dropped (sent as null) instead of being passed off as current. The off-body flag is
     * deliberately not used to block: a fresh HR sample already proves the watch is worn, and the
     * sensor's value convention is not guaranteed across vendors.
     */
    private fun recordable(snapshot: HealthSnapshot): HealthSnapshot? {
        // Not linked yet: monitoring still runs, nothing is queued. Silent on purpose (called every few seconds).
        if (snapshot.crewMemberId.isBlank()) return null
        val sv = snapshot.sensorVitals ?: return skip("no sensor vitals yet")
        val sampleAt = sv.sampleAtEpochMs
        val freshHr = sv.heartRateBpm != null && sampleAt != null &&
            nowMs() - sampleAt <= MAX_SAMPLE_AGE_MS
        if (!freshHr && sv.stepsToday == null) {
            return skip("no fresh heart rate (hr=${sv.heartRateBpm}, sampleAt=$sampleAt) and no steps")
        }
        val key = if (freshHr) sampleAt!! else snapshot.timestamp.toEpochMilli()
        if (key == lastEnqueuedSampleAt) return null // already queued
        return if (freshHr) {
            snapshot
        } else {
            snapshot.copy(sensorVitals = sv.copy(heartRateBpm = null, sampleAtEpochMs = null))
        }
    }

    private fun skip(reason: String): HealthSnapshot? {
        Log.d(TAG, "Sample skipped: $reason")
        return null
    }

    override suspend fun enqueueReading(snapshot: HealthSnapshot) {
        val toQueue = recordable(snapshot) ?: return
        insertReading(toQueue)
        // High-frequency path: no WorkManager scheduling here (the recorder uploads continuously).
        if (++insertsSinceTrim >= TRIM_EVERY_INSERTS) {
            insertsSinceTrim = 0
            dao.trimToNewest(MAX_QUEUE_ROWS)
        }
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

    private var insertsSinceTrim = 0

    private suspend fun trimAndSchedule() {
        insertsSinceTrim = 0
        dao.trimToNewest(MAX_QUEUE_ROWS)
        scheduleSync()
    }

    override suspend fun enqueueProfileSnapshot(crewMemberId: String) {
        if (crewMemberId.isBlank()) return
        if (dao.profileRowCount() > 0) return
        val profile = userProfileRepository.userProfile.first()
        if (!profile.onboardingComplete) return
        val now = nowMs()
        dao.insert(
            QueuedReadingEntity(
                itemKind = QueueItemKind.PROFILE_SNAPSHOT,
                crewMemberId = crewMemberId,
                payloadJson = gson.toJson(profile.toProfileSnapshotDto(crewMemberId, now)),
                createdAtEpochMs = now,
            ),
        )
        scheduleSync()
    }

    override suspend fun recordAssessmentCycle(
        snapshot: HealthSnapshot,
        assessment: HealthAssessment,
    ): Boolean {
        val toQueue = recordable(snapshot) ?: return false
        try {
            insertReading(toQueue)
            try {
                dao.insert(
                    QueuedReadingEntity(
                        itemKind = QueueItemKind.HEALTH_ASSESSMENT,
                        crewMemberId = toQueue.crewMemberId,
                        payloadJson = gson.toJson(assessment.toApiPayload()),
                        createdAtEpochMs = lastEnqueuedSampleAt,
                    ),
                )
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                // The reading is already queued; a bad assessment payload must not block its upload.
                Log.w(TAG, "Assessment not queued", e)
            }
        } finally {
            trimAndSchedule()
        }
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
        val now = nowMs()
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
