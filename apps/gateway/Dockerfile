FROM node:22.13-bookworm-slim AS build

WORKDIR /workspace
RUN npm install --global pnpm@10.13.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/gateway ./apps/gateway
COPY packages/config ./packages/config
COPY packages/contracts ./packages/contracts
COPY packages/emby-client ./packages/emby-client

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @newemby/gateway... build
RUN pnpm --filter @newemby/gateway deploy --prod /opt/newemby

FROM node:22.13-bookworm-slim

ENV NODE_ENV=production
WORKDIR /opt/newemby
COPY --from=build /opt/newemby ./

USER node
CMD ["node", "dist/index.js"]
