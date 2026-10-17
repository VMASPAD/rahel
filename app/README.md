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

El emulador usa `http://10.0.2.2:8080/` hacia el backend en tu PC (`BuildConfig.API_BASE_URL` en debug). Levanta el backend antes de probar sync.

Documentación: `docs/HACKATHON_PITCH.md`, `docs/SOURCES.md`.
