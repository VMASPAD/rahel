import { Router } from "express";
import type {
  TelemetryBatchRequest,
  UserProfileSnapshotDto,
} from "../types/health.js";
import * as store from "../store/telemetryStore.js";

export const healthRoutes = Router();

healthRoutes.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "rahel-backend",
    timestamp: new Date().toISOString(),
  });
});

/** Wear OS — same paths as Retrofit [HealthApiService] */
healthRoutes.post("/profile", (req, res) => {
  const body = req.body as UserProfileSnapshotDto;
  if (!body?.crewMemberId) {
    res.status(400).json({ error: "crewMemberId required" });
    return;
  }
  store.upsertProfile(body);
  res.json({ acceptedReadings: 0, acceptedAssessments: 0 });
});

healthRoutes.post("/telemetry/batch", (req, res) => {
  const body = req.body as TelemetryBatchRequest;
  if (!body?.crewMemberId || !body.clientBatchId) {
    res.status(400).json({ error: "crewMemberId and clientBatchId required" });
    return;
  }
  res.json(store.ingestBatch(body));
});

/** Dashboard — frontend */
healthRoutes.get("/api/crew", (_req, res) => {
  res.json(store.listCrew());
});

healthRoutes.get("/api/crew/:crewMemberId/latest", (req, res) => {
  const latest = store.getCrewLatest(req.params.crewMemberId);
  if (!latest) {
    res.status(404).json({ error: "crew not found" });
    return;
  }
  res.json(latest);
});

healthRoutes.get("/api/crew/:crewMemberId/readings", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  res.json(store.getReadings(req.params.crewMemberId, limit));
});

healthRoutes.get("/api/crew/:crewMemberId/assessment/latest", (req, res) => {
  const a = store.latestAssessmentFor(req.params.crewMemberId);
  if (!a) {
    res.status(404).json({ error: "no assessment" });
    return;
  }
  res.json(a);
});
