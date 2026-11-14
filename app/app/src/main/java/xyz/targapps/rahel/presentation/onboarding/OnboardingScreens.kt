package xyz.targapps.rahel.presentation.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Button
import androidx.activity.compose.BackHandler
import androidx.wear.compose.material.CompactChip
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import xyz.targapps.rahel.R
import xyz.targapps.rahel.data.SexoBiologico
import xyz.targapps.rahel.presentation.components.ScreenHeader
import xyz.targapps.rahel.presentation.components.WearScrollScreen
import xyz.targapps.rahel.presentation.components.WearScreenFrame
import xyz.targapps.rahel.presentation.theme.RaHelTheme
import java.util.Locale

@Composable
fun OnboardingFlow(viewModel: OnboardingViewModel) {
    // Swipe-to-dismiss goes back one step instead of dropping what the user already entered.
    BackHandler(enabled = viewModel.step != OnboardingStep.Sexo && viewModel.step != OnboardingStep.Welcome) {
        viewModel.back()
    }
    RaHelTheme {
        WearScreenFrame {
            when (viewModel.step) {
                OnboardingStep.Welcome -> WelcomeStep(viewModel)
                OnboardingStep.Sexo -> SexoStep(viewModel)
                OnboardingStep.Peso -> PesoStep(viewModel)
                OnboardingStep.Altura -> AlturaStep(viewModel)
                OnboardingStep.Confirm -> ConfirmStep(viewModel)
            }
        }
    }
}

@Composable
private fun WelcomeStep(vm: OnboardingViewModel) {
    WearScrollScreen {
        item {
            ScreenHeader(
                title = stringResource(R.string.onboarding_welcome_title),
                subtitle = stringResource(R.string.onboarding_welcome_subtitle),
            )
        }
        item {
            Button(
                onClick = vm::next,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(stringResource(R.string.onboarding_start))
            }
        }
    }
}

@Composable
private fun SexoStep(vm: OnboardingViewModel) {
    WearScrollScreen {
        item {
            StepHeader(
                step = 1,
                title = stringResource(R.string.onboarding_sexo_title),
                subtitle = stringResource(R.string.onboarding_sexo_subtitle),
            )
        }
        item {
            GenderChip(
                label = stringResource(R.string.onboarding_sexo_femenino),
                selected = vm.sexoBiologico == SexoBiologico.FEMENINO,
                onClick = { vm.selectSexo(SexoBiologico.FEMENINO) },
            )
        }
        item {
            GenderChip(
                label = stringResource(R.string.onboarding_sexo_masculino),
                selected = vm.sexoBiologico == SexoBiologico.MASCULINO,
                onClick = { vm.selectSexo(SexoBiologico.MASCULINO) },
            )
        }
        item { OnboardingNavRow(onBack = vm::back, onNext = vm::next) }
    }
}

@Composable
private fun PesoStep(vm: OnboardingViewModel) {
    WearScrollScreen {
        item {
            StepHeader(
                step = 2,
                title = stringResource(R.string.onboarding_peso_title),
                subtitle = stringResource(R.string.onboarding_peso_subtitle),
            )
        }
        item {
            StepperValue(
                valueText = stringResource(R.string.onboarding_peso_value, vm.pesoKg),
                onDecrease = { vm.adjustPeso(-1f) },
                onIncrease = { vm.adjustPeso(1f) },
            )
        }
        item { OnboardingNavRow(onBack = vm::back, onNext = vm::next) }
    }
}

@Composable
private fun AlturaStep(vm: OnboardingViewModel) {
    val displayValue = when (vm.heightUnit) {
        HeightUnit.Centimeters -> stringResource(R.string.onboarding_altura_cm, vm.alturaCm)
        HeightUnit.Meters -> stringResource(
            R.string.onboarding_altura_m,
            vm.alturaCmFromMeters / 100f,
        )
    }
    WearScrollScreen {
        item {
            StepHeader(
                step = 3,
                title = stringResource(R.string.onboarding_altura_title),
                subtitle = stringResource(R.string.onboarding_altura_subtitle),
            )
        }
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally),
            ) {
                CompactChip(
                    onClick = { vm.selectHeightUnit(HeightUnit.Centimeters) },
                    label = {
                        Text(
                            stringResource(R.string.onboarding_unit_cm),
                            maxLines = 1,
                        )
                    },
                    modifier = Modifier.weight(1f),
                )
                CompactChip(
                    onClick = { vm.selectHeightUnit(HeightUnit.Meters) },
                    label = {
                        Text(
                            stringResource(R.string.onboarding_unit_m),
                            maxLines = 1,
                        )
                    },
                    modifier = Modifier.weight(1f),
                )
            }
        }
        item {
            StepperValue(
                valueText = displayValue,
                onDecrease = { vm.adjustAltura(if (vm.heightUnit == HeightUnit.Centimeters) -1 else -1) },
                onIncrease = { vm.adjustAltura(1) },
            )
        }
        item { OnboardingNavRow(onBack = vm::back, onNext = vm::next) }
    }
}

