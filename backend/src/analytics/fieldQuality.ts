/**
 * Pure rules for field coverage / quality / recommendation. No I/O: unit tested.
 * Every recommendation carries a human-readable reason (Spanish) and a stable reasonCode.
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
  heartRateBpm: "Frecuencia cardiaca",
  restingHeartRateBpm: "FC en reposo",
  hrvMs: "Variabilidad (HRV)",
  spO2Percent: "SpO₂",
  stepsToday: "Pasos hoy",
  sleepHoursLastNight: "Sueño (h)",
  skinTempCelsius: "Temperatura de piel",
  stressScore: "Estrés",
  missionDay: "Día de misión",
  microgravity: "Microgravedad",
  isolationIndex: "Índice de aislamiento",
  radiationDoseMilliSvProxy: "Dosis de radiación (proxy)",
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
      reason: "Aún no hay lecturas en la ventana analizada; no se puede valorar el campo.",
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
          "El reloj no lo envía; el servidor lo estima a partir de FC y pasos (confianza baja/media). Útil como tendencia, no como medición.",
      };
    }
    if (CONTEXT_FIELDS.has(f.key)) {
      return {
        coveragePct: 0,
        quality: "no recibido",
        recommendation: "candidato a descartar",
        reasonCode: "context_missing",
        reason: "Campo de contexto de misión que no llega; no procede de ningún sensor.",
      };
    }
    if (f.key === "skinTempCelsius") {
      return {
        coveragePct: 0,
        quality: "no recibido",
        recommendation: "requiere sensor",
        reasonCode: "needs_sensor_no_estimate",
        reason:
          "Requiere un sensor de temperatura de piel; la temperatura ambiente no lo sustituye y el servidor no lo estima.",
      };
    }
    return {
      coveragePct: 0,
      quality: "no recibido",
      recommendation: "requiere sensor",
      reasonCode: "needs_sensor",
      reason: ESTIMABLE_FIELDS.has(f.key)
        ? "No llega ni hay historial suficiente para estimarlo; requiere sensor o más datos de FC/pasos."
        : "El reloj no envía este dato; requiere un sensor o permiso (revisa «Sensores detectados»).",
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
      reason: `Valor constante (${fmt(f.min)}) en ${f.nonNull} lecturas: no aporta información${
        CONTEXT_FIELDS.has(f.key) ? " (dato de contexto fijo, no un sensor)" : ""
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
      reason: `Dejó de llegar hace ${ago(f.deviceLastMs - f.lastSeenMs)} respecto a la última lectura del reloj.`,
    };
  }
  if (cov < LOW_COVERAGE * 100) {
    return {
      ...base,
      recommendation: "usar con cautela",
      reasonCode: "low_coverage",
      reason: `Cobertura baja (${cov}%): llega en pocas lecturas${
        f.estimatedCount > 0 ? "; el resto se estima en el servidor" : ""
      }.`,
    };
  }
  if (cov < HIGH_COVERAGE * 100) {
    return {
      ...base,
      recommendation: "usar con cautela",
      reasonCode: "partial_coverage",
      reason: `Cobertura parcial (${cov}%): hay huecos (p. ej. sin contacto con la muñeca o sin permiso intermitente).`,
    };
  }
  return {
    ...base,
    recommendation: "mantener",
    reasonCode: "good",
    reason: `Medido por el reloj con cobertura alta (${cov}%) y variación real.`,
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
