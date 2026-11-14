package xyz.targapps.rahel.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import xyz.targapps.rahel.data.sensors.BodySensorPermissions

class BodySensorPermissionsTest {
    private val body = "android.permission.BODY_SENSORS"
    private val hr = "android.permission.health.READ_HEART_RATE"
    private val bg = "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"

    @Test fun api35_usesBodySensors() {
        assertEquals(body, BodySensorPermissions.heartRate(35))
        assertEquals(listOf(body), BodySensorPermissions.toRequest(35))
        assertNull(BodySensorPermissions.backgroundPermission(35))
    }

    @Test fun api36_usesReadHeartRate() {
        assertEquals(hr, BodySensorPermissions.heartRate(36))
        assertEquals(listOf(hr), BodySensorPermissions.toRequest(36))
        assertEquals(bg, BodySensorPermissions.backgroundPermission(36))
    }

    @Test fun api30_minSdk_usesBodySensors_noBackground() {
        assertEquals(body, BodySensorPermissions.heartRate(30))
        assertEquals(listOf(body), BodySensorPermissions.toRequest(30))
        assertNull(BodySensorPermissions.backgroundPermission(30))
    }

    @Test fun api37_future_usesHealthPermissions() {
        assertEquals(hr, BodySensorPermissions.heartRate(37))
        assertEquals(bg, BodySensorPermissions.backgroundPermission(37))
    }
}
