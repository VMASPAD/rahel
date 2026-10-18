package xyz.targapps.rahel.data

import android.os.SystemClock
import android.util.Log
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import xyz.targapps.rahel.data.sensors.SensorTelemetrySource
import xyz.targapps.rahel.domain.MissionDynamicVitals
import xyz.targapps.rahel.domain.ProcessedVitalsSnapshot
import xyz.targapps.rahel.domain.SensorSample
import xyz.targapps.rahel.rules.HealthAssessmentEngine

/**
 * Queues a reading every second (plus an assessment every 30 s) and uploads in batches every 5 s,
 * for as long as [run] is active.
 *
 * This used to live in the Activity's ViewModel, so nothing was recorded once the screen turned off
 * or the Activity was destroyed, even while the foreground service kept the process alive. It now runs
 * in the application scope, driven only by "monitoring is on".
 *
 * It uses its own [HealthAssessmentEngine] so it does not depend on the UI's engine state.
 */
class TelemetryRecorder(
    private val repository: HealthRepository,
    private val telemetry: SensorTelemetrySource,
    private val engine: HealthAssessmentEngine,
    /** Re-registers sensors that failed to register (e.g. permission granted late). Must be idempotent. */
    private val ensureSensors: () -> Unit,
    /** Called (without blocking the loop, one at a time) after a reading was queued, to upload it right away. */
    private val onRecorded: suspend () -> Unit = {},
    /** Injectable for JVM tests; production uses the monotonic clock and [delay]. */
    private val clock: () -> Long = SystemClock::elapsedRealtime,
    private val pause: suspend (Long) -> Unit = { delay(it) },
) {
    suspend fun run() = coroutineScope {
        var processed: ProcessedVitalsSnapshot? = null
        var mission: MissionDynamicVitals? = null

        launch {
            telemetry.derivedSnapshot.collect { derived ->
                val dynamics = derived.dynamics
                mission = dynamics
                processed = engine.ingestSensorSample(
                    SensorSample(
                        timestampMillis = derived.timestamp.toEpochMilli(),
                        heartRateBpm = derived.heartRateBpm ?: dynamics.hrResting,
                        hrvMs = dynamics.hrvMs,
                        spO2Percent = dynamics.spo2Pct,
                        accelZMps2 = dynamics.accelZMps2,
                        // No skin-temperature sensor on the watch: never feed ambient temperature here.
                        skinTempCelsius = null,
                        motion = dynamics.motion,
                        ecgAnomaly = dynamics.ecgFlag,
                    ),
                )
            }
        }

        var syncJob: Job? = null
        var lastAssessmentAt = -ASSESSMENT_INTERVAL_MS
        var lastSyncTriggerAt = -SYNC_INTERVAL_MS
        var lastSensorRetryAt = -SENSOR_RETRY_INTERVAL_MS
        Log.i(TAG, "Recorder started")
        try {
            while (isActive) {
                val now = clock()
                try {
                    val snapshot = repository.currentSnapshot.first()
                    // One reading per second; the (heavier) assessment is queued only every 30 s.
                    if (now - lastAssessmentAt >= ASSESSMENT_INTERVAL_MS) {
                        val assessment = engine.assessHealth(snapshot, repository.history, processed, mission)
                        if (repository.recordAssessmentCycle(snapshot, assessment)) {
                            lastAssessmentAt = now
                        }
                    } else {
                        repository.enqueueReading(snapshot)
                    }
                    // Continuous upload: batches of whatever accumulated, at most one upload at a time.
                    if (now - lastSyncTriggerAt >= SYNC_INTERVAL_MS && syncJob?.isActive != true) {
                        lastSyncTriggerAt = now
                        syncJob = launch {
                            try {
                                onRecorded()
                            } catch (e: CancellationException) {
                                throw e
                            } catch (e: Exception) {
                                Log.w(TAG, "Continuous upload failed (will retry)", e)
                            }
                        }
                    }
                    // No heart rate yet: keep retrying sensor registration instead of waiting forever.
                    if (snapshot.sensorVitals?.heartRateBpm == null &&
                        now - lastSensorRetryAt >= SENSOR_RETRY_INTERVAL_MS
                    ) {
                        lastSensorRetryAt = now
                        Log.i(TAG, "No heart rate yet, retrying sensor registration")
                        ensureSensors()
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    Log.w(TAG, "Recording cycle failed", e)
                }
                pause(LOOP_INTERVAL_MS)
            }
        } finally {
            Log.i(TAG, "Recorder stopped")
        }
    }

    private companion object {
        const val TAG = "TelemetryRecorder"
        /** Queue a sensor reading every second; assessments are heavier, so every 30 s. */
        const val LOOP_INTERVAL_MS = 1_000L
        const val ASSESSMENT_INTERVAL_MS = 30_000L
        const val SYNC_INTERVAL_MS = 5_000L
        const val SENSOR_RETRY_INTERVAL_MS = 60_000L
    }
}
