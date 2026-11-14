package xyz.targapps.rahel.data.remote

import com.google.gson.GsonBuilder
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import xyz.targapps.rahel.BuildConfig
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Retrofit client for the RaHel API.
 *
 * **Setting the real API URL**
 * 1. **Release / default:** edit `API_BASE_URL` in `app/build.gradle.kts` `defaultConfig`.
 * 2. **Debug emulator:** debug buildType uses `http://10.0.2.2:8080/` (host loopback).
 * 3. **Physical device on LAN:** use `buildConfigField` in a product flavor or debug block with
 *    `http://<your-pc-ip>:8080/` (trailing slash required).
 *
 * Base URL is read from [BuildConfig.API_BASE_URL].
 */
object RemoteApiFactory {

    fun createHealthApiService(
        baseUrl: String = BuildConfig.API_BASE_URL,
        enableLogging: Boolean = BuildConfig.DEBUG,
        deviceTokenProvider: (() -> String?)? = null,
    ): HealthApiService = createRetrofit(baseUrl, enableLogging, deviceTokenProvider)
        .create(HealthApiService::class.java)

    fun createPairingApiService(
        baseUrl: String = BuildConfig.API_BASE_URL,
        enableLogging: Boolean = BuildConfig.DEBUG,
    ): PairingApiService = createRetrofit(baseUrl, enableLogging, null)
        .create(PairingApiService::class.java)

    /** Gson used for request bodies; explicit nulls. Shared so tests serialize exactly like production. */
    fun apiGson(): com.google.gson.Gson = GsonBuilder().serializeNulls().create()

    private fun createRetrofit(
        baseUrl: String,
        enableLogging: Boolean,
        deviceTokenProvider: (() -> String?)?,
    ): Retrofit {
        val clientBuilder = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .callTimeout(25, TimeUnit.SECONDS)

        if (deviceTokenProvider != null) {
            clientBuilder.addInterceptor(
                Interceptor { chain ->
                    val token = deviceTokenProvider()
                    // Authenticated endpoints always need the X-Device-Token header; without it do not hit the network.
                    if (token.isNullOrBlank()) {
                        throw IOException("Device not paired: no device token")
                    }
                    chain.proceed(
                        chain.request().newBuilder()
                            .header("X-Device-Token", token)
                            .build(),
                    )
                },
            )
        }

        if (enableLogging) {
            clientBuilder.addInterceptor(
                HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BASIC
                },
            )
        }

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(clientBuilder.build())
            // Explicit nulls: unmeasured vitals are sent as null (never 0).
            .addConverterFactory(GsonConverterFactory.create(apiGson()))
            .build()
    }
}
