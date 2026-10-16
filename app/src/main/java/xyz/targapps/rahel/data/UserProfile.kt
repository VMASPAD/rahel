package xyz.targapps.rahel.data

import xyz.targapps.rahel.domain.BiologicalSex
import xyz.targapps.rahel.domain.OnboardingProfileInput

/**
 * Baseline profile fields aligned with datos.md x₂ (`sexo_biologico`), x₃ (`imc`),
 * plus raw inputs used to compute IMC.
 */
data class UserProfile(
    val sexoBiologico: Int?,
    val pesoKg: Float?,
    val alturaM: Float?,
    val imc: Float?,
    val onboardingComplete: Boolean,
) {
    companion object {
        val Empty = UserProfile(
            sexoBiologico = null,
            pesoKg = null,
            alturaM = null,
            imc = null,
            onboardingComplete = false,
        )
    }
}

/** 0 = Femenino, 1 = Masculino (datos.md x₂). */
object SexoBiologico {
    const val FEMENINO = 0
    const val MASCULINO = 1
}

fun computeImc(pesoKg: Float, alturaM: Float): Float {
    if (pesoKg <= 0f || alturaM <= 0f) return 0f
    return pesoKg / (alturaM * alturaM)
}

/** Maps DataStore onboarding fields to engine baseline input (x₁–x₁₁ defaults for unset fields). */
fun UserProfile.toOnboardingProfileInput(): OnboardingProfileInput? {
    if (!onboardingComplete) return null
    val sex = sexoBiologico ?: return null
    val peso = pesoKg ?: return null
    val altura = alturaM ?: return null
    if (peso <= 0f || altura <= 0f) return null
    return OnboardingProfileInput(
        biologicalSex = if (sex == SexoBiologico.FEMENINO) BiologicalSex.FEMALE else BiologicalSex.MALE,
        weightKg = peso,
        heightCm = altura * 100f,
    )
}
