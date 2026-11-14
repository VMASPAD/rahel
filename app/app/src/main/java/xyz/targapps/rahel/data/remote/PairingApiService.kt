package xyz.targapps.rahel.data.remote

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface PairingApiService {

    @POST("pairing/code")
    suspend fun requestCode(@Body body: PairingCodeRequest): PairingCodeResponse

    @GET("pairing/status")
    suspend fun pairingStatus(@Query("deviceId") deviceId: String): PairingStatusResponse
}
