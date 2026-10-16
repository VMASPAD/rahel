package xyz.targapps.rahel.presentation.onboarding

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.wear.compose.material.CircularProgressIndicator
import xyz.targapps.rahel.data.UserProfileRepository
import xyz.targapps.rahel.presentation.HealthMonitorApp
import xyz.targapps.rahel.presentation.HealthMonitorViewModel
import xyz.targapps.rahel.presentation.components.WearScreenFrame
import xyz.targapps.rahel.presentation.theme.RaHelTheme

/**
 * Root navigation: onboarding gate → [HealthMonitorApp].
 *
 * ```
 * MainActivity
 *   └── RaHelAppEntry
 *         ├── profile.onboardingComplete == false → OnboardingFlow (Welcome → Sexo → Peso → Altura → Confirm)
 *         └── profile.onboardingComplete == true  → HealthMonitorApp
 * ```
 */
@Composable
fun RaHelAppEntry(
    healthViewModel: HealthMonitorViewModel,
    onboardingViewModel: OnboardingViewModel,
    profileRepository: UserProfileRepository,
) {
    val profileState by profileRepository.userProfile.collectAsState(initial = null)

    when (val profile = profileState) {
        null -> LoadingProfile()
        else -> if (profile.onboardingComplete) {
            HealthMonitorApp(healthViewModel)
        } else {
            OnboardingFlow(onboardingViewModel)
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
