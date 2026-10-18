# RaHel — Wear OS (`app/`)

Monitor de salud para astronautas (hackathon NASA).

## Android Studio

Abre **una** de estas carpetas (ambas compilan):

| Carpeta | Uso |
|---------|-----|
| **`app/`** | Proyecto Gradle clásico (`./gradlew :app:assembleDebug`) |
| **Raíz del monorepo** (`rahel/`) | Mismo módulo `:app` → `app/app/` (útil si abriste todo el repo) |

1. **File → Open** → `…/rahel/app` (recomendado) o la raíz `rahel/`.
2. Espera **Gradle Sync**.
3. Crea un emulador **Wear OS** (API **30+**, imagen con Google APIs / Play).
4. Run ▶ en el módulo **app**.

## Línea de comandos

```bash
cd app && ./gradlew :app:assembleDebug
# o desde la raíz del monorepo:
./gradlew :app:assembleDebug
```

## API en debug

En **debug**, `API_BASE_URL` apunta por defecto a `http://192.168.1.24:8080/api/` (IP Wi‑Fi del PC). Cópia `local.properties.example` → `local.properties` y cambia la IP si hace falta. Alternativa en emulador: `http://10.0.2.2:8080/api/`. El backend debe escuchar en `0.0.0.0` (`cd backend && npm run dev`).

Documentación: `docs/HACKATHON_PITCH.md`, `docs/SOURCES.md`.

## Telemetría, sincronización y emparejamiento

- **Muestreo:** la UI se refresca cada 1 s, pero solo se persiste en la cola Room una muestra cada ~30 s y únicamente si hay FC válida, el reloj está en la muñeca y el reloj está emparejado (`crewMemberId` real, sin valor por defecto). Cola máxima 5000 filas (se descartan las más antiguas) y se purga tras subir.
- **Sincronización:** un único trabajo WorkManager encadenado (`KEEP`) sube lotes de hasta 100 filas por `crewMemberId`. El `clientBatchId` es determinista (hash del crew + ids de filas) y el lote queda congelado en la BD hasta que el servidor lo acepta, por lo que los reintentos son idempotentes. Las filas corruptas se descartan. Fallos de red/5xx/429 => `Result.retry()`.
- **Datos honestos:** los vitales del DTO son nulables; `null` = no medido (nunca 0). `skinTemp` y `sleep` se envían `null` (no hay sensor), `hrv` también (el reloj solo da BPM), `stepsToday` sale del contador de pasos desde medianoche local. El timestamp es el de la muestra de FC.
- **Auth:** `/api/profile` y `/api/telemetry/batch` envían `X-Device-Token`; sin token no se hace la petición. Un 401 limpia credenciales y vuelve a emparejamiento.
- **Emparejamiento:** el código (alfanumérico, longitud variable) sale solo de `POST /pairing/code`; el token se guarda cifrado con AES-GCM (Android Keystore) y `allowBackup=false`. Timeouts de red 10/15 s.
- **Ciclo de vida:** `HealthForegroundService` (tipo `health`, permisos `FOREGROUND_SERVICE` y `FOREGROUND_SERVICE_HEALTH`) mantiene la recolección con pantalla apagada; se arranca desde la actividad cuando hay permisos y el reloj está emparejado y con onboarding. Al conceder permisos se reintenta el registro de sensores.
