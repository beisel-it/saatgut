# Saatgut

Saatgut is a self-hosted seed-bank and cultivation journal web app for managing varieties, seed batches, frost-date-based growing profiles, cultivation rules, and a practical 14-day calendar of upcoming garden work.

## Stack

- Next.js 15 with App Router
- TypeScript
- Prisma
- PostgreSQL 16
- Tailwind CSS v4
- Vitest
- Docker Compose

## Quick Start

1. Copy `.env.example` to `.env.local` for local app development or `.env` for Docker Compose.
2. Install dependencies and generate Prisma client with `npm install && npm run setup`.
3. Start PostgreSQL with `docker compose up db -d`.
4. Apply migrations with `npm run db:deploy`.
5. Start the web app with `npm run dev`.

Open `http://localhost:3000`.

## Full Stack With Docker Compose

Run the full stack with:

```bash
docker compose up --build
```

The web app will be available on `http://localhost:3000` and will run Prisma migrations on container startup.

## Verification

Use the baseline verification commands:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Operations Surface

The V1 operations layer now includes:

- reminder task APIs under `/api/v1/tasks`
- unified timeline reads under `/api/v1/timeline`
- workspace JSON export via `/api/v1/exports/workspace`
- backup metadata via `/api/v1/backups/summary`
- admin API token management under `/api/v1/admin/api-tokens`
- generated OpenAPI output at `/api/v1/openapi.json`

For database backups, run:

```bash
npm run backup:db
```

This writes timestamped PostgreSQL dumps to `backups/`.

## Current MVP Surface

The web app now includes:

- registration and login with cookie-based sessions
- authenticated app shell with responsive navigation
- species and variety creation
- seed batch entry and stock visibility
- growing profile creation with active-profile selection
- cultivation rule entry for frost-relative planning
- 14-day calendar list fed by the backend calendar service
- planting event capture with optional seed stock deduction
- journal entries, reminder task APIs, timeline reads, exports, and tokenized API access

The remaining work is deeper refinement, not initial UI scaffolding.
