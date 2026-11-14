# Análisis con IA (Jev, TypeSafe AI)

Página `/app/analisis`: el usuario elige un reloj y un periodo (24 h, 7 o 30 días), da su consentimiento y lanza **un análisis por lotes, no en tiempo real**. El servidor resume los datos del periodo, se los envía a Jev y devuelve un informe con todas las respuestas.

## Qué dice la documentación de Jev (leída en vivo, https://docs.typesafe.ai/llms.txt)
- **Jev** es el modelo insignia de la familia *System One*: recibe un `state` y una lista de preguntas tipadas y devuelve **juicios tipados** que el código usa directamente (el flujo sigue en nuestro código).
- **Endpoint:** `POST https://api.typesafe.ai/v1/systemone`, cabeceras `Authorization: Bearer <clave>` y `Content-Type: application/json`.
- **Petición:** `{ "state": <string|objeto|array>, "model": "jev-latest", "questions": { "<id>": { "type": "noul|choice|score", "instructions": "...", "criteria": ... } } }`. Las claves de `questions` vuelven en `answers`; el id no se envía al modelo.
- **Primitivas:** `choice` (una opción de un conjunto, `criteria` obligatorio, máx. 255), `noul` (probabilidad sí/no, `criteria` opcional `{true,false}`), `score` (grado en una escala ordenada de 2 a 10 niveles). Respuestas: `{type:"noul", noul}`, `{type:"choice", choice, probabilities, confidence}`, `{type:"score", score, legend, probabilities, confidence}`. Noul no tiene `confidence`: la probabilidad cumple ese papel.
- **Lotes:** varias preguntas en un mismo `questions` comparten el estado y se evalúan en paralelo; no hay límite fijo de preguntas (lo marca el contexto del modelo).
- **Errores:** 400, 401 (clave inválida), 413 (>32 MiB), 415, 422, 429 y 529 (sobrecarga); para 429/529 se recomienda reintento con espera exponencial.
- **Clave:** se crea en la consola de TypeSafe, https://console.typesafe.ai/keys. El SDK oficial (`@typesafe-ai/sdk`, Node >= 22) lee `TYPESAFE_API_KEY`.
- **No documentado** (verificar con una clave real): límites numéricos de tasa, lista de modelos más allá de `jev-latest`, precios, y si `score` devuelve la posición 0..n-1 (asumido aquí y recortado al rango).
- Skill oficial de TypeSafe (leído, sin instalar): trabajar hacia atrás desde el comportamiento de la app, una pregunta estrecha por juicio, pasar el estado relevante, preguntas independientes juntas, validar con casos representativos, claves solo en el servidor.

Decisión: cliente HTTP con `fetch` en vez del SDK (el SDK exige Node 22 y no documenta una URL base configurable; así tampoco añadimos dependencias).

## Configuración
1. Crea una cuenta en https://console.typesafe.ai y genera una clave en https://console.typesafe.ai/keys.
2. En el servidor define `RAHEL_TYPESAFE_API_KEY=<clave>` (en Coolify, como variable secreta; nunca en el repositorio ni en el frontend).
3. Opcional: `RAHEL_TYPESAFE_BASE_URL` (por defecto `https://api.typesafe.ai`), `RAHEL_TYPESAFE_MODEL` (por defecto `jev-latest`), `RAHEL_TYPESAFE_TIMEOUT_MS` (30000), `RAHEL_ANALYSIS_RUNS_PER_HOUR` (10), `RAHEL_ANALYSIS_GROUP_SIZE` (5), `RAHEL_ANALYSIS_CONCURRENCY` (2).
4. Reinicia el backend. `GET /api/analysis/catalog` devuelve `configured: true` y la página deja de mostrar el aviso de activación.
5. Si el CSP/red saliente del contenedor está restringido, permite la salida a `api.typesafe.ai:443` (la llamada la hace el servidor, no el navegador).

Sin clave, `POST /api/analysis/runs` responde `503 {"error":"analysis_not_configured"}`.

**Probar sin clave:** `RAHEL_TYPESAFE_FAKE=1` (solo con `NODE_ENV` distinto de `production`) usa un cliente simulado determinista; las pruebas automáticas (`npm test`) inyectan clientes simulados y nunca llaman al servicio real. **Probar con clave real** (manual, consume cuota): arranca el backend con la clave, vincula/ingesta datos y ejecuta el análisis desde la página o con `curl -X POST /api/analysis/runs -H "Authorization: Bearer <jwt>" -d '{"deviceId":"...","windowHours":24,"consent":true}'`; revisa que las 10 preguntas lleguen `ok` y que las lecturas sean coherentes.

