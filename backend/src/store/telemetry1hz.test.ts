import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import "./testDbEnv.js"; // must stay first: selects the in-memory DB before anything opens it
import { initDatabase, prep } from "../db/database.js";
import { enrichReadings, type EstimableReading } from "../estimation/index.js";
import * as analytics from "./analyticsStore.js";
import * as store from "./telemetryStore.js";

const CREW = "crew-1hz";
// Aligned to a 30 s boundary so the 1 Hz and 30 s series share HR values per bucket.
const T0 = Math.floor(Date.UTC(2026, 0, 1, 0, 0, 0) / 30_000) * 30_000;
const hrOf = (sec: number) => Math.round(58 + Math.sin(Math.floor(sec / 30) * 12.9898) * 1.5);

function reading(sec: number) {
  return {
    recordedAtEpochMs: T0 + sec * 1000,
    heartRateBpm: hrOf(sec),
    stepsToday: 0,
  };
}

function ingest1Hz(seconds: number, batch = 300) {
  for (let s0 = 0; s0 < seconds; s0 += batch) {
    const readings = Array.from({ length: Math.min(batch, seconds - s0) }, (_, i) => reading(s0 + i));
    store.ingestBatch({
      crewMemberId: CREW,
      clientBatchId: `b-${s0}`,
      readings,
      assessments: [],
    } as never);
  }
}

before(() => {
  initDatabase();
  ingest1Hz(2 * 3600);
});


test("2 h a 1 Hz => mismas estimaciones que la serie a 30 s", () => {
  const ref: EstimableReading[] = Array.from({ length: 240 }, (_, i) => ({
    recordedAtEpochMs: T0 + (i * 30 + 29) * 1000, // last reading of each bucket
    heartRateBpm: hrOf(i * 30),
    stepsToday: 0,
  }));
  const expected = enrichReadings(ref, [ref[ref.length - 1]])[0];
  assert.ok(expected.restingHeartRateBpm != null);

  const latest = store.getCrewLatest(CREW).latestReading!;
  assert.equal(latest.recordedAtEpochMs, T0 + (7200 - 1) * 1000);
  for (const k of ["restingHeartRateBpm", "hrvMs", "stressScore"] as const) {
    assert.equal(latest[k], expected[k], k);
  }
  assert.ok(latest.estimates?.restingHeartRateBpm);
});

test("ventana de estimación remuestreada a 30 s y acotada", () => {
  const w = store.readingWindowAsc(CREW);
  assert.equal(w.length, 240);
  assert.ok(w.length <= 2881);
});

test("dedupe intacto: reingestar no duplica", () => {
  const before = prep("SELECT COUNT(*) n FROM sensor_readings").get() as { n: number };
  const r = store.ingestBatch({
    crewMemberId: CREW,
    clientBatchId: "again",
    readings: [reading(0), reading(1)],
    assessments: [],
  } as never);
  assert.equal(r.acceptedReadings, 0);
  assert.equal((prep("SELECT COUNT(*) n FROM sensor_readings").get() as { n: number }).n, before.n);
});

test("readings crudo: limit y orden descendente", () => {
  const rs = store.getReadings(CREW, 1000);
  assert.equal(rs.length, 1000);
  assert.ok(rs[0].recordedAtEpochMs > rs[1].recordedAtEpochMs);
  assert.equal(store.getReadings(CREW, 5000).length, 1000);
});

test("readings con bucketSeconds=30 y 60", () => {
  const b30 = store.getReadings(CREW, 300, 30);
  assert.equal(b30.length, 240);
  assert.equal(b30[0].recordedAtEpochMs - b30[1].recordedAtEpochMs, 30_000);
  assert.ok(b30[0].restingHeartRateBpm != null);
  const b60 = store.getReadings(CREW, 50, 60);
  assert.equal(b60.length, 50);
  assert.equal(b60[0].recordedAtEpochMs - b60[1].recordedAtEpochMs, 60_000);
});

test("estimaciones por ancla de tiempo: lecturas crudas heredan entre anclas", () => {
  const rs = store.getReadings(CREW, 1000).reverse(); // ascending, last ~16 min
  const withEst = rs.filter((r) => r.restingHeartRateBpm != null).length;
  assert.equal(withEst, rs.length);
});

test("retención borra lecturas antiguas y respeta 0 = desactivada", () => {
  prep("INSERT INTO profiles (crew_member_id, data_json) VALUES (?, '{}') ON CONFLICT DO NOTHING").run(CREW);
  process.env.RAHEL_RETENTION_DAYS = "0";
  assert.equal(store.purgeOldReadings(T0 + 40 * 86_400_000), 0);
  process.env.RAHEL_RETENTION_DAYS = "30";
  const n = store.purgeOldReadings(T0 + 31 * 86_400_000);
  assert.equal(n, 7200);
  delete process.env.RAHEL_RETENTION_DAYS;
});

test("analítica: muestreo nominal 60/min y ventana por defecto 24 h", () => {
  assert.equal(analytics.DEFAULT_WINDOW_HOURS, 24);
  assert.equal(analytics.GAP_THRESHOLD_MS, 120_000);
  assert.equal(analytics.fieldsSampleSeconds(1), 1);
  assert.equal(analytics.fieldsSampleSeconds(24), 2);
  assert.ok(analytics.fieldsSampleSeconds(720) > 1);
});

// better-sqlite3 + Node 24: un-finalized statements crash the process at teardown.

// better-sqlite3 11.10 on Node 24 aborts when statement wrappers are finalized at env teardown.
// Exit explicitly once the runner has flushed results.
after(() => {
  setTimeout(() => process.exit(process.exitCode ?? 0), 100);
});
