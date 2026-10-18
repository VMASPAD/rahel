# RaHel — clona el repo; Express sirve API + frontend (sin nginx)
# docker build -t rahel .
# docker run -d -p 80:80 -v rahel-data:/data rahel

ARG REPO_URL=https://github.com/VMASPAD/rahel.git
ARG REPO_REF=main

FROM alpine:3.20 AS source
ARG REPO_URL
ARG REPO_REF
RUN apk add --no-cache git \
    && git clone --depth 1 --branch "${REPO_REF}" "${REPO_URL}" /src

FROM node:20-bookworm-slim AS backend-build
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY --from=source /src/backend/package.json /src/backend/package-lock.json ./backend/
WORKDIR /repo/backend
RUN npm ci
COPY --from=source /src/backend/ ./
RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim AS frontend-build
WORKDIR /repo
COPY --from=source /src/frontend/package.json /src/frontend/package-lock.json ./frontend/
WORKDIR /repo/frontend
RUN npm ci
COPY --from=source /src/frontend/ ./
ARG VITE_API_URL=
ARG VITE_SITE_URL=https://rahel.hermesbackend.xyz
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SITE_URL=$VITE_SITE_URL
RUN npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80
ENV RAHEL_DB_PATH=/data/rahel.db
ENV STATIC_WEB_ROOT=/app/public

COPY --from=backend-build --chown=node:node /repo/backend/package.json ./
COPY --from=backend-build --chown=node:node /repo/backend/node_modules ./node_modules
COPY --from=backend-build --chown=node:node /repo/backend/dist ./dist
COPY --from=backend-build --chown=node:node /repo/backend/data ./data
COPY --from=frontend-build --chown=node:node /repo/frontend/dist ./public

RUN mkdir -p /data && chown node:node /data

# Usuario no root. El puerto 80 funciona sin root en Docker >= 20.10
# (net.ipv4.ip_unprivileged_port_start=0); si no, usa PORT=8080 y ajusta el puerto en Coolify.
USER node

EXPOSE 80
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||80)+'/api/health').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
