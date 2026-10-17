package xyz.targapps.rahel.data.sensors

import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import xyz.targapps.rahel.domain.MissionDynamicVitals

/**
 * Live sensor telemetry for ViewModels and repositories.
 */
interface SensorTelemetrySource {
    val sensorAvailability: StateFlow<Map<SensorChannelId, SensorAvailability>>
    val sensorReadings: SharedFlow<SensorReading>
    val missionDynamics: StateFlow<MissionDynamicVitals>
    val derivedSnapshot: StateFlow<DerivedSensorSnapshot>

    suspend fun refreshSensorAvailability()
    fun startSensorCollection()
    fun stopSensorCollection()
}
