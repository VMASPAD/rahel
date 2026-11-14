import { Router } from "express";
import { loginLimiter, registerLimiter } from "../middleware/rateLimit.js";
import { issuesOf, loginSchema, registerSchema } from "../validation/schemas.js";
import { signUserToken } from "../auth/crypto.js";
import { requireUser, type AuthedRequest } from "../middleware/auth.js";
import {
  activeLinkSessionForDevice,
  getUserById,
  listDevicesForUser,
  loginUser,
  registerUser,
} from "../store/accountStore.js";

export const authRoutes = Router();

authRoutes.post("/api/auth/register", registerLimiter, (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "email and password (min 8) required", details: issuesOf(parsed.error) });
    return;
  }
  const { email, password, displayName } = parsed.data;
  try {
    const user = registerUser(email, password, displayName);
    const token = signUserToken(user.id, user.email);
    res.status(201).json({ token, user });
  } catch (e) {
    if (e instanceof Error && e.message === "EMAIL_TAKEN") {
      res.status(409).json({ error: "email_taken" });
      return;
    }
    throw e;
  }
});

authRoutes.post("/api/auth/login", loginLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "email and password required" });
    return;
  }
  const { email, password } = parsed.data;
  try {
    const user = loginUser(email, password);
    const token = signUserToken(user.id, user.email);
    res.json({ token, user });
  } catch {
    res.status(401).json({ error: "invalid_credentials" });
  }
});

authRoutes.get("/api/auth/me", requireUser, (req: AuthedRequest, res) => {
  const user = getUserById(req.userId!);
  if (!user) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const devices = listDevicesForUser(user.id).map((d) => {
    const session = activeLinkSessionForDevice(d.device_id);
    return {
      deviceId: d.device_id,
      crewMemberId: d.crew_member_id,
      pairedAt: d.paired_at_epoch_ms,
      backupCode: session?.backupCode ?? null,
      linkExpiresAt: session?.expiresAt ?? null,
    };
  });
  res.json({ user, devices });
});
