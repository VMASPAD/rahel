package xyz.targapps.rahel.data

import com.google.gson.GsonBuilder
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonNull
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.BeforeClass
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import xyz.targapps.rahel.data.remote.HealthApiService
import xyz.targapps.rahel.data.remote.RemoteApiFactory
import java.io.File

/**
 * Generates the exact bodies the app POSTs to /api/telemetry/batch (real repository + real Retrofit + the
 * production Gson) into backend/test-fixtures/app-batch-payloads.json and checks them against schemas.ts.
 */
class PayloadContractTest {

    data class Captured(val method: String, val path: String, val contentType: String?, val body: String)

    companion object {
        private val captured = mutableListOf<Captured>()
        private val scenarios = mutableListOf<Pair<String, JsonObject>>()
        private var schemasTs: String? = null
        private var fixtureFile: File? = null

        private fun findRepoRoot(): File? {
            var d: File? = File(System.getProperty("user.dir")).absoluteFile
            while (d != null) {
                if (File(d, "backend/src/validation/schemas.ts").exists()) return d
                d = d.parentFile
            }
            return null
        }

        @JvmStatic @BeforeClass fun setUp() {
            val root = findRepoRoot() ?: return
            schemasTs = File(root, "backend/src/validation/schemas.ts").readText()
            fixtureFile = File(root, "backend/test-fixtures/app-batch-payloads.json")
        }

        /** Real Retrofit + production Gson; the "network" is an interceptor that records the request. */
        private fun api(): HealthApiService {
            val client = OkHttpClient.Builder().addInterceptor(Interceptor { chain ->
                val req = chain.request()
                val buf = Buffer()
                req.body?.writeTo(buf)
                captured.add(Captured(req.method, req.url.encodedPath, req.body?.contentType()?.toString(), buf.readUtf8()))
                Response.Builder().request(req).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                    .body("{\"acceptedReadings\":0,\"acceptedAssessments\":0}".toResponseBody("application/json".toMediaType()))
                    .build()
            }).build()
            return Retrofit.Builder().baseUrl("http://localhost/api/").client(client)
                .addConverterFactory(GsonConverterFactory.create(RemoteApiFactory.apiGson()))
                .build().create(HealthApiService::class.java)
        }

        private fun scenario(name: String, fill: suspend (RepoFixture) -> Unit): JsonObject = runBlocking {
            captured.clear()
            val f = RepoFixture(api = api())
            fill(f)
            f.repo.syncPending()
            assertEquals("scenario $name must produce exactly one POST", 1, captured.size)
            val c = captured.single()
            assertEquals("POST", c.method)
            assertEquals("/api/telemetry/batch", c.path)
            assertTrue(c.contentType!!.startsWith("application/json"))
            JsonParser.parseString(c.body).asJsonObject
        }

        private fun build(): List<Pair<String, JsonObject>> {
            val out = mutableListOf<Pair<String, JsonObject>>()
            out += "single-reading" to scenario("single") { f ->
                f.now = T0
                f.repo.enqueueReading(snapshot(sampleAt = T0, hr = 72, steps = 1500, resting = 58, hrv = 42, spo2 = 97, skinTemp = 33.4f))
            }
            out += "batch-300-readings-1hz" to scenario("300") { f ->
                for (i in 0 until 300) {
                    val at = T0 + i * 1_000L
                    f.now = at
                    val hr = 105 + (45 * Math.sin(i / 20.0)).toInt() // 60..150 bpm
                    f.repo.enqueueReading(snapshot(sampleAt = at, hr = hr, steps = 2000 + i / 2, resting = 60))
                }
            }
            out += "batch-with-assessment" to scenario("assessment") { f ->
                f.now = T0
                f.repo.recordAssessmentCycle(snapshot(sampleAt = T0, hr = 88, steps = 800, hrv = 35), assessment(T0))
                f.now = T0 + 1_000
                f.repo.enqueueReading(snapshot(sampleAt = T0 + 1_000, hr = 90, steps = 801))
            }
            out += "batch-null-vitals" to scenario("nulls") { f ->
                f.now = T0
                f.repo.enqueueReading(snapshot(sampleAt = T0, hr = 64, steps = null, hrv = null, spo2 = null, skinTemp = null, resting = null))
                f.now = T0 + 1_000
                f.repo.enqueueReading(snapshot(sampleAt = T0 + 1_000, hr = 150, steps = null, onWrist = false))
            }
            out += "batch-no-hr-with-steps" to scenario("nohr") { f ->
                f.now = T0
                f.repo.enqueueReading(snapshot(sampleAt = T0 - 600_000, hr = 77, steps = 4321, timestampMs = T0))
                f.now = T0 + 1_000
                f.repo.enqueueReading(snapshot(sampleAt = null, hr = null, steps = 4322, timestampMs = T0 + 1_000))
            }
            return out
        }

        // ---- schemas.ts parsing -------------------------------------------------------------
        fun block(ts: String, header: String): String {
            val start = ts.indexOf(header)
            require(start >= 0) { "schemas.ts: $header not found" }
            val open = ts.indexOf("({", start)
            val end = ts.indexOf("\n});", open)
            return ts.substring(open, end)
        }
        fun fieldNames(block: String): Set<String> =
            Regex("(?m)^  (\\w+):").findAll(block).map { it.groupValues[1] }.toSet()
        fun ranges(block: String): Map<String, Pair<Double, Double>> =
            Regex("(?m)^  (\\w+): range\\(([\\d_.]+), ([\\d_.]+)\\)").findAll(block).associate {
                it.groupValues[1] to (it.groupValues[2].replace("_", "").toDouble() to it.groupValues[3].replace("_", "").toDouble())
            }
    }

