package xyz.targapps.rahel.data

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import xyz.targapps.rahel.data.sensors.DerivedSensorSnapshot
import xyz.targapps.rahel.data.sensors.SensorAvailability
import xyz.targapps.rahel.data.sensors.SensorChannelId
import xyz.targapps.rahel.data.sensors.SensorReading
import xyz.targapps.rahel.data.sensors.SensorTelemetrySource
import xyz.targapps.rahel.domain.HealthAssessment
import xyz.targapps.rahel.domain.HealthSnapshot
import xyz.targapps.rahel.domain.MissionContext
import xyz.targapps.rahel.domain.MissionDynamicVitals
import xyz.targapps.rahel.domain.SensorVitals
import xyz.targapps.rahel.domain.VitalSigns
import xyz.targapps.rahel.rules.HealthAssessmentEngine
import xyz.targapps.rahel.seed.SeedProfile
import java.time.Instant

/** Simulated sensor stack: emits one derived sample per simulated second. */
private class SimSensors(var withHr: Boolean = true) : SensorTelemetrySource {
    override val sensorAvailability: StateFlow<Map<SensorChannelId, SensorAvailability>> = MutableStateFlow(emptyMap())
    override val sensorReadings: SharedFlow<SensorReading> = MutableSharedFlow()
    override val missionDynamics: StateFlow<MissionDynamicVitals> = MutableStateFlow(MissionDynamicVitals())
    val derived = MutableStateFlow(DerivedSensorSnapshot(timestamp = Instant.ofEpochMilli(T0)))
    override val derivedSnapshot: StateFlow<DerivedSensorSnapshot> = derived
    override suspend fun refreshSensorAvailability() {}
    override fun startSensorCollection() {}
    override fun stopSensorCollection() {}

    fun tick(simMs: Long) {
        val at = Instant.ofEpochMilli(T0 + simMs)
        val hr = if (withHr) 60 + ((simMs / 1000) % 90).toInt() else null
        derived.value = DerivedSensorSnapshot(
            timestamp = at,
            dynamics = MissionDynamicVitals(),
            heartRateBpm = hr,
            heartRateAt = if (hr != null) at else null,
            stepsToday = (simMs / 1000).toInt(),
        )
    }
}

/** Records what the recorder asks of the repository; mirrors DeviceSensorHealthRepository's snapshot. */
private class RecordingRepo(private val sim: SimSensors, private val clock: () -> Long) : HealthRepository {
    var readings = 0
    var assessments = 0
    var failReading: ((Int) -> Boolean) = { false }
    var failAssessment: ((Int) -> Boolean) = { false }
    var assessmentAttempts = 0
    var readingAttempts = 0

    override val currentSnapshot: Flow<HealthSnapshot> = flow {
        val d = sim.derived.value
        emit(
            HealthSnapshot(
                timestamp = d.timestamp, crewMemberId = CREW,
                vitals = VitalSigns(d.heartRateBpm ?: 0, 0, 0, 0, d.stepsToday ?: 0, 0f, 0f, 0),
                mission = MissionContext(1, true, 0.3f, 0f),
                sensorVitals = SensorVitals(
                    heartRateBpm = d.heartRateBpm, stepsToday = d.stepsToday, onWrist = true,
                    sampleAtEpochMs = d.heartRateAt?.toEpochMilli(),
                ),
            ),
        )
    }
    override val history: List<HealthSnapshot> = emptyList()
    override fun setSeedProfile(profile: SeedProfile) {}
    override suspend fun enqueueReading(snapshot: HealthSnapshot) {
        if (failReading(++readingAttempts)) throw IllegalStateException("db down")
        readings++
    }
    override suspend fun recordAssessmentCycle(snapshot: HealthSnapshot, assessment: HealthAssessment): Boolean {
        if (failAssessment(++assessmentAttempts)) throw IllegalStateException("assessment boom")
        readings++
        assessments++
        return true
    }
}

class TelemetryRecorderTest {

    private class Result(val repo: RecordingRepo, val syncStarts: List<Long>, val maxConcurrentSyncs: Int,
                         val ensureCalls: List<Long>, val loops: Int)

