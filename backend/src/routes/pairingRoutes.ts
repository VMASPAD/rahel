import { Router } from "express";
import { requireUser, type AuthedRequest } from "../middleware/auth.js";
import {
  claimLimiter,
  pairingCodeLimiter,
  pairingStatusLimiter,
} from "../middleware/rateLimit.js";
import {
  claimLockedFor,
  claimPairingCode,
  createPairingCode,
  getPairingStatus,
  revokeDevice,
} from "../store/accountStore.js";
import { deviceIdSchema } from "../validation/schemas.js";

export const pairingRoutes = Router();

pairingRoutes.post("/api/pairing/code", pairingCodeLimiter, (req, res) => {
  const parsed = deviceIdSchema.safeParse((req.body as { deviceId?: unknown })?.deviceId);
  if (!parsed.success) {
    res.status(400).json({ error: "deviceId required (16-128 chars: A-Z a-z 0-9 _ -)" });
    return;
  }
  const result = createPairingCode(parsed.data);
  res.json({
    code: result.code,
    secondaryCode: result.secondaryCode,
    expiresAt: new Date(result.expiresAt).toISOString(),
    ttlSeconds: result.ttlSeconds,
  });
});

pairingRoutes.get("/api/pairing/status", pairingStatusLimiter, (req, res) => {
  const parsed = deviceIdSchema.safeParse(req.query.deviceId);
  if (!parsed.success) {
    res.status(400).json({ error: "deviceId query required" });
    return;
  }
  res.set("Cache-Control", "no-store");
  res.json(getPairingStatus(parsed.data));
});

pairingRoutes.post(
  "/api/pairing/claim",
  claimLimiter,
  requireUser,
  (req: AuthedRequest, res) => {
    const code = (req.body as { code?: unknown })?.code;
    if (typeof code !== "string" || !code) {
      res.status(400).json({ error: "code required" });
      return;
    }
    const lockMs = claimLockedFor(req.userId!);
    if (lockMs > 0) {
      res.set("Retry-After", String(Math.ceil(lockMs / 1000)));
      res.status(429).json({ error: "claim_locked" });
      return;
    }
    try {
      res.json(claimPairingCode(code, req.userId!));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      if (msg === "CLAIM_LOCKED") {
        res.status(429).json({ error: "claim_locked" });
        return;
      }
      const map: Record<string, number> = {
        CODE_NOT_FOUND: 404,
        CODE_EXPIRED: 410,
        CODE_ALREADY_USED: 409,
        DEVICE_ALREADY_PAIRED: 409,
      };
      if (!(msg in map)) throw e;
      res.status(map[msg]).json({ error: msg.toLowerCase() });
    }
  },
);

pairingRoutes.delete("/api/pairing/devices/:id", requireUser, (req: AuthedRequest, res) => {
  if (!revokeDevice(String(req.params.id), req.userId!)) {
    res.status(404).json({ error: "device_not_found" });
    return;
  }
  res.json({ revoked: true });
});
