import { CATALOG, CATALOG_BY_ID, type CatalogEntry } from "./catalog.js";
import { getJudgmentClient, JudgmentHttpError, parseAnswer, type Judgment, type JudgmentClient, type QuestionSpec } from "./judgment.js";
import { updateRun } from "../store/analysisStore.js";

export type QuestionResult =
  | { status: "pending" }
  | {
      status: "ok";
      kind: "noul" | "choice" | "score";
      /** noul: probability 0..1. score: position normalised 0..1. choice: chosen option. */
      value: number | string;
      level?: number;
      levels?: number;
      confidence: number | null;
      reading: string;
      probabilities?: Record<string, number>;
    }
  | { status: "error"; code: string; retry: true };

export type RunResults = {
  model: string | null;
  windowHours: number;
  progress: { total: number; done: number; failed: number };
  questions: Record<string, QuestionResult>;
  headline: string | null;
};

export function initialResults(windowHours: number): RunResults {
  return {
    model: null,
    windowHours,
    progress: { total: CATALOG.length, done: 0, failed: 0 },
    questions: Object.fromEntries(CATALOG.map((c) => [c.id, { status: "pending" } as QuestionResult])),
    headline: null,
  };
}

export function toSpec(c: CatalogEntry): QuestionSpec {
  if (c.kind === "noul") return { type: "noul", instructions: c.instructions, ...(c.noulCriteria ? { criteria: c.noulCriteria } : {}) };
  if (c.kind === "choice") return { type: "choice", instructions: c.instructions, criteria: c.choiceCriteria! };
  return { type: "score", instructions: c.instructions, criteria: c.scoreLevels! };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function interpret(c: CatalogEntry, j: Judgment): QuestionResult {
  if (j.type === "noul") {
    const r = c.readings.noul!;
    const p = j.probability;
    return {
      status: "ok",
      kind: "noul",
      value: r2(p),
      confidence: r2(Math.abs(p - 0.5) * 2), // Noul has no confidence field: distance from 0.5
      reading: p < 0.35 ? r[0] : p > 0.65 ? r[2] : r[1],
    };
  }
  if (j.type === "choice") {
    return {
      status: "ok",
      kind: "choice",
      value: j.choice,
      confidence: j.confidence != null ? r2(j.confidence) : null,
      reading: c.readings.choice![j.choice] ?? "",
      probabilities: Object.fromEntries(Object.entries(j.probabilities).map(([k, v]) => [k, r2(v)])),
    };
  }
  const level = Math.round(j.position);
  return {
    status: "ok",
    kind: "score",
    value: r2(j.levels > 1 ? j.position / (j.levels - 1) : 0),
    level,
    levels: j.levels,
    confidence: j.confidence != null ? r2(j.confidence) : null,
    reading: c.readings.score![level] ?? "",
  };
}

export type RunnerOptions = {
  /** Questions per request (shared state, evaluated in parallel by Jev). */
  groupSize: number;
  /** Max simultaneous requests. */
  concurrency: number;
  attempts: number;
  backoffMs: number;
};

export const DEFAULT_RUNNER_OPTIONS: RunnerOptions = {
  groupSize: Math.max(1, Number(process.env.RAHEL_ANALYSIS_GROUP_SIZE) || 5),
  concurrency: Math.max(1, Number(process.env.RAHEL_ANALYSIS_CONCURRENCY) || 2),
  attempts: 3,
  backoffMs: 500,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetries<T>(fn: () => Promise<T>, o: RunnerOptions): Promise<T> {
  let last: unknown;
  for (let i = 0; i < o.attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (e instanceof JudgmentHttpError && !e.retryable) throw e;
      if (i < o.attempts - 1) await sleep(o.backoffMs * 2 ** i);
    }
  }
  throw last;
}

function errCode(e: unknown): string {
  if (e instanceof JudgmentHttpError) return e.status === 0 ? "network" : `http_${e.status}`;
  return "unknown";
}

/**
 * Runs every catalogue question for `state`. Failures are isolated: if a group fails after its
 * retries, its questions are retried one by one (a single malformed question cannot sink the rest).
 * Progress is persisted after each request. Logs metadata only.
 */
export async function executeRun(
  runId: string,
  state: unknown,
  opts: Partial<RunnerOptions> = {},
  client: JudgmentClient | null = getJudgmentClient(),
): Promise<void> {
  const o = { ...DEFAULT_RUNNER_OPTIONS, ...opts };
  const started = Date.now();
  const results = initialResults(Number((state as { coverage?: { windowHours?: number } })?.coverage?.windowHours) || 0);
  const errors: Record<string, number> = {};
  const persist = () => {
    const qs = Object.values(results.questions);
    results.progress = {
      total: qs.length,
      done: qs.filter((q) => q.status === "ok").length,
      failed: qs.filter((q) => q.status === "error").length,
    };
    updateRun(runId, { results });
  };
  try {
    if (!client) throw new Error("not_configured");
    updateRun(runId, { status: "running" });

    const settle = (entry: CatalogEntry, raw: unknown) => {
      const parsed = parseAnswer(toSpec(entry), raw);
      if (parsed) results.questions[entry.id] = interpret(entry, parsed);
      else {
        results.questions[entry.id] = { status: "error", code: "invalid_response", retry: true };
        errors.invalid_response = (errors.invalid_response ?? 0) + 1;
      }
    };
    const fail = (entry: CatalogEntry, e: unknown) => {
      const code = errCode(e);
      results.questions[entry.id] = { status: "error", code, retry: true };
      errors[code] = (errors[code] ?? 0) + 1;
    };
    const call = (entries: CatalogEntry[]) =>
      withRetries(
        () => client.judge({ state, questions: Object.fromEntries(entries.map((e) => [e.id, toSpec(e)])) }),
        o,
      );

    const groups: CatalogEntry[][] = [];
    for (let i = 0; i < CATALOG.length; i += o.groupSize) groups.push(CATALOG.slice(i, i + o.groupSize));

    const runGroup = async (group: CatalogEntry[]) => {
      try {
        const res = await call(group);
        if (res.model) results.model = res.model;
        for (const e of group) {
          if (e.id in res.answers) settle(e, res.answers[e.id]);
          else fail(e, new Error("missing"));
        }
      } catch (e) {
        if (group.length > 1 && !(e instanceof JudgmentHttpError && (e.status === 401 || e.status === 0))) {
          for (const entry of group) {
            try {
              const res = await call([entry]);
              if (res.model) results.model = res.model;
              settle(entry, res.answers[entry.id]);
            } catch (e2) {
              fail(entry, e2);
            }
          }
        } else {
          for (const entry of group) fail(entry, e);
        }
      }
      persist();
    };

    const queue = [...groups];
    await Promise.all(
      Array.from({ length: Math.min(o.concurrency, queue.length) }, async () => {
        for (let g = queue.shift(); g; g = queue.shift()) await runGroup(g);
      }),
    );

    const ok = Object.values(results.questions).filter((q) => q.status === "ok").length;
    results.headline = ok === CATALOG.length ? "Full analysis" : ok > 0 ? "Partial analysis" : null;
    updateRun(runId, {
      status: ok > 0 ? "done" : "error",
      results,
      error: ok > 0 ? null : "all_failed",
      finished: true,
    });
  } catch (e) {
    updateRun(runId, { status: "error", results, error: e instanceof Error && e.message === "not_configured" ? "analysis_not_configured" : "internal", finished: true });
  } finally {
    // Metadata only: never the state or the answers.
    console.log(
      `[analysis] run=${runId.slice(0, 8)} questions=${CATALOG.length} ms=${Date.now() - started} errors=${JSON.stringify(errors)}`,
    );
  }
}

export { CATALOG_BY_ID };
