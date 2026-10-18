package xyz.targapps.rahel.presentation.onboarding

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.wear.compose.material.CircularProgressIndicator
import xyz.targapps.rahel.data.DevicePairingState
import xyz.targapps.rahel.data.UserProfileRepository
import xyz.targapps.rahel.presentation.HealthMonitorApp
import xyz.targapps.rahel.presentation.pairing.PairingScreen
import xyz.targapps.rahel.presentation.pairing.PairingViewModel
import xyz.targapps.rahel.presentation.HealthMonitorViewModel
import xyz.targapps.rahel.presentation.components.WearScreenFrame
import xyz.targapps.rahel.presentation.theme.RaHelTheme

@Composable
fun RaHelAppEntry(
    monitoringEnabled: Boolean,
    onSetMonitoring: (Boolean) -> Unit,
    healthViewModelFactory: HealthMonitorViewModel.Factory,
    onboardingViewModel: OnboardingViewModel,
    profileRepository: UserProfileRepository,
    pairingViewModel: PairingViewModel,
    pairingState: DevicePairingState?,
) {
    val profileState by profileRepository.userProfile.collectAsState(initial = null)

    when {
        pairingState == null -> LoadingProfile()
        !pairingState.isPaired -> PairingScreen(pairingViewModel)
        profileState == null -> LoadingProfile()
        profileState?.onboardingComplete != true -> OnboardingFlow(onboardingViewModel)
        else -> {
            val healthViewModel: HealthMonitorViewModel = viewModel(factory = healthViewModelFactory)
            HealthMonitorApp(healthViewModel, pairingViewModel, monitoringEnabled, onSetMonitoring)
        }
    }
}

@Composable
private fun LoadingProfile() {
    RaHelTheme {
        WearScreenFrame {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }
    }
}
