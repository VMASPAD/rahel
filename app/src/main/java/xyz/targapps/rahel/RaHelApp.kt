package xyz.targapps.rahel

import android.app.Application
import xyz.targapps.rahel.data.HealthRepository
import xyz.targapps.rahel.data.SeedHealthRepository
import xyz.targapps.rahel.rules.HealthAssessmentEngine
import xyz.targapps.rahel.seed.SeedProfile

class RaHelApp : Application() {
    lateinit var healthRepository: HealthRepository
    val assessmentEngine: HealthAssessmentEngine = HealthAssessmentEngine()

    override fun onCreate() {
        super.onCreate()
        healthRepository = SeedHealthRepository(SeedProfile.HEALTHY_CREW)
    }
}
