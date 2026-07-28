# Demo Environment Setup Guide

## Step 0 — One-time machine prep (skip if already done)

```bash
# Requires Node.js + pnpm.
corepack enable
pnpm install
```

## Step 1 — Environment file

```bash
cp .env.example .env
```

**CRITICAL: Edit `.env` and fix `CITY_ID` before running any seed command.**

```
# Change the CITY_ID in .env to match the seeds:
CITY_ID=00000000-0000-4000-8000-000000000001
```

## Step 2 — Start infrastructure

```bash
docker compose -f compose.yml up -d
```

This brings up **Postgres 16**, **MinIO**, and **Mailpit**.
Confirm all containers are healthy before moving on:
```bash
docker compose -f compose.yml ps
```

## Step 3 — Run migrations

```bash
pnpm --filter @batac/database db:migrate
```

## Step 4 — Seed reference data

```bash
pnpm db:seed
```

This runs IAM, Organization, Number Series, Document Types, and Workflow Definitions.

## Step 5 — Seed demo login credentials

```bash
pnpm --filter server exec tsx src/database/seeds/demo-credentials.seed.ts
```

This creates the specific users required for testing the Phase 1 UI.
Shared password for all accounts: `BatacDemo2026!`

## Step 6 — Start the app

```bash
pnpm dev
```

Wait until you see `Server listening on http://0.0.0.0:3000/health`, then open **`http://localhost:5173`** in your browser to log in.

> [!NOTE]
> `AUTH_MAX_CONCURRENT_SESSIONS=1` is set. Logging into a second account will invalidate the first account's session. Use incognito windows if you need to be logged into multiple accounts simultaneously.
