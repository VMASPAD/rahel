package xyz.targapps.rahel.data.remote

import retrofit2.http.Body
import retrofit2.http.POST

interface HealthApiService {

    @POST("profile")
    suspend fun upsertProfile(@Body body: UserProfileSnapshotDto): TelemetryBatchResponse

    @POST("telemetry/batch")
    suspend fun postTelemetryBatch(@Body body: TelemetryBatchRequest): TelemetryBatchResponse
}
