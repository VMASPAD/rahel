package xyz.targapps.rahel.data.sensors

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
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
import xyz.targapps.rahel.domain.MissionDynamicVitals
import java.time.Instant

class SensorCollector(
    context: Context,
) : SensorEventListener {

    private val appContext = context.applicationContext
    private val sensorManager = appContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val healthBridge = WearHealthServicesBridge(appContext)
    private val derivedCalculator = DerivedMetricsCalculator()

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

    suspend fun refreshAvailability() {
        val base = SensorProbe.probe(appContext)
        val hs = healthBridge.probe()
        _availability.value = base + hs
    }

    fun startCollection() {
        if (collecting) return
        collecting = true
        hubScope.launch { refreshAvailability() }
        registerSensorChannels()
        startHealthServicesStreams()
    }

    fun stopCollection() {
        if (!collecting) return
        collecting = false
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
            val type = SensorProbe.sensorTypeFor(channel) ?: continue
            val sensor = sensorManager.getDefaultSensor(type) ?: continue
            val delay = if (channel == SensorChannelId.ACCELEROMETER) {
                SensorManager.SENSOR_DELAY_GAME
            } else {
                SensorManager.SENSOR_DELAY_NORMAL
            }
            sensorManager.registerListener(this, sensor, delay)
            registeredChannels.add(channel)
        }
    }

    private fun startHealthServicesStreams() {
        healthStreamsJob?.cancel()
        healthStreamsJob = hubScope.launch {
            refreshAvailability()
            val avail = _availability.value
            if (avail[SensorChannelId.HEART_RATE_HEALTH_SERVICES]?.state == SensorAvailabilityState.AVAILABLE) {
                healthBridge.heartRateReadings()
                    .onEach { emitReading(it); applyHeartRate(it.value.toInt()) }
                    .catch { }
                    .launchIn(this)
            }
            if (avail[SensorChannelId.SPO2]?.state == SensorAvailabilityState.AVAILABLE) {
                healthBridge.spo2Readings()
                    .onEach { emitReading(it); patchDynamics(derivedCalculator.onSpo2(it.value.toInt())) }
                    .catch { }
                    .launchIn(this)
            }
        }
    }

    override fun onSensorChanged(event: SensorEvent) {
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
        patchDynamics(derivedCalculator.onHeartRate(bpm))
        updateDerived { copy(heartRateBpm = bpm) }
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
