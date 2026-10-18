package xyz.targapps.rahel.presentation.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.wear.compose.material.Colors
import androidx.wear.compose.material.MaterialTheme

private val RaHelColors = Colors(
    primary = BrandGreen,
    primaryVariant = Color(0xFF005A29),
    secondary = BrandMint,
    secondaryVariant = BrandMintLight,
    background = BrandForest,
    surface = SurfaceMuted,
    error = StatusCritical,
    onPrimary = BrandPink,
    onSecondary = BrandForest,
    onBackground = BrandPink,
    onSurface = BrandPink,
    onSurfaceVariant = OnSurfaceMuted,
    onError = BrandForest,
)

@Composable
fun RaHelTheme(content: @Composable () -> Unit) {
    MaterialTheme(colors = RaHelColors, content = content)
}
