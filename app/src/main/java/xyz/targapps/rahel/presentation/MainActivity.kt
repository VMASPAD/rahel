package xyz.targapps.rahel.presentation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import xyz.targapps.rahel.RaHelApp
import xyz.targapps.rahel.presentation.onboarding.OnboardingViewModel
import xyz.targapps.rahel.presentation.onboarding.RaHelAppEntry

class MainActivity : ComponentActivity() {
    private val healthViewModel: HealthMonitorViewModel by viewModels {
        val app = application as RaHelApp
        HealthMonitorViewModel.Factory(
            app.healthRepository,
            app.assessmentEngine,
            app.sensorHub,
            app.syncRepository,
        )
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
        val app = application as RaHelApp
        setContent {
            RaHelAppEntry(
                healthViewModel = healthViewModel,
                onboardingViewModel = onboardingViewModel,
                profileRepository = app.userProfileRepository,
            )
        }
    }
}
