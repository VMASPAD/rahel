package xyz.targapps.rahel.data.sensors

import android.content.Context
import java.time.LocalDate

/**
 * Steps since local midnight derived from the cumulative TYPE_STEP_COUNTER (steps since boot).
 * The day baseline is persisted so it survives process restarts; a reboot (counter reset) rebases to 0.
 * If the app first sees the counter mid-day, steps before that moment are not counted.
 */
internal class DailyStepsTracker(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("rahel_steps", Context.MODE_PRIVATE)

    @Synchronized
    fun stepsToday(totalSinceBoot: Long): Int {
        val today = LocalDate.now().toString()
        var baseline = prefs.getLong(KEY_BASELINE, -1L)
        val day = prefs.getString(KEY_DAY, null)
        if (day != today || baseline < 0L) {
            baseline = totalSinceBoot
            prefs.edit().putString(KEY_DAY, today).putLong(KEY_BASELINE, baseline).apply()
        } else if (totalSinceBoot < baseline) {
            // Device rebooted: the counter restarted from zero.
            baseline = 0L
            prefs.edit().putLong(KEY_BASELINE, baseline).apply()
        }
        return (totalSinceBoot - baseline).coerceIn(0L, Int.MAX_VALUE.toLong()).toInt()
    }

    private companion object {
        const val KEY_DAY = "day"
        const val KEY_BASELINE = "baseline"
    }
}
