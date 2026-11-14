FROM node:20-bookworm-slim AS build

WORKDIR /repo

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json ./backend/
WORKDIR /repo/backend
RUN npm ci

COPY backend/ ./

RUN npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV RAHEL_DB_PATH=/data/rahel.db

COPY --from=build /repo/backend/package.json ./
COPY --from=build /repo/backend/node_modules ./node_modules
COPY --from=build /repo/backend/dist ./dist
COPY --from=build /repo/backend/data ./data

RUN mkdir -p /data

EXPOSE 8080
VOLUME ["/data"]

CMD ["node", "dist/index.js"]
