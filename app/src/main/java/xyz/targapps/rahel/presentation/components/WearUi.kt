package xyz.targapps.rahel.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Science
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
import xyz.targapps.rahel.presentation.theme.StatusCritical
import xyz.targapps.rahel.presentation.theme.StatusElevated
import xyz.targapps.rahel.presentation.theme.StatusNominal
import xyz.targapps.rahel.presentation.theme.StatusWatch

val WearContentPadding = PaddingValues(top = 28.dp, start = 8.dp, end = 8.dp, bottom = 36.dp)

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
            .padding(bottom = 8.dp),
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
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

@Composable
fun StatusRing(level: AlertLevel, modifier: Modifier = Modifier) {
    val color = when (level) {
        AlertLevel.NOMINAL -> StatusNominal
        AlertLevel.WATCH -> StatusWatch
        AlertLevel.ELEVATED -> StatusElevated
        AlertLevel.CRITICAL -> StatusCritical
    }
    Box(
        modifier = modifier
            .size(56.dp)
            .clip(CircleShape)
            .background(color.copy(alpha = 0.25f)),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .size(28.dp)
                .clip(CircleShape)
                .background(color),
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
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
fun VitalMetricRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.caption1,
            color = MaterialTheme.colors.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            style = MaterialTheme.typography.body2,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.End,
        )
    }
}

@Composable
fun ListNavChip(
    title: String,
    subtitle: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    selected: Boolean = false,
) {
    Chip(
        onClick = onClick,
        label = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
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
                SelectedMarker(visible = selected)
            }
        },
        colors = ChipDefaults.chipColors(),
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
    )
}

@Composable
fun SelectedMarker(visible: Boolean) {
    if (visible) {
        Icon(
            imageVector = Icons.Filled.Check,
            contentDescription = stringResource(R.string.cd_selected),
            modifier = Modifier.size(22.dp),
            tint = MaterialTheme.colors.primary,
        )
    }
}

object RaHelIcons {
    val Home: ImageVector = Icons.Filled.Home
    val Vitals: ImageVector = Icons.Filled.Favorite
    val Risks: ImageVector = Icons.Filled.Warning
    val Seed: ImageVector = Icons.Filled.Science
}
