package xyz.targapps.rahel.presentation.pairing

import androidx.compose.foundation.layout.Column
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.Text
import xyz.targapps.rahel.R

@Composable
fun LinkCodesBlock(
    viewModel: PairingViewModel,
    compact: Boolean = false,
) {
    // Codes are requested only while this block is visible and stop when it leaves composition.
    DisposableEffect(viewModel) {
        viewModel.ensureLinkCodesActive()
        onDispose { viewModel.stopLinkCodes() }
    }
    val state by viewModel.uiState.collectAsState()
    val code = state.code
    val backup = state.secondaryCode

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = stringResource(
                if (compact) R.string.link_title_compact else R.string.link_title,
            ),
            textAlign = TextAlign.Center,
        )
        Text(
            text = stringResource(R.string.link_enter_code_hint),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 2.dp),
        )
        when {
            state.isLoading && code == null -> CircularProgressIndicator()
            code != null -> {
                // Codes are alphanumeric with variable length. The font follows the user's system
                // font size, but is capped so the code always fits the width (never cut by the edges).
                val shown = if (code.length >= 7) code.chunked(4).joinToString(" ") else code
                val wanted = when {
                    code.length <= 6 && !compact -> 36f
                    code.length <= 6 -> 28f
                    !compact -> 26f
                    else -> 20f
                }
                BoxWithConstraints(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    val fontScale = LocalDensity.current.fontScale
                    val longestLine = shown.split(' ').maxOf { it.length }.coerceAtLeast(1)
                    // ~0.62 em per monospace-ish digit; divide by fontScale because sp scales with it.
                    val fits = maxWidth.value / (longestLine * 0.62f) / fontScale
                    Text(
                        text = shown,
                        fontSize = minOf(wanted, fits).coerceAtLeast(12f).sp,
                        textAlign = TextAlign.Center,
                        maxLines = 2,
                    )
                }
                backup?.let {
                    Text(
                        text = stringResource(R.string.link_backup_code, it),
                        fontSize = if (compact) 14.sp else 16.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                    Text(
                        text = stringResource(R.string.link_auto_renews),
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        }
        state.error?.let {
            Text(text = it, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 4.dp))
        }
    }
}
