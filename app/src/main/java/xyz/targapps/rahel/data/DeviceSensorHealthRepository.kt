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
import xyz.targapps.rahel.data.sensors.SensorChannelId
import xyz.targapps.rahel.data.sensors.SensorCollector
import xyz.targapps.rahel.data.sensors.SensorReading
import xyz.targapps.rahel.data.sensors.SensorTelemetrySource
import xyz.targapps.rahel.domain.HealthSnapshot
import xyz.targapps.rahel.domain.MissionContext
import xyz.targapps.rahel.domain.MissionDynamicVitals
import xyz.targapps.rahel.domain.VitalSigns
import xyz.targapps.rahel.seed.SeedData
import xyz.targapps.rahel.seed.SeedProfile
import java.time.Instant
import java.util.ArrayDeque

/**
 * [HealthRepository] backed by on-device sensors via [SensorCollector].
 */
class DeviceSensorHealthRepository(
    context: Context,
    private val crewMemberId: String = "CMD-01",
    private val missionContext: MissionContext = MissionContext(
        missionDay = 1,
        isolationIndex = 0.3f,
        radiationDoseMilliSvProxy = 0f,
    ),
) : HealthRepository,
    HealthDataSource,
    SensorTelemetrySource {

    private val sensorHub = SensorCollector(context)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private val historyBuffer = ArrayDeque<HealthSnapshot>(32)
    private var seedProfile: SeedProfile = SeedProfile.HEALTHY_CREW

    private val _latestSnapshot = MutableStateFlow<HealthSnapshot?>(null)

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
            sensorHub.startCollection()
        }
        scope.launch {
            sensorHub.derived.collect { derived ->
                val snap = applySeedOverlay(
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
    }

    override fun liveSnapshots(): Flow<HealthSnapshot> = currentSnapshot

    override suspend fun refreshSensorAvailability() {
        sensorHub.refreshAvailability()
    }

    override fun startSensorCollection() {
        sensorHub.startCollection()
    }

    override fun stopSensorCollection() {
        sensorHub.stopCollection()
    }

    override fun setSeedProfile(profile: SeedProfile) {
        seedProfile = profile
        historyBuffer.clear()
        SeedData.historyFor(profile).forEach { historyBuffer.addLast(it) }
        _latestSnapshot.value = applySeedOverlay(
            SeedData.snapshot(profile, crewMemberId),
            ambientLightLux = null,
        )
    }

    /**
     * Demo SEED overlays mission/vitals from [SeedData] while keeping live HR/SpO₂ when present.
     */
    private fun applySeedOverlay(base: HealthSnapshot, ambientLightLux: Float?): HealthSnapshot {
        if (seedProfile == SeedProfile.HEALTHY_CREW) {
            val lux = ambientLightLux ?: base.mission.ambientLightLux
            return if (lux == null) base else base.copy(
                mission = base.mission.copy(ambientLightLux = lux),
            )
        }
        val seed = SeedData.snapshot(seedProfile, base.crewMemberId)
        val liveHr = base.vitals.heartRateBpm.takeIf { it > 0 }
        val liveSpo2 = base.vitals.spO2Percent.takeIf { it > 0 }
        val lux = ambientLightLux ?: seed.mission.ambientLightLux
        return seed.copy(
            timestamp = base.timestamp,
            vitals = seed.vitals.copy(
                heartRateBpm = liveHr ?: seed.vitals.heartRateBpm,
                spO2Percent = liveSpo2 ?: seed.vitals.spO2Percent,
                skinTempCelsius = base.vitals.skinTempCelsius.takeIf { it > 0f }
                    ?: seed.vitals.skinTempCelsius,
            ),
            mission = seed.mission.copy(ambientLightLux = lux),
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
        return HealthSnapshot(
            timestamp = timestamp,
            crewMemberId = crewId,
            vitals = VitalSigns(
                heartRateBpm = hr,
                restingHeartRateBpm = if (d.motion == 0) hr else (d.hrResting ?: hr),
                hrvMs = d.hrvMs ?: 0,
                spO2Percent = d.spo2Pct ?: 0,
                stepsToday = d.stepsSession.toInt(),
                sleepHoursLastNight = 0f,
                skinTempCelsius = ambientTempCelsius ?: 0f,
                stressScore = when (d.activityLevel) {
                    xyz.targapps.rahel.domain.ApproximateActivityLevel.STATIONARY -> 20
                    xyz.targapps.rahel.domain.ApproximateActivityLevel.LIGHT -> 35
                    xyz.targapps.rahel.domain.ApproximateActivityLevel.MODERATE -> 55
                    xyz.targapps.rahel.domain.ApproximateActivityLevel.VIGOROUS -> 75
                },
            ),
            mission = mission,
        )
    }
}
