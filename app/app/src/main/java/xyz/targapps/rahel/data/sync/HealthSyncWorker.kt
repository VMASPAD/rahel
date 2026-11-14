package xyz.targapps.rahel.data.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.CancellationException
import xyz.targapps.rahel.RaHelApp

class HealthSyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val repository = (applicationContext as RaHelApp).healthRepository
        return try {
            // syncPending throws on network errors / 5xx; success means the queue was processed.
            repository.syncPending()
            Result.success()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.w("HealthSyncWorker", "Sync failed, will retry", e)
            Result.retry()
        }
    }
}
