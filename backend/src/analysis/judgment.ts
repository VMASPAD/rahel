/**
 * Judgment client abstraction. The production implementation talks to TypeSafe AI's System One
 * API (https://docs.typesafe.ai/api.md): POST {base}/v1/systemone, Authorization: Bearer <key>,
 * body {state, model, questions}, response {model, answers, usage}. Implemented with fetch
 * (the official SDK needs Node >= 22 and has no base-URL option). The key never leaves the server
 * and is never logged.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { IS_PRODUCTION } from "../auth/crypto.js";

export type QuestionSpec =
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

export type Judgment =
  | { type: "noul"; probability: number }
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number | null }
  | { type: "score"; position: number; levels: number; confidence: number | null };

export interface JudgmentClient {
  /** One request: shared state + several independent questions. Rejects on transport/HTTP errors. */
  judge(req: { state: unknown; questions: Record<string, QuestionSpec>; signal?: AbortSignal }): Promise<{
    answers: Record<string, unknown>;
    model?: string;
  }>;
}

export class JudgmentHttpError extends Error {
  constructor(
    public status: number,
    public retryable: boolean,
  ) {
    super(`judgment_http_${status}`);
  }
}

const prob = z.number().finite().min(0).max(1);
const answerSchemas = {
  noul: z.object({ type: z.literal("noul"), noul: prob }),
  choice: z.object({
    type: z.literal("choice"),
    choice: z.string(),
    probabilities: z.record(z.string(), z.number().finite()).optional(),
    confidence: z.number().finite().min(0).max(1).nullish(),
  }),
  score: z.object({
    type: z.literal("score"),
    score: z.number().finite(),
    confidence: z.number().finite().min(0).max(1).nullish(),
  }),
};

/** Validates one raw answer against its question; returns null when it does not conform. */
export function parseAnswer(spec: QuestionSpec, raw: unknown): Judgment | null {
  if (spec.type === "noul") {
    const p = answerSchemas.noul.safeParse(raw);
    return p.success ? { type: "noul", probability: p.data.noul } : null;
  }
  if (spec.type === "choice") {
    const p = answerSchemas.choice.safeParse(raw);
    if (!p.success || !(p.data.choice in spec.criteria)) return null;
    return {
      type: "choice",
      choice: p.data.choice,
      probabilities: p.data.probabilities ?? {},
      confidence: p.data.confidence ?? null,
    };
  }
  const p = answerSchemas.score.safeParse(raw);
  if (!p.success) return null;
  const levels = spec.criteria.length;
  // The score is a position along the ordered levels (0 .. levels-1); clamp defensively.
  const position = Math.min(levels - 1, Math.max(0, p.data.score));
  return { type: "score", position, levels, confidence: p.data.confidence ?? null };
}

// ---------------------------------------------------------------- configuration

export const DEFAULT_BASE_URL = "https://api.typesafe.ai";
export const DEFAULT_MODEL = "jev-latest";

export function typesafeKeyConfigured(): boolean {
  return Boolean(process.env.RAHEL_TYPESAFE_API_KEY?.trim());
}

export type FetchLike = typeof fetch;

export class TypeSafeClient implements JudgmentClient {
  constructor(
    private readonly opts: {
      apiKey: string;
      baseUrl?: string;
      model?: string;
      timeoutMs?: number;
      fetchImpl?: FetchLike;
    },
  ) {}

  async judge(req: { state: unknown; questions: Record<string, QuestionSpec>; signal?: AbortSignal }) {
    const base = (this.opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    const timeout = AbortSignal.timeout(this.opts.timeoutMs ?? 30_000);
    const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
    let res: Response;
    try {
      res = await (this.opts.fetchImpl ?? fetch)(`${base}/v1/systemone`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state: req.state,
          model: this.opts.model ?? DEFAULT_MODEL,
          questions: req.questions,
        }),
        signal,
      });
    } catch {
      throw new JudgmentHttpError(0, true); // network error or timeout
    }
    if (!res.ok) {
      // 429/529/5xx are transient; 400/401/413/415/422 are not. Body is never logged.
      throw new JudgmentHttpError(res.status, res.status === 429 || res.status === 529 || res.status >= 500);
    }
    const body = (await res.json().catch(() => null)) as { answers?: Record<string, unknown>; model?: string } | null;
    if (!body || typeof body.answers !== "object" || body.answers === null) {
      throw new JudgmentHttpError(502, true);
    }
    return { answers: body.answers, model: body.model };
  }
}

/**
 * Deterministic offline stand-in (RAHEL_TYPESAFE_FAKE=1, never in production) so the whole flow
 * can be exercised without a key. Not a model: answers derive from a hash of the question + state.
 */
export class FakeJudgmentClient implements JudgmentClient {
  async judge(req: { state: unknown; questions: Record<string, QuestionSpec> }) {
    const answers: Record<string, unknown> = {};
    const stateHash = createHash("sha256").update(JSON.stringify(req.state)).digest();
    let i = 0;
    for (const [id, q] of Object.entries(req.questions)) {
      const h = createHash("sha256").update(id).update(stateHash).digest();
      const u = h[0] / 255;
      i++;
      if (q.type === "noul") answers[id] = { type: "noul", noul: Math.round(u * 100) / 100 };
      else if (q.type === "choice") {
        const keys = Object.keys(q.criteria);
        answers[id] = {
          type: "choice",
          choice: keys[h[1] % keys.length],
          probabilities: Object.fromEntries(keys.map((k) => [k, 1 / keys.length])),
          confidence: 0.5 + (h[2] / 255) * 0.4,
        };
      } else {
        answers[id] = { type: "score", score: u * (q.criteria.length - 1), confidence: 0.5 + (h[2] / 255) * 0.4 };
      }
    }
    void i;
    return { answers, model: "fake" };
  }
}

let override: JudgmentClient | null | undefined;
/** Tests: inject a client (or null = "not configured"); undefined restores env-based resolution. */
export function setJudgmentClientForTests(c: JudgmentClient | null | undefined): void {
  override = c;
}

export function getJudgmentClient(): JudgmentClient | null {
  if (override !== undefined) return override;
  if (!IS_PRODUCTION && process.env.RAHEL_TYPESAFE_FAKE === "1") return new FakeJudgmentClient();
  const apiKey = process.env.RAHEL_TYPESAFE_API_KEY?.trim();
  if (!apiKey) return null;
  return new TypeSafeClient({
    apiKey,
    baseUrl: process.env.RAHEL_TYPESAFE_BASE_URL?.trim() || undefined,
    model: process.env.RAHEL_TYPESAFE_MODEL?.trim() || undefined,
    timeoutMs: Number(process.env.RAHEL_TYPESAFE_TIMEOUT_MS) || undefined,
  });
}
