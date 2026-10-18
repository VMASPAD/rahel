import type { Response } from "express";
import { Router } from "express";
import {
  ALLOW_LEGACY_INGEST,
  requireDevice,
  requireUser,
  type AuthedRequest,
} from "../middleware/auth.js";
import { recordIngestSafe } from "../store/ingestLogStore.js";
import * as store from "../store/telemetryStore.js";
import { batchSchema, issuesOf, profileSchema } from "../validation/schemas.js";

export const healthRoutes = Router();

healthRoutes.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "rahel-backend",
    timestamp: new Date().toISOString(),
  });
});

/** Identity comes from the device token only; legacy body id only with the dev flag. */
function resolveCrewId(req: AuthedRequest): string | null {
  if (req.deviceCrewMemberId) return req.deviceCrewMemberId;
  if (ALLOW_LEGACY_INGEST) {
    const id = (req.body as { crewMemberId?: unknown } | undefined)?.crewMemberId;
    if (typeof id === "string" && id.length > 0 && id.length <= 64) return id;
  }
  return null;
}

function postProfile(req: AuthedRequest, res: Response): void {
  const crewMemberId = resolveCrewId(req);
  if (!crewMemberId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: issuesOf(parsed.error) });
    return;
  }
  store.upsertProfile({ ...parsed.data, crewMemberId });
  res.json({ acceptedReadings: 0, acceptedAssessments: 0 });
}

function postTelemetryBatch(req: AuthedRequest, res: Response): void {
  const crewMemberId = resolveCrewId(req);
  if (!crewMemberId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const bytes = Number(req.headers["content-length"]) || null;
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) {
    const details = issuesOf(parsed.error);
    const raw = (req.body ?? {}) as { clientBatchId?: unknown; readings?: unknown; assessments?: unknown };
    const first = details[0];
    recordIngestSafe({
      deviceId: req.deviceId,
      crewMemberId,
      batchId: typeof raw.clientBatchId === "string" ? raw.clientBatchId.slice(0, 128) : null,
      readingsReceived: Array.isArray(raw.readings) ? raw.readings.length : 0,
      readingsAccepted: 0,
      assessmentsReceived: Array.isArray(raw.assessments) ? raw.assessments.length : 0,
      status: "rechazado",
      errorCode: "invalid_payload",
      errorDetail: first ? `${first.path || "(raíz)"}: ${first.message}` : null,
      bytes,
    });
    res.status(400).json({ error: "invalid_payload", details });
    return;
  }
  res.json(
    store.ingestBatch(
      {
        ...parsed.data,
        crewMemberId,
      } as import("../types/health.js").TelemetryBatchRequest,
      { deviceId: req.deviceId, bytes },
    ),
  );
}

/** Wear OS — Retrofit base `.../api/` → profile, telemetry/batch */
healthRoutes.post("/profile", requireDevice, postProfile);
healthRoutes.post("/telemetry/batch", requireDevice, postTelemetryBatch);
healthRoutes.post("/api/profile", requireDevice, postProfile);
healthRoutes.post("/api/telemetry/batch", requireDevice, postTelemetryBatch);

/** Dashboard — Bearer JWT, scoped to the user's devices. */
healthRoutes.get("/api/crew", requireUser, (req: AuthedRequest, res) => {
  res.json(store.listCrew(req.userId!));
});

function ownedCrew(req: AuthedRequest, res: Response): string | null {
  const id = String(req.params.crewMemberId);
  if (!store.userOwnsCrew(req.userId!, id)) {
    res.status(404).json({ error: "crew not found" });
    return null;
  }
  return id;
}

healthRoutes.get("/api/crew/:crewMemberId/latest", requireUser, (req: AuthedRequest, res) => {
  const id = ownedCrew(req, res);
  if (!id) return;
  res.json(store.getCrewLatest(id));
});

healthRoutes.get("/api/crew/:crewMemberId/readings", requireUser, (req: AuthedRequest, res) => {
  const id = ownedCrew(req, res);
  if (!id) return;
  const limit = Math.max(1, Math.min(Math.floor(Number(req.query.limit)) || 100, 500));
  res.json(store.getReadings(id, limit));
});

healthRoutes.get(
  "/api/crew/:crewMemberId/assessment/latest",
  requireUser,
  (req: AuthedRequest, res) => {
    const id = ownedCrew(req, res);
    if (!id) return;
    const a = store.latestAssessmentFor(id);
    if (!a) {
      res.status(404).json({ error: "no assessment" });
      return;
    }
    res.json(a);
  },
);
