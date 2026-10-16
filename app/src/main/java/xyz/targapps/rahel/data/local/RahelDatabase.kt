package xyz.targapps.rahel.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [QueuedReadingEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class RahelDatabase : RoomDatabase() {
    abstract fun queuedReadingDao(): QueuedReadingDao

    companion object {
        @Volatile
        private var instance: RahelDatabase? = null

        fun get(context: Context): RahelDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    RahelDatabase::class.java,
                    "rahel_health.db",
                ).build().also { instance = it }
            }
    }
}
