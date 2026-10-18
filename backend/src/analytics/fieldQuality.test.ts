import assert from "node:assert/strict";
import { test } from "node:test";
import { assessField, coveragePct, sensorStatus, type FieldInput } from "./fieldQuality.js";

const base: FieldInput = {
  key: "heartRateBpm",
  total: 1000,
  nonNull: 1000,
  min: 55,
  max: 120,
  std: 12,
  lastSeenMs: 1_000_000,
  deviceLastMs: 1_000_000,
  estimatedCount: 0,
};

test("coveragePct: rounding, zero and clamping", () => {
  assert.equal(coveragePct(0, 100), 0);
  assert.equal(coveragePct(5, 0), 0);
  assert.equal(coveragePct(1, 3), 33.3);
  assert.equal(coveragePct(200, 100), 100);
});

test("full coverage with variation => medido / mantener", () => {
  const a = assessField(base);
  assert.equal(a.quality, "medido");
  assert.equal(a.recommendation, "mantener");
  assert.equal(a.coveragePct, 100);
  assert.ok(a.reason.length > 10);
});

test("partial coverage => usar con cautela", () => {
  const a = assessField({ ...base, nonNull: 500 });
  assert.equal(a.recommendation, "usar con cautela");
  assert.equal(a.reasonCode, "partial_coverage");
});

test("low coverage => usar con cautela (low_coverage)", () => {
  const a = assessField({ ...base, nonNull: 100 });
  assert.equal(a.reasonCode, "low_coverage");
});

test("never received, not estimable => no recibido / requiere sensor", () => {
  const a = assessField({ ...base, key: "spO2Percent", nonNull: 0, min: null, max: null, std: null, lastSeenMs: null });
  assert.equal(a.quality, "no recibido");
  assert.equal(a.recommendation, "requiere sensor");
});

test("skin temperature missing is never presented as estimable", () => {
  const a = assessField({ ...base, key: "skinTempCelsius", nonNull: 0, min: null, max: null, std: null, lastSeenMs: null });
  assert.equal(a.reasonCode, "needs_sensor_no_estimate");
});

test("only estimated => estimado / usar con cautela", () => {
  const a = assessField({ ...base, key: "hrvMs", nonNull: 0, min: null, max: null, std: null, lastSeenMs: null, estimatedCount: 800 });
  assert.equal(a.quality, "estimado");
  assert.equal(a.recommendation, "usar con cautela");
  assert.equal(a.coveragePct, 0);
});

test("estimable field with nothing at all => requiere sensor", () => {
  const a = assessField({ ...base, key: "hrvMs", nonNull: 0, min: null, max: null, std: null, lastSeenMs: null });
  assert.equal(a.recommendation, "requiere sensor");
});

test("constant context value => candidato a descartar", () => {
  const a = assessField({ ...base, key: "isolationIndex", min: 0.3, max: 0.3, std: 0 });
  assert.equal(a.recommendation, "candidato a descartar");
  assert.equal(a.reasonCode, "constant_value");
});

test("few samples with equal values are not judged constant", () => {
  const a = assessField({ ...base, total: 10, nonNull: 10, min: 70, max: 70, std: 0 });
  assert.notEqual(a.reasonCode, "constant_value");
});

test("context field missing => candidato a descartar", () => {
  const a = assessField({ ...base, key: "missionDay", nonNull: 0, min: null, max: null, std: null, lastSeenMs: null });
  assert.equal(a.recommendation, "candidato a descartar");
});

test("stale field (stopped arriving) => usar con cautela", () => {
  const a = assessField({ ...base, lastSeenMs: 1_000_000 - 3 * 3_600_000 });
  assert.equal(a.reasonCode, "stale");
  assert.match(a.reason, /3 h/);
});

test("no readings at all", () => {
  const a = assessField({ ...base, total: 0, nonNull: 0 });
  assert.equal(a.reasonCode, "no_readings");
});

test("sensorStatus cross", () => {
  const s = { typeName: "heart_rate", available: true, permissionGranted: true, inUse: true, delivering: true };
  assert.equal(sensorStatus(s, true), "enviando datos");
  assert.equal(sensorStatus(s, false), "entrega pero no se sube");
  assert.equal(sensorStatus({ ...s, permissionGranted: false }, false), "sin permiso");
  assert.equal(sensorStatus({ ...s, available: false }, false), "no disponible");
  assert.equal(sensorStatus({ ...s, delivering: false }, false), "no entrega");
  assert.equal(sensorStatus({ ...s, delivering: false, inUse: false }, false), "no usado por la app");
});
