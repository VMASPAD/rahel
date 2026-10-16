package xyz.targapps.rahel.presentation

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import xyz.targapps.rahel.data.HealthRepository
import xyz.targapps.rahel.domain.AssessmentResult
import xyz.targapps.rahel.domain.HealthSnapshot
import xyz.targapps.rahel.rules.HealthAssessmentEngine
import xyz.targapps.rahel.seed.SeedProfile

enum class MonitorScreen {
    Home,
    Vitals,
    Conditions,
    ProfilePicker,
    ConditionDetail,
}

class HealthMonitorViewModel(
    private val repository: HealthRepository,
    private val engine: HealthAssessmentEngine,
) : ViewModel() {

    var screen by mutableStateOf(MonitorScreen.Home)
        private set

    var snapshot by mutableStateOf<HealthSnapshot?>(null)
        private set

    var assessment by mutableStateOf<AssessmentResult?>(null)
        private set

    var selectedConditionId by mutableStateOf<String?>(null)
        private set

    var seedProfile by mutableStateOf(SeedProfile.HEALTHY_CREW)
        private set

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val snap = repository.currentSnapshot.first()
            snapshot = snap
            assessment = engine.assess(snap, repository.history)
        }
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
        repository.setSeedProfile(profile)
        refresh()
        screen = MonitorScreen.Home
    }

    fun selectedCondition() =
        assessment?.conditions?.find { it.conditionId == selectedConditionId }

    class Factory(
        private val repository: HealthRepository,
        private val engine: HealthAssessmentEngine,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return HealthMonitorViewModel(repository, engine) as T
        }
    }
}
