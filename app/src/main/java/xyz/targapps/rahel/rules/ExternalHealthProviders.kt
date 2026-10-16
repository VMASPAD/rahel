package xyz.targapps.rahel.rules

/**
 * Injectable stubs for sensors/APIs not yet wired on-device (datos.md §2).
 */
fun interface EcgAnomalyProvider {
    fun ecgAnomalyDetected(): Boolean
}

fun interface SolarRadiationFluxProvider {
    /** Proton flux in pfu (NASA DONKI-style). */
    fun protonFluxPfu(): Double
}

fun interface CabinCo2Provider {
    fun co2Ppm(): Int?
}

fun interface CrewScheduleProvider {
    /** 0 = rest, 1 = work (api_crew_schedule). */
    fun crewScheduleWork(): Int
}

object DefaultHealthProviders {
    val ecg: EcgAnomalyProvider = EcgAnomalyProvider { false }
    val radiation: SolarRadiationFluxProvider = SolarRadiationFluxProvider { 0.0 }
    val co2: CabinCo2Provider = CabinCo2Provider { null }
    val crewSchedule: CrewScheduleProvider = CrewScheduleProvider { 1 }
}
