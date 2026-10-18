import { randomUUID } from "node:crypto";
import { prep } from "../db/database.js";

export type RunStatus = "queued" | "running" | "done" | "error";

export type RunRow = {
  id: string;
  deviceId: string;
  windowHours: number;
  status: RunStatus;
  consentAt: number;
  summaryHash: string | null;
  results: unknown | null;
  error: string | null;
  createdAt: number;
  finishedAt: number | null;
};

type Raw = {
  id: string;
  device_id: string;
  window_hours: number;
  status: RunStatus;
  consent_at: number;
  summary_hash: string | null;
  results_json: string | null;
  error: string | null;
  created_at: number;
  finished_at: number | null;
};

const COLS = "id, device_id, window_hours, status, consent_at, summary_hash, results_json, error, created_at, finished_at";

function map(r: Raw): RunRow {
  return {
    id: r.id,
    deviceId: r.device_id,
    windowHours: r.window_hours,
    status: r.status,
    consentAt: r.consent_at,
    summaryHash: r.summary_hash,
    results: r.results_json ? JSON.parse(r.results_json) : null,
    error: r.error,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
  };
}

export function activeRunFor(userId: string): string | null {
  const r = prep(`SELECT id FROM analysis_runs WHERE user_id = ? AND status IN ('queued','running') LIMIT 1`).get(
    userId,
  ) as { id: string } | undefined;
  return r?.id ?? null;
}

/** Synchronous check+insert (better-sqlite3 is sync): at most one active run per user. */
export function createRun(args: {
  userId: string;
  deviceId: string;
  windowHours: number;
  summaryHash: string;
  initialResults: unknown;
  now?: number;
}): { id: string } | { activeId: string } {
  const active = activeRunFor(args.userId);
  if (active) return { activeId: active };
  const id = randomUUID();
  const now = args.now ?? Date.now();
  prep(
    `INSERT INTO analysis_runs (id, user_id, device_id, window_hours, status, consent_at, summary_hash, results_json, created_at)
     VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?)`,
  ).run(id, args.userId, args.deviceId, args.windowHours, now, args.summaryHash, JSON.stringify(args.initialResults), now);
  return { id };
}

export function updateRun(
  id: string,
  patch: { status?: RunStatus; results?: unknown; error?: string | null; finished?: boolean },
): void {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.status) (sets.push("status = ?"), vals.push(patch.status));
  if (patch.results !== undefined) (sets.push("results_json = ?"), vals.push(JSON.stringify(patch.results)));
  if (patch.error !== undefined) (sets.push("error = ?"), vals.push(patch.error));
  if (patch.finished) (sets.push("finished_at = ?"), vals.push(Date.now()));
  if (!sets.length) return;
  prep(`UPDATE analysis_runs SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
}

export function getRun(userId: string, id: string): RunRow | null {
  const r = prep(`SELECT ${COLS} FROM analysis_runs WHERE id = ? AND user_id = ?`).get(id, userId) as Raw | undefined;
  return r ? map(r) : null;
}

export function listRuns(userId: string, limit: number, before?: number): { items: Omit<RunRow, "results">[]; next: number | null } {
  const lim = Math.max(1, Math.min(50, Math.floor(limit) || 10));
  const rows = prep(
    `SELECT ${COLS} FROM analysis_runs WHERE user_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`,
  ).all(userId, before ?? Number.MAX_SAFE_INTEGER, lim + 1) as Raw[];
  const page = rows.slice(0, lim).map(map);
  return {
    items: page.map(({ results: _r, ...rest }) => rest),
    next: rows.length > lim ? page[page.length - 1].createdAt : null,
  };
}

export function deleteRun(userId: string, id: string): "deleted" | "not_found" | "active" {
  const r = getRun(userId, id);
  if (!r) return "not_found";
  if (r.status === "queued" || r.status === "running") return "active";
  prep(`DELETE FROM analysis_runs WHERE id = ? AND user_id = ?`).run(id, userId);
  return "deleted";
}

/** Startup: runs that were in flight when the process stopped can never finish. */
export function failInterruptedRuns(): number {
  return prep(
    `UPDATE analysis_runs SET status = 'error', error = 'interrupted', finished_at = ? WHERE status IN ('queued','running')`,
  ).run(Date.now()).changes;
}

/** Account/device cleanups: remove reports for a user. */
export function deleteRunsOfUser(userId: string): number {
  return prep(`DELETE FROM analysis_runs WHERE user_id = ?`).run(userId).changes;
}
