import assert from "node:assert/strict";
import { test } from "node:test";
import { isNoindexRoute, isSpaRoute } from "./staticWeb.js";

test("isSpaRoute acepta /, /app y /demo con subrutas", () => {
  for (const p of ["/", "/app", "/app/", "/app/analytics", "/demo", "/demo/", "/demo/analytics", "/demo/analysis"]) {
    assert.equal(isSpaRoute(p), true, p);
  }
  for (const p of ["/application", "/demos", "/demo-x", "/otra", "/appx/y"]) {
    assert.equal(isSpaRoute(p), false, p);
  }
});

test("isNoindexRoute marca /app y /demo", () => {
  for (const p of ["/app", "/app/x", "/demo", "/demo/analysis"]) {
    assert.equal(isNoindexRoute(p), true, p);
  }
  assert.equal(isNoindexRoute("/"), false);
});
