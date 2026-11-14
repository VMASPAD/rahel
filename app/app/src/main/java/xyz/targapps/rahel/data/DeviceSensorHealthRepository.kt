package xyz.targapps.rahel.data

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import xyz.targapps.rahel.data.sensors.DerivedSensorSnapshot
import xyz.targapps.rahel.data.sensors.SensorAvailability
import xyz.targapps.rahel.data.sensors.SensorAvailabilityState
import xyz.targapps.rahel.data.sensors.SensorChannelId
import xyz.targapps.rahel.data.sensors.SensorCollector
import xyz.targapps.rahel.data.sensors.SensorReading
import xyz.targapps.rahel.data.sensors.SensorTelemetrySource
import xyz.targapps.rahel.domain.ApproximateActivityLevel
import xyz.targapps.rahel.domain.HealthSnapshot
import xyz.targapps.rahel.domain.MissionContext
import xyz.targapps.rahel.domain.MissionDynamicVitals
import xyz.targapps.rahel.domain.SensorVitals
import xyz.targapps.rahel.domain.VitalSigns
import xyz.targapps.rahel.seed.SeedProfile
import xyz.targapps.rahel.sensor.LiveSensorMetrics
import xyz.targapps.rahel.sensor.SensorAvailability as UiSensorAvailability
import xyz.targapps.rahel.sensor.SensorHub
import xyz.targapps.rahel.sensor.SensorKind
import java.time.Instant
import java.util.ArrayDeque

/**
 * [HealthRepository] backed by on-device sensors via [SensorCollector].
 */
