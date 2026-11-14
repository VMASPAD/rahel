package xyz.targapps.rahel.rules

import xyz.targapps.rahel.domain.AlertLevel
import xyz.targapps.rahel.domain.HealthEventAlert
import xyz.targapps.rahel.domain.MissionContext
import xyz.targapps.rahel.domain.SpaceCardioEventId
import xyz.targapps.rahel.domain.VitalSigns

/**
 * PrimerVersionNASA Parts III–IV: hydration/calcium reminders and behavioral nudges.
 */
object MissionWellnessRules {

    data class ReminderFlags(
        var hydrationEmitted: Boolean = false,
        var calciumEmitted: Boolean = false,
        var inactivityEmitted: Boolean = false,
        var restLightEmitted: Boolean = false,
    )

    fun evaluate(
        mission: MissionContext,
        vitals: VitalSigns,
        flags: ReminderFlags,
    ): List<HealthEventAlert> = buildList {
        addAll(hydrationRule(mission, flags))
        addAll(calciumRule(mission, flags))
        addAll(inactivityRule(mission, flags))
        addAll(restLightRule(mission, flags))
    }

    fun onWaterLogged(flags: ReminderFlags) {
        flags.hydrationEmitted = false
    }

    fun onCalciumLogged(flags: ReminderFlags) {
        flags.calciumEmitted = false
    }

    fun onSignificantMotion(flags: ReminderFlags) {
        flags.inactivityEmitted = false
    }

    fun onCrewWorkSchedule(flags: ReminderFlags) {
        flags.restLightEmitted = false
    }

    private fun hydrationRule(mission: MissionContext, flags: ReminderFlags): List<HealthEventAlert> {
        if (mission.crewScheduleWork != 1) return emptyList()
        if (flags.hydrationEmitted) return emptyList()
        if (mission.hoursSinceLastWaterIntake < 2) return emptyList()
        flags.hydrationEmitted = true
        return listOf(
            HealthEventAlert(
                eventId = SpaceCardioEventId.HYDRATION_REMINDER,
                level = AlertLevel.WATCH,
                title = "Hydration",
                message = "Reminder: log your water intake.",
                suggestedAction = "Drink according to the mission hydration plan and log the amount consumed.",
                triggerHaptic = true,
            ),
        )
    }

    private fun calciumRule(mission: MissionContext, flags: ReminderFlags): List<HealthEventAlert> {
        if (mission.crewScheduleWork != 1) return emptyList()
        if (flags.calciumEmitted) return emptyList()
        if (mission.calciumConsumedMg >= mission.calciumTargetMg) return emptyList()
        if (mission.hoursSinceLastCalciumIntake < 4) return emptyList()
        flags.calciumEmitted = true
        return listOf(
            HealthEventAlert(
                eventId = SpaceCardioEventId.CALCIUM_REMINDER,
                level = AlertLevel.WATCH,
                title = "Calcium",
                message = "Reminder: check your calcium intake.",
                suggestedAction = "Review the nutrition log and calcium-rich foods per the mission plan.",
                triggerHaptic = true,
            ),
        )
    }

    private fun inactivityRule(mission: MissionContext, flags: ReminderFlags): List<HealthEventAlert> {
        if (mission.crewScheduleWork != 1) return emptyList()
        if (flags.inactivityEmitted) return emptyList()
        if (mission.inactivityMinutes < 60) return emptyList()
        flags.inactivityEmitted = true
        return listOf(
            HealthEventAlert(
                eventId = SpaceCardioEventId.INACTIVITY_REMINDER,
                level = AlertLevel.WATCH,
                title = "Active break",
                message = "Take a 5-minute active break.",
                suggestedAction = "Walk or stretch for a few minutes if safety conditions allow.",
                triggerHaptic = true,
            ),
        )
    }

    private fun restLightRule(mission: MissionContext, flags: ReminderFlags): List<HealthEventAlert> {
        if (mission.crewScheduleWork != 0) return emptyList()
        if (flags.restLightEmitted) return emptyList()
        val lux = mission.ambientLightLux ?: return emptyList()
        if (mission.nightAwakenings < 3) return emptyList()
        if (lux <= 200f) return emptyList()
        flags.restLightEmitted = true
        return listOf(
            HealthEventAlert(
                eventId = SpaceCardioEventId.REST_LIGHT_DISRUPTION,
                level = AlertLevel.WATCH,
                title = "Rest",
                message = "Bright light during the rest period.",
                suggestedAction = "Dim the cabin lighting and follow the established rest routine.",
                triggerHaptic = true,
            ),
        )
    }
}
