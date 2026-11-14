package xyz.targapps.rahel.data.remote

import com.google.gson.annotations.SerializedName

/**
 * POST device/sensors — sensors detected via SensorManager (+ Health Services streams) and their
 * runtime state. Explicit [SerializedName]s keep the wire format stable under R8 (the package is
 * also covered by the keep rule for `xyz.targapps.rahel.data.remote.**`).
 */
data class DeviceSensorsRequest(
    @SerializedName("appVersion") val appVersion: String?,
    @SerializedName("sensors") val sensors: List<DetectedSensorDto>,
)

data class DetectedSensorDto(
    /** Stable key: "t<type>:<name>:<w|n>" for SensorManager sensors, "hs:<stream>" for Health Services. */
    @SerializedName("sensorKey") val sensorKey: String,
    /** Android string type without the "android.sensor." prefix, e.g. "heart_rate". */
    @SerializedName("typeName") val typeName: String,
    @SerializedName("typeId") val typeId: Int?,
    @SerializedName("name") val name: String?,
    @SerializedName("vendor") val vendor: String?,
    @SerializedName("wakeUp") val wakeUp: Boolean?,
    @SerializedName("resolution") val resolution: Double?,
    @SerializedName("available") val available: Boolean,
    /** null = the sensor needs no runtime permission. */
    @SerializedName("permissionGranted") val permissionGranted: Boolean?,
    /** True when SensorCollector registers a listener for it. */
    @SerializedName("inUse") val inUse: Boolean,
    /** True when at least one event arrived since collection started. */
    @SerializedName("delivering") val delivering: Boolean,
    @SerializedName("lastEventAtEpochMs") val lastEventAtEpochMs: Long?,
)

data class DeviceSensorsResponse(
    @SerializedName("storedSensors") val storedSensors: Int = 0,
)
