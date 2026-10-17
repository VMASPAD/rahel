package xyz.targapps.rahel.data.sensors

import xyz.targapps.rahel.domain.ApproximateActivityLevel
import xyz.targapps.rahel.domain.MissionDynamicVitals
import java.time.Instant

enum class SensorChannelId {
    HEART_RATE,
    HEART_RATE_HEALTH_SERVICES,
    SPO2,
    ACCELEROMETER,
    GYROSCOPE,
    BAROMETER,
    LIGHT,
    STEP_COUNTER,
    STEP_DETECTOR,
    AMBIENT_TEMPERATURE,
    OFF_BODY,
    LOW_LATENCY_OFF_BODY,
    SIGNIFICANT_MOTION,
    ECG,
    HRV,
}

enum class SensorAvailabilityState {
    AVAILABLE,
    UNAVAILABLE,
}

data class SensorAvailability(
    val state: SensorAvailabilityState,
    val reason: String? = null,
)

sealed class SensorReading {
    abstract val channel: SensorChannelId
    abstract val timestamp: Instant

    data class Scalar(
        override val channel: SensorChannelId,
        override val timestamp: Instant,
        val value: Float,
        val unit: String,
    ) : SensorReading()

    data class Vector3(
        override val channel: SensorChannelId,
        override val timestamp: Instant,
        val x: Float,
        val y: Float,
        val z: Float,
        val unit: String = "m/s²",
    ) : SensorReading()

    data class BooleanState(
        override val channel: SensorChannelId,
        override val timestamp: Instant,
        val active: Boolean,
    ) : SensorReading()

    data class StepEvent(
        override val timestamp: Instant,
        val totalSinceBoot: Long? = null,
    ) : SensorReading() {
        override val channel: SensorChannelId = SensorChannelId.STEP_DETECTOR
    }
}

data class DerivedSensorSnapshot(
    val timestamp: Instant = Instant.now(),
    val dynamics: MissionDynamicVitals = MissionDynamicVitals(),
    val heartRateBpm: Int? = null,
    val barometerHpa: Float? = null,
    val lightLux: Float? = null,
    val ambientTempCelsius: Float? = null,
    val gyroMagnitude: Float? = null,
)

fun DerivedSensorSnapshot.toMissionDynamicVitals(): MissionDynamicVitals = dynamics.copy(
    hrResting = dynamics.hrResting ?: heartRateBpm,
)