    /** Runs the recorder for [totalMs] of simulated time at 1 Hz. */
    private fun simulate(
        totalMs: Long = 90_000,
        withHr: Boolean = true,
        syncDurationMs: Long = 0,
        syncFails: Boolean = false,
        configure: (RecordingRepo) -> Unit = {},
    ): Result = runBlocking {
        var now = 0L
        val sim = SimSensors(withHr)
        val repo = RecordingRepo(sim) { now }.also(configure)
        val starts = mutableListOf<Long>()
        val ensures = mutableListOf<Long>()
        var concurrent = 0
        var maxConcurrent = 0
        var loops = 0
        sim.tick(0)
        val recorder = TelemetryRecorder(
            repository = repo, telemetry = sim, engine = HealthAssessmentEngine(),
            ensureSensors = { ensures.add(now) },
            onRecorded = {
                starts.add(now)
                concurrent++; maxConcurrent = maxOf(maxConcurrent, concurrent)
                try {
                    val end = now + syncDurationMs
                    while (now < end) yield()
                    if (syncFails) throw java.io.IOException("offline")
                } finally { concurrent-- }
            },
            clock = { now },
            pause = { ms ->
                loops++
                now += ms
                if (now >= totalMs) throw CancellationException("simulation finished")
                sim.tick(now)
                yield()
            },
        )
        try { recorder.run() } catch (_: CancellationException) {}
        Result(repo, starts, maxConcurrent, ensures, loops)
    }

    @Test fun ninetySeconds_queues90Readings_and3Assessments() {
        val r = simulate()
        assertEquals(90, r.loops)
        assertEquals(90, r.repo.readings)       // 87 plain readings + 3 reading+assessment cycles
        assertEquals(3, r.repo.assessments)     // t = 0, 30, 60 s
        assertEquals(0, r.ensureCalls.size)     // HR present: no sensor re-registration
    }

    @Test fun upload_atMostEvery5s_neverOverlapping() {
        val r = simulate()
        // The upload coroutine starts one loop turn (1 s of simulated time) after being triggered at 0, 5, 10 ... 85 s.
        assertEquals((1_000L until 90_000L step 5_000L).toList(), r.syncStarts)
        r.syncStarts.zipWithNext().forEach { (a, b) -> assertTrue(b - a >= 5_000) }
        assertEquals(1, r.maxConcurrentSyncs)
    }

    @Test fun slowUpload_neverOverlaps_andSkipsTriggersWhileRunning() {
        val r = simulate(syncDurationMs = 12_000)
        assertEquals(1, r.maxConcurrentSyncs)
        // Each upload takes 12 s: a new one can only start after the previous finished (>= 12 s apart).
        r.syncStarts.zipWithNext().forEach { (a, b) -> assertTrue("overlap: $a -> $b", b - a >= 12_000) }
        assertTrue(r.syncStarts.size in 5..7)
        assertEquals(90, r.repo.readings) // recording is not blocked by a slow upload
    }

    @Test fun noHeartRate_retriesSensorRegistrationEvery60s() {
        val r = simulate(withHr = false)
        assertEquals(listOf(0L, 60_000L), r.ensureCalls)
        // No HR but steps present -> readings are still produced.
        assertEquals(90, r.repo.readings)
    }

    @Test fun uploadException_doesNotKillLoop() {
        val r = simulate(syncFails = true)
        assertEquals(90, r.loops)
        assertEquals(90, r.repo.readings)
        assertEquals(18, r.syncStarts.size) // keeps retrying every 5 s
    }

    @Test fun assessmentException_doesNotKillLoop_andIsRetried() {
        val r = simulate { it.failAssessment = { n -> n <= 2 } }
        assertEquals(90, r.loops)
        // First two assessment attempts fail (t=0,1 s); retried until it succeeds, then 30 s and 60 s cycles.
        assertEquals(3, r.repo.assessments)
        assertTrue(r.repo.readings >= 87)
    }

    @Test fun enqueueException_doesNotKillLoop() {
        val r = simulate { it.failReading = { n -> n % 10 == 0 } }
        assertEquals(90, r.loops)
        assertTrue(r.repo.readings in 78..90)
        assertEquals(3, r.repo.assessments)
    }
}
