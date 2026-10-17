package xyz.targapps.rahel.rules

import xyz.targapps.rahel.domain.MetricBaseline
import xyz.targapps.rahel.domain.PhysiologicalMetric
import xyz.targapps.rahel.domain.ZScoreBand
import xyz.targapps.rahel.domain.ZScoreEvaluation
import kotlin.math.abs

object ZScoreEvaluator {
    fun zScore(measured: Double, baseline: MetricBaseline): Double {
        if (baseline.sigma <= 0.0) return 0.0
        return (measured - baseline.mu) / baseline.sigma
    }

    fun band(z: Double): ZScoreBand {
        val a = abs(z)
        return when {
            a <= SpaceHealthThresholds.Z_NORMAL_MAX -> ZScoreBand.NORMAL
            a <= SpaceHealthThresholds.Z_YELLOW_MAX -> ZScoreBand.YELLOW
            else -> ZScoreBand.RED
        }
    }

    fun evaluate(
        metric: PhysiologicalMetric,
        measured: Double,
        baseline: MetricBaseline,
    ): ZScoreEvaluation {
        val z = zScore(measured, baseline)
        return ZScoreEvaluation(
            metric = metric,
            measured = measured,
            muBase = baseline.mu,
            sigmaBase = baseline.sigma,
            zScore = z,
            band = band(z),
        )
    }
}
