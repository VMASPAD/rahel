package xyz.targapps.rahel.data.sensors

import android.content.Context
import androidx.health.services.client.HealthServices
import androidx.health.services.client.MeasureCallback
import androidx.health.services.client.MeasureClient
import androidx.health.services.client.data.Availability
import androidx.health.services.client.data.DataPointContainer
import androidx.health.services.client.data.DataType
import androidx.health.services.client.data.DeltaDataType
import androidx.health.services.client.data.SampleDataPoint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import java.time.Instant
import java.util.concurrent.Executors
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal class WearHealthServicesBridge(context: Context) {

    private val appContext = context.applicationContext
    private val measureClient: MeasureClient = HealthServices.getClient(appContext).measureClient
    private val executor = Executors.newSingleThreadExecutor()

    suspend fun probe(): Map<SensorChannelId, SensorAvailability> {
        val result = mutableMapOf<SensorChannelId, SensorAvailability>()
        result[SensorChannelId.HEART_RATE_HEALTH_SERVICES] = availabilityFor(DataType.HEART_RATE_BPM)
        result[SensorChannelId.SPO2] = SensorAvailability(
            SensorAvailabilityState.UNAVAILABLE,
            "SpO₂ not exposed on Health Services MeasureClient in this SDK version",
        )
        return result
    }

    private suspend fun availabilityFor(dataType: DeltaDataType<*, *>): SensorAvailability {
        return try {
            val capabilities = measureClient.getCapabilitiesAsync().await()
            val supported = capabilities.supportedDataTypesMeasure.contains(dataType)
            if (supported) {
                SensorAvailability(SensorAvailabilityState.AVAILABLE)
            } else {
                SensorAvailability(
                    SensorAvailabilityState.UNAVAILABLE,
                    "Health Services does not list $dataType for MeasureClient",
                )
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            SensorAvailability(
                SensorAvailabilityState.UNAVAILABLE,
                e.message ?: "Health Services unavailable",
            )
        }
    }

    fun heartRateReadings(): Flow<SensorReading.Scalar> = measureFlow(DataType.HEART_RATE_BPM) { value ->
        SensorReading.Scalar(
            channel = SensorChannelId.HEART_RATE_HEALTH_SERVICES,
            timestamp = Instant.now(),
            value = value,
            unit = "bpm",
        )
    }

    fun spo2Readings(): Flow<SensorReading.Scalar> = emptyFlow()

    private fun measureFlow(
        dataType: DeltaDataType<*, *>,
        mapValue: (Float) -> SensorReading.Scalar,
    ): Flow<SensorReading.Scalar> = callbackFlow {
        val callback = object : MeasureCallback {
            override fun onAvailabilityChanged(
                dataType: DeltaDataType<*, *>,
                availability: Availability,
            ) = Unit

            override fun onDataReceived(data: DataPointContainer) {
                val points = data.getData(dataType)
                for (point in points) {
                    if (point is SampleDataPoint<*>) {
                        val raw = point.value
                        val value = when (raw) {
                            is Double -> raw.toFloat()
                            is Float -> raw
                            is Long -> raw.toFloat()
                            is Int -> raw.toFloat()
                            else -> continue
                        }
                        trySend(mapValue(value))
                    }
                }
            }

            override fun onRegistered() = Unit

            override fun onRegistrationFailed(throwable: Throwable) {
                close(throwable)
            }
        }
        measureClient.registerMeasureCallback(dataType, executor, callback)
        awaitClose {
            measureClient.unregisterMeasureCallbackAsync(dataType, callback)
        }
    }
}

private suspend fun <T> com.google.common.util.concurrent.ListenableFuture<T>.await(): T =
    suspendCancellableCoroutine { cont ->
        addListener(
            {
                try {
                    cont.resume(get())
                } catch (e: Exception) {
                    cont.resumeWithException(e)
                }
            },
            Runnable::run,
        )
    }
