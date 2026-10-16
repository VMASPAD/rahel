package xyz.targapps.rahel.presentation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.flow.distinctUntilChanged
import xyz.targapps.rahel.R
import xyz.targapps.rahel.domain.AlertLevel
import xyz.targapps.rahel.domain.ConditionAssessment
import xyz.targapps.rahel.domain.ZScoreEvaluation
import xyz.targapps.rahel.presentation.components.BackChip
import xyz.targapps.rahel.presentation.components.DashboardPageDots
import xyz.targapps.rahel.presentation.components.ListNavChip
import xyz.targapps.rahel.presentation.components.NavCompactChip
import xyz.targapps.rahel.presentation.components.RaHelIcons
import xyz.targapps.rahel.presentation.components.ScreenHeader
import xyz.targapps.rahel.presentation.components.SectionTitle
import xyz.targapps.rahel.presentation.components.SensorAvailabilityFlow
import xyz.targapps.rahel.presentation.components.StatusRing
import xyz.targapps.rahel.presentation.components.VitalMetricRow
import xyz.targapps.rahel.presentation.components.WearScreenFrame
import xyz.targapps.rahel.presentation.components.WearScrollScreen
import xyz.targapps.rahel.presentation.components.ZScoreRow
import xyz.targapps.rahel.presentation.theme.RaHelTheme
import xyz.targapps.rahel.seed.SeedData
import xyz.targapps.rahel.seed.SeedProfile
import xyz.targapps.rahel.sensor.LiveSensorMetrics

private val syncTimeFormatter =
    DateTimeFormatter.ofPattern("dd MMM HH:mm").withZone(ZoneId.systemDefault())

private fun formatZMeasured(z: ZScoreEvaluation): String =
    when (z.metric) {
        xyz.targapps.rahel.domain.PhysiologicalMetric.SPO2 -> "${z.measured.toInt()}%"
        xyz.targapps.rahel.domain.PhysiologicalMetric.SKIN_TEMPERATURE ->
            "${"%.1f".format(z.measured)} °C"
        xyz.targapps.rahel.domain.PhysiologicalMetric.HRV_7D_MEAN ->
            "${z.measured.toInt()} ms"
        else -> "${z.measured.toInt()} bpm"
    }

@Composable
fun HealthMonitorApp(viewModel: HealthMonitorViewModel) {
    RaHelTheme {
        WearScreenFrame {
            when (viewModel.screen) {
                MonitorScreen.Dashboard -> DashboardHost(viewModel)
                MonitorScreen.ProfilePicker -> ProfilePickerScreen(viewModel)
                MonitorScreen.ConditionDetail -> ConditionDetailScreen(viewModel)
            }
        }
    }
}

@Composable
private fun DashboardHost(vm: HealthMonitorViewModel) {
    val pageCount = DashboardPage.entries.size
    val pagerState = rememberPagerState(
        initialPage = vm.dashboardPage,
        pageCount = { pageCount },
    )

    LaunchedEffect(pagerState) {
        snapshotFlow { pagerState.currentPage }
            .distinctUntilChanged()
            .collect { vm.selectDashboardPage(it) }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize(),
        ) { page ->
            when (DashboardPage.entries[page]) {
                DashboardPage.Overview -> OverviewPage(vm)
                DashboardPage.Sensors -> SensorsPage(vm)
                DashboardPage.Alerts -> AlertsPage(vm)
                DashboardPage.Sync -> SyncPage(vm)
            }
        }
        DashboardPageDots(
            currentPage = pagerState.currentPage,
            pageCount = pageCount,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 8.dp),
        )
    }
}

