import { z } from "zod";

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
export const MAX_BATCH_ITEMS = 500;

const epochMs = z
  .number()
  .int()
  .positive()
  .refine((v) => v <= Date.now() + FUTURE_TOLERANCE_MS, {
    message: "timestamp in the future",
  });

const str = (max: number) => z.string().max(max);
const range = (min: number, max: number) => z.number().finite().min(min).max(max).nullish();

const symptom = z.object({
  id: str(64),
  label: str(200),
  severity: str(32),
});

const action = z.object({
  id: str(64),
  title: str(200),
  detail: str(2000),
});

const condition = z.object({
  conditionId: str(64),
  title: str(200),
  category: str(64),
  summary: str(2000),
  confidence: z.number().finite().min(0).max(1),
  severity: str(32),
  symptoms: z.array(symptom).max(50).default([]),
  recommendedActions: z.array(action).max(50).default([]),
});

/** Vitals are nullable: the watch sends null when it has no data (never coerced to 0). */
export const readingSchema = z.object({
  recordedAtEpochMs: epochMs,
  heartRateBpm: range(20, 250),
  restingHeartRateBpm: range(20, 250),
  hrvMs: range(0, 500),
  spO2Percent: range(50, 100),
  stepsToday: range(0, 200_000),
  sleepHoursLastNight: range(0, 24),
  skinTempCelsius: range(25, 45),
  stressScore: range(0, 100),
  missionDay: range(0, 20_000),
  microgravity: z.boolean().nullish(),
  isolationIndex: range(0, 100),
  radiationDoseMilliSvProxy: range(0, 100_000),
  selfReportedSymptoms: z.array(symptom).max(50).default([]),
});

export const assessmentSchema = z.object({
  assessedAtEpochMs: epochMs,
  overallLevel: str(32),
  headline: str(500),
  disclaimer: str(2000),
  conditions: z.array(condition).max(50).default([]),
});

export const batchSchema = z.object({
  clientBatchId: z.string().min(1).max(128),
  appVersion: z.string().max(40).nullish(),
  readings: z.array(readingSchema).max(MAX_BATCH_ITEMS).default([]),
  assessments: z.array(assessmentSchema).max(MAX_BATCH_ITEMS).default([]),
});

export const profileSchema = z.object({
  sexoBiologico: range(0, 10),
  imc: range(5, 100),
  pesoKg: range(1, 500),
  alturaM: range(0.3, 2.8),
  snapshotAtEpochMs: epochMs,
});

export const registerSchema = z.object({
  email: z.string().trim().max(254).email(),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().max(80).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().max(254),
  password: z.string().min(1).max(200),
});

export const DEVICE_ID_RE = /^[A-Za-z0-9_-]{16,128}$/;
export const deviceIdSchema = z.string().regex(DEVICE_ID_RE);

export function issuesOf(err: z.ZodError): { path: string; message: string }[] {
  return err.issues.slice(0, 20).map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}

const MAX_SENSORS = 200;

/** POST /api/device/sensors: sensors detected by SensorManager + their runtime state. */
export const sensorInventorySchema = z.object({
  appVersion: z.string().max(40).nullish(),
  sensors: z
    .array(
      z.object({
        sensorKey: str(160).min(1),
        typeName: str(80).min(1),
        typeId: z.number().int().min(-1).max(100_000).nullish(),
        name: str(160).nullish(),
        vendor: str(120).nullish(),
        wakeUp: z.boolean().nullish(),
        resolution: z.number().finite().nullish(),
        available: z.boolean(),
        permissionGranted: z.boolean().nullish(),
        inUse: z.boolean().nullish(),
        delivering: z.boolean(),
        lastEventAtEpochMs: z.number().int().positive().nullish(),
      }),
    )
    .max(MAX_SENSORS),
});
