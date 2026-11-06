# Targets: pruefen (lint and unit tests), betrieb (the application). `docker compose up` builds betrieb.
FROM node:22-alpine AS abhaengigkeiten
WORKDIR /w
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
COPY e2e/package.json e2e/package.json
RUN npm ci --no-audit --no-fund --ignore-scripts -w api -w web --include-workspace-root

FROM abhaengigkeiten AS pruefen
COPY . .

FROM pruefen AS oberflaeche
RUN npm run build

FROM node:22-alpine AS betrieb
ENV NODE_ENV=production
WORKDIR /w
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
COPY e2e/package.json e2e/package.json
RUN npm ci --omit=dev --no-audit --no-fund --ignore-scripts -w api
COPY api/src api/src
COPY api/stadt api/stadt
COPY --from=oberflaeche /w/web/dist web/dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=20s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/gesund').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "api/src/server.js"]
