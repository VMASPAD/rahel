package xyz.targapps.rahel.sensor

import java.time.Instant
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

enum class SensorKind {
    HEART_RATE,
    SPO2,
    MOTION,
    STEPS,
    BAROMETER,
}

data class SensorAvailability(
    val kind: SensorKind,
    val available: Boolean,
    val displayName: String,
)

data class LiveSensorMetrics(
    val heartRateBpm: Int? = null,
    val spO2Percent: Int? = null,
    val motionLabel: String? = null,
    val motionMagnitude: Float? = null,
    val stepsToday: Int? = null,
    val pressureHpa: Float? = null,
    val updatedAt: Instant? = null,
)

/**
 * Live device sensors; real implementation can be provided by the platform agent.
 */
interface SensorHub {
    val availability: StateFlow<List<SensorAvailability>>
    val liveMetrics: StateFlow<LiveSensorMetrics>
    fun refreshAvailability()
}

interface SensorMetricsSource {
    fun observeLiveMetrics(): Flow<LiveSensorMetrics>
}
