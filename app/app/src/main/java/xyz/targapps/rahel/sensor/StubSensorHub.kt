package xyz.targapps.rahel.sensor

import java.time.Instant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import xyz.targapps.rahel.domain.HealthSnapshot

class StubSensorHub : SensorHub {

    private val _availability = MutableStateFlow(defaultAvailability())
    override val availability: StateFlow<List<SensorAvailability>> = _availability.asStateFlow()

    private val _liveMetrics = MutableStateFlow(LiveSensorMetrics())
    override val liveMetrics: StateFlow<LiveSensorMetrics> = _liveMetrics.asStateFlow()

    fun updateFromSnapshot(snap: HealthSnapshot) {
        _liveMetrics.value = snap.toLiveMetrics()
        _availability.value = availabilityFrom(snap)
    }

    override fun refreshAvailability() {
        // No-op until platform layer binds real sensors.
    }

    private fun availabilityFrom(snap: HealthSnapshot): List<SensorAvailability> =
        defaultAvailability().map { item ->
            when (item.kind) {
                SensorKind.SPO2 -> item.copy(available = snap.vitals.spO2Percent > 0)
                else -> item
            }
        }

    private fun HealthSnapshot.toLiveMetrics(): LiveSensorMetrics {
        val v = vitals
        val motion = when {
            v.stepsToday > 8000 -> "High"
            v.stepsToday > 3000 -> "Moderate"
            else -> "Low"
        }
        return LiveSensorMetrics(
            heartRateBpm = v.heartRateBpm,
            spO2Percent = if (v.spO2Percent > 0) v.spO2Percent else null,
            motionLabel = motion,
            motionMagnitude = (v.stepsToday / 10_000f).coerceIn(0f, 1f),
            stepsToday = v.stepsToday,
            pressureHpa = 1013.25f - mission.isolationIndex * 2f,
            updatedAt = timestamp,
        )
    }

    companion object {
        fun defaultAvailability(): List<SensorAvailability> = listOf(
            SensorAvailability(SensorKind.HEART_RATE, true, "HR"),
            SensorAvailability(SensorKind.SPO2, true, "SpO₂"),
            SensorAvailability(SensorKind.MOTION, true, "Motion"),
            SensorAvailability(SensorKind.STEPS, true, "Steps"),
            SensorAvailability(SensorKind.BAROMETER, false, "Barometer"),
        )
    }
}
