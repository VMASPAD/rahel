package xyz.targapps.rahel.service

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.content.ContextCompat
import xyz.targapps.rahel.RaHelApp
import xyz.targapps.rahel.data.sensors.BodySensorPermissions
import xyz.targapps.rahel.presentation.MainActivity

/**
 * Foreground service of type `health`: keeps the sensor collection process alive while the screen is off.
 * Must be started from a visible activity (background starts are not allowed) and only once
 * BODY_SENSORS / ACTIVITY_RECOGNITION have been granted (required for the health type on API 34+).
 */
class HealthForegroundService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!hasHealthPermission(this)) {
            stopSelf()
            return START_NOT_STICKY
        }
        try {
            val notification = buildNotification()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: RuntimeException) {
            // SecurityException / ForegroundServiceStartNotAllowedException
            Log.w(TAG, "Cannot start foreground health service", e)
            stopSelf()
            return START_NOT_STICKY
        }
        (application as RaHelApp).ensureSensorCollection()
        return START_STICKY
    }

    private fun buildNotification(): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Health monitoring", NotificationManager.IMPORTANCE_LOW),
        )
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("RaHel")
            .setContentText("Monitoring vital signs")
            .setOngoing(true)
            .setContentIntent(open)
            .build()
    }

    companion object {
        private const val TAG = "HealthForegroundSvc"
        private const val CHANNEL_ID = "rahel_health_monitoring"
        private const val NOTIFICATION_ID = 1001

        fun hasHealthPermission(context: Context): Boolean =
            listOf(BodySensorPermissions.heartRate, Manifest.permission.ACTIVITY_RECOGNITION).any {
                ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
            }

        fun start(context: Context) {
            if (!hasHealthPermission(context)) return
            try {
                ContextCompat.startForegroundService(context, Intent(context, HealthForegroundService::class.java))
            } catch (e: RuntimeException) {
                Log.w(TAG, "Foreground service start refused", e)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, HealthForegroundService::class.java))
        }
    }
}
