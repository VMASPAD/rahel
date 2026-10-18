import assert from "node:assert/strict";
import { test } from "node:test";
import { enrichReadings, type EstimableReading } from "./index.js";

const STEP = 30_000;
const T0 = Date.UTC(2026, 0, 1, 0, 0, 0);

/** Deterministic pseudo-noise in [-1, 1]. */
const noise = (i: number) => Math.sin(i * 12.9898);

function series(n: number, hr: (i: number) => number | null, steps: (i: number) => number | null = () => 0, start = T0) {
  return Array.from({ length: n }, (_, i): EstimableReading => ({
    recordedAtEpochMs: start + i * STEP,
    heartRateBpm: hr(i),
    stepsToday: steps(i),
  }));
}
const latest = (rs: EstimableReading[]) => enrichReadings(rs, [rs[rs.length - 1]])[0];

test("reposo con FC~58 => resting~58", () => {
  const rs = series(300, (i) => Math.round(58 + noise(i) * 1.5)); // 2.5 h
  const r = latest(rs);
  assert.ok(Math.abs(r.restingHeartRateBpm! - 57) <= 2, String(r.restingHeartRateBpm));
  assert.equal(r.estimates?.restingHeartRateBpm?.confidence, "low");
  assert.ok(r.estimates!.restingHeartRateBpm!.sampleCount >= 30);
});

test("noche simulada de 7 h => sleep~7", () => {
  // 1 h de actividad (pasos crecen, FC 85) + 7 h de sueño (FC ~55).
  const awake = 120;
  const n = awake + 7 * 120 + 1;
  const rs = series(
    n,
    (i) => (i < awake ? 85 + Math.round(noise(i) * 3) : 55 + Math.round(noise(i))),
    (i) => (i < awake ? i * 10 : awake * 10),
  );
  const r = latest(rs);
  assert.ok(Math.abs(r.sleepHoursLastNight! - 7) <= 0.2, String(r.sleepHoursLastNight));
  assert.equal(r.estimates?.sleepHoursLastNight?.confidence, "medium");
  assert.ok(r.hrvMs! >= 10 && r.hrvMs! <= 120);
  assert.ok(r.stressScore! >= 0 && r.stressScore! <= 100);
  assert.equal((r as { skinTempCelsius?: unknown }).skinTempCelsius, undefined);
});

test("hueco largo (reloj fuera) corta el bloque de sueño", () => {
  const a = series(300, () => 55); // 2.5 h
  const b = series(300, () => 55, () => 0, T0 + 300 * STEP + 30 * 60_000); // tras 30 min de hueco
  const rs = [...a, ...b];
  const r = latest(rs);
  assert.ok(Math.abs(r.sleepHoursLastNight! - 2.5) <= 0.1, String(r.sleepHoursLastNight));
});

test("datos insuficientes => sin estimación", () => {
  const rs = series(20, () => 60);
  const r = latest(rs);
  assert.equal(r.restingHeartRateBpm ?? null, null);
  assert.equal(r.hrvMs ?? null, null);
  assert.equal(r.sleepHoursLastNight ?? null, null);
  assert.equal(r.stressScore ?? null, null);
  assert.equal(r.estimates, undefined);
});

test("sin pasos (null) => no se puede afirmar reposo => sin estimación", () => {
  const rs = series(300, () => 58, () => null);
  assert.equal(latest(rs).estimates, undefined);
});

test("valor medido presente => no se toca ni se marca", () => {
  const rs = series(300, (i) => Math.round(58 + noise(i)));
  rs[rs.length - 1] = { ...rs[rs.length - 1], restingHeartRateBpm: 70, hrvMs: 33 };
  const r = latest(rs);
  assert.equal(r.restingHeartRateBpm, 70);
  assert.equal(r.hrvMs, 33);
  assert.equal(r.estimates?.restingHeartRateBpm, undefined);
  assert.equal(r.estimates?.hrvMs, undefined);
});

test("no muta la entrada y el estrés sube con FC elevada en reposo", () => {
  const rs = series(400, (i) => (i < 300 ? 58 : 75), () => 0);
  const before = JSON.stringify(rs);
  const r = latest(rs);
  assert.equal(JSON.stringify(rs), before);
  assert.equal(rs[rs.length - 1].restingHeartRateBpm, undefined);
  assert.ok(r.stressScore! > 40, String(r.stressScore));
});

test("enrichReadings en lote: objetos independientes y última lectura estimada", () => {
  const rs = series(300, (i) => Math.round(58 + noise(i)));
  const out = enrichReadings(rs, rs.slice(-50));
  assert.equal(out.length, 50);
  assert.ok(out[49].restingHeartRateBpm != null);
  assert.equal(rs[299].restingHeartRateBpm, undefined);
});
