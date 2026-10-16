package xyz.targapps.rahel.rules

import xyz.targapps.rahel.domain.ProcessedVitalsSnapshot
import xyz.targapps.rahel.domain.SensorSample
import kotlin.math.abs

/**
 * Stateful processor: motion gating, resting-HR EMA, 7-day HRV mean, orthostatic deltas.
 */
class SensorStreamProcessor {

    private var lastAccelZ: Float? = null
    private var restingHrEma: Double? = null
    private var lastSpO2: Int? = null
    private val hrHistory = ArrayDeque<Pair<Long, Int>>()
    private val hrvWindow = ArrayDeque<Pair<Long, Int>>()
    private var nocturnalMotionAccum = 0f
    private var nocturnalMotionSamples = 0

    fun reset() {
        lastAccelZ = null
        restingHrEma = null
        lastSpO2 = null
        hrHistory.clear()
        hrvWindow.clear()
        nocturnalMotionAccum = 0f
        nocturnalMotionSamples = 0
    }

    fun ingest(sample: SensorSample): ProcessedVitalsSnapshot {
        val deltaAz = updateAccelAndDelta(sample)
        val motion = when (sample.motion) {
            0 -> false
            1 -> true
            else -> deltaAz > SpaceHealthThresholds.MOTION_ACCEL_Z_DELTA_THRESHOLD
        }
        updateRestingHr(sample, motion)
        updateHrvWindow(sample)
        updateHrHistory(sample)
        val deltaHr5s = computeDeltaHr5s(sample.timestampMillis)
        val deltaSpo2 = computeDeltaSpo2(sample)
        updateNocturnalMotion(sample, motion)

        val hrResting = restingHrEma?.toInt() ?: sample.heartRateBpm ?: 0
        val hrv7d = hrv7dMean()

        return ProcessedVitalsSnapshot(
            hrRestingSmoothedBpm = hrResting,
            hrv7dMeanMs = hrv7d,
            motionActive = motion,
            deltaAzMps2 = deltaAz,
            deltaHeartRate5sBpm = deltaHr5s,
            deltaSpO2Percent = deltaSpo2,
            nocturnalMotionScore = nocturnalMotionScore(),
        )
    }

    fun snapshotFromInstant(
        heartRateBpm: Int,
        hrvMs: Int,
        spO2Percent: Int,
        skinTempCelsius: Float,
        timestampMillis: Long = System.currentTimeMillis(),
    ): ProcessedVitalsSnapshot = ingest(
        SensorSample(
            timestampMillis = timestampMillis,
            heartRateBpm = heartRateBpm,
            hrvMs = hrvMs,
            spO2Percent = spO2Percent,
            accelZMps2 = 0f,
            skinTempCelsius = skinTempCelsius,
        ),
    )

    private fun updateAccelAndDelta(sample: SensorSample): Float {
        val z = sample.accelZMps2 ?: return 0f
        val prev = lastAccelZ
        lastAccelZ = z
        if (prev == null) return 0f
        return abs(z - prev)
    }

    private fun updateRestingHr(sample: SensorSample, motion: Boolean) {
        val hr = sample.heartRateBpm ?: return
        if (motion) return
        val alpha = SpaceHealthThresholds.RESTING_HR_EMA_ALPHA
        restingHrEma = if (restingHrEma == null) {
            hr.toDouble()
        } else {
            alpha * hr + (1 - alpha) * restingHrEma!!
        }
    }

    private fun updateHrvWindow(sample: SensorSample) {
        val hrv = sample.hrvMs ?: return
        val cutoff = sample.timestampMillis - SpaceHealthThresholds.HRV_7D_WINDOW_MS
        hrvWindow.addLast(sample.timestampMillis to hrv)
        while (hrvWindow.isNotEmpty() && hrvWindow.first().first < cutoff) {
            hrvWindow.removeFirst()
        }
    }

    private fun hrv7dMean(): Int {
        if (hrvWindow.isEmpty()) return 0
        return (hrvWindow.sumOf { it.second } / hrvWindow.size)
    }

    private fun updateHrHistory(sample: SensorSample) {
        val hr = sample.heartRateBpm ?: return
        hrHistory.addLast(sample.timestampMillis to hr)
        val cutoff = sample.timestampMillis - SpaceHealthThresholds.HR_HISTORY_WINDOW_MS
        while (hrHistory.isNotEmpty() && hrHistory.first().first < cutoff) {
            hrHistory.removeFirst()
        }
    }

    private fun computeDeltaHr5s(nowMillis: Long): Int {
        if (hrHistory.size < 2) return 0
        val latest = hrHistory.last().second
        val target = nowMillis - 5_000L
        val baseline = hrHistory.firstOrNull { it.first <= target }?.second
            ?: hrHistory.first().second
        return latest - baseline
    }

    private fun computeDeltaSpo2(sample: SensorSample): Float {
        val spo2 = sample.spO2Percent ?: return 0f
        val prev = lastSpO2
        lastSpO2 = spo2
        if (prev == null) return 0f
        return spo2 - prev.toFloat()
    }

    private fun updateNocturnalMotion(sample: SensorSample, motion: Boolean) {
        if (!sample.isSleepWindow) return
        nocturnalMotionSamples++
        if (motion) nocturnalMotionAccum += 1f
    }

    private fun nocturnalMotionScore(): Float {
        if (nocturnalMotionSamples == 0) return 0f
        return nocturnalMotionAccum / nocturnalMotionSamples
    }
}
