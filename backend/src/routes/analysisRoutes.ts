import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { publicCatalog, WELLNESS_DISCLAIMER } from "../analysis/catalog.js";
import { getJudgmentClient } from "../analysis/judgment.js";
import { executeRun, initialResults } from "../analysis/runner.js";
import { ALLOWED_WINDOWS, buildSummary } from "../analysis/summary.js";
import { requireUser, type AuthedRequest } from "../middleware/auth.js";
import { createRun, deleteRun, getRun, listRuns } from "../store/analysisStore.js";
import { ownedDevice } from "../store/analyticsStore.js";

export const analysisRoutes = Router();

const bodySchema = z.object({
  deviceId: z.string().min(1).max(100),
  windowHours: z.number().refine((n) => (ALLOWED_WINDOWS as readonly number[]).includes(n)),
  consent: z.literal(true),
  tzOffsetMinutes: z.number().int().min(-840).max(840).optional(),
});

const MAX_RUNS_PER_HOUR = Math.max(1, Number(process.env.RAHEL_ANALYSIS_RUNS_PER_HOUR) || 10);

/** Per-user (not per-IP) limit; rejected requests (400/404/409/503...) do not consume quota. */
const runLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: MAX_RUNS_PER_HOUR,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipFailedRequests: true,
  keyGenerator: (req) => (req as AuthedRequest).userId ?? "anon",
  message: { error: "too_many_requests" },
  validate: { keyGeneratorIpFallback: false },
});

analysisRoutes.get("/api/analysis/catalog", requireUser, (_req, res) => {
  res.json({
    configured: getJudgmentClient() !== null,
    disclaimer: WELLNESS_DISCLAIMER,
    windows: ALLOWED_WINDOWS,
    maxRunsPerHour: MAX_RUNS_PER_HOUR,
    items: publicCatalog(),
  });
});

analysisRoutes.post("/api/analysis/runs", requireUser, runLimiter, (req: AuthedRequest, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    const consentMissing = !(req.body && typeof req.body === "object" && (req.body as { consent?: unknown }).consent === true);
    res.status(400).json({ error: consentMissing ? "consent_required" : "invalid_payload" });
    return;
  }
  const { deviceId, windowHours, tzOffsetMinutes } = parsed.data;
  const device = ownedDevice(req.userId!, deviceId);
  if (!device) {
    res.status(404).json({ error: "device not found" });
    return;
  }
  const client = getJudgmentClient();
  if (!client) {
    res.status(503).json({ error: "analysis_not_configured" });
    return;
  }
  const built = buildSummary(device.crewMemberId, windowHours as 24 | 168 | 720, { tzOffsetMinutes });
  if (!built.enoughData) {
    res.status(422).json({ error: "insufficient_data" });
    return;
  }
  const created = createRun({
    userId: req.userId!,
    deviceId: device.deviceId,
    windowHours,
    summaryHash: built.hash,
    initialResults: initialResults(windowHours),
  });
  if ("activeId" in created) {
    res.status(409).json({ error: "analysis_in_progress", runId: created.activeId });
    return;
  }
  // Background execution: the request returns immediately; the UI polls GET /runs/:id.
  setImmediate(() => {
    void executeRun(created.id, built.summary, {}, client);
  });
  res.status(202).json({ id: created.id, status: "queued" });
});

analysisRoutes.get("/api/analysis/runs", requireUser, (req: AuthedRequest, res) => {
  const before = Number(req.query.before);
  res.json(listRuns(req.userId!, Number(req.query.limit) || 10, Number.isFinite(before) && before > 0 ? before : undefined));
});

analysisRoutes.get("/api/analysis/runs/:id", requireUser, (req: AuthedRequest, res) => {
  const run = getRun(req.userId!, String(req.params.id));
  if (!run) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ ...run, disclaimer: WELLNESS_DISCLAIMER });
});

analysisRoutes.delete("/api/analysis/runs/:id", requireUser, (req: AuthedRequest, res) => {
  const r = deleteRun(req.userId!, String(req.params.id));
  if (r === "not_found") res.status(404).json({ error: "not_found" });
  else if (r === "active") res.status(409).json({ error: "analysis_in_progress" });
  else res.status(204).end();
});
