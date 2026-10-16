package xyz.targapps.rahel.presentation

import xyz.targapps.rahel.domain.AlertLevel
import xyz.targapps.rahel.domain.PhysiologicalMetric
import xyz.targapps.rahel.domain.ZScoreBand
import xyz.targapps.rahel.domain.ZScoreEvaluation

fun ZScoreEvaluation.toUiLevel(): AlertLevel = when (band) {
    ZScoreBand.NORMAL -> AlertLevel.NOMINAL
    ZScoreBand.YELLOW -> AlertLevel.WATCH
    ZScoreBand.RED -> AlertLevel.ELEVATED
}

fun PhysiologicalMetric.spanishLabel(): String = when (this) {
    PhysiologicalMetric.RESTING_HEART_RATE -> "FC reposo"
    PhysiologicalMetric.HEART_RATE -> "FC"
    PhysiologicalMetric.HRV_7D_MEAN -> "HRV 7d"
    PhysiologicalMetric.SPO2 -> "SpO₂"
    PhysiologicalMetric.SKIN_TEMPERATURE -> "Temp. piel"
}
