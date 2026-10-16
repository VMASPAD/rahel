package xyz.targapps.rahel.presentation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import xyz.targapps.rahel.R
import xyz.targapps.rahel.domain.AlertLevel
import xyz.targapps.rahel.domain.ConditionAssessment
import xyz.targapps.rahel.presentation.components.BackChip
import xyz.targapps.rahel.presentation.components.ListNavChip
import xyz.targapps.rahel.presentation.components.NavCompactChip
import xyz.targapps.rahel.presentation.components.RaHelIcons
import xyz.targapps.rahel.presentation.components.ScreenHeader
import xyz.targapps.rahel.presentation.components.StatusRing
import xyz.targapps.rahel.presentation.components.VitalMetricRow
import xyz.targapps.rahel.presentation.components.WearScreenFrame
import xyz.targapps.rahel.presentation.components.WearScrollScreen
import xyz.targapps.rahel.presentation.theme.RaHelTheme
import xyz.targapps.rahel.seed.SeedData
import xyz.targapps.rahel.seed.SeedProfile

@Composable
fun HealthMonitorApp(viewModel: HealthMonitorViewModel) {
    RaHelTheme {
        WearScreenFrame {
            when (viewModel.screen) {
                MonitorScreen.Home -> HomeScreen(viewModel)
                MonitorScreen.Vitals -> VitalsScreen(viewModel)
                MonitorScreen.Conditions -> ConditionsScreen(viewModel)
                MonitorScreen.ProfilePicker -> ProfilePickerScreen(viewModel)
                MonitorScreen.ConditionDetail -> ConditionDetailScreen(viewModel)
            }
        }
    }
}

@Composable
private fun HomeScreen(vm: HealthMonitorViewModel) {
    val snap = vm.snapshot
    val result = vm.assessment
    val level = result?.overallLevel ?: AlertLevel.NOMINAL

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
                    .padding(vertical = 8.dp),
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
                    .padding(bottom = 12.dp),
            )
        }
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                NavCompactChip(
                    label = stringResource(R.string.nav_vitals),
                    icon = RaHelIcons.Vitals,
                    onClick = { vm.navigate(MonitorScreen.Vitals) },
                    modifier = Modifier.weight(1f),
                )
                NavCompactChip(
                    label = stringResource(R.string.nav_risks),
                    icon = RaHelIcons.Risks,
                    onClick = { vm.navigate(MonitorScreen.Conditions) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
        item {
            NavCompactChip(
                label = stringResource(R.string.nav_seed),
                icon = RaHelIcons.Seed,
                onClick = { vm.navigate(MonitorScreen.ProfilePicker) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 6.dp),
            )
        }
    }
}

@Composable
private fun VitalsScreen(vm: HealthMonitorViewModel) {
    val snap = vm.snapshot
    WearScrollScreen(horizontalAlignment = Alignment.Start) {
        item { ScreenHeader(title = stringResource(R.string.screen_vitals)) }
        if (snap != null) {
            item { VitalMetricRow(stringResource(R.string.vital_hr), "${snap.vitals.heartRateBpm} bpm") }
            item {
                VitalMetricRow(
                    stringResource(R.string.vital_resting_hr),
                    "${snap.vitals.restingHeartRateBpm} bpm",
                )
            }
            item { VitalMetricRow(stringResource(R.string.vital_hrv), "${snap.vitals.hrvMs} ms") }
            item { VitalMetricRow(stringResource(R.string.vital_spo2), "${snap.vitals.spO2Percent}%") }
            item { VitalMetricRow(stringResource(R.string.vital_steps), "${snap.vitals.stepsToday}") }
            item {
                VitalMetricRow(
                    stringResource(R.string.vital_sleep),
                    "${snap.vitals.sleepHoursLastNight} h",
                )
            }
            item {
                VitalMetricRow(
                    stringResource(R.string.vital_stress),
                    "${snap.vitals.stressScore}/100",
                )
            }
            item {
                VitalMetricRow(
                    stringResource(R.string.vital_skin_temp),
                    "${snap.vitals.skinTempCelsius} °C",
                )
            }
        }
        item { BackChip(onClick = { vm.navigate(MonitorScreen.Home) }) }
    }
}

@Composable
private fun ConditionsScreen(vm: HealthMonitorViewModel) {
    val conditions = vm.assessment?.conditions ?: emptyList()
    WearScrollScreen(horizontalAlignment = Alignment.Start) {
        item { ScreenHeader(title = stringResource(R.string.screen_assessment)) }
        if (conditions.isEmpty()) {
            item {
                Text(
                    text = stringResource(R.string.assessment_empty),
                    style = MaterialTheme.typography.body2,
                    modifier = Modifier.padding(horizontal = 4.dp, vertical = 8.dp),
                )
            }
        } else {
            items(conditions) { c ->
                ConditionChip(c, onClick = { vm.openCondition(c.conditionId) })
            }
        }
        item { BackChip(onClick = { vm.navigate(MonitorScreen.Home) }) }
    }
}

@Composable
private fun ConditionChip(condition: ConditionAssessment, onClick: () -> Unit) {
    ListNavChip(
        title = condition.title,
        subtitle = "${condition.category.name} · ${(condition.confidence * 100).toInt()}%",
        onClick = onClick,
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
                    Text(
                        text = stringResource(R.string.section_symptoms),
                        style = MaterialTheme.typography.caption1,
                        color = MaterialTheme.colors.primary,
                        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                    )
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
                Text(
                    text = stringResource(R.string.section_actions),
                    style = MaterialTheme.typography.caption1,
                    color = MaterialTheme.colors.primary,
                    modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                )
            }
            items(condition.recommendedActions) { a ->
                Text(
                    text = stringResource(R.string.action_item, a.title, a.detail),
                    style = MaterialTheme.typography.caption2,
                    modifier = Modifier.padding(bottom = 6.dp),
                )
            }
        }
        item { BackChip(onClick = { vm.navigate(MonitorScreen.Conditions) }) }
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
        item { BackChip(onClick = { vm.navigate(MonitorScreen.Home) }) }
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
