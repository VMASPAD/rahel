package xyz.targapps.rahel.data

import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import xyz.targapps.rahel.data.local.QueuedReadingDao
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class SyncStatus(
    val lastUploadAt: Instant?,
    val pendingCount: Int,
    val isSyncing: Boolean = false,
    val lastError: String? = null,
)

/**
 * Upload queue / backend sync; API agent can replace [StubHealthSyncRepository].
 */
interface HealthSyncRepository {
    val syncStatus: StateFlow<SyncStatus>
    suspend fun triggerSync(): Result<Unit>
    suspend fun refreshStatus()
}

class StubHealthSyncRepository : HealthSyncRepository {
    private val _syncStatus = MutableStateFlow(
        SyncStatus(
            lastUploadAt = null,
            pendingCount = 3,
        ),
    )
    override val syncStatus: StateFlow<SyncStatus> = _syncStatus.asStateFlow()

    override suspend fun triggerSync(): Result<Unit> {
        _syncStatus.value = _syncStatus.value.copy(isSyncing = true)
        _syncStatus.value = _syncStatus.value.copy(
            isSyncing = false,
            pendingCount = 0,
            lastUploadAt = Instant.now(),
        )
        return Result.success(Unit)
    }

    override suspend fun refreshStatus() = Unit

    fun observe(): Flow<SyncStatus> = syncStatus
}

class DefaultHealthSyncRepository(
    private val healthRepository: HealthRepository,
    private val pendingDao: QueuedReadingDao,
) : HealthSyncRepository {

    private val _syncStatus = MutableStateFlow(
        SyncStatus(lastUploadAt = null, pendingCount = 0),
    )
    override val syncStatus: StateFlow<SyncStatus> = _syncStatus.asStateFlow()

    override suspend fun refreshStatus() {
        _syncStatus.value = _syncStatus.value.copy(pendingCount = pendingDao.pendingCount())
    }

    override suspend fun triggerSync(): Result<Unit> {
        _syncStatus.value = _syncStatus.value.copy(isSyncing = true, lastError = null)
        return try {
            val uploaded = healthRepository.syncPending()
            val current = _syncStatus.value
            _syncStatus.value = current.copy(
                isSyncing = false,
                pendingCount = pendingDao.pendingCount(),
                // Only a real upload counts: 0 rows (nothing pending, or a rejected token) is not "last upload".
                lastUploadAt = if (uploaded > 0) Instant.now() else current.lastUploadAt,
            )
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            _syncStatus.value = _syncStatus.value.copy(
                isSyncing = false,
                pendingCount = pendingDao.pendingCount(),
                lastError = e.message,
            )
            Result.failure(e)
        }
    }
}
