package xyz.targapps.rahel.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import xyz.targapps.rahel.domain.HealthSnapshot
import xyz.targapps.rahel.seed.SeedData
import xyz.targapps.rahel.seed.SeedProfile

interface HealthRepository {
    val currentSnapshot: Flow<HealthSnapshot>
    val history: List<HealthSnapshot>
    fun setSeedProfile(profile: SeedProfile)
}

class SeedHealthRepository(
    initialProfile: SeedProfile = SeedProfile.HEALTHY_CREW,
) : HealthRepository, HealthDataSource {

    private var profile: SeedProfile = initialProfile
    private var cachedHistory: List<HealthSnapshot> = SeedData.historyFor(profile)

    override fun setSeedProfile(profile: SeedProfile) {
        this.profile = profile
        cachedHistory = SeedData.historyFor(profile)
    }

    override val history: List<HealthSnapshot>
        get() = cachedHistory

    override val currentSnapshot: Flow<HealthSnapshot> = flow {
        emit(SeedData.snapshot(profile))
    }

    override fun liveSnapshots(): Flow<HealthSnapshot> = currentSnapshot
}
