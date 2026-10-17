package xyz.targapps.rahel.data.sensors

import xyz.targapps.rahel.domain.ApproximateActivityLevel
import xyz.targapps.rahel.domain.MissionDynamicVitals
import kotlin.math.abs
import kotlin.math.sqrt

internal class DerivedMetricsCalculator(
    private val motionAccelThreshold: Float = 1.2f,
    private val gravityReference: Float = 9.81f,
) {
    private var lastAccelZ: Float? = null
    private val accelMagnitudes = ArrayDeque<Float>()
    private val hrSamples = ArrayDeque<Int>()
    private var stepBaseline: Long? = null
    private var stepsSession: Long = 0L
    private var offBody: Boolean? = null

    fun onAccelerometer(x: Float, y: Float, z: Float): Pair<Float, DerivedDynamicsPatch> {
        val magnitude = sqrt(x * x + y * y + z * z)
        val deltaAz = lastAccelZ?.let { abs(z - it) } ?: 0f
        lastAccelZ = z

        accelMagnitudes.addLast(magnitude)
        while (accelMagnitudes.size > 50) {
            accelMagnitudes.removeFirst()
        }

        val deviation = abs(magnitude - gravityReference)
        val motion = if (deviation > motionAccelThreshold) 1 else 0
        val activityLevel = classifyActivity(deviation)

        val partial = DerivedDynamicsPatch(
            motion = motion,
            deltaAz = deltaAz,
            accelZMps2 = z,
            activityLevel = activityLevel,
            offBody = offBody,
            stepsSession = stepsSession,
        )
        return magnitude to partial
    }

    fun onGyroMagnitude(magnitude: Float) = magnitude

    fun onHeartRate(bpm: Int): DerivedDynamicsPatch {
        hrSamples.addLast(bpm)
        while (hrSamples.size > 30) {
            hrSamples.removeFirst()
        }
        val hrv = estimateHrvMs()
        return DerivedDynamicsPatch(
            hrResting = bpm,
            hrvMs = hrv,
            motion = null,
            deltaAz = null,
            activityLevel = null,
            offBody = offBody,
            stepsSession = stepsSession,
            spo2Pct = null,
            ecgFlag = null,
        )
    }

    fun onSpo2(percent: Int) = DerivedDynamicsPatch(spo2Pct = percent)

    fun onOffBody(onWrist: Boolean) {
        offBody = !onWrist
    }

    fun onStepCounter(totalSinceBoot: Long) {
        val baseline = stepBaseline
        if (baseline == null) {
            stepBaseline = totalSinceBoot
            stepsSession = 0L
        } else {
            stepsSession = (totalSinceBoot - baseline).coerceAtLeast(0L)
        }
    }

    fun onStepDetected() {
        stepsSession += 1
    }

    fun currentStepsSession(): Long = stepsSession

    private fun classifyActivity(deviation: Float): ApproximateActivityLevel = when {
        deviation < 0.5f -> ApproximateActivityLevel.STATIONARY
        deviation < 1.5f -> ApproximateActivityLevel.LIGHT
        deviation < 3.0f -> ApproximateActivityLevel.MODERATE
        else -> ApproximateActivityLevel.VIGOROUS
    }

    private fun estimateHrvMs(): Int? {
        if (hrSamples.size < 5) return null
        val intervals = hrSamples.zipWithNext { a, b -> abs(b - a) }
        val mean = intervals.average()
        if (mean <= 0.0) return null
        return (mean * 8).toInt().coerceIn(5, 200)
    }
}

internal data class DerivedDynamicsPatch(
    val hrResting: Int? = null,
    val motion: Int? = null,
    val hrvMs: Int? = null,
    val spo2Pct: Int? = null,
    val deltaAz: Float? = null,
    val accelZMps2: Float? = null,
    val ecgFlag: Boolean? = null,
    val activityLevel: ApproximateActivityLevel? = null,
    val stepsSession: Long? = null,
    val offBody: Boolean? = null,
)

internal fun MissionDynamicVitals.merge(partial: DerivedDynamicsPatch): MissionDynamicVitals =
    copy(
        hrResting = partial.hrResting ?: hrResting,
        motion = partial.motion ?: motion,
        hrvMs = partial.hrvMs ?: hrvMs,
        spo2Pct = partial.spo2Pct ?: spo2Pct,
        deltaAz = partial.deltaAz ?: deltaAz,
        accelZMps2 = partial.accelZMps2 ?: accelZMps2,
        ecgFlag = partial.ecgFlag ?: ecgFlag,
        activityLevel = partial.activityLevel ?: activityLevel,
        stepsSession = partial.stepsSession ?: stepsSession,
        offBody = partial.offBody ?: offBody,
    )
