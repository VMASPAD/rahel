package xyz.targapps.rahel.presentation.pairing

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import xyz.targapps.rahel.presentation.components.WearScreenFrame
import xyz.targapps.rahel.presentation.theme.RaHelTheme

@Composable
fun PairingScreen(viewModel: PairingViewModel) {
    RaHelTheme {
        WearScreenFrame {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                LinkCodesBlock(viewModel = viewModel, compact = false)
            }
        }
    }
}
