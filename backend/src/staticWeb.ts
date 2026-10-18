import type { Express, Response } from "express";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";

const API_PREFIXES = ["/api", "/profile", "/telemetry"];

/** Rutas válidas del SPA: /, /app y /app/* (con o sin barra final). */
function isSpaRoute(p: string): boolean {
  return p === "/" || p === "/app" || p === "/app/" || p.startsWith("/app/");
}

const MIME: Record<string, string> = {
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
};

export function mountStaticWeb(app: Express): void {
  const root = process.env.STATIC_WEB_ROOT;
  if (!root || !existsSync(root)) {
    return;
  }
  const indexHtml = path.resolve(root, "index.html");

  const sendIndex = (res: Response, status: number, noindex: boolean) => {
    res.status(status);
    res.set("Cache-Control", "no-cache");
    if (noindex) res.set("X-Robots-Tag", "noindex, nofollow");
    res.sendFile(indexHtml);
  };

  app.use(
    express.static(root, {
      index: false,
      etag: true,
      lastModified: true,
      // /assets/* lleva hash en el nombre: inmutable.
      setHeaders(res, filePath) {
        const ext = path.extname(filePath).toLowerCase();
        if (MIME[ext]) res.setHeader("Content-Type", MIME[ext]);
        const rel = path.relative(root, filePath).split(path.sep).join("/");
        if (rel.startsWith("assets/")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (rel === "index.html") {
          res.setHeader("Cache-Control", "no-cache");
        } else {
          res.setHeader("Cache-Control", "public, max-age=86400");
        }
      },
    }),
  );

  app.get("*", (req, res, next) => {
    if (API_PREFIXES.some((p) => req.path === p || req.path.startsWith(`${p}/`))) {
      next();
      return;
    }
    // Un asset/archivo inexistente nunca debe caer en el HTML con 200.
    if (isSpaRoute(req.path)) {
      sendIndex(res, 200, req.path.startsWith("/app"));
      return;
    }
    if (path.extname(req.path)) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    sendIndex(res, 404, true);
  });
}
