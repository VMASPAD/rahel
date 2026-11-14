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
    /** datos.md §3 — |Z| bands */
    const val Z_NORMAL_MAX = 1.5
    const val Z_YELLOW_MAX = 2.5

    /** Part I Event 1 */
    const val AFIB_RESTING_HR_BPM = 120

    /** Part I Event 2 */
    const val RADIATION_HRV_Z_TRIGGER = -2.0
    const val RADIATION_FLUX_PFU_TRIGGER = 10.0

    /** Part I Event 3 */
    const val ORTHOSTATIC_DELTA_AZ_MPS2 = 2.5f
    const val ORTHOSTATIC_DELTA_AZ_SENSITIZED_MPS2 = 2.0f
    const val ORTHOSTATIC_DELTA_HR_5S_MAX = 5
    const val ORTHOSTATIC_DELTA_SPO2_MAX = -2.0f

    /** Part I Event 4 */
    const val CIRCADIAN_SKIN_TEMP_C = 37.0f
    const val CIRCADIAN_HRV_Z_TRIGGER = -1.5
    const val CIRCADIAN_NOCTURNAL_MOTION_THRESHOLD = 0.45f

    /** Part I Event 5 */
    const val CO2_PPM_TRIGGER = 4000
    const val CO2_SPO2_PERCENT_MAX = 94
    const val CO2_HR_BASELINE_MULTIPLIER = 1.2f

    /** Sensor processing */
    const val MOTION_ACCEL_Z_DELTA_THRESHOLD = 0.35f
    const val RESTING_HR_EMA_ALPHA = 0.15f
    const val HRV_7D_WINDOW_MS = 7L * 24 * 60 * 60 * 1000
    const val HR_HISTORY_WINDOW_MS = 6_000L

    /** Default σ when calibrating from baseline vector (prototipo). */
    const val SIGMA_HR_FRACTION = 0.12f
    const val SIGMA_HR_MIN = 5.0
    const val SIGMA_HRV_FRACTION = 0.25f
    const val SIGMA_HRV_MIN = 8.0
    const val SIGMA_SPO2 = 1.2
    const val SIGMA_SKIN_TEMP = 0.25

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
