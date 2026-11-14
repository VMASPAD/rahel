/**
 * Port of backend/src/analytics/fieldQuality.ts (pure rules: coverage, quality, recommendation
 * and the English reason). Copied so the demo reproduces the exact same wording.
 */

export const FIELD_KEYS = [
  "heartRateBpm",
  "restingHeartRateBpm",
  "hrvMs",
  "spO2Percent",
  "stepsToday",
  "sleepHoursLastNight",
  "skinTempCelsius",
  "stressScore",
  "missionDay",
  "microgravity",
  "isolationIndex",
  "radiationDoseMilliSvProxy",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

/** Fields the backend can fill at read time (see estimation/). */
export const ESTIMABLE_FIELDS: ReadonlySet<string> = new Set([
  "hrvMs",
  "restingHeartRateBpm",
  "sleepHoursLastNight",
  "stressScore",
]);

/** Mission context sent as constants by the app, not measured by a sensor. */
export const CONTEXT_FIELDS: ReadonlySet<string> = new Set([
  "missionDay",
  "microgravity",
  "isolationIndex",
  "radiationDoseMilliSvProxy",
]);

export const FIELD_LABELS: Record<FieldKey, string> = {
  heartRateBpm: "Heart rate",
  restingHeartRateBpm: "Resting heart rate",
  hrvMs: "Heart rate variability (HRV)",
  spO2Percent: "SpO₂",
  stepsToday: "Steps today",
  sleepHoursLastNight: "Sleep (h)",
  skinTempCelsius: "Skin temperature",
  stressScore: "Stress",
  missionDay: "Mission day",
  microgravity: "Microgravity",
  isolationIndex: "Isolation index",
  radiationDoseMilliSvProxy: "Radiation dose (proxy)",
};

export type Quality = "medido" | "estimado" | "no recibido";
export type Recommendation =
  | "mantener"
  | "usar con cautela"
  | "candidato a descartar"
  | "requiere sensor";

export const LOW_COVERAGE = 0.2;
export const HIGH_COVERAGE = 0.8;
/** Minimum non-null samples before a zero-variance field is judged constant. */
export const CONSTANT_MIN_SAMPLES = 20;
/** A field not seen for this long before the device's last reading is "stale". */
export const STALE_MS = 60 * 60 * 1000;

export type FieldInput = {
  key: string;
  /** Readings in the analysed window. */
  total: number;
  /** Readings in which the field was received (non-null raw value). */
  nonNull: number;
  min: number | null;
  max: number | null;
  std: number | null;
  lastSeenMs: number | null;
  /** Latest reading time of the device (reference for staleness). */
  deviceLastMs: number | null;
  /** Read-time estimates counted in the estimation window (estimable fields only). */
  estimatedCount: number;
};

export type FieldAssessment = {
  coveragePct: number;
  quality: Quality;
  recommendation: Recommendation;
  reasonCode: string;
  reason: string;
};

export function coveragePct(nonNull: number, total: number): number {
  if (total <= 0 || nonNull <= 0) return 0;
  return Math.round(Math.min(1, nonNull / total) * 1000) / 10;
}

function ago(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

export function assessField(f: FieldInput): FieldAssessment {
  const cov = coveragePct(f.nonNull, f.total);
  const fmt = (v: number | null) => (v === null ? "?" : String(Math.round(v * 100) / 100));

  if (f.total === 0) {
    return {
      coveragePct: 0,
      quality: "no recibido",
      recommendation: "requiere sensor",
      reasonCode: "no_readings",
      reason: "No readings in the analyzed window yet, so this field will be rated once data arrives.",
    };
  }

  if (f.nonNull === 0) {
    if (f.estimatedCount > 0) {
      return {
        coveragePct: 0,
        quality: "estimado",
        recommendation: "usar con cautela",
        reasonCode: "estimated_only",
        reason:
          "RaHel calculates this from your heart rate and steps (low to medium confidence). A great trend indicator rather than a direct measurement.",
      };
    }
    if (CONTEXT_FIELDS.has(f.key)) {
      return {
        coveragePct: 0,
        quality: "no recibido",
        recommendation: "candidato a descartar",
        reasonCode: "context_missing",
        reason: "Mission context field that is not arriving; it does not come from any sensor.",
      };
    }
    if (f.key === "skinTempCelsius") {
      return {
        coveragePct: 0,
        quality: "no recibido",
        recommendation: "requiere sensor",
        reasonCode: "needs_sensor_no_estimate",
        reason:
          "Needs a skin temperature sensor; ambient temperature is not a substitute and the server does not estimate it.",
      };
    }
    return {
      coveragePct: 0,
      quality: "no recibido",
      recommendation: "requiere sensor",
      reasonCode: "needs_sensor",
      reason: ESTIMABLE_FIELDS.has(f.key)
        ? "RaHel needs a little more heart rate and step history to calculate this; it appears as soon as there is enough."
        : "This value is not part of the readings RaHel currently works with.",
    };
  }

  // nonNull > 0: measured.
  const base = { coveragePct: cov, quality: "medido" as const };
  if (
    f.nonNull >= CONSTANT_MIN_SAMPLES &&
    f.min !== null &&
    f.max !== null &&
    f.min === f.max
  ) {
    return {
      ...base,
      recommendation: "candidato a descartar",
      reasonCode: "constant_value",
      reason: `Constant value (${fmt(f.min)}) across ${f.nonNull} readings, so it adds no information${
        CONTEXT_FIELDS.has(f.key) ? " (fixed context value, not a sensor)" : ""
      }.`,
    };
  }
  if (
    f.lastSeenMs !== null &&
    f.deviceLastMs !== null &&
    f.deviceLastMs - f.lastSeenMs > STALE_MS
  ) {
    return {
      ...base,
      recommendation: "usar con cautela",
      reasonCode: "stale",
      reason: `Stopped arriving ${ago(f.deviceLastMs - f.lastSeenMs)} before the watch's latest reading.`,
    };
  }
  if (cov < LOW_COVERAGE * 100) {
    return {
      ...base,
      recommendation: "usar con cautela",
      reasonCode: "low_coverage",
      reason: `Low coverage (${cov}%): it arrives in only a few readings${
        f.estimatedCount > 0 ? "; the rest is estimated on the server" : ""
      }.`,
    };
  }
  if (cov < HIGH_COVERAGE * 100) {
    return {
      ...base,
      recommendation: "usar con cautela",
      reasonCode: "partial_coverage",
      reason: `Partial coverage (${cov}%): there are gaps (for example, the watch was off the wrist or a permission came and went).`,
    };
  }
  return {
    ...base,
    recommendation: "mantener",
    reasonCode: "good",
    reason: `Measured by the watch with high coverage (${cov}%) and real variation.`,
  };
}

// ---- Sensor <-> field cross ------------------------------------------------

/** Which wire fields each detected sensor type (Android stringType suffix / virtual key) can feed. */
export const SENSOR_FEEDS: Record<string, FieldKey[]> = {
  heart_rate: ["heartRateBpm", "restingHeartRateBpm", "hrvMs", "stressScore", "sleepHoursLastNight"],
  hs_heart_rate: ["heartRateBpm", "restingHeartRateBpm", "hrvMs", "stressScore", "sleepHoursLastNight"],
  hs_spo2: ["spO2Percent"],
  step_counter: ["stepsToday"],
  step_detector: ["stepsToday"],
};

/** Detected sensors the app reads on-device but does not upload as a dedicated field. */
export const SENSOR_NOT_UPLOADED: ReadonlySet<string> = new Set([
  "accelerometer",
  "gyroscope",
  "pressure",
  "light",
  "ambient_temperature",
  "low_latency_offbody_detect",
  "significant_motion",
]);

export type SensorStatus =
  | "enviando datos"
  | "entrega pero no se sube"
  | "sin permiso"
  | "no disponible"
  | "no entrega"
  | "no usado por la app";

export function sensorStatus(
  s: { typeName: string; available: boolean; permissionGranted: boolean | null; inUse: boolean | null; delivering: boolean },
  feedsReceived: boolean,
): SensorStatus {
  if (!s.available) return "no disponible";
  if (s.permissionGranted === false) return "sin permiso";
  if (feedsReceived) return "enviando datos";
  if (s.delivering) return "entrega pero no se sube";
  if (s.inUse === false) return "no usado por la app";
  return "no entrega";
}
