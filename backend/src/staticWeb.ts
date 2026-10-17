import type { Express } from "express";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";

export function mountStaticWeb(app: Express): void {
  const root = process.env.STATIC_WEB_ROOT;
  if (!root || !existsSync(root)) {
    return;
  }
  const indexHtml = path.join(root, "index.html");
  app.use(express.static(root, { index: false }));
  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path === "/profile" ||
      req.path.startsWith("/telemetry")
    ) {
      next();
      return;
    }
    res.sendFile(indexHtml);
  });
}
