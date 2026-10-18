import type { Response } from "express";
import { Router } from "express";
import { requireDevice, requireUser, type AuthedRequest } from "../middleware/auth.js";
import {
  clampWindowHours,
  fieldsAnalytics,
  ingestLogPage,
  listDeviceAnalytics,
  ownedDevice,
  replaceSensorInventory,
  sensorsAnalytics,
  timeline,
  type OwnedDevice,
} from "../store/analyticsStore.js";
import { issuesOf, sensorInventorySchema } from "../validation/schemas.js";

export const analyticsRoutes = Router();

/** Wear OS: detected sensors + runtime state. Identity from X-Device-Token only. */
function postDeviceSensors(req: AuthedRequest, res: Response): void {
  if (!req.deviceId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const parsed = sensorInventorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: issuesOf(parsed.error) });
    return;
  }
  const stored = replaceSensorInventory(
    req.deviceId,
    parsed.data.sensors,
    parsed.data.appVersion ?? null,
  );
  res.json({ storedSensors: stored });
}
analyticsRoutes.post("/api/device/sensors", requireDevice, postDeviceSensors);
analyticsRoutes.post("/device/sensors", requireDevice, postDeviceSensors);

/** Dashboard: Bearer JWT; a device that is not the user's answers 404. */
function owned(req: AuthedRequest, res: Response): OwnedDevice | null {
  const d = ownedDevice(req.userId!, String(req.params.deviceId));
  if (!d) {
    res.status(404).json({ error: "device not found" });
    return null;
  }
  return d;
}

analyticsRoutes.get("/api/analytics/devices", requireUser, (req: AuthedRequest, res) => {
  res.json(listDeviceAnalytics(req.userId!));
});

analyticsRoutes.get(
  "/api/analytics/devices/:deviceId/fields",
  requireUser,
  (req: AuthedRequest, res) => {
    const d = owned(req, res);
    if (!d) return;
    res.json(fieldsAnalytics(d, clampWindowHours(req.query.hours)));
  },
);

analyticsRoutes.get(
  "/api/analytics/devices/:deviceId/sensors",
  requireUser,
  (req: AuthedRequest, res) => {
    const d = owned(req, res);
    if (!d) return;
    res.json(sensorsAnalytics(d, fieldsAnalytics(d, clampWindowHours(req.query.hours))));
  },
);

analyticsRoutes.get(
  "/api/analytics/devices/:deviceId/log",
  requireUser,
  (req: AuthedRequest, res) => {
    const d = owned(req, res);
    if (!d) return;
    res.json(
      ingestLogPage(d.deviceId, {
        limit: req.query.limit,
        before: req.query.before,
        status: req.query.status,
      }),
    );
  },
);

analyticsRoutes.get(
  "/api/analytics/devices/:deviceId/timeline",
  requireUser,
  (req: AuthedRequest, res) => {
    const d = owned(req, res);
    if (!d) return;
    const h = Math.floor(Number(req.query.hours));
    res.json(timeline(d, Number.isFinite(h) && h >= 1 ? Math.min(h, 168) : 24));
  },
);
