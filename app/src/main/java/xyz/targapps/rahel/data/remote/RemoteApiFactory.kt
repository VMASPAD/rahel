package xyz.targapps.rahel.data.remote

import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import xyz.targapps.rahel.BuildConfig
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
    ): HealthApiService {
        val clientBuilder = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)

        if (enableLogging) {
            clientBuilder.addInterceptor(
                HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BASIC
                },
            )
        }

        val retrofit = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(clientBuilder.build())
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        return retrofit.create(HealthApiService::class.java)
    }
}
