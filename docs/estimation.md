# Estimación de métricas en el backend

El reloj solo envía FC, SpO2 (si existe) y pasos del día (~1 lectura cada 30 s). `restingHeartRateBpm`, `hrvMs`, `sleepHoursLastNight`, `stressScore` y `skinTempCelsius` llegan `null`. El backend estima las cuatro primeras **al leer** (`/api/crew/:id/latest` y `/readings`); la BD conserva los datos crudos (null). Código: `backend/src/estimation/`.

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

Una sola consulta por request (últimas 3000 lecturas, ~25 h a 30 s), sin N+1. `/latest` estima sobre la ventana de 24 h que termina en la última lectura. `/readings` calcula estimados en "anclas" cada 20 lecturas (~10 min), cada una con su propia ventana de 24 h, y las lecturas intermedias heredan el de la ancla previa (nunca usan datos futuros); la lectura más reciente siempre se calcula exacta. Coste: unas 25 ventanas como máximo para 500 lecturas (pocos ms). Lecturas con menos de 1 h de histórico previo no tendrán estimación de reposo/HRV/sueño/estrés.
