package xyz.targapps.rahel.data.sensors

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

/**
 * Wear OS 6 / Android 16 (API 36) replaces BODY_SENSORS with granular health permissions:
 * apps targeting API 36 must hold READ_HEART_RATE to read the heart-rate sensor. (SpO2 is not read by
 * the app, so READ_OXYGEN_SATURATION is deliberately not declared.) Older systems keep using BODY_SENSORS. This picks the right one per OS version.
 */
object BodySensorPermissions {
    const val READ_HEART_RATE = "android.permission.health.READ_HEART_RATE"
    const val READ_HEALTH_DATA_IN_BACKGROUND = "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"

    private const val API_HEALTH_PERMISSIONS = 36

    private fun usesHealthPermissions(sdkInt: Int): Boolean = sdkInt >= API_HEALTH_PERMISSIONS

    /** Permission that gates the heart-rate sensor on this OS version. */
    val heartRate: String
        get() = heartRate(Build.VERSION.SDK_INT)

    /** [sdkInt] is injectable for JVM tests; production always uses the running OS version. */
    fun heartRate(sdkInt: Int): String =
        if (usesHealthPermissions(sdkInt)) READ_HEART_RATE else Manifest.permission.BODY_SENSORS

    /** Vitals permissions to request at runtime on this OS version. */
    fun toRequest(sdkInt: Int = Build.VERSION.SDK_INT): List<String> =
        if (usesHealthPermissions(sdkInt)) {
            listOf(READ_HEART_RATE)
        } else {
            listOf(Manifest.permission.BODY_SENSORS)
        }

    /**
     * Background access (screen off). Android asks for it separately, after the foreground vitals
     * permissions. Null before API 36, where BODY_SENSORS already covers it.
     */
    fun backgroundPermission(sdkInt: Int = Build.VERSION.SDK_INT): String? =
        if (usesHealthPermissions(sdkInt)) READ_HEALTH_DATA_IN_BACKGROUND else null

    fun isGranted(context: Context, permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    fun isHeartRateGranted(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, heartRate) == PackageManager.PERMISSION_GRANTED
}
