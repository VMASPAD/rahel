package xyz.targapps.rahel.data

import java.time.Instant
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
            healthRepository.syncPending()
            _syncStatus.value = _syncStatus.value.copy(
                isSyncing = false,
                pendingCount = pendingDao.pendingCount(),
                lastUploadAt = Instant.now(),
            )
            Result.success(Unit)
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
