# rahel

Monorepo **RaHel** — monitoreo de salud para astronautas (hackathon NASA).

| Carpeta | Descripción |
|---------|-------------|
| [`app/`](app/) | Wear OS — abrir **`app/`** o la raíz del repo en Android Studio (ver [app/README.md](app/README.md)). |
| [`backend/`](backend/) | API Express + TypeScript + SQLite (puerto **8080**). |
| [`frontend/`](frontend/) | Web Vite + React + TypeScript. |

Documentación del wearable: `app/docs/`.

## Despliegue con Docker (un contenedor)

El [`Dockerfile`](Dockerfile) **descarga el código desde GitHub** durante el build (`git clone` de [VMASPAD/rahel](https://github.com/VMASPAD/rahel)) y arranca API + web en el mismo contenedor.

```bash
# Descarga solo el Dockerfile y construye (el build clona el repo completo desde GitHub)
curl -fsSL https://raw.githubusercontent.com/VMASPAD/rahel/main/Dockerfile -o Dockerfile
docker build -t rahel .

# O clona tú el repo y construye desde la raíz (mismo clone interno en la imagen)
git clone https://github.com/VMASPAD/rahel.git
cd rahel
docker build -t rahel .
```

Ejecutar:

```bash
docker run -d --name rahel -p 80:80 -v rahel-data:/data rahel
```

Rama o fork distinto:

```bash
docker build -t rahel --build-arg REPO_URL=https://github.com/VMASPAD/rahel.git --build-arg REPO_REF=main .
```

- **Web + API:** http://localhost (un solo proceso Node en el puerto 80)
- **SQLite:** volumen `-v rahel-data:/data` → `/data/rahel.db`

Parar: `docker stop rahel && docker rm rahel`

## Desarrollo local

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```
