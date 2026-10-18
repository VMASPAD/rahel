package xyz.targapps.rahel.data.sensors

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import androidx.core.content.ContextCompat
import xyz.targapps.rahel.data.remote.DetectedSensorDto
import xyz.targapps.rahel.data.remote.DeviceSensorsRequest

/** Builds the sensor inventory report sent to the backend (analytics). Pure reads, no side effects. */
internal object SensorInventory {

    const val KEY_HS_HEART_RATE = "hs:heart_rate"
    const val KEY_HS_SPO2 = "hs:spo2"
    private const val MAX_SENSORS = 150

    fun keyOf(sensor: Sensor): String {
        val wake = if (sensor.isWakeUpSensor) "w" else "n"
        return "t${sensor.type}:${sensor.name}:$wake".take(160)
    }

    private fun typeNameOf(sensor: Sensor): String {
        val raw: String? = sensor.stringType
        val name = if (raw.isNullOrBlank()) "type_${sensor.type}" else raw.substringAfterLast('.')
        return name.take(80)
    }

    private fun requiredPermission(type: Int): String? = when (type) {
        Sensor.TYPE_HEART_RATE, Sensor.TYPE_HEART_BEAT -> Manifest.permission.BODY_SENSORS
        Sensor.TYPE_STEP_COUNTER, Sensor.TYPE_STEP_DETECTOR -> Manifest.permission.ACTIVITY_RECOGNITION
        else -> null
    }

    fun build(
        context: Context,
        sensorManager: SensorManager,
        inUseKeys: Set<String>,
        lastEventAt: Map<String, Long>,
        availability: Map<SensorChannelId, SensorAvailability>,
        appVersion: String?,
    ): DeviceSensorsRequest {
        fun granted(permission: String): Boolean =
            ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

        val out = ArrayList<DetectedSensorDto>()
        val seen = HashSet<String>()
        for (sensor in sensorManager.getSensorList(Sensor.TYPE_ALL)) {
            if (out.size >= MAX_SENSORS) break
            val key = keyOf(sensor)
            if (!seen.add(key)) continue
            val permission = requiredPermission(sensor.type)
            val last = lastEventAt[key]
            val resolution = sensor.resolution.toDouble()
            out.add(
                DetectedSensorDto(
                    sensorKey = key,
                    typeName = typeNameOf(sensor),
                    typeId = sensor.type,
                    name = sensor.name?.take(160),
                    vendor = sensor.vendor?.take(120),
                    wakeUp = sensor.isWakeUpSensor,
                    resolution = if (resolution.isFinite()) resolution else null,
                    available = true,
                    permissionGranted = permission?.let { granted(it) },
                    inUse = key in inUseKeys,
                    delivering = last != null,
                    lastEventAtEpochMs = last,
                ),
            )
        }

        val bodyGranted = granted(Manifest.permission.BODY_SENSORS)
        fun healthServices(key: String, typeName: String, name: String, channel: SensorChannelId) {
            val available = availability[channel]?.state == SensorAvailabilityState.AVAILABLE
            val last = lastEventAt[key]
            out.add(
                DetectedSensorDto(
                    sensorKey = key,
                    typeName = typeName,
                    typeId = null,
                    name = name,
                    vendor = "Wear Health Services",
                    wakeUp = null,
                    resolution = null,
                    available = available,
                    permissionGranted = bodyGranted,
                    inUse = available,
                    delivering = last != null,
                    lastEventAtEpochMs = last,
                ),
            )
        }
        healthServices(KEY_HS_HEART_RATE, "hs_heart_rate", "Health Services heart rate", SensorChannelId.HEART_RATE_HEALTH_SERVICES)
        healthServices(KEY_HS_SPO2, "hs_spo2", "Health Services SpO2", SensorChannelId.SPO2)

        return DeviceSensorsRequest(appVersion = appVersion, sensors = out)
    }
}
