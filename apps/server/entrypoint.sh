#!/bin/sh
# apps/server/entrypoint.sh
set -e

echo "[entrypoint] APP_ENV=${APP_ENV}"
echo "[entrypoint] DB_HOST=${DB_HOST:-localhost}"

echo "[entrypoint] Running database migrations..."
node ./packages/database/dist/migrate.js
echo "[entrypoint] Migrations complete."

if [ "$APP_ENV" = "development" ] || [ "$APP_ENV" = "staging" ]; then
  echo "[entrypoint] Seeding database (${APP_ENV})..."
  node ./packages/database/dist/seed.js
  echo "[entrypoint] Seed complete."
else
  echo "[entrypoint] Skipping seed (APP_ENV=${APP_ENV})."
fi

echo "[entrypoint] Starting server on port ${APP_PORT:-3000}..."
exec node --import ./apps/server/dist/apps/server/src/instrumentation.js --experimental-loader=@opentelemetry/instrumentation/hook.mjs ./apps/server/dist/apps/server/src/index.js
