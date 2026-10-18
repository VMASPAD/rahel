# Despliegue RaHel (Coolify)

## Arquitectura

Un solo contenedor (`Dockerfile` en la raíz): **Express :80** sirve la API y el frontend estático (sin nginx).

| Ruta pública | Uso |
|--------------|-----|
| `https://rahel.hermesbackend.xyz/` | Dashboard React |
| `https://rahel.hermesbackend.xyz/api/*` | REST (crew, health, …) |
| `https://rahel.hermesbackend.xyz/api/profile` | Wear OS — POST perfil |
| `https://rahel.hermesbackend.xyz/api/telemetry/batch` | Wear OS — POST telemetría |

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

`https://rahel.hermesbackend.xyz/api/`

(trailing slash requerido por Retrofit; rutas `profile` y `telemetry/batch`).

## Variables de entorno

| Variable | Cuándo | Descripción |
|----------|--------|-------------|
| `NODE_ENV=production` | runtime (Dockerfile ya la fija) | Activa HSTS, CORS estricto y exige secretos |
| `RAHEL_JWT_SECRET` | runtime, **obligatoria** | Secreto largo y aleatorio para firmar JWT (`openssl rand -hex 32`) |
| `RAHEL_CORS_ORIGINS` | runtime | Orígenes permitidos separados por coma, p. ej. `https://rahel.hermesbackend.xyz`. Mismo origen y el reloj (sin `Origin`) no lo necesitan |
| `RAHEL_CSP_CONNECT_SRC` | runtime, opcional | Orígenes extra para `connect-src` de la CSP (solo si `VITE_API_URL` apunta a otro dominio) |
| `RAHEL_TRUST_PROXY` | runtime | Saltos de proxy (por defecto `1` en producción, para rate limit tras Traefik) |
| `RAHEL_DB_PATH` | runtime | Ruta SQLite (`/data/rahel.db`; monta un volumen en `/data`) |
| `RAHEL_ENABLE_SEED`, `RAHEL_ALLOW_LEGACY_INGEST` | runtime | Ver `backend/README.md` |
| `STATIC_WEB_ROOT` | runtime | Carpeta del frontend compilado (`/app/public` en la imagen) |
| `PORT` | runtime | Puerto de escucha (80 por defecto en la imagen) |
| `VITE_API_URL` | **build** (`--build-arg`) | Vacío = rutas relativas `/api` (recomendado) |
| `VITE_SITE_URL` | **build** (`--build-arg`) | Dominio público para canonical/OG/sitemap/robots (por defecto `https://rahel.hermesbackend.xyz`) |

## Endurecimiento y SEO

- Express aplica `helmet` (CSP propia: `default-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`, HSTS en producción), compresión gzip/brotli-compatible por `compression` (gzip/deflate) y ETag fuerte.
- `/assets/*` (con hash) se sirve `immutable` un año; `index.html` con `no-cache`.
- Solo `/`, `/app` y `/app/*` devuelven la SPA con 200. Cualquier otra ruta responde 404 con `index.html` y `X-Robots-Tag: noindex`. `/app*` envía además `noindex`.
- `robots.txt`, `sitemap.xml`, `site.webmanifest` salen de `frontend/public/` con su Content-Type correcto.
- Contenedor: multi-stage, usuario `node` (no root), `HEALTHCHECK` contra `/api/health`. El puerto 80 sin root requiere Docker >= 20.10; si no, usa `PORT=8080`.
- Prerender: no se hace (la landing se monta con `createRoot`, que reemplazaría el HTML sin hidratar). Los crawlers ven title/description/OG/JSON-LD de `index.html` y un `<noscript>` con contenido útil; Google ejecuta JS para el resto.
