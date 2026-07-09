# apps/web/Dockerfile

FROM node:22-alpine AS pruner
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune --scope=@batac/web --docker

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY --from=pruner /app/out/full/ .

ARG VITE_APP_NAME="Batac City LGU"
ARG VITE_API_URL
ARG VITE_APP_URL
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_ENVIRONMENT

ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT

RUN pnpm --filter @batac/shared build && \
    pnpm --filter @batac/ui build && \
    pnpm --filter @batac/web build

FROM alpine:3.20 AS production
COPY --from=builder /app/apps/web/dist /app/dist
