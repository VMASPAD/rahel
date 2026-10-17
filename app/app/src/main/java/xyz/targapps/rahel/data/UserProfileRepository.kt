package xyz.targapps.rahel.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.userProfileDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "rahel_user_profile",
)

/**
 * DataStore preference keys for onboarding / baseline profile.
 *
 * | Key | Type | Maps to |
 * |-----|------|---------|
 * | [Keys.ONBOARDING_COMPLETE] | Boolean | Gate main app |
 * | [Keys.SEXO_BIOLOGICO] | Int | datos.md x₂ (0 F / 1 M) |
 * | [Keys.PESO_KG] | Float | Weight input (kg) |
 * | [Keys.ALTURA_M] | Float | Height stored in metres |
 * | [Keys.IMC] | Float | datos.md x₃ |
 */
class UserProfileRepository(private val context: Context) {

    object Keys {
        const val ONBOARDING_COMPLETE = "onboarding_complete"
        const val SEXO_BIOLOGICO = "sexo_biologico"
        const val PESO_KG = "peso_kg"
        const val ALTURA_M = "altura_m"
        const val IMC = "imc"

        val onboardingComplete = booleanPreferencesKey(ONBOARDING_COMPLETE)
        val sexoBiologico = intPreferencesKey(SEXO_BIOLOGICO)
        val pesoKg = floatPreferencesKey(PESO_KG)
        val alturaM = floatPreferencesKey(ALTURA_M)
        val imc = floatPreferencesKey(IMC)
    }

    val userProfile: Flow<UserProfile> = context.userProfileDataStore.data.map { prefs ->
        UserProfile(
            sexoBiologico = prefs[Keys.sexoBiologico],
            pesoKg = prefs[Keys.pesoKg],
            alturaM = prefs[Keys.alturaM],
            imc = prefs[Keys.imc],
            onboardingComplete = prefs[Keys.onboardingComplete] ?: false,
        )
    }

    suspend fun saveOnboardingProfile(
        sexoBiologico: Int,
        pesoKg: Float,
        alturaM: Float,
    ) {
        val imc = computeImc(pesoKg, alturaM)
        context.userProfileDataStore.edit { prefs ->
            prefs[Keys.sexoBiologico] = sexoBiologico
            prefs[Keys.pesoKg] = pesoKg
            prefs[Keys.alturaM] = alturaM
            prefs[Keys.imc] = imc
            prefs[Keys.onboardingComplete] = true
        }
    }
}
