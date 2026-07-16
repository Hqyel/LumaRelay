FROM node:22.13-bookworm-slim AS build

ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

WORKDIR /workspace
RUN npm install --global pnpm@10.13.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/web ./apps/web
COPY packages/config ./packages/config
COPY packages/contracts ./packages/contracts
COPY packages/ui ./packages/ui

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @newemby/web build

FROM nginx:1.29-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
