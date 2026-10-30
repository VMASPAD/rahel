package xyz.targapps.rahel.complication

import android.app.PendingIntent
import android.content.Intent
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import xyz.targapps.rahel.RaHelApp
import xyz.targapps.rahel.presentation.MainActivity

/**
 * RaHel complication: the latest heart rate for the watch face (short text). Tapping it opens the app.
 * It is refreshed by the app every minute while monitoring is on.
 */
class MainComplicationService : SuspendingComplicationDataSourceService() {

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        if (type != ComplicationType.SHORT_TEXT) {
            return null
        }
        return createComplicationData(heartRateBpm = 72)
    }

    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData {
        val bpm = (application as RaHelApp).sensorHub.liveMetrics.value.heartRateBpm
        return createComplicationData(bpm)
    }

    private fun createComplicationData(heartRateBpm: Int?): ShortTextComplicationData {
        val text = heartRateBpm?.toString() ?: "--"
        val description = heartRateBpm?.let { "Heart rate $it beats per minute" } ?: "Heart rate"
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return ShortTextComplicationData.Builder(
            text = PlainComplicationText.Builder(text).build(),
            contentDescription = PlainComplicationText.Builder(description).build(),
        )
            .setTitle(PlainComplicationText.Builder("bpm").build())
            .setTapAction(open)
            .build()
    }
}
