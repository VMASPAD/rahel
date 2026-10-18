import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { NextFunction, Request, Response } from "express";
import { IS_PRODUCTION } from "./auth/crypto.js";
import { initDatabase } from "./db/database.js";
import { seedIfEmpty } from "./db/seed.js";
import { analyticsRoutes } from "./routes/analyticsRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import { pairingRoutes } from "./routes/pairingRoutes.js";
import { mountStaticWeb } from "./staticWeb.js";
import { cleanupExpired } from "./store/accountStore.js";
import { purgeIngestLog } from "./store/ingestLogStore.js";

initDatabase();
seedIfEmpty();
cleanupExpired();
setInterval(cleanupExpired, 60_000).unref();
purgeIngestLog();
setInterval(purgeIngestLog, 60 * 60_000).unref();

const app = express();
const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST ?? "0.0.0.0";

// Behind Traefik/Coolify the client IP comes from X-Forwarded-For (needed for rate limits).
const trust = process.env.RAHEL_TRUST_PROXY ?? (IS_PRODUCTION ? "1" : "false");
app.set(
  "trust proxy",
  trust === "true" ? true : trust === "false" ? false : Number.isFinite(Number(trust)) ? Number(trust) : trust,
);
app.disable("x-powered-by");
app.set("etag", "strong");

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "font-src": ["'self'", "data:"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'", ...(process.env.RAHEL_CSP_CONNECT_SRC ?? "").split(/[\s,]+/).filter(Boolean)],
        "manifest-src": ["'self'"],
        "worker-src": ["'self'", "blob:"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
        ...(IS_PRODUCTION ? { "upgrade-insecure-requests": [] } : {}),
      },
    },
    frameguard: { action: "deny" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: IS_PRODUCTION ? { maxAge: 15552000, includeSubDomains: true } : false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);
app.use(compression());

const allowedOrigins = (process.env.RAHEL_CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const localhostRe = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

app.use(
  cors({
    origin(origin, cb) {
      // No Origin header: native clients (watch) and same-origin requests.
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (!IS_PRODUCTION && allowedOrigins.length === 0 && localhostRe.test(origin)) {
        return cb(null, true);
      }
      cb(null, false);
    },
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(authRoutes);
app.use(pairingRoutes);
app.use(healthRoutes);
app.use(analyticsRoutes);
mountStaticWeb(app);

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const e = err as { status?: number; type?: string };
  if (e.type === "entity.parse.failed") {
    res.status(400).json({ error: "invalid_json" });
    return;
  }
  if (e.type === "entity.too.large") {
    res.status(413).json({ error: "payload_too_large" });
    return;
  }
  console.error("[error]", err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(port, host, () => {
  console.log(`RaHel listening on http://${host}:${port}`);
});