@Composable
private fun ConfirmStep(vm: OnboardingViewModel) {
    val sexoLabel = if (vm.sexoBiologico == SexoBiologico.FEMENINO) {
        stringResource(R.string.onboarding_sexo_femenino)
    } else {
        stringResource(R.string.onboarding_sexo_masculino)
    }
    val imcText = String.format(Locale.getDefault(), "%.1f", vm.imcPreview)
    WearScrollScreen {
        item {
            ScreenHeader(
                title = stringResource(R.string.onboarding_confirm_title),
                subtitle = stringResource(R.string.onboarding_confirm_subtitle),
            )
        }
        item {
            SummaryLine(stringResource(R.string.onboarding_summary_sexo), sexoLabel)
        }
        item {
            SummaryLine(
                stringResource(R.string.onboarding_summary_peso),
                stringResource(R.string.onboarding_peso_value, vm.pesoKg),
            )
        }
        item {
            SummaryLine(
                stringResource(R.string.onboarding_summary_altura),
                stringResource(R.string.onboarding_altura_m, vm.alturaM),
            )
        }
        item {
            Text(
                text = stringResource(R.string.onboarding_summary_imc, imcText),
                style = MaterialTheme.typography.title3,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
            )
        }
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                CompactChip(
                    onClick = vm::back,
                    label = { Text(stringResource(R.string.action_back)) },
                    modifier = Modifier.weight(1f),
                )
                Button(
                    onClick = vm::completeOnboarding,
                    enabled = !vm.saving,
                    modifier = Modifier.weight(1f),
                ) {
                    Text(
                        if (vm.saving) {
                            stringResource(R.string.onboarding_saving)
                        } else {
                            stringResource(R.string.onboarding_finish)
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun StepHeader(step: Int, title: String, subtitle: String) {
    ScreenHeader(
        title = title,
        subtitle = stringResource(R.string.onboarding_step_indicator, step, 3) + "\n" + subtitle,
    )
}

@Composable
private fun GenderChip(label: String, selected: Boolean, onClick: () -> Unit) {
    CompactChip(
        onClick = onClick,
        label = {
            Text(
                text = label,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
        },
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
    )
}

@Composable
private fun StepperValue(
    valueText: String,
    onDecrease: () -> Unit,
    onIncrease: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
        CompactChip(
            onClick = onDecrease,
            label = { Text("−") },
            icon = {
                Icon(
                    imageVector = Icons.Filled.Remove,
                    contentDescription = stringResource(R.string.onboarding_decrease),
                    modifier = Modifier.size(24.dp),
                )
            },
        )
        Text(
            text = valueText,
            style = MaterialTheme.typography.title2,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
        )
        CompactChip(
            onClick = onIncrease,
            label = { Text("+") },
            icon = {
                Icon(
                    imageVector = Icons.Filled.Add,
                    contentDescription = stringResource(R.string.onboarding_increase),
                    modifier = Modifier.size(24.dp),
                )
            },
        )
    }
}

@Composable
private fun OnboardingNavRow(onBack: () -> Unit, onNext: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        CompactChip(
            onClick = onBack,
            label = { Text(stringResource(R.string.action_back)) },
            modifier = Modifier.weight(1f),
        )
        Button(
            onClick = onNext,
            modifier = Modifier.weight(1f),
        ) {
            Text(stringResource(R.string.onboarding_next))
        }
    }
}

@Composable
private fun SummaryLine(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.caption1,
            color = MaterialTheme.colors.onSurfaceVariant,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.body2,
            fontWeight = FontWeight.Medium,
        )
    }
}
