package xyz.targapps.rahel.presentation

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.launch
import xyz.targapps.rahel.RaHelApp
import xyz.targapps.rahel.service.HealthForegroundService
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.viewmodel.compose.viewModel
import xyz.targapps.rahel.data.remote.RemoteApiFactory
import xyz.targapps.rahel.presentation.onboarding.OnboardingViewModel
import xyz.targapps.rahel.presentation.onboarding.RaHelAppEntry
import xyz.targapps.rahel.presentation.pairing.PairingViewModel

class MainActivity : ComponentActivity() {

    private val sensorPermissions = buildList {
        add(Manifest.permission.BODY_SENSORS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            add(Manifest.permission.ACTIVITY_RECOGNITION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }.toTypedArray()

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) {
        // Permissions may have just been granted: retry sensor registration and start the service.
        (application as RaHelApp).let {
            it.ensureSensorCollection()
            if (it.collectionEnabled.value) HealthForegroundService.start(this)
        }
    }

    private val onboardingViewModel: OnboardingViewModel by viewModels {
        val app = application as RaHelApp
        OnboardingViewModel.Factory(
            app.userProfileRepository,
            app.healthRepository,
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setTheme(android.R.style.Theme_DeviceDefault)
        requestSensorPermissionsIfNeeded()
        val app = application as RaHelApp
        val healthFactory = HealthMonitorViewModel.Factory(
            app.healthRepository,
            app.assessmentEngine,
            app.sensorHub,
            app.syncRepository,
        )
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                app.collectionEnabled.collect { enabled ->
                    if (enabled) {
                        app.ensureSensorCollection()
                        HealthForegroundService.start(this@MainActivity)
                    }
                }
            }
        }
        val pairingApi = RemoteApiFactory.createPairingApiService()
        setContent {
            val pairingState by app.devicePairingRepository.pairingState.collectAsState(
                initial = null,
            )
            val pairingViewModel: PairingViewModel = viewModel(
                factory = PairingViewModel.Factory(
                    app.devicePairingRepository,
                    pairingApi,
                ),
            )
            val monitoringEnabled by app.userProfileRepository.monitoringEnabled
                .collectAsState(initial = false)
            RaHelAppEntry(
                monitoringEnabled = monitoringEnabled,
                onSetMonitoring = { enabled ->
                    if (enabled) requestSensorPermissionsIfNeeded()
                    app.setMonitoring(enabled)
                },
                healthViewModelFactory = healthFactory,
                onboardingViewModel = onboardingViewModel,
                profileRepository = app.userProfileRepository,
                pairingViewModel = pairingViewModel,
                pairingState = pairingState,
            )
        }
    }

    private fun requestSensorPermissionsIfNeeded() {
        val missing = sensorPermissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }
}
