# RaHel — NASA hackathon pitch

## Problema

En misiones largas, la radiación, el aislamiento, la microgravedad y el ambiente cerrado afectan inmunidad, hueso, corazón y salud mental. Los astronautas deben detectar cambios a tiempo y actuar.

**Contexto documentado:** el [HRP de NASA](https://www.nasa.gov/hrp/risks/) identifica riesgos de inmunidad, hueso, cardiovascular, conducta y radiación; en ISS el sueño medio ronda **~6 h** y el sueño **&lt; 6 h** se asocia con más estrés y peor rendimiento (ver `docs/SOURCES.md`).

## Solución

**RaHel** es un monitor de salud para **Wear OS** (p. ej. Samsung Galaxy Watch) que:

1. Agrega indicadores corporales (FC, HRV, SpO₂, sueño, actividad, estrés).
2. Evalúa riesgos alineados a categorías de investigación humana NASA (simplificado).
3. Muestra síntomas probables, nivel de alerta y acciones concretas.

## Demo

1. Abrir el proyecto en Android Studio.
2. Emulador o dispositivo **Wear OS** (API 30+).
3. Ejecutar la app → **Demo SEED** → elegir un perfil de tripulación.
4. Revisar **Vitals** y **Riesgos**.

## Próximos pasos

- Health Connect / Samsung Health para datos reales.
- Sincronización con ground control.
- Modelos ML calibrados con datasets NASA (TRISH, HRP).

**Aviso:** prototipo educativo, no diagnóstico médico.
