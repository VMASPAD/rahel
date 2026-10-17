package xyz.targapps.rahel.data.sensors

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import xyz.targapps.rahel.domain.ApproximateActivityLevel
import xyz.targapps.rahel.domain.MissionDynamicVitals
import xyz.targapps.rahel.sensor.LiveSensorMetrics
import xyz.targapps.rahel.sensor.SensorAvailability as UiSensorAvailability
import xyz.targapps.rahel.sensor.SensorHub
import xyz.targapps.rahel.sensor.SensorKind

/**
 * Bridges [SensorCollector] to the UI-facing [SensorHub] contract.
 */
class WearPlatformSensorHub(
    context: Context,
) : SensorHub,
    SensorTelemetrySource {

    private val collector = SensorCollector(context)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val _availabilityUi = MutableStateFlow(mapUiAvailability(collector.availability.value))
    override val availability: StateFlow<List<UiSensorAvailability>> = _availabilityUi.asStateFlow()

    private val _liveMetrics = MutableStateFlow(LiveSensorMetrics())
    override val liveMetrics: StateFlow<LiveSensorMetrics> = _liveMetrics.asStateFlow()

    override val sensorAvailability: StateFlow<Map<SensorChannelId, SensorAvailability>> =
        collector.availability

    override val sensorReadings: SharedFlow<SensorReading> = collector.readings

    override val missionDynamics: StateFlow<MissionDynamicVitals> = collector.dynamics

    override val derivedSnapshot: StateFlow<DerivedSensorSnapshot> = collector.derived

    init {
        scope.launch {
            collector.availability.collect { map ->
                _availabilityUi.value = mapUiAvailability(map)
            }
        }
        scope.launch {
            collector.derived.collect { derived ->
                _liveMetrics.value = derived.toLiveMetrics()
            }
        }
        scope.launch {
            collector.refreshAvailability()
            collector.startCollection()
        }
    }

    override fun refreshAvailability() {
        scope.launch { collector.refreshAvailability() }
    }

    override suspend fun refreshSensorAvailability() {
        collector.refreshAvailability()
    }

    override fun startSensorCollection() {
        collector.startCollection()
    }

    override fun stopSensorCollection() {
        collector.stopCollection()
    }

    private fun mapUiAvailability(
        map: Map<SensorChannelId, SensorAvailability>,
    ): List<UiSensorAvailability> = listOf(
        uiRow(SensorKind.HEART_RATE, "FC", map, SensorChannelId.HEART_RATE, SensorChannelId.HEART_RATE_HEALTH_SERVICES),
        uiRow(SensorKind.SPO2, "SpO₂", map, SensorChannelId.SPO2),
        uiRow(SensorKind.MOTION, "Movimiento", map, SensorChannelId.ACCELEROMETER, SensorChannelId.GYROSCOPE),
        uiRow(SensorKind.STEPS, "Pasos", map, SensorChannelId.STEP_COUNTER, SensorChannelId.STEP_DETECTOR),
        uiRow(SensorKind.BAROMETER, "Barómetro", map, SensorChannelId.BAROMETER),
    )

    private fun uiRow(
        kind: SensorKind,
        label: String,
        map: Map<SensorChannelId, SensorAvailability>,
        vararg channels: SensorChannelId,
    ): UiSensorAvailability {
        val available = channels.any { map[it]?.state == SensorAvailabilityState.AVAILABLE }
        val reason = channels.firstNotNullOfOrNull { map[it]?.reason }
        return UiSensorAvailability(
            kind = kind,
            available = available,
            displayName = if (reason != null && !available) "$label ($reason)" else label,
        )
    }

    private fun DerivedSensorSnapshot.toLiveMetrics(): LiveSensorMetrics {
        val d = dynamics
        val motionLabel = when (d.activityLevel) {
            ApproximateActivityLevel.STATIONARY -> "Estacionario"
            ApproximateActivityLevel.LIGHT -> "Ligero"
            ApproximateActivityLevel.MODERATE -> "Moderado"
            ApproximateActivityLevel.VIGOROUS -> "Vigoroso"
        }
        return LiveSensorMetrics(
            heartRateBpm = d.hrResting ?: heartRateBpm,
            spO2Percent = d.spo2Pct,
            motionLabel = motionLabel,
            motionMagnitude = d.deltaAz,
            stepsToday = d.stepsSession.toInt(),
            pressureHpa = barometerHpa,
            updatedAt = timestamp,
        )
    }
}