class DeviceSensorHealthRepository(
    context: Context,
    initialCrewMemberId: String = "", // blank until the watch is paired
    private val missionContext: MissionContext = MissionContext(
        missionDay = 1,
        isolationIndex = 0.3f,
        radiationDoseMilliSvProxy = 0f,
    ),
) : HealthRepository,
    HealthDataSource,
    SensorTelemetrySource,
    SensorHub {

    @Volatile
    private var crewMemberId: String = initialCrewMemberId

    private val sensorHub = SensorCollector(context)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val historyBuffer = ArrayDeque<HealthSnapshot>(32)
    private var collectionStarted = false

    private val _latestSnapshot = MutableStateFlow<HealthSnapshot?>(null)

    private val _availabilityUi = MutableStateFlow(defaultUiAvailability())
    override val availability: StateFlow<List<UiSensorAvailability>> = _availabilityUi.asStateFlow()

    private val _liveMetrics = MutableStateFlow(LiveSensorMetrics())
    override val liveMetrics: StateFlow<LiveSensorMetrics> = _liveMetrics.asStateFlow()

    override val sensorAvailability: StateFlow<Map<SensorChannelId, SensorAvailability>> =
        sensorHub.availability

    override val sensorReadings: SharedFlow<SensorReading> = sensorHub.readings

    override val missionDynamics: StateFlow<MissionDynamicVitals> = sensorHub.dynamics

    override val derivedSnapshot: StateFlow<DerivedSensorSnapshot> = sensorHub.derived

    override val history: List<HealthSnapshot>
        get() = historyBuffer.toList()

    override val currentSnapshot: Flow<HealthSnapshot> =
        _latestSnapshot.asStateFlow().map { it ?: emptySnapshot() }

    init {
        scope.launch {
            sensorHub.refreshAvailability()
            sensorHub.availability.collect { map ->
                _availabilityUi.value = mapUiAvailability(map)
            }
        }
        scope.launch {
            sensorHub.derived.collect { derived ->
                _liveMetrics.value = derived.toLiveMetrics()
                val snap = withAmbientLight(
                    derived.toHealthSnapshot(crewMemberId, missionContext),
                    derived.lightLux,
                )
                _latestSnapshot.value = snap
                if (historyBuffer.isEmpty() || historyBuffer.last().timestamp != snap.timestamp) {
                    historyBuffer.addLast(snap)
                    while (historyBuffer.size > 32) {
                        historyBuffer.removeFirst()
                    }
                }
            }
        }
        _latestSnapshot.value = null
    }

    override fun liveSnapshots(): Flow<HealthSnapshot> = currentSnapshot

    fun setCrewMemberId(id: String) {
        if (id == crewMemberId) return
        crewMemberId = id
        _latestSnapshot.value = _latestSnapshot.value?.copy(crewMemberId = id)
    }

    /** Detected-sensor inventory for the analytics endpoint; null until collection has warmed up. */
    fun buildSensorInventory(): xyz.targapps.rahel.data.remote.DeviceSensorsRequest? =
        sensorHub.buildInventory()

    override suspend fun refreshSensorAvailability() {
        sensorHub.refreshAvailability()
    }

    override fun refreshAvailability() {
        scope.launch { sensorHub.refreshAvailability() }
    }

    override fun startSensorCollection() {
        collectionStarted = true
        // Idempotent: also re-registers sensors that failed earlier (permissions granted later).
        sensorHub.startCollection()
    }

    override fun stopSensorCollection() {
        collectionStarted = false
        sensorHub.stopCollection()
    }

    override fun setSeedProfile(_profile: SeedProfile) {
        // Seed demos disabled — vitals come only from device sensors.
    }

    private fun withAmbientLight(base: HealthSnapshot, ambientLightLux: Float?): HealthSnapshot {
        val lux = ambientLightLux ?: base.mission.ambientLightLux
        return if (lux == null) base else base.copy(
            mission = base.mission.copy(ambientLightLux = lux),
        )
    }

    private fun emptySnapshot(): HealthSnapshot = HealthSnapshot(
        timestamp = Instant.now(),
        crewMemberId = crewMemberId,
        vitals = VitalSigns(
            heartRateBpm = 0,
            restingHeartRateBpm = 0,
            hrvMs = 0,
            spO2Percent = 0,
            stepsToday = 0,
            sleepHoursLastNight = 0f,
            skinTempCelsius = 0f,
            stressScore = 0,
        ),
        mission = missionContext,
    )

    private fun DerivedSensorSnapshot.toHealthSnapshot(
        crewId: String,
        mission: MissionContext,
    ): HealthSnapshot {
        val d = dynamics
        val hr = d.hrResting ?: heartRateBpm ?: 0
        val measuredHr = (heartRateBpm ?: d.hrResting)?.takeIf { it > 0 }
        return HealthSnapshot(
            timestamp = timestamp,
            crewMemberId = crewId,
            vitals = VitalSigns(
                heartRateBpm = hr,
                restingHeartRateBpm = if (d.motion == 0) hr else (d.hrResting ?: hr),
                hrvMs = d.hrvMs ?: 0,
                spO2Percent = d.spo2Pct ?: 0,
                stepsToday = stepsToday ?: 0,
                sleepHoursLastNight = 0f,
                skinTempCelsius = 0f,
                stressScore = when (d.activityLevel) {
                    ApproximateActivityLevel.STATIONARY -> 20
                    ApproximateActivityLevel.LIGHT -> 35
                    ApproximateActivityLevel.MODERATE -> 55
                    ApproximateActivityLevel.VIGOROUS -> 75
                },
            ),
            mission = mission,
            sensorVitals = SensorVitals(
                heartRateBpm = measuredHr,
                restingHeartRateBpm = if (d.motion == 0) measuredHr else null,
                // The watch only exposes BPM (no RR intervals): the on-device HRV is an estimate, not uploaded.
                hrvMs = null,
                spO2Percent = d.spo2Pct,
                stepsToday = stepsToday,
                // No skin-temperature sensor: ambient temperature must never be reported as skin temp.
                skinTempCelsius = null,
                onWrist = d.offBody?.let { !it },
                sampleAtEpochMs = if (measuredHr != null) heartRateAt?.toEpochMilli() else null,
            ),
        )
    }

    private fun DerivedSensorSnapshot.toLiveMetrics(): LiveSensorMetrics {
        val d = dynamics
        val motionLabel = when (d.activityLevel) {
            ApproximateActivityLevel.STATIONARY -> "Stationary"
            ApproximateActivityLevel.LIGHT -> "Light"
            ApproximateActivityLevel.MODERATE -> "Moderate"
            ApproximateActivityLevel.VIGOROUS -> "Vigorous"
        }
        return LiveSensorMetrics(
            heartRateBpm = d.hrResting ?: heartRateBpm,
            spO2Percent = d.spo2Pct,
            motionLabel = motionLabel,
            motionMagnitude = d.deltaAz,
            stepsToday = stepsToday,
            pressureHpa = barometerHpa,
            updatedAt = timestamp,
        )
    }

    private fun mapUiAvailability(
        map: Map<SensorChannelId, SensorAvailability>,
    ): List<UiSensorAvailability> = listOf(
        uiRow(SensorKind.HEART_RATE, "HR", map, SensorChannelId.HEART_RATE, SensorChannelId.HEART_RATE_HEALTH_SERVICES),
        uiRow(SensorKind.SPO2, "SpO₂", map, SensorChannelId.SPO2),
        uiRow(SensorKind.MOTION, "Motion", map, SensorChannelId.ACCELEROMETER, SensorChannelId.GYROSCOPE),
        uiRow(SensorKind.STEPS, "Steps", map, SensorChannelId.STEP_COUNTER, SensorChannelId.STEP_DETECTOR),
        uiRow(SensorKind.BAROMETER, "Barometer", map, SensorChannelId.BAROMETER),
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

    private fun defaultUiAvailability(): List<UiSensorAvailability> = listOf(
        UiSensorAvailability(SensorKind.HEART_RATE, false, "HR"),
        UiSensorAvailability(SensorKind.SPO2, false, "SpO₂"),
        UiSensorAvailability(SensorKind.MOTION, false, "Motion"),
        UiSensorAvailability(SensorKind.STEPS, false, "Steps"),
        UiSensorAvailability(SensorKind.BAROMETER, false, "Barometer"),
    )
}
