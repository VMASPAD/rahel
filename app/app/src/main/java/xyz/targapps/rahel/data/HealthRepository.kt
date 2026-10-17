package xyz.targapps.rahel.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import xyz.targapps.rahel.domain.HealthAssessment
import xyz.targapps.rahel.domain.HealthSnapshot
import xyz.targapps.rahel.seed.SeedData
import xyz.targapps.rahel.seed.SeedProfile

interface HealthRepository {
    val currentSnapshot: Flow<HealthSnapshot>
    val history: List<HealthSnapshot>
    fun setSeedProfile(profile: SeedProfile)

    /** Persist a sensor reading locally for later upload (offline-first). */
    suspend fun enqueueReading(snapshot: HealthSnapshot) {}

    /** Queue baseline profile for POST /profile after onboarding. */
    suspend fun enqueueProfileSnapshot(crewMemberId: String = "CMD-01") {}

    /** After each assessment cycle: queue reading + assessment (+ profile) and try sync. */
    suspend fun recordAssessmentCycle(snapshot: HealthSnapshot, assessment: HealthAssessment) {
        enqueueReading(snapshot)
    }

    /** Upload pending queue rows; returns count of items successfully synced. */
    suspend fun syncPending(): Int = 0
}

fun HealthRepository.sensorTelemetry(): xyz.targapps.rahel.data.sensors.SensorTelemetrySource? =
    this as? xyz.targapps.rahel.data.sensors.SensorTelemetrySource

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
