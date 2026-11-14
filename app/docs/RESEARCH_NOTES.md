# Notas de investigación (web)

## Hallazgos clave para el hackathon

1. **Sueño:** En ISS los astronautas duermen en promedio ~6 h (menos que las ~8 h de NASA-STD-3001). Sueño &lt; 6 h se asocia con peor vigilancia, más estrés y mayor carga de trabajo ([Sleep Evidence Report](https://humanresearchroadmap.nasa.gov/Evidence/reports/Sleep.pdf), [PMC8919197](https://pmc.ncbi.nlm.nih.gov/articles/PMC8919197/)). RaHel marca **WATCH/ELEVATED** cuando el SEED reporta &lt; 6 h y estrés alto.

2. **Hueso:** Sin gravedad, la densidad mineral ósea puede caer ~**1–1.5% por mes** ([Human Body in Space](https://www.nasa.gov/humans-in-space/the-human-body-in-space/)). El reloj no mide DMO; usamos **pasos/actividad baja** como proxy de carga mecánica insuficiente y recomendamos resistencia (ARED).

3. **Cardiovascular:** Microgravedad altera circulación y condición física; el HRP integra riesgo cardiovascular con estrés, sueño, ejercicio y radiación ([Cardio EB 2022](https://humanresearchroadmap.nasa.gov/evidence/reports/Cardio%20Risk%20EB%202022%20FINAL_4-3-2023.pdf)). RaHel vigila **FC reposo elevada** y tendencia al alza en historial SEED.

4. **Inmunidad:** Función inmune alterada en vuelo; reactivación viral y síntomas alérgicos documentados ([Immune EB 2021](https://humanresearchroadmap.nasa.gov/Evidence/reports/IMMUNE%20EB%20Update%202021%20v02%20FINAL_6-15-22.pdf)). Sin laboratorio a bordo, combinamos **fatiga autoinformada + sueño + estrés + HRV baja** como proxy de vulnerabilidad.

5. **Conductual:** Aislamiento, sobrecarga y desalineación circadiana son riesgos HRP explícitos ([hrp/risks](https://www.nasa.gov/hrp/risks/)). `isolationIndex` en SEED modela confinamiento para la demo.

## Limitaciones del prototipo

- Umbrales de wearable (HRV, SpO₂) **no están calibrados** para población astronauta.
- `radiationDoseMilliSvProxy` es simulado; la dosimetría real es sistema de nave.
- Las reglas son **heurísticas** para demostrar flujo “detectar → explicar → actuar”.

## Siguiente iteración sugerida

- Ingesta Health Connect / Samsung Health.
- Reglas configurables desde JSON firmado por médico de vuelo.
- Sincronización con checklist NASA-STD-3001 (sueño, trabajo/descanso).
