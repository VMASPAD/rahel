package xyz.targapps.rahel.data.local

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/** Offline queue row: sensor reading, assessment, or profile snapshot (JSON payload). */
@Entity(tableName = "queued_readings")
data class QueuedReadingEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "item_kind") val itemKind: String,
    @ColumnInfo(name = "crew_member_id") val crewMemberId: String,
    @ColumnInfo(name = "payload_json") val payloadJson: String,
    @ColumnInfo(name = "created_at_epoch_ms") val createdAtEpochMs: Long,
)

object QueueItemKind {
    const val SENSOR_READING = "SENSOR_READING"
    const val HEALTH_ASSESSMENT = "HEALTH_ASSESSMENT"
    const val PROFILE_SNAPSHOT = "PROFILE_SNAPSHOT"
}
