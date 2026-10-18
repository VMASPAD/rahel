package xyz.targapps.rahel.presentation.pairing

import androidx.compose.foundation.layout.Column
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
            .padding(vertical = 4.dp),
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
                // Codes are alphanumeric with variable length: scale the font and group for readability.
                val big = code.length <= 6
                Text(
                    text = if (code.length >= 7) code.chunked(4).joinToString(" ") else code,
                    fontSize = when {
                        big && !compact -> 36.sp
                        big -> 28.sp
                        !compact -> 26.sp
                        else -> 20.sp
                    },
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    modifier = Modifier.padding(top = 8.dp),
                )
                backup?.let {
                    Text(
                        text = stringResource(R.string.link_backup_code, it),
                        fontSize = if (compact) 16.sp else 20.sp,
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
