import type { Quality, Recommendation, SensorStatus } from '../../api/analytics'

/**
 * The API returns Spanish codes (contract). These maps turn them into English labels;
 * an unknown code falls back to the original value.
 */
const QUALITY_LABEL: Record<string, string> = {
  medido: 'measured',
  estimado: 'estimated',
  'no recibido': 'not received',
}

const RECOMMENDATION_LABEL: Record<string, string> = {
  mantener: 'keep',
  'usar con cautela': 'use with caution',
  'candidato a descartar': 'candidate to drop',
  'requiere sensor': 'needs sensor',
}

const SENSOR_STATUS_LABEL: Record<string, string> = {
  'enviando datos': 'sending data',
  'entrega pero no se sube': 'delivering but not uploaded',
  'sin permiso': 'permission missing',
  'no disponible': 'unavailable',
  'no entrega': 'not delivering',
  'no usado por la app': 'not used by the app',
}

const INGEST_STATUS_LABEL: Record<string, string> = {
  ok: 'ok',
  rechazado: 'rejected',
}

export const qualityLabel = (q: Quality | string): string => QUALITY_LABEL[q] ?? q
export const recommendationLabel = (r: Recommendation | string): string => RECOMMENDATION_LABEL[r] ?? r
export const sensorStatusLabel = (s: SensorStatus | string): string => SENSOR_STATUS_LABEL[s] ?? s
export const ingestStatusLabel = (s: string): string => INGEST_STATUS_LABEL[s] ?? s
