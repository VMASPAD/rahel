package xyz.targapps.rahel.presentation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import xyz.targapps.rahel.RaHelApp

class MainActivity : ComponentActivity() {
    private val viewModel: HealthMonitorViewModel by viewModels {
        val app = application as RaHelApp
        HealthMonitorViewModel.Factory(app.healthRepository, app.assessmentEngine)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setTheme(android.R.style.Theme_DeviceDefault)
        setContent {
            HealthMonitorApp(viewModel)
        }
    }
}
