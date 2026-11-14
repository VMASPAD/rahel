package xyz.targapps.rahel.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface QueuedReadingDao {

    @Insert
    suspend fun insert(entity: QueuedReadingEntity): Long

    @Query("SELECT COUNT(*) FROM queued_readings")
    suspend fun pendingCount(): Int

    @Query("DELETE FROM queued_readings WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<Long>)

    @Query("DELETE FROM queued_readings")
    suspend fun clearAll()

    @Query("SELECT * FROM queued_readings WHERE item_kind = 'PROFILE_SNAPSHOT' ORDER BY id ASC")
    suspend fun profileRows(): List<QueuedReadingEntity>

    @Query("SELECT COUNT(*) FROM queued_readings WHERE item_kind = 'PROFILE_SNAPSHOT'")
    suspend fun profileRowCount(): Int

    /** Batch id of the oldest batch that was frozen but not yet acknowledged, if any. */
    @Query("SELECT batch_id FROM queued_readings WHERE batch_id IS NOT NULL ORDER BY id ASC LIMIT 1")
    suspend fun inFlightBatchId(): String?

    @Query("SELECT * FROM queued_readings WHERE batch_id = :batchId ORDER BY id ASC")
    suspend fun rowsOfBatch(batchId: String): List<QueuedReadingEntity>

    /** Crew of the oldest row not yet assigned to a batch (telemetry rows only). */
    @Query(
        """
        SELECT crew_member_id FROM queued_readings
        WHERE batch_id IS NULL AND item_kind != 'PROFILE_SNAPSHOT'
        ORDER BY id ASC LIMIT 1
        """,
    )
    suspend fun oldestUnassignedCrew(): String?

    @Query(
        """
        SELECT * FROM queued_readings
        WHERE batch_id IS NULL AND item_kind != 'PROFILE_SNAPSHOT' AND crew_member_id = :crew
        ORDER BY id ASC LIMIT :limit
        """,
    )
    suspend fun unassignedForCrew(crew: String, limit: Int): List<QueuedReadingEntity>

    @Query("UPDATE queued_readings SET batch_id = :batchId WHERE id IN (:ids)")
    suspend fun assignBatch(ids: List<Long>, batchId: String)

    /** Keeps only the newest [max] rows that are not part of an in-flight batch. */
    @Query(
        """
        DELETE FROM queued_readings
        WHERE batch_id IS NULL AND id IN (
            SELECT id FROM queued_readings ORDER BY id DESC LIMIT -1 OFFSET :max
        )
        """,
    )
    suspend fun trimToNewest(max: Int)
}
