package xyz.targapps.rahel.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface QueuedReadingDao {

    @Insert
    suspend fun insert(entity: QueuedReadingEntity): Long

    @Query(
        """
        SELECT * FROM queued_readings
        ORDER BY created_at_epoch_ms ASC
        LIMIT :limit
        """,
    )
    suspend fun peekPending(limit: Int = 100): List<QueuedReadingEntity>

    @Query("SELECT COUNT(*) FROM queued_readings")
    suspend fun pendingCount(): Int

    @Query("DELETE FROM queued_readings WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<Long>)
}
