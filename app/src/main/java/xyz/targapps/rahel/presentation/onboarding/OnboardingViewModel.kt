package xyz.targapps.rahel.presentation.onboarding

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import xyz.targapps.rahel.data.HealthRepository
import xyz.targapps.rahel.data.SexoBiologico
import xyz.targapps.rahel.data.UserProfileRepository
import xyz.targapps.rahel.data.computeImc

enum class OnboardingStep {
    Welcome,
    Sexo,
    Peso,
    Altura,
    Confirm,
}

enum class HeightUnit {
    Centimeters,
    Meters,
}

class OnboardingViewModel(
    private val profileRepository: UserProfileRepository,
    private val healthRepository: HealthRepository,
) : ViewModel() {

    var step by mutableStateOf(OnboardingStep.Welcome)
        private set

    var sexoBiologico by mutableIntStateOf(SexoBiologico.MASCULINO)
        private set

    var pesoKg by mutableFloatStateOf(70f)
        private set

    var heightUnit by mutableStateOf(HeightUnit.Centimeters)
        private set

    /** Height when [heightUnit] is Centimeters. */
    var alturaCm by mutableIntStateOf(170)
        private set

    /** Height when [heightUnit] is Meters (stored as metres × 100 for 0.01 m steps). */
    var alturaCmFromMeters by mutableIntStateOf(170)
        private set

    var saving by mutableStateOf(false)
        private set

    val alturaM: Float
        get() = when (heightUnit) {
            HeightUnit.Centimeters -> alturaCm / 100f
            HeightUnit.Meters -> alturaCmFromMeters / 100f
        }

    val imcPreview: Float
        get() = computeImc(pesoKg, alturaM)

    fun next() {
        step = when (step) {
            OnboardingStep.Welcome -> OnboardingStep.Sexo
            OnboardingStep.Sexo -> OnboardingStep.Peso
            OnboardingStep.Peso -> OnboardingStep.Altura
            OnboardingStep.Altura -> OnboardingStep.Confirm
            OnboardingStep.Confirm -> OnboardingStep.Confirm
        }
    }

    fun back() {
        step = when (step) {
            OnboardingStep.Welcome -> OnboardingStep.Welcome
            OnboardingStep.Sexo -> OnboardingStep.Welcome
            OnboardingStep.Peso -> OnboardingStep.Sexo
            OnboardingStep.Altura -> OnboardingStep.Peso
            OnboardingStep.Confirm -> OnboardingStep.Altura
        }
    }

    fun selectSexo(value: Int) {
        sexoBiologico = value
    }

    fun adjustPeso(delta: Float) {
        pesoKg = (pesoKg + delta).coerceIn(30f, 200f)
    }

    fun adjustAltura(deltaCm: Int) {
        when (heightUnit) {
            HeightUnit.Centimeters -> {
                alturaCm = (alturaCm + deltaCm).coerceIn(120, 220)
            }
            HeightUnit.Meters -> {
                alturaCmFromMeters = (alturaCmFromMeters + deltaCm).coerceIn(120, 220)
            }
        }
    }

    fun selectHeightUnit(unit: HeightUnit) {
        heightUnit = unit
    }

    fun completeOnboarding() {
        if (saving) return
        saving = true
        viewModelScope.launch {
            profileRepository.saveOnboardingProfile(
                sexoBiologico = sexoBiologico,
                pesoKg = pesoKg,
                alturaM = alturaM,
            )
            healthRepository.enqueueProfileSnapshot(
                healthRepository.currentSnapshot.first().crewMemberId,
            )
            saving = false
        }
    }

    class Factory(
        private val profileRepository: UserProfileRepository,
        private val healthRepository: HealthRepository,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return OnboardingViewModel(
                profileRepository,
                healthRepository,
            ) as T
        }
    }
}
