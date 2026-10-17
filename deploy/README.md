# Despliegue RaHel (Coolify)

## Arquitectura

Un solo contenedor (`Dockerfile` en la raíz): **Express :80** sirve la API y el frontend estático (sin nginx).

| Ruta pública | Uso |
|--------------|-----|
| `https://rahel.hermesbackend.xyz/` | Dashboard React |
| `https://rahel.hermesbackend.xyz/api/*` | REST (crew, health, …) |
| `https://rahel.hermesbackend.xyz/profile` | Wear OS — POST perfil |
| `https://rahel.hermesbackend.xyz/telemetry/batch` | Wear OS — POST telemetría |

El frontend en producción usa rutas **relativas** (`/api/...`) si `VITE_API_URL` está vacío en el build Docker.

## Traefik (pegar en Coolify)

Copia las etiquetas de [`coolify-traefik.labels`](coolify-traefik.labels). Sustituye los routers `http-0-dks0…` / `https-0-dks0…` por esta variante con:

- `PathPrefix(`/api`)` (+ `/profile`, `/telemetry`) con **priority=100**
- SPA en `PathPrefix(`/`)` con **priority=1**
- **Un solo servicio** al puerto **80** del contenedor (`rahel-svc`)

## Caddy

Ver [`coolify-caddy.labels`](coolify-caddy.labels).

## Reloj en producción

En `app/app/build.gradle.kts` (release), apunta `API_BASE_URL` a:

`https://rahel.hermesbackend.xyz/`

(trailing slash requerido por Retrofit).
