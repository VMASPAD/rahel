package xyz.targapps.rahel.rules

/**
 * Demo thresholds documented in [docs/SOURCES.md].
 *
 * Sleep &lt; 6 h: chronic sleep loss on ISS (~6 h average); &lt; 6 h linked to stress/performance (PMC8919197).
 * NASA-STD-3001 targets ~8 h sleep opportunity — we flag below 6 h for watch demo.
 *
 * Steps &lt; 4000: proxy for insufficient mechanical loading (bone risk context; ~1–1.5% BMD/month in microgravity).
 *
 * HRV &lt; 30 ms: conservative consumer-watch alert for autonomic stress (not a flight medical cutoff).
 */
object SpaceHealthThresholds {
    const val SLEEP_HOURS_WATCH = 6f
    const val SLEEP_HOURS_ELEVATED = 5f
    const val HRV_MS_LOW = 30
    const val HRV_MS_BEHAVIORAL = 28
    const val STRESS_SCORE_HIGH = 60
    const val STRESS_SCORE_ELEVATED = 70
    const val STEPS_BONE_WATCH = 4000
    const val STEPS_BONE_ELEVATED = 2500
    const val RESTING_HR_ELEVATED = 72
    const val RESTING_HR_TREND_BPM = 5
    const val SPO2_WATCH = 95
    const val SPO2_CRITICAL = 92
    const val RADIATION_DOSE_PROXY_MSV = 30f
    const val ISOLATION_INDEX_HIGH = 0.65f
}
