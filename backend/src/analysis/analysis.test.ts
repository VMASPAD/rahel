import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import "../store/testDbEnv.js"; // first: selects the in-memory DB
process.env.RAHEL_ANALYSIS_RUNS_PER_HOUR = "6";

import express from "express";
import { signUserToken } from "../auth/crypto.js";
import { initDatabase, prep } from "../db/database.js";
import { ingestBatch } from "../store/telemetryStore.js";
import { CATALOG } from "./catalog.js";
import {
  FakeJudgmentClient,
  JudgmentHttpError,
  setJudgmentClientForTests,
  TypeSafeClient,
  type JudgmentClient,
} from "./judgment.js";

const { analysisRoutes } = await import("../routes/analysisRoutes.js");

const EMAIL = "persona.privada@example.com";
const CREW = "crew-secret-123";
const DEVICE = "device-secret-456";
let base = "";
let server: ReturnType<express.Express["listen"]>;
let tokenA = "";
let tokenB = "";
const states: unknown[] = [];

const auth = (t: string) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json" });
const post = (body: unknown, t = tokenA) =>
  fetch(`${base}/api/analysis/runs`, { method: "POST", headers: auth(t), body: JSON.stringify(body) });
const ok = { deviceId: DEVICE, windowHours: 24, consent: true };

async function waitDone(id: string, t = tokenA) {
  for (let i = 0; i < 100; i++) {
    const r = await (await fetch(`${base}/api/analysis/runs/${id}`, { headers: auth(t) })).json();
    if (r.status === "done" || r.status === "error") return r;
    await new Promise((res) => setTimeout(res, 20));
  }
  throw new Error("timeout");
}

/** Records the states and delegates to the deterministic fake. */
const recording: JudgmentClient = {
  async judge(req) {
    states.push(req.state);
    return new FakeJudgmentClient().judge(req);
  },
};

before(async () => {
  initDatabase();
  const now = Date.now();
  for (const [id, email] of [["user-a", EMAIL], ["user-b", "otra@example.com"]]) {
    prep(`INSERT INTO users (id, email, password_hash, created_at_epoch_ms) VALUES (?, ?, 'x', ?)`).run(id, email, now);
  }
  prep(
    `INSERT INTO devices (device_id, user_id, crew_member_id, token_hash, paired_at_epoch_ms) VALUES (?, 'user-a', ?, 'h', ?)`,
  ).run(DEVICE, CREW, now);
  tokenA = signUserToken("user-a", EMAIL);
  tokenB = signUserToken("user-b", "otra@example.com");
  // 12 h of synthetic data every 30 s: quiet night then some walking.
  const start = Math.floor((now - 12 * 3600_000) / 30_000) * 30_000;
  const readings = [];
  let steps = 0;
  for (let i = 0; i < 12 * 120; i++) {
    const active = i > 12 * 120 * 0.7 && i % 7 < 3;
    if (active) steps += 4;
    readings.push({
      recordedAtEpochMs: start + i * 30_000,
      heartRateBpm: active ? 105 : 58 + (i % 5),
      stepsToday: steps,
      selfReportedSymptoms: [],
    });
  }
  for (let o = 0; o < readings.length; o += 400) {
    ingestBatch({ crewMemberId: CREW, clientBatchId: `b${o}`, readings: readings.slice(o, o + 400), assessments: [] } as never);
  }
  const app = express();
  app.use(express.json());
  app.use(analysisRoutes);
  await new Promise<void>((res) => {
    server = app.listen(0, "127.0.0.1", () => res());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  setJudgmentClientForTests(undefined);
  server.close();
});

test("sin clave configurada: analysis_not_configured", async () => {
  setJudgmentClientForTests(null);
  const cat = await (await fetch(`${base}/api/analysis/catalog`, { headers: auth(tokenA) })).json();
  assert.equal(cat.configured, false);
  assert.equal(cat.items.length, CATALOG.length);
  const r = await post(ok);
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, "analysis_not_configured");
});

test("requiere Bearer", async () => {
  const r = await fetch(`${base}/api/analysis/runs`, { method: "POST", body: "{}" });
  assert.equal(r.status, 401);
});

test("el consentimiento es obligatorio", async () => {
  setJudgmentClientForTests(recording);
  for (const body of [{ deviceId: DEVICE, windowHours: 24 }, { ...ok, consent: false }, { ...ok, consent: "true" }]) {
    const r = await post(body);
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, "consent_required");
  }
  assert.equal((await post({ ...ok, windowHours: 5 })).status, 400);
});

test("dispositivo ajeno: 404; informe ajeno: 404", async () => {
  setJudgmentClientForTests(recording);
  assert.equal((await post(ok, tokenB)).status, 404);
  assert.equal((await post({ ...ok, deviceId: "no-existe" })).status, 404);
});

