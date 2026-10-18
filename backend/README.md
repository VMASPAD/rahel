# RaHel backend

API Express + TypeScript.

```bash
npm install
npm run dev
```

**SQLite:** `data/rahel.db` (override con `RAHEL_DB_PATH`). El seed de demo (`data/seed-dashboard.json`) está **desactivado** por defecto; actívalo con `RAHEL_ENABLE_SEED=true` si la base está vacía.

- Puerto **8080** por defecto (alineado con el emulador Android `10.0.2.2:8080`).
- Ver `docs/API.md` para ingesta Wear y endpoints del dashboard.

## Estimaciones (lectura)

`/api/crew/:id/latest` y `/readings` rellenan, solo en la respuesta, los campos que el reloj no envía (`restingHeartRateBpm`, `hrvMs`, `sleepHoursLastNight`, `stressScore`) a partir del historial (últimas 24 h remuestreadas a 30 s, ≤2881 filas, una consulta; la app envía 1 lectura/s) y añaden `estimates` por lectura (`method`, `confidence` low|medium, `sampleCount`). Los datos crudos en BD no se modifican; los valores medidos nunca se sustituyen; `skinTempCelsius` no se estima. Detalle y fórmulas en `../docs/estimation.md`; código en `src/estimation/`.

Tests: `npm test` (node:test vía tsx).

## Seguridad y variables de entorno

| Variable | Descripción |
|----------|-------------|
| `RAHEL_JWT_SECRET` | **Obligatoria en producción** (`NODE_ENV=production`, mín. 16 chars); sin ella el servidor no arranca. En dev usa un secreto inseguro con aviso. Firma JWT, hashea tokens de dispositivo y deriva la clave AES-GCM de tokens pendientes. |
| `RAHEL_CORS_ORIGINS` | Lista blanca separada por comas (`https://app.example.com,...`). En dev, si está vacía, se permite `localhost`/`127.0.0.1`. En prod vacía = sin CORS cross-origin. |
| `RAHEL_TRUST_PROXY` | `trust proxy` de Express para rate limiting tras Traefik/Coolify (`1` por defecto en prod, `false` en dev; acepta número, `true`/`false` o lista de subredes). |
| `RAHEL_ALLOW_LEGACY_INGEST` | `true` permite `/profile` y `/telemetry/batch` sin `X-Device-Token` usando `crewMemberId` del body. **Solo dev**, se ignora en producción. |
| `RAHEL_RETENTION_DAYS` | Días que se conservan las lecturas crudas (`sensor_readings`); por defecto **30**, `0` desactiva la purga. Se ejecuta al arrancar y cada hora, por trozos de 20 000 filas vía el índice `(crew_member_id, recorded_at_epoch_ms)`. |
| `RAHEL_TYPESAFE_API_KEY` | Clave de TypeSafe AI (Jev) para la página «Análisis». **Solo servidor.** Sin ella la API responde `analysis_not_configured`. Ver `docs/analysis.md`. |
| `RAHEL_TYPESAFE_BASE_URL`, `RAHEL_TYPESAFE_MODEL`, `RAHEL_TYPESAFE_TIMEOUT_MS` | Opcionales: `https://api.typesafe.ai`, `jev-latest`, `30000`. |
| `RAHEL_ANALYSIS_RUNS_PER_HOUR`, `RAHEL_ANALYSIS_GROUP_SIZE`, `RAHEL_ANALYSIS_CONCURRENCY` | Opcionales: 10 ejecuciones/hora/usuario, 5 preguntas por petición, 2 peticiones simultáneas. |
| `RAHEL_TYPESAFE_FAKE` | `1` usa un cliente simulado determinista (**solo fuera de producción**, para desarrollo y pruebas). |
| `RAHEL_DB_PATH`, `RAHEL_ENABLE_SEED`, `PORT`, `HOST`, `STATIC_WEB_ROOT` | Sin cambios. Los datos del seed no pertenecen a ningún usuario, por lo que no son visibles en el dashboard autenticado. |

- Lectura (`/api/crew*`): Bearer JWT; solo dispositivos propios (`devices.user_id`); si no es propio, `404 {"error":"crew not found"}`.
- Escritura (`/profile`, `/telemetry/batch`, y sus variantes `/api/...`): `X-Device-Token` obligatorio (401 `unauthorized` si falta, es inválido o está revocado). La identidad sale solo del token.
- Validación con zod: lotes <= 500 lecturas y <= 500 evaluaciones, rangos fisiológicos, timestamps <= ahora + 5 min, vitales nulables (`null` se guarda como `null`). Error: `400 {"error":"invalid_payload","details":[{path,message}]}`.
- Dedupe: `UNIQUE(crew_member_id, recorded_at_epoch_ms)` (y equivalente en evaluaciones) con `INSERT OR IGNORE`; `acceptedReadings/Assessments` cuenta solo filas nuevas. La migración elimina duplicados previos.
- Rate limiting (por IP): login 10/15 min, register 10/h, pairing/code 20/10 min, pairing/status 120/min, claim 30/15 min (429 `too_many_requests`). Además 5 fallos de claim por usuario => bloqueo 15 min (429 `claim_locked`).
- Errores siempre JSON `{ "error": "..." }` (`invalid_json`, `payload_too_large`, `not_found`, `internal_error`).

