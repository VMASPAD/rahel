package xyz.targapps.rahel.data

import kotlinx.coroutines.flow.Flow
import xyz.targapps.rahel.domain.HealthSnapshot

/**
 * Live health snapshots (seed data, sensors, or future Health Connect integration).
 */
interface HealthDataSource {
    fun liveSnapshots(): Flow<HealthSnapshot>
}

/** Access sensor telemetry when the repository supports it. */
fun HealthDataSource.sensorTelemetry(): xyz.targapps.rahel.data.sensors.SensorTelemetrySource? =
    this as? xyz.targapps.rahel.data.sensors.SensorTelemetrySource
