package xyz.targapps.rahel.data.sensors

import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import androidx.core.content.ContextCompat

internal object SensorProbe {

    fun probe(context: Context): Map<SensorChannelId, SensorAvailability> {
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val bodySensorsGranted = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.BODY_SENSORS,
        ) == PackageManager.PERMISSION_GRANTED

        fun fromSensorType(
            channel: SensorChannelId,
            type: Int,
            requiresBodySensors: Boolean = false,
        ): SensorAvailability {
            if (requiresBodySensors && !bodySensorsGranted) {
                return SensorAvailability(
                    SensorAvailabilityState.UNAVAILABLE,
                    "BODY_SENSORS permission not granted",
                )
            }
            val sensor = sensorManager.getDefaultSensor(type)
            return if (sensor != null) {
                SensorAvailability(SensorAvailabilityState.AVAILABLE)
            } else {
                SensorAvailability(SensorAvailabilityState.UNAVAILABLE, "No default sensor on device")
            }
        }

        return mapOf(
            SensorChannelId.HEART_RATE to fromSensorType(
                SensorChannelId.HEART_RATE,
                Sensor.TYPE_HEART_RATE,
                requiresBodySensors = true,
            ),
            SensorChannelId.ACCELEROMETER to fromSensorType(
                SensorChannelId.ACCELEROMETER,
                Sensor.TYPE_ACCELEROMETER,
            ),
            SensorChannelId.GYROSCOPE to fromSensorType(
                SensorChannelId.GYROSCOPE,
                Sensor.TYPE_GYROSCOPE,
            ),
            SensorChannelId.BAROMETER to fromSensorType(
                SensorChannelId.BAROMETER,
                Sensor.TYPE_PRESSURE,
            ),
            SensorChannelId.LIGHT to fromSensorType(
                SensorChannelId.LIGHT,
                Sensor.TYPE_LIGHT,
            ),
            SensorChannelId.STEP_COUNTER to fromSensorType(
                SensorChannelId.STEP_COUNTER,
                Sensor.TYPE_STEP_COUNTER,
            ),
            SensorChannelId.STEP_DETECTOR to fromSensorType(
                SensorChannelId.STEP_DETECTOR,
                Sensor.TYPE_STEP_DETECTOR,
            ),
            SensorChannelId.AMBIENT_TEMPERATURE to fromSensorType(
                SensorChannelId.AMBIENT_TEMPERATURE,
                Sensor.TYPE_AMBIENT_TEMPERATURE,
            ),
            SensorChannelId.OFF_BODY to fromSensorType(
                SensorChannelId.OFF_BODY,
                Sensor.TYPE_LOW_LATENCY_OFFBODY_DETECT,
            ),
            SensorChannelId.LOW_LATENCY_OFF_BODY to fromSensorType(
                SensorChannelId.LOW_LATENCY_OFF_BODY,
                Sensor.TYPE_LOW_LATENCY_OFFBODY_DETECT,
            ),
            SensorChannelId.SIGNIFICANT_MOTION to fromSensorType(
                SensorChannelId.SIGNIFICANT_MOTION,
                Sensor.TYPE_SIGNIFICANT_MOTION,
            ),
            SensorChannelId.ECG to SensorAvailability(
                SensorAvailabilityState.UNAVAILABLE,
                "ECG not exposed via SensorManager on this build; use OEM APIs if present",
            ),
            SensorChannelId.SPO2 to SensorAvailability(
                SensorAvailabilityState.UNAVAILABLE,
                "Probed via Health Services at runtime",
            ),
            SensorChannelId.HEART_RATE_HEALTH_SERVICES to SensorAvailability(
                SensorAvailabilityState.UNAVAILABLE,
                "Probed via Health Services at runtime",
            ),
            SensorChannelId.HRV to SensorAvailability(
                SensorAvailabilityState.UNAVAILABLE,
                "Derived from beat intervals when available",
            ),
        )
    }

    fun sensorTypeFor(channel: SensorChannelId): Int? = when (channel) {
        SensorChannelId.HEART_RATE -> Sensor.TYPE_HEART_RATE
        SensorChannelId.ACCELEROMETER -> Sensor.TYPE_ACCELEROMETER
        SensorChannelId.GYROSCOPE -> Sensor.TYPE_GYROSCOPE
        SensorChannelId.BAROMETER -> Sensor.TYPE_PRESSURE
        SensorChannelId.LIGHT -> Sensor.TYPE_LIGHT
        SensorChannelId.STEP_COUNTER -> Sensor.TYPE_STEP_COUNTER
        SensorChannelId.STEP_DETECTOR -> Sensor.TYPE_STEP_DETECTOR
        SensorChannelId.AMBIENT_TEMPERATURE -> Sensor.TYPE_AMBIENT_TEMPERATURE
        SensorChannelId.OFF_BODY,
        SensorChannelId.LOW_LATENCY_OFF_BODY,
        -> Sensor.TYPE_LOW_LATENCY_OFFBODY_DETECT
        SensorChannelId.SIGNIFICANT_MOTION -> Sensor.TYPE_SIGNIFICANT_MOTION
        else -> null
    }
}
