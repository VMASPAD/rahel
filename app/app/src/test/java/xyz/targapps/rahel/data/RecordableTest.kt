package xyz.targapps.rahel.data

import com.google.gson.Gson
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import xyz.targapps.rahel.data.local.QueueItemKind
import xyz.targapps.rahel.data.remote.SensorReadingDto

class RecordableTest {

    private fun FakeDao.readings(): List<SensorReadingDto> =
        rows.filter { it.itemKind == QueueItemKind.SENSOR_READING }
            .map { Gson().fromJson(it.payloadJson, SensorReadingDto::class.java) }

    @Test fun validRecentHr_isQueued() = runBlocking {
        val f = RepoFixture()
        f.repo.enqueueReading(snapshot(sampleAt = T0 - 5_000, hr = 80))
        val r = f.dao.readings()
        assertEquals(1, r.size)
        assertEquals(80, r[0].heartRateBpm)
        assertEquals(T0 - 5_000, r[0].recordedAtEpochMs)
    }

    @Test fun staleHr_withoutSteps_isDiscarded() = runBlocking {
        val f = RepoFixture()
        f.repo.enqueueReading(snapshot(sampleAt = T0 - 121_000, hr = 80, steps = null))
        assertEquals(0, f.dao.rows.size)
    }

    @Test fun hrExactlyAtLimit_isStillFresh() = runBlocking {
        val f = RepoFixture()
        f.repo.enqueueReading(snapshot(sampleAt = T0 - 120_000, hr = 80))
        assertEquals(1, f.dao.readings().size)
    }

    @Test fun staleHr_withSteps_isQueuedWithNullHr() = runBlocking {
        val f = RepoFixture()
        f.repo.enqueueReading(snapshot(sampleAt = T0 - 300_000, hr = 80, steps = 1234, timestampMs = T0))
        val r = f.dao.readings()
        assertEquals(1, r.size)
        assertNull(r[0].heartRateBpm)
        assertEquals(1234, r[0].stepsToday)
        // The stale HR timestamp must not be passed off as the reading time.
        assertEquals(T0, r[0].recordedAtEpochMs)
    }

    @Test fun noHrAtAll_withSteps_isQueued() = runBlocking {
        val f = RepoFixture()
        f.repo.enqueueReading(snapshot(sampleAt = null, hr = null, steps = 10))
        val r = f.dao.readings()
        assertEquals(1, r.size)
        assertNull(r[0].heartRateBpm)
    }

    @Test fun unpaired_blankCrew_queuesNothing() = runBlocking {
        val f = RepoFixture()
        f.repo.enqueueReading(snapshot(sampleAt = T0, crew = ""))
        val queued = f.repo.recordAssessmentCycle(snapshot(sampleAt = T0, crew = ""), assessment(T0, crew = ""))
        assertFalse(queued)
        assertEquals(0, f.dao.rows.size)
    }

    @Test fun sameSampleTwice_isDeduplicated() = runBlocking {
        val f = RepoFixture()
        val s = snapshot(sampleAt = T0 - 1_000, hr = 70)
        f.repo.enqueueReading(s)
        f.repo.enqueueReading(s)
        assertEquals(1, f.dao.rows.size)
        // A new HR sample is accepted again.
        f.repo.enqueueReading(snapshot(sampleAt = T0, hr = 71))
        assertEquals(2, f.dao.rows.size)
    }

    @Test fun offWristFalse_withValidHr_isQueued() = runBlocking {
        val f = RepoFixture()
        f.repo.enqueueReading(snapshot(sampleAt = T0, hr = 90, onWrist = false))
        assertEquals(1, f.dao.readings().size)
    }

    @Test fun assessmentCycle_queuesReadingAndAssessment_andReturnsTrue() = runBlocking {
        val f = RepoFixture()
        val ok = f.repo.recordAssessmentCycle(snapshot(sampleAt = T0, hr = 88), assessment(T0))
        assertTrue(ok)
        assertEquals(listOf(QueueItemKind.SENSOR_READING, QueueItemKind.HEALTH_ASSESSMENT), f.dao.rows.map { it.itemKind })
        assertEquals(1, f.scheduled)
    }

    @Test fun assessmentCycle_discardedSample_returnsFalse() = runBlocking {
        val f = RepoFixture()
        val ok = f.repo.recordAssessmentCycle(snapshot(sampleAt = T0 - 500_000, hr = 80), assessment(T0))
        assertFalse(ok)
        assertEquals(0, f.dao.rows.size)
    }

    @Test fun assessmentCycle_duplicateSample_returnsFalse_andQueuesOnce() = runBlocking {
        val f = RepoFixture()
        val s = snapshot(sampleAt = T0, hr = 88)
        assertTrue(f.repo.recordAssessmentCycle(s, assessment(T0)))
        assertFalse(f.repo.recordAssessmentCycle(s, assessment(T0)))
        assertEquals(2, f.dao.rows.size)
        assertNotNull(f.dao.rows.firstOrNull { it.itemKind == QueueItemKind.HEALTH_ASSESSMENT })
    }
}
