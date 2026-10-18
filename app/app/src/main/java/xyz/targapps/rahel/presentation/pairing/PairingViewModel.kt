package xyz.targapps.rahel.presentation.pairing

import android.os.SystemClock
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import xyz.targapps.rahel.data.DevicePairingRepository
import xyz.targapps.rahel.data.remote.PairingApiService
import xyz.targapps.rahel.data.remote.PairingCodeRequest

data class PairingUiState(
    /** Alphanumeric link code of variable length, exactly as returned by POST /pairing/code. */
    val code: String? = null,
    val secondaryCode: String? = null,
    val expiresAtLabel: String? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
)

class PairingViewModel(
    private val pairingRepository: DevicePairingRepository,
    private val pairingApi: PairingApiService,
) : ViewModel() {

    private companion object {
        const val TAG = "PairingVM"
        const val POLL_INTERVAL_MS = 2_500L
        const val RETRY_DELAY_MS = 5_000L
        const val DEFAULT_TTL_MS = 5 * 60_000L
    }

    private val _uiState = MutableStateFlow(PairingUiState())
    val uiState: StateFlow<PairingUiState> = _uiState.asStateFlow()

    /** The single job that requests a code and polls its status; replaced (never duplicated). */
    private var pairingJob: Job? = null

    /** Start link codes (initial pairing or re-sync from the Sync tab). No-op while already running. */
    fun ensureLinkCodesActive() {
        if (pairingJob?.isActive == true) return
        restart()
    }

    /** Cancels any running request/poll and starts a fresh one. */
    fun refreshCode() = restart()

    private fun restart() {
        pairingJob?.cancel()
        pairingJob = viewModelScope.launch { runPairing() }
    }

    private suspend fun runPairing() {
        while (currentCoroutineContext().isActive) {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val deviceId: String
            val expiresAt: Long
            try {
                deviceId = pairingRepository.ensureDeviceId()
                val response = pairingApi.requestCode(PairingCodeRequest(deviceId))
                // The code is taken only from this response (status never returns it).
                _uiState.value = PairingUiState(
                    code = response.code,
                    secondaryCode = response.secondaryCode,
                    expiresAtLabel = response.expiresAt,
                    isLoading = false,
                )
                val ttlMs = response.ttlSeconds?.takeIf { it > 0 }?.let { it * 1000L } ?: DEFAULT_TTL_MS
                expiresAt = SystemClock.elapsedRealtime() + ttlMs
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "requestCode failed", e)
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = e.message ?: "Network error",
                )
                delay(RETRY_DELAY_MS)
                continue
            }
            if (poll(deviceId, expiresAt)) return // paired: stop polling for good
        }
    }

    /** Returns true when paired (stop), false when a new code must be requested. */
    private suspend fun poll(deviceId: String, expiresAt: Long): Boolean {
        while (currentCoroutineContext().isActive) {
            delay(POLL_INTERVAL_MS)
            if (SystemClock.elapsedRealtime() >= expiresAt) return false
            try {
                val status = pairingApi.pairingStatus(deviceId)
                when (status.status) {
                    "paired" -> {
                        val crew = status.crewMemberId
                        val token = status.deviceToken
                        if (!crew.isNullOrBlank() && !token.isNullOrBlank()) {
                            pairingRepository.savePairing(crew, token)
                            return true
                        }
                        // Token is delivered only once; paired without it is unusable: get a new code.
                        return false
                    }
                    "expired" -> return false
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Log.w(TAG, "pairingStatus failed (will retry)", e)
            }
        }
        return false
    }

    class Factory(
        private val pairingRepository: DevicePairingRepository,
        private val pairingApi: PairingApiService,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T =
            PairingViewModel(pairingRepository, pairingApi) as T
    }
}
