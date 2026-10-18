import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

export const IS_PRODUCTION = process.env.NODE_ENV === "production";

function loadSecret(): string {
  const s = process.env.RAHEL_JWT_SECRET;
  if (IS_PRODUCTION) {
    if (!s || s.length < 16) {
      throw new Error(
        "RAHEL_JWT_SECRET is required in production (min 16 chars). Refusing to start.",
      );
    }
    return s;
  }
  if (!s) {
    console.warn("[auth] RAHEL_JWT_SECRET not set — using INSECURE dev secret");
    return "dev-only-insecure-secret";
  }
  return s;
}

const JWT_SECRET = loadSecret();

const PENDING_KEY = Buffer.from(
  hkdfSync("sha256", JWT_SECRET, "rahel-salt", "pending-device-token", 32),
);

/** AES-256-GCM; output = base64(iv | tag | ciphertext). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", PENDING_KEY, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

export function decryptSecret(blob: string): string | null {
  try {
    const raw = Buffer.from(blob, "base64");
    const d = createDecipheriv("aes-256-gcm", PENDING_KEY, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function hmacWithSecret(label: string, data: string): string {
  return createHmac("sha256", JWT_SECRET).update(`${label}:${data}`).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const attempt = scryptSync(password, salt, 64).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempt, "hex"));
  } catch {
    return false;
  }
}

export function hashDeviceToken(token: string): string {
  return createHmac("sha256", JWT_SECRET).update(token).digest("hex");
}

export function newDeviceToken(): string {
  return randomBytes(32).toString("hex");
}

export function signUserToken(userId: string, email: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, email, exp }),
  ).toString("base64url");
  const sig = createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export type JwtPayload = { sub: string; email: string; exp: number };

export function verifyUserToken(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  const a = Buffer.from(sig ?? "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as JwtPayload;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}
