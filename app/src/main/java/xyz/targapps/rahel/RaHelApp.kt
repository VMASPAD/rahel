package xyz.targapps.rahel

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import xyz.targapps.rahel.data.DefaultHealthSyncRepository
import xyz.targapps.rahel.data.DeviceSensorHealthRepository
import xyz.targapps.rahel.data.HealthRepository
import xyz.targapps.rahel.data.HealthSyncRepository
import xyz.targapps.rahel.data.toOnboardingProfileInput
import xyz.targapps.rahel.data.SyncingHealthRepository
import xyz.targapps.rahel.data.UserProfileRepository
import xyz.targapps.rahel.data.local.RahelDatabase
import xyz.targapps.rahel.data.remote.RemoteApiFactory
import xyz.targapps.rahel.data.sync.HealthSyncScheduler
import xyz.targapps.rahel.rules.HealthAssessmentEngine
import xyz.targapps.rahel.data.sensors.WearPlatformSensorHub
import xyz.targapps.rahel.sensor.SensorHub

class RaHelApp : Application() {
    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    lateinit var healthRepository: HealthRepository
    lateinit var userProfileRepository: UserProfileRepository
    lateinit var syncRepository: HealthSyncRepository
    val assessmentEngine: HealthAssessmentEngine = HealthAssessmentEngine()
    val sensorHub: SensorHub by lazy { WearPlatformSensorHub(this) }

    override fun onCreate() {
        super.onCreate()
        userProfileRepository = UserProfileRepository(this)
        applicationScope.launch {
            userProfileRepository.userProfile
                .distinctUntilChanged()
                .collect { profile ->
                    profile.toOnboardingProfileInput()?.let { input ->
                        assessmentEngine.setBaselineFromOnboarding(input)
                    }
                }
        }
        val dao = RahelDatabase.get(this).queuedReadingDao()
        val api = RemoteApiFactory.createHealthApiService()
        val sensorRepository = DeviceSensorHealthRepository(this)
        healthRepository = SyncingHealthRepository(
            context = this,
            delegate = sensorRepository,
            userProfileRepository = userProfileRepository,
            dao = dao,
            api = api,
        )
        syncRepository = DefaultHealthSyncRepository(healthRepository, dao)
        HealthSyncScheduler.schedulePeriodic(this)
    }
}
