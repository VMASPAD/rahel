package xyz.targapps.rahel.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.util.UUID

private val Context.devicePairingDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "rahel_device_pairing",
)

data class DevicePairingState(
    val deviceId: String,
    val isPaired: Boolean,
    val crewMemberId: String?,
    val deviceToken: String?,
)

class DevicePairingRepository(private val context: Context) {

    private object Keys {
        val deviceId = stringPreferencesKey("device_id")
        val crewMemberId = stringPreferencesKey("crew_member_id")
        /** Device token encrypted with an Android Keystore key (see [TokenCipher]). */
        val deviceTokenEnc = stringPreferencesKey("device_token_enc")
        /** Legacy plaintext key; never read, removed on write/clear. */
        val legacyDeviceToken = stringPreferencesKey("device_token")
    }

    val pairingState: Flow<DevicePairingState> = context.devicePairingDataStore.data.map { prefs ->
        val id = prefs[Keys.deviceId] ?: ""
        val crew = prefs[Keys.crewMemberId]
        val token = prefs[Keys.deviceTokenEnc]?.let { TokenCipher.decrypt(it) }
        DevicePairingState(
            deviceId = id,
            isPaired = !crew.isNullOrBlank() && !token.isNullOrBlank(),
            crewMemberId = crew,
            deviceToken = token,
        )
    }.flowOn(Dispatchers.Default) // Keystore decryption off the main thread

    suspend fun ensureDeviceId(): String {
        val prefs = context.devicePairingDataStore.data.first()
        val existing = prefs[Keys.deviceId]
        if (!existing.isNullOrBlank()) return existing
        val newId = UUID.randomUUID().toString()
        context.devicePairingDataStore.edit { it[Keys.deviceId] = newId }
        return newId
    }

    suspend fun savePairing(crewMemberId: String, deviceToken: String) {
        context.devicePairingDataStore.edit { prefs ->
            prefs[Keys.crewMemberId] = crewMemberId
            prefs[Keys.deviceTokenEnc] = TokenCipher.encrypt(deviceToken)
            prefs.remove(Keys.legacyDeviceToken)
        }
    }

    suspend fun deviceTokenOrNull(): String? =
        context.devicePairingDataStore.data.first()[Keys.deviceTokenEnc]?.let { TokenCipher.decrypt(it) }

    suspend fun clearCredentials() {
        context.devicePairingDataStore.edit { prefs ->
            prefs.remove(Keys.crewMemberId)
            prefs.remove(Keys.deviceTokenEnc)
            prefs.remove(Keys.legacyDeviceToken)
        }
    }
}
