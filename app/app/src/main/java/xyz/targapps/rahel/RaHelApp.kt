package xyz.targapps.rahel

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import xyz.targapps.rahel.service.HealthForegroundService
import xyz.targapps.rahel.data.DefaultHealthSyncRepository
import xyz.targapps.rahel.data.DevicePairingRepository
import xyz.targapps.rahel.data.DeviceSensorHealthRepository
import xyz.targapps.rahel.data.HealthRepository
import xyz.targapps.rahel.data.HealthSyncRepository
import xyz.targapps.rahel.data.SyncingHealthRepository
import xyz.targapps.rahel.data.TelemetryRecorder
import xyz.targapps.rahel.data.UserProfileRepository
import xyz.targapps.rahel.data.local.RahelDatabase
import xyz.targapps.rahel.data.remote.RemoteApiFactory
import xyz.targapps.rahel.data.sensors.SensorTelemetrySource
import xyz.targapps.rahel.data.sync.HealthSyncScheduler
import xyz.targapps.rahel.data.toOnboardingProfileInput
import xyz.targapps.rahel.rules.HealthAssessmentEngine
import xyz.targapps.rahel.sensor.SensorHub
import java.util.concurrent.atomic.AtomicReference

class RaHelApp : Application() {
    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private lateinit var sensorRepository: DeviceSensorHealthRepository

    lateinit var devicePairingRepository: DevicePairingRepository
    lateinit var healthRepository: HealthRepository
    lateinit var userProfileRepository: UserProfileRepository
    lateinit var syncRepository: HealthSyncRepository
    val assessmentEngine: HealthAssessmentEngine = HealthAssessmentEngine()

    /** Separate engine for the background recorder, so recording never depends on the UI. */
    private val recorderEngine: HealthAssessmentEngine = HealthAssessmentEngine()

    private val deviceTokenCache = AtomicReference<String?>(null)

    private val _collectionEnabled = MutableStateFlow(false)

    /** True when onboarded and the user turned monitoring on (pairing is NOT required; uploads need it): sensors collect and the foreground service runs. */
    val collectionEnabled: StateFlow<Boolean> = _collectionEnabled

    /** Idempotent; also re-registers sensors whose permission was granted after the first attempt. */
    fun ensureSensorCollection() {
        if (_collectionEnabled.value) sensorRepository.startSensorCollection()
    }

    /** Called from the UI when the user taps Start / Stop monitoring. */
    fun setMonitoring(enabled: Boolean) {
        applicationScope.launch { userProfileRepository.setMonitoringEnabled(enabled) }
    }

    val sensorHub: SensorHub
        get() = sensorRepository

    val sensorTelemetry: SensorTelemetrySource
        get() = sensorRepository

    override fun onCreate() {
        super.onCreate()
        devicePairingRepository = DevicePairingRepository(this)
        sensorRepository = DeviceSensorHealthRepository(this)
        userProfileRepository = UserProfileRepository(this)
        // No runBlocking: pairing state loads asynchronously (UI shows a loading state meanwhile).
        applicationScope.launch {
            devicePairingRepository.pairingState.collect { pairing ->
                deviceTokenCache.set(pairing.deviceToken)
                sensorRepository.setCrewMemberId(pairing.crewMemberId.orEmpty())
            }
        }
        applicationScope.launch {
            userProfileRepository.userProfile
                .distinctUntilChanged()
                .collect { profile ->
                    profile.toOnboardingProfileInput()?.let { input ->
                        assessmentEngine.setBaselineFromOnboarding(input)
                        recorderEngine.setBaselineFromOnboarding(input)
                    }
                }
        }
        applicationScope.launch {
            combine(
                devicePairingRepository.pairingState.map { it.isPaired },
                userProfileRepository.userProfile.map { it.onboardingComplete },
                userProfileRepository.monitoringEnabled,
            ) { _, onboarded, monitoring -> onboarded && monitoring }
                .distinctUntilChanged()
                .collect { enabled ->
                    _collectionEnabled.value = enabled
                    if (enabled) {
                        sensorRepository.startSensorCollection()
                    } else {
                        sensorRepository.stopSensorCollection()
                        HealthForegroundService.stop(this@RaHelApp)
                    }
                }
        }
        val dao = RahelDatabase.get(this).queuedReadingDao()
        val api = RemoteApiFactory.createHealthApiService(
            deviceTokenProvider = { deviceTokenCache.get() },
        )
        healthRepository = SyncingHealthRepository(
            context = this,
            delegate = sensorRepository,
            userProfileRepository = userProfileRepository,
            dao = dao,
            api = api,
            hasCredentials = { !deviceTokenCache.get().isNullOrBlank() },
            sensorInventoryProvider = { sensorRepository.buildSensorInventory() },
            onAuthFailure = {
                applicationScope.launch {
                    deviceTokenCache.set(null)
                    devicePairingRepository.clearCredentials()
                }
            },
        )
        syncRepository = DefaultHealthSyncRepository(healthRepository, dao)
        // Record readings for as long as monitoring is on, independent of any Activity or screen state.
        val recorder = TelemetryRecorder(
            repository = healthRepository,
            telemetry = sensorRepository,
            engine = recorderEngine,
            ensureSensors = { ensureSensorCollection() },
            // Continuous upload: after every queued reading, push the queue right away (only when linked).
            onRecorded = {
                if (!deviceTokenCache.get().isNullOrBlank()) syncRepository.triggerSync()
            },
        )
        // Linking after onboarding: queue the profile snapshot (it was skipped while unpaired).
        applicationScope.launch {
            combine(
                devicePairingRepository.pairingState.map { it.crewMemberId.orEmpty() },
                userProfileRepository.userProfile.map { it.onboardingComplete },
            ) { crew, onboarded -> if (onboarded) crew else "" }
                .distinctUntilChanged()
                .collect { crew ->
                    if (crew.isNotBlank()) {
                        try {
                            healthRepository.enqueueProfileSnapshot(crew)
                        } catch (e: kotlinx.coroutines.CancellationException) {
                            throw e
                        } catch (e: Exception) {
                            android.util.Log.w("RaHelApp", "Profile snapshot not queued", e)
                        }
                    }
                }
        }
        applicationScope.launch {
            _collectionEnabled.collectLatest { enabled -> if (enabled) recorder.run() }
        }
        HealthSyncScheduler.schedulePeriodic(this)
    }
}