test("ejecución completa, estado sin identificadores, lectura y borrado", async () => {
  setJudgmentClientForTests(recording);
  states.length = 0;
  const r = await post(ok);
  assert.equal(r.status, 202);
  const { id } = await r.json();
  const run = await waitDone(id);
  assert.equal(run.status, "done");
  assert.equal(run.results.progress.done, CATALOG.length);
  assert.equal(run.results.progress.failed, 0);
  for (const c of CATALOG) {
    const q = run.results.questions[c.id];
    assert.equal(q.status, "ok");
    assert.ok(q.reading.length > 5, c.id);
  }
  assert.ok(run.summaryHash && run.summaryHash.length === 64);
  assert.ok(run.consentAt > 0);

  // Aggregation: no identifiers, no raw/absolute timestamps.
  assert.ok(states.length >= 1);
  for (const s of states) {
    const json = JSON.stringify(s);
    for (const secret of [DEVICE, CREW, EMAIL, "user-a", "persona", "crewMemberId", "deviceId", "email"]) {
      assert.ok(!json.includes(secret), `el estado contiene ${secret}`);
    }
    assert.ok(!/\b1[5-9]\d{11}\b/.test(json), "el estado contiene una marca de tiempo absoluta");
    assert.ok(json.length < 20_000, `estado demasiado grande: ${json.length}`);
  }

  // Ownership on read/delete, history and delete.
  assert.equal((await fetch(`${base}/api/analysis/runs/${id}`, { headers: auth(tokenB) })).status, 404);
  assert.equal((await fetch(`${base}/api/analysis/runs/${id}`, { method: "DELETE", headers: auth(tokenB) })).status, 404);
  const list = await (await fetch(`${base}/api/analysis/runs`, { headers: auth(tokenA) })).json();
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].results, undefined);
  assert.equal((await fetch(`${base}/api/analysis/runs/${id}`, { method: "DELETE", headers: auth(tokenA) })).status, 204);
  assert.equal((await fetch(`${base}/api/analysis/runs/${id}`, { headers: auth(tokenA) })).status, 404);
});

test("solo una ejecución activa por usuario (409)", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  setJudgmentClientForTests({
    async judge(req) {
      await gate;
      return new FakeJudgmentClient().judge(req);
    },
  });
  const first = await post(ok);
  assert.equal(first.status, 202);
  const { id } = await first.json();
  const second = await post(ok);
  assert.equal(second.status, 409);
  assert.equal((await second.json()).error, "analysis_in_progress");
  assert.equal((await fetch(`${base}/api/analysis/runs/${id}`, { method: "DELETE", headers: auth(tokenA) })).status, 409);
  release();
  assert.equal((await waitDone(id)).status, "done");
});

test("fallo parcial: el informe conserva el resto y marca reintentar", async () => {
  setJudgmentClientForTests({
    async judge(req) {
      if ("activity_level" in req.questions) throw new JudgmentHttpError(422, false);
      return new FakeJudgmentClient().judge(req);
    },
  });
  const { id } = await (await post(ok)).json();
  const run = await waitDone(id);
  assert.equal(run.status, "done");
  assert.equal(run.results.progress.failed, 1);
  assert.equal(run.results.progress.done, CATALOG.length - 1);
  assert.deepEqual(run.results.questions.activity_level, { status: "error", code: "http_422", retry: true });
  assert.equal(run.results.questions.recovery.status, "ok");
  assert.equal(run.results.headline, "Partial analysis");
});

test("respuesta inválida de Jev: se marca esa pregunta, no el informe", async () => {
  setJudgmentClientForTests({
    async judge(req) {
      const res = await new FakeJudgmentClient().judge(req);
      if ("sustained_stress" in res.answers) res.answers.sustained_stress = { type: "noul", noul: 7 };
      if ("activity_level" in res.answers) res.answers.activity_level = { type: "choice", choice: "inventada" };
      return res;
    },
  });
  const { id } = await (await post(ok)).json();
  const run = await waitDone(id);
  assert.equal(run.results.questions.sustained_stress.code, "invalid_response");
  assert.equal(run.results.questions.activity_level.code, "invalid_response");
  assert.equal(run.results.progress.failed, 2);
});

test("límite de frecuencia por usuario (429) y otro usuario no se ve afectado", async () => {
  setJudgmentClientForTests(recording);
  // 3 accepted so far (full, 409-first, partial, invalid = 4). Fill the remaining quota of 6.
  let accepted = 4;
  for (; accepted < 6; accepted++) {
    const r = await post(ok);
    assert.equal(r.status, 202);
    await waitDone((await r.json()).id);
  }
  const blocked = await post(ok);
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).error, "too_many_requests");
  // User B is not limited (gets 404 for a device that is not theirs, not 429).
  assert.equal((await post(ok, tokenB)).status, 404);
});

test("cliente HTTP: URL, cabeceras, cuerpo y errores según la documentación", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const mk = (status: number, body: unknown) =>
    new TypeSafeClient({
      apiKey: "k-test",
      baseUrl: "https://example.test/",
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify(body), { status });
      }) as typeof fetch,
    });
  const res = await mk(200, { model: "jev-1.13.0", answers: { q: { type: "noul", noul: 0.4 } } }).judge({
    state: { a: 1 },
    questions: { q: { type: "noul", instructions: "?" } },
  });
  assert.equal(res.model, "jev-1.13.0");
  assert.equal(calls[0].url, "https://example.test/v1/systemone");
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer k-test");
  const sent = JSON.parse(String(calls[0].init.body));
  assert.equal(sent.model, "jev-latest");
  assert.deepEqual(Object.keys(sent).sort(), ["model", "questions", "state"]);
  await assert.rejects(mk(429, {}).judge({ state: 1, questions: {} }), (e: JudgmentHttpError) => e.retryable && e.status === 429);
  await assert.rejects(mk(401, {}).judge({ state: 1, questions: {} }), (e: JudgmentHttpError) => !e.retryable);
});
