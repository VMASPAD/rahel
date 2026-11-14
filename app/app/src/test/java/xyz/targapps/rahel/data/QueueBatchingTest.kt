package xyz.targapps.rahel.data

import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import xyz.targapps.rahel.data.local.QueueItemKind
import xyz.targapps.rahel.data.local.QueuedReadingEntity
import java.io.IOException

class QueueBatchingTest {

    /** 650 rows: readings at 1 Hz with an assessment cycle every 30th sample (cycle = reading + assessment). */
    private suspend fun fill(f: RepoFixture, rows: Int = 650) {
        var i = 0
        while (f.dao.rows.size < rows) {
            val at = T0 + i * 1_000L
            f.now = at
            val s = snapshot(sampleAt = at, hr = 60 + i % 90, steps = i)
            if (i % 30 == 0 && f.dao.rows.size < rows - 1) f.repo.recordAssessmentCycle(s, assessment(at))
            else f.repo.enqueueReading(s)
            i++
        }
    }

    @Test fun mixedRows_650_areSplitInBatchesOfAtMost300() = runBlocking {
        val api = FakeApi()
        val f = RepoFixture(api = api)
        fill(f)
        assertEquals(650, f.dao.rows.size)
        assertTrue(f.dao.rows.any { it.itemKind == QueueItemKind.HEALTH_ASSESSMENT })

        val sent = f.repo.syncPending()

        assertEquals(650, sent)
        assertEquals(0, f.dao.rows.size)
        assertEquals(3, api.batches.size)
        val sizes = api.batches.map { it.readings.size + it.assessments.size }
        assertEquals(listOf(300, 300, 50), sizes)
        assertTrue(api.batches.all { it.readings.size <= 300 && it.assessments.size <= 300 })
        assertEquals(3, api.batches.map { it.clientBatchId }.toSet().size)
        assertTrue(api.batches.all { it.crewMemberId == CREW })
        // No reading lost or duplicated, order preserved.
        val times = api.batches.flatMap { b -> b.readings.map { it.recordedAtEpochMs } }
        assertEquals(times.sorted(), times)
        assertEquals(times.size, times.toSet().size)
    }

    @Test fun batchId_isDeterministicAndStableAcrossRetries() = runBlocking {
        val api = FakeApi()
        val f = RepoFixture(api = api)
        fill(f)
        api.failWith = { IOException("no network") }
        try { f.repo.syncPending(); fail("network error must propagate so WorkManager retries") } catch (_: IOException) {}
        val first = api.batches.single()
        val inFlightRows = f.dao.rows.count { it.batchId != null }
        assertEquals(300, inFlightRows) // frozen in the DB, nothing deleted

        // New rows arrive while offline: must not change the frozen batch.
        f.now = T0 + 10_000_000
        f.repo.enqueueReading(snapshot(sampleAt = f.now, hr = 100, steps = 1))
        try { f.repo.syncPending(); fail() } catch (_: IOException) {}
        val second = api.batches.last()
        assertEquals(first.clientBatchId, second.clientBatchId)
        assertEquals(first.readings, second.readings)
        assertEquals(first.assessments, second.assessments)

        // Same data in a fresh DB yields the same ids (deterministic from crew + row ids).
        val api2 = FakeApi(); val f2 = RepoFixture(api = api2); fill(f2); f2.repo.syncPending()
        assertEquals(first.clientBatchId, api2.batches.first().clientBatchId)
        assertTrue(first.clientBatchId.length in 1..128)

        // Recovery: server answers, everything is flushed and in order.
        api.failWith = null
        val ok = f.repo.syncPending()
        assertEquals(651, ok)
        assertEquals(0, f.dao.rows.size)
    }

    @Test fun corruptRows_doNotBlockTheRest() = runBlocking {
        val api = FakeApi()
        val f = RepoFixture(api = api)
        fill(f, rows = 20)
        f.dao.insert(QueuedReadingEntity(itemKind = QueueItemKind.SENSOR_READING, crewMemberId = CREW, payloadJson = "{not json", createdAtEpochMs = 1))
        f.dao.insert(QueuedReadingEntity(itemKind = QueueItemKind.HEALTH_ASSESSMENT, crewMemberId = CREW, payloadJson = "{\"timestamp\":\"nope\"}", createdAtEpochMs = 1))
        f.dao.insert(QueuedReadingEntity(itemKind = "WEIRD", crewMemberId = CREW, payloadJson = "{}", createdAtEpochMs = 1))
        fill(f, rows = 43)

        val sent = f.repo.syncPending()

        assertEquals(1, api.batches.size)
        val b = api.batches.single()
        val goodReadings = b.readings.size + b.assessments.size
        assertEquals(sent, goodReadings)
        assertEquals(40, goodReadings) // 43 rows minus the 3 corrupt ones
        assertEquals(0, f.dao.rows.size)
    }

    @Test fun onlyCorruptRows_areDropped_withoutCallingServer() = runBlocking {
        val api = FakeApi()
        val f = RepoFixture(api = api)
        f.dao.insert(QueuedReadingEntity(itemKind = QueueItemKind.SENSOR_READING, crewMemberId = CREW, payloadJson = "garbage", createdAtEpochMs = 1))
        assertEquals(0, f.repo.syncPending())
        assertEquals(0, api.batches.size)
        assertEquals(0, f.dao.rows.size)
    }

    private fun http(code: Int) = HttpException(Response.error<Any>(code, "{}".toResponseBody("application/json".toMediaType())))

    @Test fun serverStatuses_duplicateIsAckedRejectedIsDropped_5xxKeepsQueue() = runBlocking {
        val api = FakeApi()
        val f = RepoFixture(api = api)
        fill(f, rows = 10)
        api.failWith = { http(500) }
        try { f.repo.syncPending(); fail() } catch (_: HttpException) {}
        assertEquals(10, f.dao.rows.size)

        api.failWith = { http(409) } // already accepted earlier: idempotent replay
        assertEquals(10, f.repo.syncPending())
        assertEquals(0, f.dao.rows.size)

        fill(f, rows = 5)
        api.failWith = { http(422) } // can never succeed: dropped so it can't block the queue
        assertEquals(0, f.repo.syncPending())
        assertEquals(0, f.dao.rows.size)
    }

    @Test fun unauthorized_callsOnAuthFailure_andKeepsQueue() = runBlocking {
        val api = FakeApi().also { it.failWith = { http(401) } }
        val dao = FakeDao()
        var authFailed = 0
        val repo = SyncingHealthRepository(
            context = fakeContext(), delegate = FakeDelegate(), userProfileRepository = UserProfileRepository(fakeContext()),
            dao = dao, api = api, onAuthFailure = { authFailed++ }, nowMs = { T0 }, scheduleSync = {},
        )
        repo.enqueueReading(snapshot(sampleAt = T0))
        assertEquals(0, repo.syncPending())
        assertEquals(1, authFailed)
        assertEquals(1, dao.rows.size)
    }
}