## Analítica de sensores

Registro y análisis de lo que llega de cada reloj. Detalle completo en `../docs/analytics.md`.

| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `POST /api/device/sensors` | `X-Device-Token` | Inventario de sensores detectados (SensorManager + Health Services) y su estado. Zod, máx. 200 sensores; reemplaza el inventario previo del reloj. `400 invalid_payload` si no valida. |
| `GET /api/analytics/devices` | Bearer | Resumen por reloj: primera/última lectura, última recepción, lecturas totales y 24 h, muestras/min reales (sin huecos), huecos, lotes ok/rechazados 24 h. |
| `GET /api/analytics/devices/:deviceId/fields?hours=168` | Bearer | Por campo: no nulos, cobertura %, min/max/media/σ, última vez visto, medidos vs estimados, calidad (`medido`/`estimado`/`no recibido`) y recomendación explicada (`mantener`/`usar con cautela`/`candidato a descartar`/`requiere sensor`). `hours` 1–720. |
| `GET /api/analytics/devices/:deviceId/sensors` | Bearer | Inventario detectado cruzado con los campos que realmente llegan (`status`, `feeds`, `fieldsWithoutSensor`). |
| `GET /api/analytics/devices/:deviceId/log?limit&before&status` | Bearer | Registro de lotes (`ingest_log`), más reciente primero; `before` = id (cursor, usa `nextBefore`), `status` = `ok`/`rechazado`, `limit` ≤ 200. |
| `GET /api/analytics/devices/:deviceId/timeline?hours=24` | Bearer | Cubos de lecturas/lotes (relleno con ceros para ver huecos). Extra de la UI. |

- Un `deviceId` que no es del usuario (o está revocado) responde `404 {"error":"device not found"}`.
- `ingest_log` se escribe en la misma transacción de `ingestBatch` y también registra los `400 invalid_payload` de un dispositivo autenticado (`status=rechazado`, `error_code`, `error_detail` con el primer error de zod). Lote repetido: `status=ok`, `error_code=duplicate_batch`. Retención: > 30 días o > 5000 filas por reloj se purgan al arrancar y cada hora.
- El lote de telemetría acepta `appVersion` opcional (se guarda en el log).
- Tablas nuevas (migración aditiva `CREATE ... IF NOT EXISTS`): `ingest_log`, `device_sensor_inventory`.
- Tests: `src/analytics/fieldQuality.test.ts` (cobertura, calidad, recomendaciones, cruce sensor/campo).

## Escala y retención (1 lectura/s)

- El reloj envía **1 lectura por segundo** en lotes de hasta ~300 (el servidor admite 500 lecturas + 500 evaluaciones por lote; un lote de 500+500 medido pesa ~0,4 MB, lejos del límite de 2 MB) y una evaluación cada 30 s. La deduplicación `UNIQUE(crew_member_id, recorded_at_epoch_ms)` + `INSERT OR IGNORE` sigue igual; la migración de dedupe solo corre si faltan los índices únicos (no en cada arranque).
- **Crecimiento esperado:** ~86 400 filas/día/reloj (~30-40 MB/día/reloj en SQLite con el JSON actual: ~67 MB para 306k filas medidas), es decir ~2,6 M filas y ~1 GB por reloj con 30 días de retención. Planifica disco y backups en consecuencia o baja `RAHEL_RETENTION_DAYS`.
- Lecturas: `GET /api/crew/:id/readings?limit=1..1000&bucketSeconds=1..3600` (sin `bucketSeconds`: filas crudas). Detalle en `../docs/estimation.md` y `../docs/analytics.md`.
- Las sentencias de las rutas calientes se preparan una vez (`prep()` en `src/db/database.ts`).
- Nota de entorno: con Node 24 y better-sqlite3 11.10 el recolector de basura puede abortar el proceso al finalizar `Statement` temporales (`Assertion failed: (env) != nullptr`); producción usa Node 20 (Dockerfile). Por eso se cachean sentencias y se evita `db.pragma()`/`db.transaction()` por llamada en las rutas calientes.
