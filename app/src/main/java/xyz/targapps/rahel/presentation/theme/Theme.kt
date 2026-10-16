package xyz.targapps.rahel.presentation.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.wear.compose.material.Colors
import androidx.wear.compose.material.MaterialTheme

private val RaHelColors = Colors(
    primary = Color(0xFF64B5F6),
    primaryVariant = Color(0xFF42A5F5),
    secondary = Color(0xFF81C784),
    background = Color(0xFF000000),
    surface = SurfaceMuted,
    onPrimary = Color(0xFF000000),
    onSecondary = Color(0xFF000000),
    onBackground = Color(0xFFECEFF1),
    onSurface = Color(0xFFECEFF1),
    onSurfaceVariant = OnSurfaceMuted,
)

@Composable
fun RaHelTheme(content: @Composable () -> Unit) {
    MaterialTheme(colors = RaHelColors, content = content)
}
