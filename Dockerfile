FROM node:22.13-bookworm-slim AS build

WORKDIR /workspace
RUN npm install --global pnpm@11.13.1

COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/gateway ./apps/gateway
COPY apps/web ./apps/web
COPY packages/config ./packages/config
COPY packages/contracts ./packages/contracts
COPY packages/emby-client ./packages/emby-client
COPY packages/ui ./packages/ui

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @lumarelay/gateway... build \
  && pnpm --filter @lumarelay/web... build
RUN pnpm --filter @lumarelay/gateway deploy --prod --legacy /opt/lumarelay

FROM node:22.13-bookworm-slim

ARG VERSION=0.0.0
ENV LUMARELAY_DATABASE_PATH=/data/lumarelay.db \
  LUMARELAY_HOST=0.0.0.0 \
  LUMARELAY_PORT=3000 \
  LUMARELAY_VERSION=${VERSION} \
  NODE_ENV=production

WORKDIR /opt/lumarelay
COPY --from=build /opt/lumarelay ./
COPY --from=build /workspace/apps/web/dist ./public

RUN mkdir -p /data \
  && chown -R node:node /data /opt/lumarelay

USER node
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "dist/index.js"]