## Catálogo (10 juicios, `backend/src/analysis/catalog.ts`)
Cada uno: id estable, título, tipo, pregunta con criterios y plantillas de lectura en lenguaje claro (el texto que ve el usuario sale de las plantillas, no de texto libre del modelo).

| id | Tipo | Pregunta |
|---|---|---|
| `recovery` | score (5) | Grado de recuperación según pulso en reposo, descenso nocturno, VFC y sueño estimados |
| `sustained_stress` | noul | ¿Indicios de estrés sostenido (repetido, no puntual)? |
| `resting_hr_trend_up` | noul | ¿El pulso en reposo diario sube a lo largo del periodo? |
| `sleep_regularity` | score (5) | Regularidad de la hora de descanso nocturno estimado |
| `activity_level` | choice | sedentary / light / moderate / high |
| `unexplained_elevated_hr` | noul | ¿Episodios de pulso elevado sin pasos que los expliquen? |
| `data_quality` | score (5) | Cobertura y calidad de los datos del periodo |
| `best_activity_window` | choice | morning / afternoon / evening / unclear |
| `night_dip` | noul | ¿El pulso baja claramente por la noche? |
| `wellbeing_trend` | choice | improving / stable / worsening / unclear |

Justificación: son preguntas estrechas con criterios explícitos (como pide la guía de Jev), de los tres tipos, que se pueden contestar solo con el resumen agregado. Las cifras (medias, pendientes, conteos) las calcula el código; Jev aporta el juicio semántico sobre ellas. Ninguna pide diagnóstico: tono de bienestar y aviso «no es un dispositivo médico».

## Estado enviado a Jev (`backend/src/analysis/summary.ts`)
Resumen JSON de ~2 KB construido en el servidor: cobertura (porcentaje, hueco más largo, días con datos), estadísticos de pulso (media, p10/p50/p90, reposo, pendiente diaria), estrés estimado, episodios de pulso alto sin actividad, actividad (pasos/día, proporción activa), estadísticos por franja del día (noche/mañana/tarde/noche temprana), descanso nocturno estimado (inicio, duración, descenso), serie diaria con «hace N días» y las estimaciones de `backend/src/estimation`. Los datos se muestrean en cubos de 5/15/30 min según el periodo.

**No se envía:** email, userId, deviceId, crewMemberId, tokens, lecturas crudas, marcas de tiempo absolutas, ubicación. Hay una prueba automática que lo comprueba. Se guarda solo el SHA-256 del resumen (`summary_hash`), no el resumen.

## API (todas con `Authorization: Bearer`)
- `GET /api/analysis/catalog` → `{configured, disclaimer, windows, maxRunsPerHour, items[]}`
- `POST /api/analysis/runs` `{deviceId, windowHours: 24|168|720, consent: true, tzOffsetMinutes?}` → `202 {id, status}`. Errores: `400 consent_required|invalid_payload`, `404` (dispositivo ajeno), `503 analysis_not_configured`, `422 insufficient_data`, `409 analysis_in_progress` (máx. 1 activa por usuario), `429 too_many_requests` (10/hora/usuario; los rechazos no consumen cuota).
- `GET /api/analysis/runs?limit&before` → historial paginado (sin resultados). `GET /api/analysis/runs/:id` → informe (404 si es ajeno).
- `DELETE /api/analysis/runs/:id` → 204 (409 si sigue en curso, 404 si es ajeno).

Ejecución asíncrona: el POST responde al instante; un proceso en segundo plano lanza las preguntas en 2 peticiones de 5 preguntas (concurrencia 2, timeout 30 s, 3 intentos con espera exponencial en 429/529/5xx/red). Si falla un grupo, se reintentan sus preguntas una a una; cada respuesta se valida con zod y contra el catálogo. Una pregunta fallida se marca `error` (el informe muestra el resto) y se reintenta lanzando un nuevo análisis. Al reiniciar el servidor, las ejecuciones interrumpidas pasan a `error: interrupted`. El frontend sondea cada 2,5 s mientras haya una activa. Tabla `analysis_runs` (migración aditiva con índices).

## Riesgos y costes pendientes
- **Coste:** una ejecución = 2 peticiones con ~2 KB de estado y 5 preguntas; precios no publicados en la documentación consultada. El límite por hora acota el gasto por usuario, pero no el global: considera un tope diario global.
- **Privacidad:** completar los campos entre corchetes de `docs/privacy-policy.md` (DPA con TypeSafe AI, país, retención en su lado). Datos agregados no equivalen a anónimos: tratarlos como datos de salud.
- **Calidad:** la semántica de `score` (posición 0..n-1) y el comportamiento real de Jev con estas preguntas deben validarse con una clave y casos representativos antes de publicar.
- Los informes se guardan hasta que el usuario los borre; no hay purga automática por antigüedad.
