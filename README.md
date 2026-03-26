# Saatgut 🌱

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)
![Vitest](https://img.shields.io/badge/Vitest-tested-6E9F18)
![Playwright](https://img.shields.io/badge/Playwright-e2e-45BA4B)

Saatgut is a self-hosted seed-bank and cultivation journal web app for running a practical home-growing workflow: catalog varieties, track seed batches, define frost-date-based growing profiles, derive a 14-day calendar, record planting activity, and manage seed quality signals such as germination tests and stock corrections.

## 📘 End-User Guide

German-first end-user documentation with validated screenshots is available in [docs/benutzerhandbuch.md](docs/benutzerhandbuch.md).

## ✨ What Is Shipped

The current implementation includes:

- cookie-based registration, login, password change, invites, and session handling
- authenticated app shell with responsive navigation
- species and variety management, including tags and synonyms
- seed batch tracking with storage metadata, warning display, germination tests, and stock transaction history
- growing profiles with active-profile handling and persisted phenology state
- cultivation rules for frost-relative planning
- 14-day calendar output from the backend planning engine
- planting event capture with stock deduction
- journal logging plus operational/API surfaces for timeline, tasks, exports, backups, API tokens, MCP, and OpenAPI output

The core web UI is focused on seed-bank and planning workflows. Some operational surfaces are currently API-first rather than fully represented in the main page UI.

## 🧰 Stack

- Next.js 15 App Router
- TypeScript
- Prisma
- PostgreSQL 16
- Tailwind CSS v4
- Vitest
- Playwright
- Docker Compose

## 🗂️ Project Layout

```text
src/app/                    App Router pages and API routes
src/components/             Main client-side UI
src/lib/client/             Frontend API client and shared types
src/lib/server/             Domain services, serializers, validation, operations
src/lib/auth/               Session, password, invite, and API token helpers
prisma/                     Schema and migrations
docker/                     Database image and entrypoint helpers
scripts/                    Operational scripts such as PostgreSQL backup
tests/                      Vitest and Playwright coverage
```

## 🚀 Local Development

1. Copy `.env.example` to `.env.local`.
2. Install dependencies and generate the Prisma client:

```bash
npm install
npm run setup
```

3. Start PostgreSQL:

```bash
docker compose up db -d
```

4. Apply migrations:

```bash
npm run db:deploy
```

5. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## 🐳 Docker Compose

Run the app and database together with:

```bash
docker compose up --build
```

Notes:

- Compose derives the app `DATABASE_URL` from `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`.
- The bundled PostgreSQL image reconciles `POSTGRES_PASSWORD` onto the persisted role during startup, which helps avoid stale-password issues on reused volumes.
- This setup is intended to be self-hosting friendly and Portainer-friendly, but the README does not claim production hardening beyond the shipped health checks and container wiring.

## ✅ Verification

Run the baseline checks with:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Browser-level coverage is available via:

```bash
npm run test:e2e
```

## 🔌 API Surface

Selected shipped endpoints:

- `/api/health`
- `/api/v1/auth/*`
- `/api/v1/species`
- `/api/v1/varieties`
- `/api/v1/seed-batches`
- `/api/v1/seed-batches/:id/germination-tests`
- `/api/v1/seed-batches/:id/transactions`
- `/api/v1/profiles`
- `/api/v1/profiles/:id/phenology`
- `/api/v1/cultivation-rules`
- `/api/v1/calendar`
- `/api/v1/plantings`
- `/api/v1/journal`
- `/api/v1/tasks`
- `/api/v1/timeline`
- `/api/v1/exports/workspace`
- `/api/v1/backups/summary`
- `/api/v1/admin/api-tokens`
- `/api/v1/openapi.json`
- `/api/v1/mcp`

## 🛠️ Operations

Create a PostgreSQL dump with:

```bash
npm run backup:db
```

Backups are written to `backups/`.

## ⚙️ Environment Notes

Important variables in `.env.example`:

- `DATABASE_URL`: direct local development database connection
- `AUTH_SECRET`: session and auth signing secret
- `APP_URL`: app origin for local runtime behavior
- `API_RATE_LIMIT_PER_MINUTE`: baseline per-minute rate limit
- `API_TOKEN_DEFAULT_RATE_LIMIT_PER_MINUTE`: default rate limit for issued API tokens
- `MCP_ALLOWED_ORIGINS`: allowed browser origins for the MCP HTTP endpoint
- `POSTGRES_*` and `APP_PORT`: Compose-oriented runtime settings
