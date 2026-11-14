package xyz.targapps.rahel.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [QueuedReadingEntity::class],
    version = 2,
    exportSchema = false,
)
abstract class RahelDatabase : RoomDatabase() {
    abstract fun queuedReadingDao(): QueuedReadingDao

    companion object {
        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE queued_readings ADD COLUMN batch_id TEXT")
            }
        }

        @Volatile
        private var instance: RahelDatabase? = null

        fun get(context: Context): RahelDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    RahelDatabase::class.java,
                    "rahel_health.db",
                ).addMigrations(MIGRATION_1_2).build().also { instance = it }
            }
    }
}