@Composable
private fun OverviewPage(vm: HealthMonitorViewModel) {
    val result = vm.assessment
    val level = result?.overallLevel ?: AlertLevel.NOMINAL
    val snap = vm.snapshot
    val metrics by vm.liveMetrics.collectAsState()
    val sensors by vm.sensorAvailability.collectAsState()
    val zScores = vm.zScores
    val eventAlerts = vm.healthAssessment?.eventAlerts ?: emptyList()

    WearScrollScreen {
        item {
            ScreenHeader(
                title = stringResource(R.string.app_name),
                subtitle = result?.headline ?: stringResource(R.string.status_loading),
            )
        }
        item {
            StatusRing(
                level = level,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
            )
        }
        item {
            Text(
                text = snap?.let {
                    stringResource(R.string.home_mission_line, it.mission.missionDay, it.crewMemberId)
                } ?: "",
                style = MaterialTheme.typography.caption2,
                color = MaterialTheme.colors.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp),
            )
        }
        item { SectionTitle(stringResource(R.string.section_sensors)) }
        item {
            SensorAvailabilityFlow(
                sensors = sensors,
                modifier = Modifier.padding(bottom = 4.dp),
            )
        }
        item { SectionTitle(stringResource(R.string.section_live_vitals)) }
        item { LiveVitalsBlock(metrics) }
        if (zScores.isNotEmpty()) {
            item { SectionTitle(stringResource(R.string.section_z_scores)) }
            items(zScores) { z ->
                ZScoreRow(
                    label = z.metric.spanishLabel(),
                    zScore = z.zScore.toFloat(),
                    displayValue = formatZMeasured(z),
                    level = z.toUiLevel(),
                    modifier = Modifier.padding(bottom = 6.dp),
                )
            }
        }
        if (eventAlerts.isNotEmpty()) {
            item { SectionTitle(stringResource(R.string.section_space_events)) }
            items(eventAlerts) { alert ->
                ListNavChip(
                    title = alert.title,
                    subtitle = alert.message,
                    onClick = { },
                    leadingLevel = alert.level,
                )
            }
        }
        item {
            Text(
                text = stringResource(R.string.swipe_hint),
                style = MaterialTheme.typography.caption2,
                color = MaterialTheme.colors.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp, bottom = 4.dp),
            )
        }
        item {
            NavCompactChip(
                label = stringResource(R.string.nav_seed),
                icon = RaHelIcons.Seed,
                onClick = { vm.navigate(MonitorScreen.ProfilePicker) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun LiveVitalsBlock(metrics: LiveSensorMetrics) {
    val motionText = metrics.motionLabel?.let { label ->
        metrics.motionMagnitude?.let { mag ->
            "$label (${(mag * 100).toInt()}%)"
        } ?: label
    } ?: "—"
    VitalMetricRow(
        label = stringResource(R.string.vital_hr),
        value = metrics.heartRateBpm?.let { "$it bpm" } ?: "—",
    )
    metrics.spO2Percent?.let { spo2 ->
        VitalMetricRow(
            label = stringResource(R.string.vital_spo2),
            value = "$spo2%",
        )
    }
    VitalMetricRow(
        label = stringResource(R.string.vital_motion),
        value = motionText,
    )
    VitalMetricRow(
        label = stringResource(R.string.vital_steps),
        value = metrics.stepsToday?.toString() ?: "—",
    )
    metrics.pressureHpa?.let { pressure ->
        VitalMetricRow(
            label = stringResource(R.string.vital_barometer),
            value = "${pressure.toInt()} hPa",
        )
    }
}

@Composable
private fun SensorsPage(vm: HealthMonitorViewModel) {
    val sensors by vm.sensorAvailability.collectAsState()
    val metrics by vm.liveMetrics.collectAsState()

    WearScrollScreen(horizontalAlignment = Alignment.Start) {
        item { ScreenHeader(title = stringResource(R.string.page_sensors)) }
        items(sensors) { sensor ->
            VitalMetricRow(
                label = sensor.displayName,
                value = if (sensor.available) {
                    stringResource(R.string.sensor_available)
                } else {
                    stringResource(R.string.sensor_unavailable)
                },
                level = if (sensor.available) AlertLevel.NOMINAL else AlertLevel.WATCH,
            )
        }
        item { SectionTitle(stringResource(R.string.section_live_vitals)) }
        item { LiveVitalsBlock(metrics) }
        item {
            Text(
                text = stringResource(R.string.swipe_hint),
                style = MaterialTheme.typography.caption2,
                color = MaterialTheme.colors.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

@Composable
private fun AlertsPage(vm: HealthMonitorViewModel) {
    val conditions = vm.assessment?.conditions ?: emptyList()
    val eventAlerts = vm.healthAssessment?.eventAlerts ?: emptyList()
    val level = vm.assessment?.overallLevel ?: AlertLevel.NOMINAL

    WearScrollScreen(horizontalAlignment = Alignment.Start) {
        item {
            ScreenHeader(
                title = stringResource(R.string.page_alerts),
                subtitle = vm.assessment?.headline,
            )
        }
        item {
            StatusRing(
                level = level,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 6.dp),
            )
        }
        if (eventAlerts.isNotEmpty()) {
            item { SectionTitle(stringResource(R.string.section_space_events)) }
            items(eventAlerts) { alert ->
                ListNavChip(
                    title = alert.title,
                    subtitle = alert.suggestedAction,
                    onClick = { },
                    leadingLevel = alert.level,
                )
            }
        }
        if (conditions.isEmpty() && eventAlerts.isEmpty()) {
            item {
                Text(
                    text = stringResource(R.string.assessment_empty),
                    style = MaterialTheme.typography.body2,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 8.dp),
                )
            }
        } else {
            if (conditions.isNotEmpty()) {
                item { SectionTitle(stringResource(R.string.screen_assessment)) }
            }
            items(conditions) { c ->
                ConditionChip(c, onClick = { vm.openCondition(c.conditionId) })
            }
        }
    }
}

@Composable
private fun SyncPage(vm: HealthMonitorViewModel) {
    val sync by vm.syncStatus.collectAsState()

    WearScrollScreen(horizontalAlignment = Alignment.Start) {
        item { ScreenHeader(title = stringResource(R.string.page_sync)) }
        item {
            VitalMetricRow(
                label = stringResource(R.string.sync_last_upload),
                value = sync.lastUploadAt?.let { syncTimeFormatter.format(it) }
                    ?: stringResource(R.string.sync_never),
            )
        }
        item {
            VitalMetricRow(
                label = stringResource(R.string.sync_pending),
                value = sync.pendingCount.toString(),
                level = when {
                    sync.pendingCount == 0 -> AlertLevel.NOMINAL
                    sync.pendingCount < 5 -> AlertLevel.WATCH
                    else -> AlertLevel.ELEVATED
                },
            )
        }
        item {
            NavCompactChip(
                label = if (sync.isSyncing) {
                    stringResource(R.string.sync_in_progress)
                } else {
                    stringResource(R.string.sync_action)
                },
                icon = RaHelIcons.Sync,
                onClick = { if (!sync.isSyncing) vm.triggerSync() },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp),
            )
        }
        sync.lastError?.let { err ->
            item {
                Text(
                    text = err,
                    style = MaterialTheme.typography.caption2,
                    color = MaterialTheme.colors.error,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun ConditionChip(condition: ConditionAssessment, onClick: () -> Unit) {
    ListNavChip(
        title = condition.title,
        subtitle = "${condition.category.name} · ${(condition.confidence * 100).toInt()}%",
        onClick = onClick,
        leadingLevel = condition.severity,
    )
}

@Composable
private fun ConditionDetailScreen(vm: HealthMonitorViewModel) {
    val condition = vm.selectedCondition()
    WearScrollScreen(horizontalAlignment = Alignment.Start) {
        item {
            ScreenHeader(
                title = condition?.title ?: stringResource(R.string.screen_detail),
            )
        }
        if (condition != null) {
            item {
                Text(
                    text = condition.summary,
                    style = MaterialTheme.typography.body2,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 6.dp),
                )
            }
            if (condition.symptoms.isNotEmpty()) {
                item {
                    SectionTitle(stringResource(R.string.section_symptoms))
                }
                items(condition.symptoms) { s ->
                    Text(
                        text = stringResource(R.string.bullet_item, s.label),
                        style = MaterialTheme.typography.caption2,
                        modifier = Modifier.padding(start = 8.dp, bottom = 2.dp),
                    )
                }
            }
            item {
                SectionTitle(stringResource(R.string.section_actions))
            }
            items(condition.recommendedActions) { a ->
                Text(
                    text = stringResource(R.string.action_item, a.title, a.detail),
                    style = MaterialTheme.typography.caption2,
                    modifier = Modifier.padding(bottom = 6.dp),
                )
            }
        }
        item { BackChip(onClick = { vm.navigate(MonitorScreen.Dashboard) }) }
    }
}

@Composable
private fun ProfilePickerScreen(vm: HealthMonitorViewModel) {
    WearScrollScreen(horizontalAlignment = Alignment.Start) {
        item { ScreenHeader(title = stringResource(R.string.screen_seed)) }
        items(SeedData.allProfiles) { profile ->
            ProfileRow(
                profile = profile,
                selected = profile == vm.seedProfile,
                onSelect = { vm.selectProfile(profile) },
            )
        }
        item { BackChip(onClick = { vm.navigate(MonitorScreen.Dashboard) }) }
    }
}

@Composable
private fun ProfileRow(profile: SeedProfile, selected: Boolean, onSelect: () -> Unit) {
    ListNavChip(
        title = profile.displayName,
        subtitle = profile.description,
        onClick = onSelect,
        selected = selected,
        modifier = Modifier.padding(vertical = 2.dp),
    )
}
