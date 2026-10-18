package xyz.targapps.rahel.data.sensors

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import xyz.targapps.rahel.BuildConfig
import xyz.targapps.rahel.data.remote.DeviceSensorsRequest
import xyz.targapps.rahel.domain.MissionDynamicVitals
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap

private const val TAG = "SensorCollector"
private val VALID_HR_RANGE = 30..230

/** Minimum collection time before the first inventory report, so "delivering" is meaningful. */
private const val INVENTORY_WARMUP_MS = 120_000L

class SensorCollector(
    context: Context,
) : SensorEventListener {

    private val appContext = context.applicationContext
    private val sensorManager = appContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val healthBridge = WearHealthServicesBridge(appContext)
    private val derivedCalculator = DerivedMetricsCalculator()
    private val dailySteps = DailyStepsTracker(appContext)

    private val hubScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var healthStreamsJob: Job? = null

    private val _availability = MutableStateFlow(SensorProbe.probe(appContext))
    val availability: StateFlow<Map<SensorChannelId, SensorAvailability>> = _availability.asStateFlow()

    private val _readings = MutableSharedFlow<SensorReading>(extraBufferCapacity = 128)
    val readings: SharedFlow<SensorReading> = _readings.asSharedFlow()

    private val _derived = MutableStateFlow(DerivedSensorSnapshot())
    val derived: StateFlow<DerivedSensorSnapshot> = _derived.asStateFlow()

    private val _dynamics = MutableStateFlow(MissionDynamicVitals())
    val dynamics: StateFlow<MissionDynamicVitals> = _dynamics.asStateFlow()

    private var collecting = false
    private val registeredChannels = mutableSetOf<SensorChannelId>()

    /** Wall-clock time of the last event per sensor (SensorInventory.keyOf / hs:* keys); analytics only. */
    private val lastEventAtByKey = ConcurrentHashMap<String, Long>()

    @Volatile
    private var collectionStartedAtMs = 0L

    /**
     * Sensor inventory for the backend, or null while collection has not run for at least
     * [INVENTORY_WARMUP_MS] (so "delivering" is meaningful).
     */
    @Synchronized
    fun buildInventory(): DeviceSensorsRequest? {
        val started = collectionStartedAtMs
        if (!collecting || started == 0L) return null
        if (System.currentTimeMillis() - started < INVENTORY_WARMUP_MS) return null
        val inUseKeys = registeredChannels.mapNotNull { channel ->
            SensorProbe.sensorTypeFor(channel)
                ?.let { sensorManager.getDefaultSensor(it) }
                ?.let { SensorInventory.keyOf(it) }
        }.toSet()
        return SensorInventory.build(
            context = appContext,
            sensorManager = sensorManager,
            inUseKeys = inUseKeys,
            lastEventAt = lastEventAtByKey.toMap(),
            availability = _availability.value,
            appVersion = BuildConfig.VERSION_NAME,
        )
    }

    suspend fun refreshAvailability() {
        val base = SensorProbe.probe(appContext)
        val hs = healthBridge.probe()
        _availability.value = base + hs
    }

    /**
     * Starts collection, or re-tries registering whatever is still missing (e.g. after BODY_SENSORS /
     * ACTIVITY_RECOGNITION were granted). Safe to call repeatedly.
     */
    @Synchronized
    fun startCollection() {
        collecting = true
        if (collectionStartedAtMs == 0L) collectionStartedAtMs = System.currentTimeMillis()
        hubScope.launch { refreshAvailability() }
        registerSensorChannels()
        if (healthStreamsJob?.isActive != true) {
            startHealthServicesStreams()
        }
    }

    @Synchronized
    fun stopCollection() {
        if (!collecting) return
        collecting = false
        collectionStartedAtMs = 0L
        healthStreamsJob?.cancel()
        healthStreamsJob = null
        registeredChannels.forEach { channel ->
            SensorProbe.sensorTypeFor(channel)?.let { type ->
                sensorManager.getDefaultSensor(type)?.let { sensor ->
                    sensorManager.unregisterListener(this, sensor)
                }
            }
        }
        registeredChannels.clear()
    }

    private fun registerSensorChannels() {
        val channels = listOf(
            SensorChannelId.ACCELEROMETER,
            SensorChannelId.GYROSCOPE,
            SensorChannelId.BAROMETER,
            SensorChannelId.LIGHT,
            SensorChannelId.STEP_COUNTER,
            SensorChannelId.STEP_DETECTOR,
            SensorChannelId.AMBIENT_TEMPERATURE,
            SensorChannelId.OFF_BODY,
            SensorChannelId.HEART_RATE,
        )
        for (channel in channels) {
            if (channel in registeredChannels) continue
            val type = SensorProbe.sensorTypeFor(channel) ?: continue
            val sensor = sensorManager.getDefaultSensor(type) ?: continue
            val delay = if (channel == SensorChannelId.ACCELEROMETER) {
                SensorManager.SENSOR_DELAY_GAME
            } else {
                SensorManager.SENSOR_DELAY_NORMAL
            }
            try {
                if (sensorManager.registerListener(this, sensor, delay)) {
                    registeredChannels.add(channel)
                }
                // false/SecurityException: permission (BODY_SENSORS / ACTIVITY_RECOGNITION) not granted yet;
                // startCollection() is called again once it is granted.
            } catch (e: SecurityException) {
                Log.w(TAG, "Sensor $channel not permitted yet")
            }
        }
    }

    private fun startHealthServicesStreams() {
        healthStreamsJob?.cancel()
        healthStreamsJob = hubScope.launch {
            refreshAvailability()
            val avail = _availability.value
            if (avail[SensorChannelId.HEART_RATE_HEALTH_SERVICES]?.state == SensorAvailabilityState.AVAILABLE) {
                healthBridge.heartRateReadings()
                    .onEach {
                        lastEventAtByKey[SensorInventory.KEY_HS_HEART_RATE] = System.currentTimeMillis()
                        emitReading(it)
                        applyHeartRate(it.value.toInt())
                    }
                    .catch { Log.w(TAG, "HR stream failed", it) }
                    .launchIn(this)
            }
            if (avail[SensorChannelId.SPO2]?.state == SensorAvailabilityState.AVAILABLE) {
                healthBridge.spo2Readings()
                    .onEach {
                        lastEventAtByKey[SensorInventory.KEY_HS_SPO2] = System.currentTimeMillis()
                        emitReading(it)
                        patchDynamics(derivedCalculator.onSpo2(it.value.toInt()))
                    }
                    .catch { Log.w(TAG, "SpO2 stream failed", it) }
                    .launchIn(this)
            }
        }
    }

    override fun onSensorChanged(event: SensorEvent) {
        lastEventAtByKey[SensorInventory.keyOf(event.sensor)] = System.currentTimeMillis()
        val now = Instant.now()
        when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                val reading = SensorReading.Vector3(
                    channel = SensorChannelId.ACCELEROMETER,
                    timestamp = now,
                    x = event.values[0],
                    y = event.values[1],
                    z = event.values[2],
                )
                emitReading(reading)
                val (_, patch) = derivedCalculator.onAccelerometer(
                    event.values[0],
                    event.values[1],
                    event.values[2],
                )
                patchDynamics(patch)
            }

            Sensor.TYPE_GYROSCOPE -> {
                val gx = event.values[0]
                val gy = event.values[1]
                val gz = event.values[2]
                val mag = derivedCalculator.onGyroMagnitude(
                    kotlin.math.sqrt(gx * gx + gy * gy + gz * gz),
                )
                emitReading(
                    SensorReading.Vector3(
                        channel = SensorChannelId.GYROSCOPE,
                        timestamp = now,
                        x = gx,
                        y = gy,
                        z = gz,
                        unit = "rad/s",
                    ),
                )
                updateDerived { copy(gyroMagnitude = mag) }
            }

            Sensor.TYPE_PRESSURE -> {
                val hpa = event.values[0]
                emitReading(
                    SensorReading.Scalar(
                        channel = SensorChannelId.BAROMETER,
                        timestamp = now,
                        value = hpa,
                        unit = "hPa",
                    ),
                )
                updateDerived { copy(barometerHpa = hpa) }
            }

            Sensor.TYPE_LIGHT -> {
                val lux = event.values[0]
                emitReading(
                    SensorReading.Scalar(
                        channel = SensorChannelId.LIGHT,
                        timestamp = now,
                        value = lux,
                        unit = "lux",
                    ),
                )
                updateDerived { copy(lightLux = lux) }
            }

            Sensor.TYPE_AMBIENT_TEMPERATURE -> {
                val temp = event.values[0]
                emitReading(
                    SensorReading.Scalar(
                        channel = SensorChannelId.AMBIENT_TEMPERATURE,
                        timestamp = now,
                        value = temp,
                        unit = "°C",
                    ),
                )
                updateDerived { copy(ambientTempCelsius = temp) }
            }

            Sensor.TYPE_STEP_COUNTER -> {
                val total = event.values[0].toLong()
                derivedCalculator.onStepCounter(total)
                val today = dailySteps.stepsToday(total)
                updateDerived { copy(stepsToday = today) }
                emitReading(SensorReading.StepEvent(timestamp = now, totalSinceBoot = total))
                patchDynamics(DerivedDynamicsPatch(stepsSession = derivedCalculator.currentStepsSession()))
            }

            Sensor.TYPE_STEP_DETECTOR -> {
                derivedCalculator.onStepDetected()
                emitReading(SensorReading.StepEvent(timestamp = now))
                patchDynamics(DerivedDynamicsPatch(stepsSession = derivedCalculator.currentStepsSession()))
            }

            Sensor.TYPE_LOW_LATENCY_OFFBODY_DETECT -> {
                val offBody = event.values[0] > 0f
                derivedCalculator.onOffBody(onWrist = !offBody)
                emitReading(
                    SensorReading.BooleanState(
                        channel = SensorChannelId.LOW_LATENCY_OFF_BODY,
                        timestamp = now,
                        active = offBody,
                    ),
                )
                patchDynamics(DerivedDynamicsPatch(offBody = offBody))
            }

            Sensor.TYPE_HEART_RATE -> {
                val bpm = event.values[0].toInt()
                if (event.accuracy == SensorManager.SENSOR_STATUS_NO_CONTACT) return
                emitReading(
                    SensorReading.Scalar(
                        channel = SensorChannelId.HEART_RATE,
                        timestamp = now,
                        value = bpm.toFloat(),
                        unit = "bpm",
                    ),
                )
                applyHeartRate(bpm)
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun applyHeartRate(bpm: Int) {
        // 0 / out-of-range values mean "no contact" or noise, not a measurement.
        if (bpm !in VALID_HR_RANGE) return
        val at = Instant.now()
        patchDynamics(derivedCalculator.onHeartRate(bpm))
        updateDerived { copy(heartRateBpm = bpm, heartRateAt = at) }
        val hrv = _dynamics.value.hrvMs
        if (hrv != null) {
            _availability.value = _availability.value + mapOf(
                SensorChannelId.HRV to SensorAvailability(SensorAvailabilityState.AVAILABLE),
            )
        }
    }

    private fun patchDynamics(patch: DerivedDynamicsPatch) {
        val merged = _dynamics.value.merge(patch)
        _dynamics.value = merged
        updateDerived { copy(dynamics = merged) }
    }

    private fun emitReading(reading: SensorReading) {
        _readings.tryEmit(reading)
    }

    private inline fun updateDerived(transform: DerivedSensorSnapshot.() -> DerivedSensorSnapshot) {
        _derived.value = _derived.value.transform().copy(timestamp = Instant.now())
    }
}
