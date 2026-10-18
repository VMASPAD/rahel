package xyz.targapps.rahel.presentation

import android.os.SystemClock
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
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
    ConditionDetail,
}

class HealthMonitorViewModel(
    private val repository: HealthRepository,
    private val engine: HealthAssessmentEngine,
    private val sensorHub: SensorHub,
    private val syncRepository: HealthSyncRepository,
) : ViewModel() {

    private companion object {
        /** Live UI refresh period (nothing is persisted or uploaded at this rate). */
        const val UI_REFRESH_INTERVAL_MS = 1_000L

        /** Minimum period between samples persisted to the upload queue. */
        const val RECORD_INTERVAL_MS = 30_000L
    }

    private var lastRecordedAtMs: Long = -RECORD_INTERVAL_MS

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

    val sensorAvailability: StateFlow<List<SensorAvailability>> = sensorHub.availability
    val liveMetrics: StateFlow<LiveSensorMetrics> = sensorHub.liveMetrics
    val syncStatus: StateFlow<SyncStatus> = syncRepository.syncStatus

    init {
        sensorHub.let { hub ->
            val telemetry = hub as? SensorTelemetrySource ?: return@let
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
                            // No skin-temperature sensor on the watch: never feed ambient temperature here.
                            skinTempCelsius = null,
                            motion = dynamics.motion,
                            ecgAnomaly = dynamics.ecgFlag,
                        ),
                    )
                }
            }
        }
        viewModelScope.launch {
            var tick = 0
            while (isActive) {
                runTelemetryCycle()
                if (tick++ % 15 == 0) {
                    sensorHub.refreshAvailability()
                }
                delay(UI_REFRESH_INTERVAL_MS)
            }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            runTelemetryCycle()
            sensorHub.refreshAvailability()
        }
    }

    private suspend fun runTelemetryCycle() {
        try {
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
            val now = SystemClock.elapsedRealtime()
            if (now - lastRecordedAtMs >= RECORD_INTERVAL_MS) {
                // Only advances the timer when a valid sample (real HR, on wrist, paired) was queued.
                if (repository.recordAssessmentCycle(snap, full)) {
                    lastRecordedAtMs = now
                }
            }
            syncRepository.refreshStatus()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Log.w("HealthMonitorVM", "Telemetry cycle failed", e)
            try {
                syncRepository.refreshStatus()
            } catch (c: CancellationException) {
                throw c
            } catch (_: Exception) {
            }
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
