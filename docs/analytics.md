# Analítica de sensores

Objetivo: saber qué sensores llegan de cada reloj emparejado, con qué calidad, y cuáles conviene usar o descartar.

## Piezas

- **Registro de ingesta** (`ingest_log`): una fila por lote recibido (`POST /api/telemetry/batch`): `device_id`, `crew_member_id`, `received_at`, `batch_id`, lecturas recibidas/aceptadas/duplicadas, evaluaciones, `status` (`ok`/`rechazado`), `error_code`, `error_detail`, `bytes`, `app_version`. Se escribe dentro de la transacción de ingesta. Los 400 de validación de un reloj autenticado se registran como `rechazado`. Retención 30 días y máx. 5000 filas por reloj.
- **Inventario de sensores** (`device_sensor_inventory`): lo envía el reloj a `POST /api/device/sensors` (~2 min tras arrancar la recolección y cada ~6 h). Cada sensor: `sensorKey`, `typeName` (tipo Android sin prefijo, p. ej. `heart_rate`; `hs_heart_rate`/`hs_spo2` para Health Services), vendor, `wakeUp`, resolución, `available`, `permissionGranted` (null = sin permiso requerido), `inUse` (la app registra listener), `delivering` (ha entregado algún evento desde que arrancó la recolección) y `lastEventAtEpochMs`.
- **Analítica** (`/api/analytics/*`, Bearer, 404 si el reloj no es del usuario). Agregaciones SQL con `json_extract` sobre `sensor_readings` (índice `crew_member_id, recorded_at`), una consulta por endpoint, sin N+1.

## Reglas de calidad y recomendación (`backend/src/analytics/fieldQuality.ts`)

- **Calidad**: `medido` (algún valor no nulo recibido del reloj en la ventana), `estimado` (nunca llega pero el servidor lo rellena al leer: `hrvMs`, `restingHeartRateBpm`, `sleepHoursLastNight`, `stressScore`; recuento sobre la serie de estimación: últimas 24 h remuestreadas a 30 s, ≤2881 filas), `no recibido`.
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


## Escala a 1 Hz (86 400 lecturas/día/reloj)

- `nominalSamplesPerMinute` = `NOMINAL_APP_SAMPLES_PER_MINUTE` = 60 (cadencia real de la app, distinta de `SAMPLE_INTERVAL_MS` = 30 s, que es solo la cadencia del remuestreo de estimación). `samplesPerMinute` es la tasa real sin huecos; el umbral de hueco es `GAP_THRESHOLD_MS` = 120 s.
- `/devices`: 3 consultas agrupadas para todos los relojes; la ventana de 24 h usa `LAG()` sobre ~86k filas por reloj y el total histórico es un `COUNT/MIN/MAX` sobre el índice (cubre hasta 30 días de retención, ~2,6 M filas/reloj: lineal pero solo índice).
- `/fields` y `/sensors`: ventana por defecto **24 h** (antes 168 h); `hours` 1–720. Una agregación con `json_extract`; para acotar el coste agrega como máximo ~`FIELDS_MAX_ROWS` = 50 000 filas: si la ventana tiene más, se muestrea en SQL tomando la última lectura de cada cubo de `ceil(horas*3600/50000)` s (24 h => 2 s, 168 h => 13 s, 720 h => 52 s), recorriendo solo el índice. La respuesta añade `totalReadings` (real), `sampledReadings` y `sampleBucketSeconds`; cobertura, min/max/media/σ y "visto por última vez" salen de la muestra. `estimationWindowReadings` cuenta filas de la serie remuestreada a 30 s.
- `/timeline`: agrega por cubo sobre el índice (hasta 168 h); medido ~15-25 ms con 170-300k filas.
- Medido (300k filas, 1 reloj): `/devices` ~90 ms, `/fields` 24 h ~300 ms (con tope 100k filas eran ~515 ms), 168 h ~140 ms, 720 h ~80 ms.
