FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY backend backend
COPY frontend frontend
COPY scripts scripts
ENV BACKEND_INTERNAL_URL=http://127.0.0.1:8001
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV BACKEND_INTERNAL_URL=http://127.0.0.1:8001
ENV STORAGE_ROOT=/data
COPY --from=build /app /app
EXPOSE 3001
CMD ["node", "scripts/start-production.mjs"]
