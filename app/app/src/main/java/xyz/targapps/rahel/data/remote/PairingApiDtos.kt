package xyz.targapps.rahel.data.remote

data class PairingCodeRequest(val deviceId: String)

/** The link code is alphanumeric and of variable length (backend currently issues 8 chars). */
data class PairingCodeResponse(
    val code: String,
    val secondaryCode: String? = null,
    val expiresAt: String? = null,
    val ttlSeconds: Int? = null,
)

/** The status endpoint never returns link codes; the code only comes from POST /pairing/code. */
data class PairingStatusResponse(
    val status: String,
    val crewMemberId: String? = null,
    val deviceToken: String? = null,
)
