# Estimación de métricas en el backend

El reloj solo envía FC, SpO2 (si existe) y pasos del día (1 lectura por segundo desde la v1 Hz de la app; antes ~1 cada 30 s). `restingHeartRateBpm`, `hrvMs`, `sleepHoursLastNight`, `stressScore` y `skinTempCelsius` llegan `null`. El backend estima las cuatro primeras **al leer** (`/api/crew/:id/latest` y `/readings`); la BD conserva los datos crudos (null). Código: `backend/src/estimation/`.

**Son estimaciones de apoyo, no mediciones clínicas.** `confidence` nunca es `high`.

## Contrato

Cada lectura puede incluir `estimates?: { hrvMs?, restingHeartRateBpm?, sleepHoursLastNight?, stressScore? }` con `Est = { method, confidence: 'low'|'medium', sampleCount }`. El valor va en el campo numérico de la lectura. Solo se rellenan campos que vengan `null`; un valor medido nunca se reemplaza ni se marca. Sin datos suficientes el campo sigue `null` y no hay entrada en `estimates`.

## Muestra "en reposo"

Muestra con FC válida (30-220) y `stepsToday` conocido que no ha crecido en los 60 s previos (un descenso por reset de medianoche cuenta como no crecer). Si los pasos son `null` no se afirma reposo y no se estima nada.

## Métodos (constantes en `constants.ts`)

| Campo | Método (`method`) | Fórmula / reglas | Mínimos | Confianza |
|---|---|---|---|---|
| restingHeartRateBpm | `hr-p10-still-24h` | Percentil 10 de FC de muestras en reposo, ventana 24 h | >= 30 muestras y >= 1 h de cobertura | low |
| hrvMs | `hrv-proxy-hr-dispersion` | `base = exp(ln70 - 0.025*(FCrep-50))`; `disp` = RMS de diferencias sucesivas de FC (muestras en reposo separadas <= 60 s); `factor = clamp((disp/1.5)^0.25, 0.7, 1.3)`; `hrv = clamp(base*factor, 10, 120)` ms | >= 40 muestras en reposo y FC en reposo | low siempre |
| sleepHoursLastNight | `sleep-block-low-hr-no-steps` | Bloque continuo más largo (24 h) con FC <= reposo*1.10 y sin pasos nuevos. Huecos sin muestras < 10 min se toleran; >= 10 min cortan (reloj fuera de la muñeca). Rachas no cualificantes < 3 min se toleran. Horas = (fin - inicio)/1 h | bloque >= 2 h | medium si muestras > 80 % de las esperadas, si no low |
| stressScore | `stress-hr-elevation-10m` / `stress-hr-elevation-hrv-10m` | `hrPart = clamp(((FCmedia10min - rep)/rep)/0.35, 0, 1)*100`; `hrvPart = clamp((60-hrv)/50, 0, 1)*100`; `score = 0.7*hrPart + 0.3*hrvPart` (solo `hrPart` si no hay HRV) | FC en reposo y >= 5 muestras en reposo en 10 min | medium con >= 15 muestras, si no low |

Límites honestos: el HRV no se mide (no hay intervalos RR); es un proxy a partir de la relación inversa FC-HRV y la variabilidad de FC a 30 s, y el estrés lo reutiliza, por lo que ambos están correlacionados. El sueño no distingue sueño de reposo despierto quieto. El percentil 10 de FC puede sobreestimar el reposo real si el reloj lleva poco puesto.

## skinTempCelsius: no se estima

No hay sensor de temperatura en el reloj ni un modelo físico defendible que la derive de FC y pasos; cualquier número sería inventado. Queda `null`.

## Rendimiento y ventanas

Los umbrales (mínimos de muestras, dispersión HRV, huecos de pareja) están calibrados para muestras cada 30 s, así que con 1 Hz (86 400 filas/día/reloj) el módulo trabaja sobre una **serie remuestreada a `SAMPLE_INTERVAL_MS` = 30 s** de las últimas `ANALYSIS_WINDOW_MS` = 24 h: una sola consulta SQL agrupa por cubo (`recorded_at_epoch_ms / 30000`), toma la **última lectura de cada cubo** (así `stepsToday` es el último valor y la dispersión de FC sigue siendo la de una muestra instantánea) y devuelve como máximo 2881 filas (`MAX_WINDOW_ROWS`). El subselect solo recorre el índice único `(crew_member_id, recorded_at_epoch_ms)` y luego se hace un acceso por fila-cubo. Sin N+1.

`/latest` estima sobre esa ventana de 24 h que termina en la última lectura. `/readings` calcula estimados en "anclas" **por tiempo** (cada `ANCHOR_INTERVAL_MS` = 10 min de datos, más la lectura más reciente), cada una con su propia ventana de 24 h, y los objetivos intermedios heredan el de la ancla previa (nunca usan datos futuros). Los objetivos pueden ser lecturas crudas a 1 Hz (no hace falta que estén en la ventana remuestreada) o cubos (`bucketSeconds`); un objetivo anterior al inicio de la ventana de 24 h no recibe estimación. Lecturas con menos de 1 h de histórico previo no tendrán estimación de reposo/HRV/sueño/estrés.

`/readings?limit&bucketSeconds`: `limit` 1..1000 (por defecto 100); sin `bucketSeconds` devuelve filas crudas (comportamiento previo); con `bucketSeconds` (entero 1..3600, si no `400 invalid_query`) devuelve la última lectura de cada cubo, para gráficos (la web pide `limit=300&bucketSeconds=30`, ~2,5 h). Con `bucketSeconds=30` se reutiliza la misma consulta de la ventana (1 consulta); en otros casos hay una segunda consulta acotada a `(limit+1)*bucket` ms.
