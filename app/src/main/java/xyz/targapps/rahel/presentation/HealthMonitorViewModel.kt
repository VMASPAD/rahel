package xyz.targapps.rahel.presentation

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import xyz.targapps.rahel.data.HealthRepository
import xyz.targapps.rahel.data.HealthSyncRepository
import xyz.targapps.rahel.data.SyncStatus
import xyz.targapps.rahel.data.sensors.SensorTelemetrySource
import xyz.targapps.rahel.domain.AssessmentResult
import xyz.targapps.rahel.domain.HealthAssessment
import xyz.targapps.rahel.domain.MissionDynamicVitals
import xyz.targapps.rahel.domain.HealthSnapshot
import xyz.targapps.rahel.domain.ProcessedVitalsSnapshot
import xyz.targapps.rahel.domain.SensorSample
import xyz.targapps.rahel.domain.ZScoreEvaluation
import xyz.targapps.rahel.rules.HealthAssessmentEngine
import xyz.targapps.rahel.seed.SeedProfile
import xyz.targapps.rahel.sensor.LiveSensorMetrics
import xyz.targapps.rahel.sensor.SensorAvailability
import xyz.targapps.rahel.sensor.SensorHub

enum class DashboardPage {
    Overview,
    Sensors,
    Alerts,
    Sync,
}

enum class MonitorScreen {
    Dashboard,
    ProfilePicker,
    ConditionDetail,
}

class HealthMonitorViewModel(
    private val repository: HealthRepository,
    private val engine: HealthAssessmentEngine,
    private val sensorHub: SensorHub,
    private val syncRepository: HealthSyncRepository,
) : ViewModel() {

    private var latestProcessedVitals: ProcessedVitalsSnapshot? = null
    private var latestMissionDynamics: MissionDynamicVitals? = null

    var screen by mutableStateOf(MonitorScreen.Dashboard)
        private set

    var dashboardPage by mutableIntStateOf(DashboardPage.Overview.ordinal)
        private set

    var snapshot by mutableStateOf<HealthSnapshot?>(null)
        private set

    var assessment by mutableStateOf<AssessmentResult?>(null)
        private set

    var healthAssessment by mutableStateOf<HealthAssessment?>(null)
        private set

    val zScores: List<ZScoreEvaluation>
        get() = healthAssessment?.zScores ?: emptyList()

    var selectedConditionId by mutableStateOf<String?>(null)
        private set

    var seedProfile by mutableStateOf(SeedProfile.HEALTHY_CREW)
        private set

    val sensorAvailability: StateFlow<List<SensorAvailability>> = sensorHub.availability
    val liveMetrics: StateFlow<LiveSensorMetrics> = sensorHub.liveMetrics
    val syncStatus: StateFlow<SyncStatus> = syncRepository.syncStatus

    init {
        (sensorHub as? SensorTelemetrySource)?.let { telemetry ->
            viewModelScope.launch {
                telemetry.derivedSnapshot.collect { derived ->
                    val dynamics = derived.dynamics
                    latestMissionDynamics = dynamics
                    latestProcessedVitals = engine.ingestSensorSample(
                        SensorSample(
                            timestampMillis = derived.timestamp.toEpochMilli(),
                            heartRateBpm = derived.heartRateBpm ?: dynamics.hrResting,
                            hrvMs = dynamics.hrvMs,
                            spO2Percent = dynamics.spo2Pct,
                            accelZMps2 = dynamics.accelZMps2,
                            skinTempCelsius = derived.ambientTempCelsius,
                            motion = dynamics.motion,
                            ecgAnomaly = dynamics.ecgFlag,
                        ),
                    )
                }
            }
        }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val snap = repository.currentSnapshot.first()
            snapshot = snap
            val full = engine.assessHealth(
                snap,
                repository.history,
                latestProcessedVitals,
                latestMissionDynamics,
            )
            healthAssessment = full
            assessment = full.legacyAssessment
            repository.recordAssessmentCycle(snap, full)
            syncRepository.refreshStatus()
            sensorHub.refreshAvailability()
        }
    }

    fun selectDashboardPage(index: Int) {
        dashboardPage = index.coerceIn(0, DashboardPage.entries.size - 1)
    }

    fun navigate(to: MonitorScreen) {
        screen = to
    }

    fun openCondition(conditionId: String) {
        selectedConditionId = conditionId
        screen = MonitorScreen.ConditionDetail
    }

    fun selectProfile(profile: SeedProfile) {
        seedProfile = profile
        engine.resetWellnessState()
        repository.setSeedProfile(profile)
        refresh()
        screen = MonitorScreen.Dashboard
    }

    fun triggerSync() {
        viewModelScope.launch {
            syncRepository.triggerSync()
        }
    }

    fun selectedCondition() =
        assessment?.conditions?.find { it.conditionId == selectedConditionId }

    class Factory(
        private val repository: HealthRepository,
        private val engine: HealthAssessmentEngine,
        private val sensorHub: SensorHub,
        private val syncRepository: HealthSyncRepository,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return HealthMonitorViewModel(
                repository,
                engine,
                sensorHub,
                syncRepository,
            ) as T
        }
    }
}
