package xyz.targapps.rahel.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Science
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.filled.Warning
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListScope
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.ChipDefaults
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import xyz.targapps.rahel.R
import xyz.targapps.rahel.domain.AlertLevel
import xyz.targapps.rahel.presentation.theme.OnSurfaceMuted
import xyz.targapps.rahel.presentation.theme.StatusCritical
import xyz.targapps.rahel.presentation.theme.StatusElevated
import xyz.targapps.rahel.presentation.theme.StatusNominal
import xyz.targapps.rahel.presentation.theme.StatusWatch
import xyz.targapps.rahel.presentation.theme.SurfaceMuted
import xyz.targapps.rahel.sensor.SensorAvailability

val WearContentPadding = PaddingValues(top = 28.dp, start = 10.dp, end = 10.dp, bottom = 40.dp)

fun alertColor(level: AlertLevel) = when (level) {
    AlertLevel.NOMINAL -> StatusNominal
    AlertLevel.WATCH -> StatusWatch
    AlertLevel.ELEVATED -> StatusElevated
    AlertLevel.CRITICAL -> StatusCritical
}

@Composable
fun WearScreenFrame(content: @Composable () -> Unit) {
    Box(modifier = Modifier.fillMaxSize()) {
        TimeText()
        content()
    }
}

@Composable
fun WearScrollScreen(
    modifier: Modifier = Modifier,
    horizontalAlignment: Alignment.Horizontal = Alignment.CenterHorizontally,
    content: ScalingLazyListScope.() -> Unit,
) {
    ScalingLazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = WearContentPadding,
        horizontalAlignment = horizontalAlignment,
        content = content,
    )
}

@Composable
fun ScreenHeader(title: String, subtitle: String? = null) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.title3,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        if (subtitle != null) {
            Text(
                text = subtitle,
                style = MaterialTheme.typography.caption2,
                color = MaterialTheme.colors.onSurfaceVariant,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = MaterialTheme.typography.caption1,
        color = MaterialTheme.colors.secondary,
        fontWeight = FontWeight.Medium,
        modifier = modifier
            .fillMaxWidth()
            .padding(top = 10.dp, bottom = 6.dp, start = 2.dp),
    )
}

@Composable
fun StatusRing(level: AlertLevel, modifier: Modifier = Modifier) {
    val color = alertColor(level)
    Box(
        modifier = modifier
            .size(64.dp)
            .clip(CircleShape)
            .background(color.copy(alpha = 0.22f)),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(color),
        )
    }
}

@Composable
fun AlertLevelDot(level: AlertLevel, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(10.dp)
            .clip(CircleShape)
            .background(alertColor(level)),
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SensorAvailabilityFlow(
    sensors: List<SensorAvailability>,
    modifier: Modifier = Modifier,
) {
    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        sensors.forEach { sensor ->
            SensorAvailabilityChip(sensor)
        }
    }
}

@Composable
fun SensorAvailabilityChip(sensor: SensorAvailability) {
    val bg = if (sensor.available) StatusNominal.copy(alpha = 0.2f) else SurfaceMuted
    val labelColor = if (sensor.available) MaterialTheme.colors.onSurface else OnSurfaceMuted
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Text(
            text = sensor.displayName,
            style = MaterialTheme.typography.caption2,
            color = labelColor,
            maxLines = 1,
        )
    }
}

@Composable
fun NavCompactChip(
    label: String,
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    CompactChip(
        onClick = onClick,
        label = {
            Text(
                text = label,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        },
        icon = {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
        },
        modifier = modifier,
    )
}

@Composable
fun BackChip(onClick: () -> Unit) {
    CompactChip(
        onClick = onClick,
        label = { Text(stringResource(R.string.action_back)) },
        icon = {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
        },
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
    )
}

@Composable
fun VitalMetricRow(
    label: String,
    value: String,
    level: AlertLevel? = null,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 32.dp)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.weight(1f),
        ) {
            if (level != null) {
                AlertLevelDot(level)
            }
            Text(
                text = label,
                style = MaterialTheme.typography.caption1,
                color = MaterialTheme.colors.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Text(
            text = value,
            style = MaterialTheme.typography.body2,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.End,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.widthIn(max = 110.dp),
        )
    }
}

@Composable
fun ZScoreRow(
    label: String,
    zScore: Float,
    displayValue: String,
    level: AlertLevel,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceMuted.copy(alpha = 0.65f))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.weight(1f),
        ) {
            AlertLevelDot(level)
            Column {
                Text(label, style = MaterialTheme.typography.caption1, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    stringResource(R.string.z_score_format, zScore),
                    style = MaterialTheme.typography.caption2,
                    color = MaterialTheme.colors.onSurfaceVariant,
                )
            }
        }
        Text(
            text = displayValue,
            style = MaterialTheme.typography.body2,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            modifier = Modifier.padding(start = 6.dp),
        )
    }
}

@Composable
fun DashboardPageDots(currentPage: Int, pageCount: Int, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        repeat(pageCount) { index ->
            val active = index == currentPage
            Box(
                modifier = Modifier
                    .size(if (active) 8.dp else 6.dp)
                    .clip(CircleShape)
                    .background(
                        if (active) MaterialTheme.colors.secondary
                        else MaterialTheme.colors.onSurfaceVariant.copy(alpha = 0.4f),
                    ),
            )
        }
    }
}

@Composable
fun ListNavChip(
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    selected: Boolean = false,
    leadingLevel: AlertLevel? = null,
) {
    Chip(
        onClick = onClick,
        label = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    if (leadingLevel != null) {
                        AlertLevelDot(leadingLevel)
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(title, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Text(
                            subtitle,
                            style = MaterialTheme.typography.caption2,
                            color = MaterialTheme.colors.onSurfaceVariant,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                SelectedMarker(visible = selected)
            }
        },
        colors = ChipDefaults.chipColors(),
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp),
    )
}

@Composable
fun SelectedMarker(visible: Boolean) {
    if (visible) {
        Icon(
            imageVector = Icons.Filled.Check,
            contentDescription = stringResource(R.string.cd_selected),
            modifier = Modifier.size(22.dp),
            tint = MaterialTheme.colors.secondary,
        )
    }
}

object RaHelIcons {
    val Home: ImageVector = Icons.Filled.Home
    val Vitals: ImageVector = Icons.Filled.Favorite
    val Risks: ImageVector = Icons.Filled.Warning
    val Seed: ImageVector = Icons.Filled.Science
    val Sensors: ImageVector = Icons.Filled.Sensors
    val Sync: ImageVector = Icons.Filled.CloudUpload
}
