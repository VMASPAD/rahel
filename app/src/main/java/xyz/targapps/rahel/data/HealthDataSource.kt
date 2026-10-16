package xyz.targapps.rahel.data

import kotlinx.coroutines.flow.Flow
import xyz.targapps.rahel.domain.HealthSnapshot

/**
 * Future integration point for Samsung Health / Health Connect on Galaxy Watch.
 */
interface HealthDataSource {
    fun liveSnapshots(): Flow<HealthSnapshot>
}