    private val all by lazy { build() }

    @Test fun fixtureIsWrittenAndWellFormed() {
        val file = fixtureFile
        assumeTrue("backend/ not found next to app/", file != null)
        val text = buildString {
            append("[\n")
            all.forEachIndexed { i, (name, body) ->
                append("  {\"name\":").append(GsonBuilder().create().toJson(name)).append(",\"body\":")
                    .append(GsonBuilder().serializeNulls().create().toJson(body)).append("}")
                append(if (i < all.size - 1) ",\n" else "\n")
            }
            append("]\n")
        }
        file!!.parentFile.mkdirs()
        if (!file.exists() || file.readText() != text) file.writeText(text)
        val parsed = JsonParser.parseString(file.readText()).asJsonArray
        assertEquals(5, parsed.size())
        assertEquals(listOf("single-reading", "batch-300-readings-1hz", "batch-with-assessment", "batch-null-vitals", "batch-no-hr-with-steps"),
            parsed.map { it.asJsonObject.get("name").asString })
    }

    @Test fun payloadsMatchBackendSchema() {
        val ts = schemasTs
        assumeTrue("schemas.ts not found", ts != null)
        val readingBlock = block(ts!!, "export const readingSchema")
        val readingFields = fieldNames(readingBlock)
        val readingRanges = ranges(readingBlock)
        val assessmentFields = fieldNames(block(ts, "export const assessmentSchema"))
        val conditionFields = fieldNames(block(ts, "const condition ="))
        val batchFields = fieldNames(block(ts, "export const batchSchema"))
        assertTrue(readingRanges.containsKey("heartRateBpm"))

        for ((name, body) in all) {
            val ctx = "[$name]"
            // Envelope: every key the schema requires/accepts is present with the right name.
            assertTrue("$ctx clientBatchId", body.get("clientBatchId").asString.length in 1..128)
            assertTrue("$ctx keys", batchFields.all { body.has(it) || it == "appVersion" })
            assertTrue("$ctx appVersion", body.get("appVersion").asString.length <= 40)
            val readings = body.getAsJsonArray("readings")
            val assessments = body.getAsJsonArray("assessments")
            assertTrue("$ctx max 500 readings", readings.size() <= 500)
            assertTrue("$ctx max 500 assessments", assessments.size() <= 500)
            assertTrue("$ctx not empty", readings.size() + assessments.size() > 0)

            for (r in readings.map { it.asJsonObject }) {
                // Same field names as readingSchema, nothing extra and nothing missing (nulls are explicit).
                assertEquals("$ctx reading keys", readingFields, r.keySet())
                val at = r.get("recordedAtEpochMs").asLong
                assertTrue("$ctx recordedAt positive int in the past", at > 0 && at <= System.currentTimeMillis() + 5 * 60_000)
                assertTrue("$ctx microgravity boolean", r.get("microgravity").asJsonPrimitive.isBoolean)
                for ((field, range) in readingRanges) {
                    val v: JsonElement = r.get(field)
                    if (v is JsonNull) continue
                    val d = v.asDouble
                    assertTrue("$ctx $field=$d outside ${range.first}..${range.second}", d >= range.first && d <= range.second)
                }
                assertTrue(r.get("selfReportedSymptoms").isJsonArray)
            }
            for (a in assessments.map { it.asJsonObject }) {
                assertEquals("$ctx assessment keys", assessmentFields, a.keySet())
                assertTrue(a.get("assessedAtEpochMs").asLong > 0)
                assertTrue(a.get("headline").asString.length <= 500)
                assertTrue(a.get("disclaimer").asString.length <= 2000)
                for (c in a.getAsJsonArray("conditions").map { it.asJsonObject }) {
                    assertEquals("$ctx condition keys", conditionFields, c.keySet())
                    assertTrue(c.get("confidence").asDouble in 0.0..1.0)
                }
            }
        }
    }

    @Test fun scenarioSemantics() {
        val byName = all.toMap()
        fun readings(n: String): JsonArray = byName.getValue(n).getAsJsonArray("readings")

        assertEquals(1, readings("single-reading").size())
        assertEquals(300, readings("batch-300-readings-1hz").size())
        val hrs = readings("batch-300-readings-1hz").map { it.asJsonObject.get("heartRateBpm").asInt }
        assertTrue(hrs.min() >= 60 && hrs.max() <= 150)

        val withA = byName.getValue("batch-with-assessment")
        assertEquals(1, withA.getAsJsonArray("assessments").size())
        assertEquals(2, withA.getAsJsonArray("readings").size())

        val nulls = readings("batch-null-vitals").map { it.asJsonObject }
        assertTrue(nulls.all { it.get("hrvMs") is JsonNull && it.get("spO2Percent") is JsonNull && it.get("skinTempCelsius") is JsonNull })
        assertTrue(nulls.all { it.has("stepsToday") && it.get("stepsToday") is JsonNull })

        val noHr = readings("batch-no-hr-with-steps").map { it.asJsonObject }
        assertEquals(2, noHr.size)
        assertTrue(noHr.all { it.get("heartRateBpm") is JsonNull && !it.get("stepsToday").isJsonNull })
    }
}
