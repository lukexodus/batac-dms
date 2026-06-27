# apps/server/Dockerfile

FROM node:22-alpine AS pruner
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm dlx turbo prune --scope=server --docker

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter @batac/shared build && \
    pnpm --filter @batac/database build && \
    pnpm --filter server build

FROM node:22-alpine AS production
RUN apk add --no-cache wget dumb-init
RUN corepack enable
WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/server/dist           ./apps/server/dist
COPY --from=builder /app/packages/shared/dist       ./packages/shared/dist
COPY --from=builder /app/packages/database/dist     ./packages/database/dist
COPY --from=builder /app/packages/database/migrations ./packages/database/migrations
COPY --from=builder /app/packages/database/scripts/post-migrate-grants.sql \
                    ./packages/database/scripts/post-migrate-grants.sql

COPY apps/server/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

ENV TZ=Asia/Manila
ENV TESSDATA_PREFIX=/app/tessdata
RUN mkdir -p /app/tessdata && \
    wget -q -O /app/tessdata/eng.traineddata.gz \
      https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best/eng.traineddata.gz && \
    wget -q -O /app/tessdata/fil.traineddata.gz \
      https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best/fil.traineddata.gz && \
    gunzip /app/tessdata/*.gz && \
    chown -R node:node /app/tessdata

USER node
EXPOSE 3000
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["./entrypoint.sh"]
