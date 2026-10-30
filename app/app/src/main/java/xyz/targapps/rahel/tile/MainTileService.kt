package xyz.targapps.rahel.tile

import android.content.Context
import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.ColorBuilders.argb
import androidx.wear.protolayout.DeviceParametersBuilders
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.protolayout.material.ChipColors
import androidx.wear.protolayout.material.CompactChip
import androidx.wear.protolayout.material.Text
import androidx.wear.protolayout.material.Typography
import androidx.wear.protolayout.material.layouts.PrimaryLayout
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.tooling.preview.Preview
import androidx.wear.tiles.tooling.preview.TilePreviewData
import androidx.wear.tooling.preview.devices.WearDevices
import com.google.android.horologist.annotations.ExperimentalHorologistApi
import com.google.android.horologist.tiles.SuspendingTileService
import kotlinx.coroutines.flow.first
import xyz.targapps.rahel.RaHelApp
import xyz.targapps.rahel.presentation.MainActivity

private const val RESOURCES_VERSION = "1"
private const val REFRESH_MS = 60_000L

private const val BRAND_GREEN = 0xFF007A39.toInt()
private const val BRAND_PINK = 0xFFFFE5E7.toInt()
private const val BRAND_MINT = 0xFF5EE0A0.toInt()

/** What the tile shows: the latest heart rate and whether monitoring is running. */
internal data class TileState(val heartRateBpm: Int?, val monitoring: Boolean, val setUp: Boolean = true)

/**
 * RaHel tile: current heart rate and monitoring status at a glance, with a one-tap shortcut
 * into the app. While monitoring runs it mirrors the ongoing activity shown on the watch face.
 */
@OptIn(ExperimentalHorologistApi::class)
class MainTileService : SuspendingTileService() {

    override suspend fun resourcesRequest(
        requestParams: RequestBuilders.ResourcesRequest
    ) = resources(requestParams)

    override suspend fun tileRequest(
        requestParams: RequestBuilders.TileRequest
    ): TileBuilders.Tile {
        val app = application as RaHelApp
        val state = TileState(
            heartRateBpm = app.sensorHub.liveMetrics.value.heartRateBpm,
            monitoring = app.userProfileRepository.monitoringEnabled.first(),
            setUp = app.userProfileRepository.userProfile.first().onboardingComplete,
        )
        return tile(requestParams, this, state)
    }
}

private fun resources(
    @Suppress("UNUSED_PARAMETER") requestParams: RequestBuilders.ResourcesRequest
): ResourceBuilders.Resources {
    return ResourceBuilders.Resources.Builder()
        .setVersion(RESOURCES_VERSION)
        .build()
}

private fun tile(
    requestParams: RequestBuilders.TileRequest,
    context: Context,
    state: TileState,
): TileBuilders.Tile {
    val singleTileTimeline = TimelineBuilders.Timeline.Builder()
        .addTimelineEntry(
            TimelineBuilders.TimelineEntry.Builder()
                .setLayout(
                    LayoutElementBuilders.Layout.Builder()
                        .setRoot(tileLayout(requestParams.deviceConfiguration, context, state))
                        .build()
                )
                .build()
        )
        .build()

    return TileBuilders.Tile.Builder()
        .setResourcesVersion(RESOURCES_VERSION)
        .setFreshnessIntervalMillis(REFRESH_MS)
        .setTileTimeline(singleTileTimeline)
        .build()
}

private fun openAppClickable(context: Context): ModifiersBuilders.Clickable =
    ModifiersBuilders.Clickable.Builder()
        .setId("open_rahel")
        .setOnClick(
            ActionBuilders.LaunchAction.Builder()
                .setAndroidActivity(
                    ActionBuilders.AndroidActivity.Builder()
                        .setPackageName(context.packageName)
                        .setClassName(MainActivity::class.java.name)
                        .build()
                )
                .build()
        )
        .build()

private fun tileLayout(
    deviceParameters: DeviceParametersBuilders.DeviceParameters,
    context: Context,
    state: TileState,
): LayoutElementBuilders.LayoutElement {
    if (!state.setUp) return setUpLayout(deviceParameters, context)
    val heartRate = state.heartRateBpm?.let { "$it bpm" } ?: "-- bpm"
    val status = if (state.monitoring) "Monitoring is on" else "Monitoring is off"

    return PrimaryLayout.Builder(deviceParameters)
        .setResponsiveContentInsetEnabled(true)
        .setPrimaryLabelTextContent(
            Text.Builder(context, "RaHel")
                .setColor(argb(BRAND_MINT))
                .setTypography(Typography.TYPOGRAPHY_CAPTION1)
                .build()
        )
        .setContent(
            LayoutElementBuilders.Column.Builder()
                .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
                .addContent(
                    Text.Builder(context, heartRate)
                        .setColor(argb(BRAND_PINK))
                        .setTypography(Typography.TYPOGRAPHY_DISPLAY3)
                        .build()
                )
                .addContent(
                    Text.Builder(context, status)
                        .setColor(argb(if (state.monitoring) BRAND_MINT else BRAND_PINK))
                        .setTypography(Typography.TYPOGRAPHY_CAPTION2)
                        .build()
                )
                .build()
        )
        .setPrimaryChipContent(
            CompactChip.Builder(context, "Open", openAppClickable(context), deviceParameters)
                .setChipColors(ChipColors(argb(BRAND_GREEN), argb(BRAND_PINK)))
                .build()
        )
        .build()
}

/** First-run state: invites the user into the app, where the 3 quick questions live. */
private fun setUpLayout(
    deviceParameters: DeviceParametersBuilders.DeviceParameters,
    context: Context,
): LayoutElementBuilders.LayoutElement =
    PrimaryLayout.Builder(deviceParameters)
        .setResponsiveContentInsetEnabled(true)
        .setPrimaryLabelTextContent(
            Text.Builder(context, "RaHel")
                .setColor(argb(BRAND_MINT))
                .setTypography(Typography.TYPOGRAPHY_CAPTION1)
                .build()
        )
        .setContent(
            Text.Builder(context, "Set up RaHel to see your heart rate here")
                .setColor(argb(BRAND_PINK))
                .setTypography(Typography.TYPOGRAPHY_BODY1)
                .setMaxLines(3)
                .build()
        )
        .setPrimaryChipContent(
            CompactChip.Builder(context, "Get started", openAppClickable(context), deviceParameters)
                .setChipColors(ChipColors(argb(BRAND_GREEN), argb(BRAND_PINK)))
                .build()
        )
        .build()

@Preview(device = WearDevices.SMALL_ROUND)
@Preview(device = WearDevices.LARGE_ROUND)
fun tilePreview(context: Context) = TilePreviewData(::resources) {
    tile(it, context, TileState(heartRateBpm = 72, monitoring = true))
}
