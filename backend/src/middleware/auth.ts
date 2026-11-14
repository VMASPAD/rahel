import type { Request, Response, NextFunction } from "express";
import { IS_PRODUCTION, verifyUserToken } from "../auth/crypto.js";
import { resolveDeviceByToken } from "../store/accountStore.js";

export type AuthedRequest = Request & {
  userId?: string;
  userEmail?: string;
  deviceCrewMemberId?: string;
  deviceId?: string;
};

export function unauthorized(res: Response): void {
  res.status(401).json({ error: "unauthorized" });
}

export function requireUser(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  const token =
    header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  const payload = token ? verifyUserToken(token) : null;
  if (!payload) {
    unauthorized(res);
    return;
  }
  req.userId = payload.sub;
  req.userEmail = payload.email;
  next();
}

/** Dev-only escape hatch: accept ingest without a device token (body crewMemberId). */
export const ALLOW_LEGACY_INGEST =
  !IS_PRODUCTION && process.env.RAHEL_ALLOW_LEGACY_INGEST === "true";

/**
 * Wear OS ingest: `X-Device-Token` is mandatory. The crew member is derived from the
 * token only (req.deviceCrewMemberId); the body is never trusted for identity.
 */
export function requireDevice(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  const token = req.headers["x-device-token"];
  if (typeof token !== "string" || !token) {
    if (ALLOW_LEGACY_INGEST) {
      next();
      return;
    }
    unauthorized(res);
    return;
  }
  const device = resolveDeviceByToken(token);
  if (!device) {
    unauthorized(res);
    return;
  }
  req.deviceCrewMemberId = device.crewMemberId;
  req.deviceId = device.deviceId;
  next();
}
