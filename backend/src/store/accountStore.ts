import { randomBytes, randomInt } from "node:crypto";
import { getDb } from "../db/database.js";
import {
  decryptSecret,
  encryptSecret,
  hashDeviceToken,
  hmacWithSecret,
  hashPassword,
  newDeviceToken,
  verifyPassword,
} from "../auth/crypto.js";

const PAIRING_TTL_MS = 10 * 60 * 1000;
const PENDING_TOKEN_TTL_MS = 5 * 60 * 1000;
const MAX_CLAIM_FAILURES = 5;
const CLAIM_LOCK_MS = 15 * 60 * 1000;
const CLAIM_FAIL_WINDOW_MS = 15 * 60 * 1000;

export type UserRow = {
  id: string;
  email: string;
  displayName: string | null;
};

export function registerUser(
  email: string,
  password: string,
  displayName?: string,
): UserRow {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(normalized);
  if (existing) {
    throw new Error("EMAIL_TAKEN");
  }
  const id = randomBytes(12).toString("hex");
  const now = Date.now();
  try {
    db.prepare(
      `INSERT INTO users (id, email, password_hash, display_name, created_at_epoch_ms)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, normalized, hashPassword(password), displayName ?? null, now);
  } catch (e) {
    if ((e as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new Error("EMAIL_TAKEN");
    }
    throw e;
  }
  return { id, email: normalized, displayName: displayName ?? null };
}

export function loginUser(email: string, password: string): UserRow {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const row = db
    .prepare(
      `SELECT id, email, password_hash, display_name FROM users WHERE email = ?`,
    )
    .get(normalized) as
    | {
        id: string;
        email: string;
        password_hash: string;
        display_name: string | null;
      }
    | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new Error("INVALID_CREDENTIALS");
  }
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
  };
}

export function getUserById(userId: string): UserRow | null {
  const row = getDb()
    .prepare(`SELECT id, email, display_name FROM users WHERE id = ?`)
    .get(userId) as
    | { id: string; email: string; display_name: string | null }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
  };
}

export function listDevicesForUser(userId: string) {
  return getDb()
    .prepare(
      `SELECT device_id, crew_member_id, paired_at_epoch_ms
       FROM devices WHERE user_id = ? AND revoked_at_epoch_ms IS NULL ORDER BY paired_at_epoch_ms DESC`,
    )
    .all(userId) as {
    device_id: string;
    crew_member_id: string;
    paired_at_epoch_ms: number;
  }[];
}

export function activeLinkSessionForDevice(deviceId: string) {
  const row = getDb()
    .prepare(
      `SELECT code, secondary_code, expires_at_epoch_ms FROM pairing_codes
       WHERE device_id = ? AND expires_at_epoch_ms > ? AND claimed_by_user_id IS NULL
       ORDER BY expires_at_epoch_ms DESC LIMIT 1`,
    )
    .get(deviceId, Date.now()) as
    | {
        code: string;
        secondary_code: string | null;
        expires_at_epoch_ms: number;
      }
    | undefined;
  if (!row?.secondary_code) return null;
  return {
    linkCode: row.code,
    backupCode: row.secondary_code,
    expiresAt: row.expires_at_epoch_ms,
  };
}

// Unambiguous 6-digit numeric code kept for contract compatibility (watch + web input).
function newPairingCode(): string {
  return String(randomInt(100_000, 1_000_000));
}

function deriveSecondaryCode(primaryCode: string, deviceId: string): string {
  const hash = hmacWithSecret("pairing-secondary", `${primaryCode}:${deviceId}`);
  const n = (parseInt(hash.slice(0, 8), 16) % 900_000) + 100_000;
  return String(n);
}

function newCrewMemberId(): string {
  return `CREW-${randomInt(100_000, 999_999)}`;
}

export function cleanupExpired(): void {
  const db = getDb();
  const now = Date.now();
  db.prepare(`DELETE FROM pairing_codes WHERE expires_at_epoch_ms < ?`).run(
    now - 60 * 60 * 1000,
  );
  db.prepare(`DELETE FROM device_token_pending WHERE created_at_epoch_ms < ?`).run(
    now - PENDING_TOKEN_TTL_MS,
  );
}

export function createPairingCode(deviceId: string) {
  const db = getDb();
  return db.transaction(() => {
    const now = Date.now();
    const expiresAt = now + PAIRING_TTL_MS;
    cleanupExpired();
    db.prepare(`DELETE FROM pairing_codes WHERE device_id = ?`).run(deviceId);
    const insert = db.prepare(
      `INSERT INTO pairing_codes
         (code, device_id, secondary_code, expires_at_epoch_ms, claimed_by_user_id, created_at_epoch_ms)
       VALUES (?, ?, ?, ?, NULL, ?)`,
    );
    for (let i = 0; i < 20; i++) {
      const code = newPairingCode();
      const secondaryCode = deriveSecondaryCode(code, deviceId);
      try {
        insert.run(code, deviceId, secondaryCode, expiresAt, now);
        return { code, secondaryCode, expiresAt, ttlSeconds: PAIRING_TTL_MS / 1000 };
      } catch (e) {
        if ((e as { code?: string }).code?.startsWith("SQLITE_CONSTRAINT")) continue;
        throw e;
      }
    }
    throw new Error("PAIRING_CODE_UNAVAILABLE");
  })();
}

/**
 * Public (unauthenticated) status. Never exposes pairing codes; the device token is
 * delivered exactly once and deleted on read (5 min TTL, stored AES-GCM encrypted).
 */
export type PairingStatus =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "paired"; crewMemberId: string; deviceToken?: string };

export function getPairingStatus(deviceId: string): PairingStatus {
  const db = getDb();
  return db.transaction((): PairingStatus => {
    const now = Date.now();
    const device = db
      .prepare(
        `SELECT crew_member_id FROM devices
         WHERE device_id = ? AND revoked_at_epoch_ms IS NULL`,
      )
      .get(deviceId) as { crew_member_id: string } | undefined;
    if (device) {
      const pending = db
        .prepare(
          `SELECT token_enc, created_at_epoch_ms FROM device_token_pending WHERE device_id = ?`,
        )
        .get(deviceId) as { token_enc: string; created_at_epoch_ms: number } | undefined;
      if (pending) {
        db.prepare(`DELETE FROM device_token_pending WHERE device_id = ?`).run(deviceId);
        const token =
          now - pending.created_at_epoch_ms <= PENDING_TOKEN_TTL_MS
            ? decryptSecret(pending.token_enc)
            : null;
        if (token) {
          return { status: "paired", crewMemberId: device.crew_member_id, deviceToken: token };
        }
      }
      // Already paired; a newer unclaimed code means a re-link is in progress.
      const open = db
        .prepare(
          `SELECT 1 FROM pairing_codes
           WHERE device_id = ? AND claimed_by_user_id IS NULL AND expires_at_epoch_ms >= ?`,
        )
        .get(deviceId, now);
      return open
        ? { status: "pending" }
        : { status: "paired", crewMemberId: device.crew_member_id };
    }
    const row = db
      .prepare(
        `SELECT expires_at_epoch_ms FROM pairing_codes
         WHERE device_id = ? ORDER BY expires_at_epoch_ms DESC LIMIT 1`,
      )
      .get(deviceId) as { expires_at_epoch_ms: number } | undefined;
    if (!row || row.expires_at_epoch_ms < now) return { status: "expired" };
    return { status: "pending" };
  })();
}

// ---- claim failure tracking (per user, in memory) ----
const claimFailures = new Map<string, { count: number; first: number; lockedUntil: number }>();

export function claimLockedFor(userId: string): number {
  const f = claimFailures.get(userId);
  if (!f) return 0;
  const now = Date.now();
  if (f.lockedUntil > now) return f.lockedUntil - now;
  if (now - f.first > CLAIM_FAIL_WINDOW_MS) claimFailures.delete(userId);
  return 0;
}

function recordClaimFailure(userId: string): void {
  const now = Date.now();
  const f = claimFailures.get(userId);
  if (!f || now - f.first > CLAIM_FAIL_WINDOW_MS) {
    claimFailures.set(userId, { count: 1, first: now, lockedUntil: 0 });
    return;
  }
  f.count += 1;
  if (f.count >= MAX_CLAIM_FAILURES) f.lockedUntil = now + CLAIM_LOCK_MS;
}

function normalizeSixDigitCode(code: string): string {
  if (typeof code !== "string" || code.length > 16) throw new Error("CODE_NOT_FOUND");
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== 6) throw new Error("CODE_NOT_FOUND");
  return normalized;
}

export function claimPairingCode(code: string, userId: string) {
  if (claimLockedFor(userId) > 0) throw new Error("CLAIM_LOCKED");
  try {
    const result = claimTx(code, userId);
    claimFailures.delete(userId);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "CODE_NOT_FOUND" || msg === "CODE_EXPIRED") recordClaimFailure(userId);
    throw e;
  }
}

function claimTx(code: string, userId: string) {
  const db = getDb();
  const normalized = normalizeSixDigitCode(code);
  return db.transaction(() => {
    const now = Date.now();
    const row = db
      .prepare(
        `SELECT code, device_id, expires_at_epoch_ms, created_at_epoch_ms
         FROM pairing_codes WHERE code = ?`,
      )
      .get(normalized) as
      | {
          code: string;
          device_id: string;
          expires_at_epoch_ms: number;
          created_at_epoch_ms: number | null;
        }
      | undefined;
    if (!row) throw new Error("CODE_NOT_FOUND");
    if (row.expires_at_epoch_ms < now) throw new Error("CODE_EXPIRED");

    const existing = db
      .prepare(
        `SELECT user_id, crew_member_id, paired_at_epoch_ms, revoked_at_epoch_ms
         FROM devices WHERE device_id = ?`,
      )
      .get(row.device_id) as
      | {
          user_id: string;
          crew_member_id: string;
          paired_at_epoch_ms: number;
          revoked_at_epoch_ms: number | null;
        }
      | undefined;

    const active = existing && existing.revoked_at_epoch_ms == null ? existing : undefined;
    const codeCreatedAt = row.created_at_epoch_ms ?? row.expires_at_epoch_ms - PAIRING_TTL_MS;
    if (
      active &&
      active.user_id !== userId &&
      codeCreatedAt <= active.paired_at_epoch_ms
    ) {
      // Paired to someone else, and the watch has not issued a fresh code since.
      throw new Error("DEVICE_ALREADY_PAIRED");
    }

    const upd = db
      .prepare(
        `UPDATE pairing_codes SET claimed_by_user_id = ?
         WHERE code = ? AND claimed_by_user_id IS NULL AND expires_at_epoch_ms >= ?`,
      )
      .run(userId, normalized, now);
    if (upd.changes !== 1) throw new Error("CODE_ALREADY_USED");

    const tokenPlain = newDeviceToken();
    const tokenHash = hashDeviceToken(tokenPlain);
    let crewMemberId: string;
    // Same owner keeps history; a new owner (or a revoked device) gets a fresh crew id.
    if (existing && (existing.user_id === userId && existing.revoked_at_epoch_ms == null)) {
      crewMemberId = existing.crew_member_id;
      db.prepare(
        `UPDATE devices SET token_hash = ?, paired_at_epoch_ms = ? WHERE device_id = ?`,
      ).run(tokenHash, now, row.device_id);
    } else {
      crewMemberId = insertOrReplaceDevice(row.device_id, userId, tokenHash, now, Boolean(existing));
    }

    db.prepare(
      `INSERT INTO device_token_pending (device_id, token_enc, created_at_epoch_ms)
       VALUES (?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET token_enc = excluded.token_enc,
         created_at_epoch_ms = excluded.created_at_epoch_ms`,
    ).run(row.device_id, encryptSecret(tokenPlain), now);

    return {
      crewMemberId,
      deviceId: row.device_id,
      relinked: Boolean(active && active.user_id === userId),
    };
  })();
}

function insertOrReplaceDevice(
  deviceId: string,
  userId: string,
  tokenHash: string,
  now: number,
  exists: boolean,
): string {
  const db = getDb();
  for (let i = 0; i < 20; i++) {
    const crewMemberId = newCrewMemberId();
    try {
      if (exists) {
        db.prepare(
          `UPDATE devices SET user_id = ?, crew_member_id = ?, token_hash = ?,
             paired_at_epoch_ms = ?, revoked_at_epoch_ms = NULL WHERE device_id = ?`,
        ).run(userId, crewMemberId, tokenHash, now, deviceId);
      } else {
        db.prepare(
          `INSERT INTO devices (device_id, user_id, crew_member_id, token_hash, paired_at_epoch_ms)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(deviceId, userId, crewMemberId, tokenHash, now);
      }
      return crewMemberId;
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (
        err.code === "SQLITE_CONSTRAINT_UNIQUE" &&
        err.message?.includes("crew_member_id")
      ) {
        continue;
      }
      throw e;
    }
  }
  throw new Error("CREW_ID_UNAVAILABLE");
}

/** Revokes the device token (owner only). Returns false if not found / not owned. */
export function revokeDevice(deviceId: string, userId: string): boolean {
  const db = getDb();
  return db.transaction(() => {
    const r = db
      .prepare(
        `UPDATE devices SET token_hash = '', revoked_at_epoch_ms = ?
         WHERE device_id = ? AND user_id = ? AND revoked_at_epoch_ms IS NULL`,
      )
      .run(Date.now(), deviceId, userId);
    if (r.changes !== 1) return false;
    db.prepare(`DELETE FROM device_token_pending WHERE device_id = ?`).run(deviceId);
    db.prepare(`DELETE FROM pairing_codes WHERE device_id = ?`).run(deviceId);
    return true;
  })();
}

export function resolveDeviceByToken(
  token: string,
): { crewMemberId: string; deviceId: string } | null {
  const hash = hashDeviceToken(token);
  const row = getDb()
    .prepare(
      `SELECT device_id, crew_member_id FROM devices
       WHERE token_hash = ? AND revoked_at_epoch_ms IS NULL`,
    )
    .get(hash) as { device_id: string; crew_member_id: string } | undefined;
  if (!row) return null;
  return { crewMemberId: row.crew_member_id, deviceId: row.device_id };
}
