# RaHel API

Base URL (debug emulator): `http://10.0.2.2:8080/` — mismo puerto que `PORT` del backend (default **8080**).

## Ingesta desde Wear OS (`HealthApiService`)

| Método | Ruta | Body |
|--------|------|------|
| POST | `/profile` | `UserProfileSnapshotDto` |
| POST | `/telemetry/batch` | `TelemetryBatchRequest` |

Respuesta batch: `{ acceptedReadings, acceptedAssessments }`. Idempotente por `crewMemberId` + `clientBatchId`.

## Dashboard (frontend)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado del servicio |
| GET | `/api/crew` | Lista resumida de tripulantes |
| GET | `/api/crew/:id/latest` | Perfil + última lectura + última evaluación |
| GET | `/api/crew/:id/readings?limit=20` | Historial de lecturas |
| GET | `/api/crew/:id/assessment/latest` | Última evaluación |

Tipos TypeScript: `backend/src/types/health.ts` (espejo de `HealthApiDtos.kt`).
