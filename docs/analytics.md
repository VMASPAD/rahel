# Analítica de sensores

Objetivo: saber qué sensores llegan de cada reloj emparejado, con qué calidad, y cuáles conviene usar o descartar.

## Piezas

- **Registro de ingesta** (`ingest_log`): una fila por lote recibido (`POST /api/telemetry/batch`): `device_id`, `crew_member_id`, `received_at`, `batch_id`, lecturas recibidas/aceptadas/duplicadas, evaluaciones, `status` (`ok`/`rechazado`), `error_code`, `error_detail`, `bytes`, `app_version`. Se escribe dentro de la transacción de ingesta. Los 400 de validación de un reloj autenticado se registran como `rechazado`. Retención 30 días y máx. 5000 filas por reloj.
- **Inventario de sensores** (`device_sensor_inventory`): lo envía el reloj a `POST /api/device/sensors` (~2 min tras arrancar la recolección y cada ~6 h). Cada sensor: `sensorKey`, `typeName` (tipo Android sin prefijo, p. ej. `heart_rate`; `hs_heart_rate`/`hs_spo2` para Health Services), vendor, `wakeUp`, resolución, `available`, `permissionGranted` (null = sin permiso requerido), `inUse` (la app registra listener), `delivering` (ha entregado algún evento desde que arrancó la recolección) y `lastEventAtEpochMs`.
- **Analítica** (`/api/analytics/*`, Bearer, 404 si el reloj no es del usuario). Agregaciones SQL con `json_extract` sobre `sensor_readings` (índice `crew_member_id, recorded_at`), una consulta por endpoint, sin N+1.

## Reglas de calidad y recomendación (`backend/src/analytics/fieldQuality.ts`)

- **Calidad**: `medido` (algún valor no nulo recibido del reloj en la ventana), `estimado` (nunca llega pero el servidor lo rellena al leer: `hrvMs`, `restingHeartRateBpm`, `sleepHoursLastNight`, `stressScore`; recuento sobre las últimas ≤3000 lecturas), `no recibido`.
- **Cobertura** = no nulos / lecturas de la ventana.
- **Recomendación** (la primera regla que aplica):
  1. Sin lecturas: `requiere sensor`.
  2. Nunca medido: solo estimado -> `usar con cautela`; campo de contexto de misión -> `candidato a descartar`; `skinTempCelsius` -> `requiere sensor` (no se estima ni se sustituye por temperatura ambiente); resto -> `requiere sensor`.
  3. Medido y constante (>= 20 muestras, min = max) -> `candidato a descartar` (típico de `missionDay`, `microgravity`, `isolationIndex`, `radiationDoseMilliSvProxy`, que la app envía como constantes).
  4. Dejó de llegar > 1 h antes de la última lectura del reloj -> `usar con cautela`.
  5. Cobertura < 20 % o < 80 % -> `usar con cautela`; >= 80 % -> `mantener`.
  Cada respuesta incluye `reasonCode` y `reason` en español.
- **Cruce sensor/campo**: `SENSOR_FEEDS` mapea tipo de sensor -> campos que alimenta. Estado del sensor: `enviando datos`, `entrega pero no se sube` (p. ej. barómetro, luz, acelerómetro: se leen pero no tienen campo en el lote), `sin permiso`, `no disponible`, `no entrega`, `no usado por la app`. `fieldsWithoutSensor` lista campos que no llegan y que ningún sensor disponible puede alimentar.
- **Muestreo real**: (n-1) / minutos activos de la ventana de 24 h, descontando huecos (> 2 min entre lecturas consecutivas, `LAG` en SQL). Nominal: 2/min.

## Frontend

Ruta `/app/analitica` (lazy), enlazada desde el encabezado del panel. Polling cada 10 s solo con la pestaña visible. Código: `frontend/src/pages/Analytics.tsx`, `frontend/src/components/analytics/`, `frontend/src/api/analytics.ts`.

## App Wear OS

`SensorCollector` guarda la hora del último evento por sensor; `SensorInventory` construye el informe (`SensorManager.getSensorList(TYPE_ALL)` + permisos `BODY_SENSORS`/`ACTIVITY_RECOGNITION` + streams de Health Services); `SyncingHealthRepository` lo envía tras sincronizar la cola, como mucho cada 6 h, con la misma política que el resto (401 -> `onAuthFailure`, red/5xx -> reintento de WorkManager). DTOs en `data/remote/SensorInventoryDtos.kt` con `@SerializedName` explícito.
