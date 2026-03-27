# Saatgut 🌱

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)
![Vitest](https://img.shields.io/badge/Vitest-tested-6E9F18)
![Playwright](https://img.shields.io/badge/Playwright-e2e-45BA4B)
![GHCR](https://img.shields.io/badge/GHCR-publishable-181717)

Saatgut is a self-hosted seed-bank and cultivation journal web app for running a practical home-growing workflow: catalog varieties, track seed batches, define frost-date-based growing profiles, derive a 14-day calendar, record planting activity, and manage seed quality signals such as germination tests and stock corrections.

## 📘 End-User Guide

German-first end-user documentation with validated screenshots is available in [docs/benutzerhandbuch.md](docs/benutzerhandbuch.md).

## 🎨 Visual Identity

The repository-level visual system is documented in:

- [docs/design/visual-identity-guide.md](docs/design/visual-identity-guide.md)
- [docs/design/logo-design-description.md](docs/design/logo-design-description.md)

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
- The app container now receives the same runtime knobs the shipped app expects for passkeys, media storage, API limits, and MCP.
- Uploaded images are persisted in the named `media_data` volume at `/app/var/media`.
- Container startup runs `prisma migrate deploy`, so the app expects the shipped migration set in `prisma/migrations/` through `0008_variety_companions`.
- This setup is intended to be self-hosting friendly and Portainer-friendly, but the README does not claim production hardening beyond the shipped health checks and container wiring.

### Runtime Contract

The current deployment assets assume:

- `AUTH_SECRET` is set to a strong random value with at least 16 characters.
- `APP_URL` is the public origin of the app and must match the URL users actually visit.
- `WEBAUTHN_RP_ID` is the bare hostname for passkeys, and `WEBAUTHN_ALLOWED_ORIGINS` must include the exact browser origin.
- `MEDIA_STORAGE_DIR` points at writable filesystem storage; the compose variants mount `/app/var/media` for this purpose.
- `MCP_ALLOWED_ORIGINS` controls browser-origin access to `/api/v1/mcp`; simple server-to-server requests without an `Origin` header are unaffected.
- `API_RATE_LIMIT_PER_MINUTE` and `API_TOKEN_DEFAULT_RATE_LIMIT_PER_MINUTE` shape the in-app throttling used by REST and MCP routes.
- `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` remain the authoritative inputs for the containerized `DATABASE_URL`.

## 📦 GHCR Images

GitHub Actions now publishes container images to GHCR after the verification job passes on `main` and version tags.

Published image names:

- `ghcr.io/beisel-it/saatgut:latest`
- `ghcr.io/beisel-it/saatgut:main`
- `ghcr.io/beisel-it/saatgut-db:latest`
- `ghcr.io/beisel-it/saatgut-db:main`

The workflow also publishes immutable SHA and Git tag variants.

## 🧭 Portainer Deployment

For a registry-based Portainer stack, use [docker-compose.portainer.yml](docker-compose.portainer.yml).
Start from [.env.portainer.example](.env.portainer.example) when creating the stack environment.

Typical flow:

1. Create a stack in Portainer from the repository or upload the compose file.
2. Use `docker-compose.portainer.yml`.
3. Populate the stack environment from `.env.portainer.example`.
4. Set at least:
   - `AUTH_SECRET`
   - `APP_URL`
   - `WEBAUTHN_RP_ID`
   - `WEBAUTHN_ALLOWED_ORIGINS`
   - `POSTGRES_DB`
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
5. Deploy the stack.

Notes:

- The Portainer variant pulls prebuilt GHCR images instead of building locally.
- The custom database image keeps the shipped password-reconciliation behavior for reused volumes.
- The Portainer variant also mounts a named `media_data` volume so uploads and variety images survive restarts.
- If you want deterministic upgrades, set `SAATGUT_APP_IMAGE` and `SAATGUT_DB_IMAGE` to a release tag or SHA tag instead of `latest`.
- Passkeys will fail if `APP_URL`, `WEBAUTHN_RP_ID`, and `WEBAUTHN_ALLOWED_ORIGINS` do not reflect the public hostname exactly.
- Browser-based MCP clients should keep `MCP_ALLOWED_ORIGINS` aligned with the same public origin.

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
- `WEBAUTHN_RP_NAME`, `WEBAUTHN_RP_ID`, `WEBAUTHN_ALLOWED_ORIGINS`: passkey/WebAuthn runtime contract
- `API_RATE_LIMIT_PER_MINUTE`: baseline per-minute rate limit
- `API_TOKEN_DEFAULT_RATE_LIMIT_PER_MINUTE`: default rate limit for issued API tokens
- `MEDIA_STORAGE_DIR`, `MEDIA_MAX_UPLOAD_BYTES`: local upload storage path and upload cap
- `MCP_ALLOWED_ORIGINS`: allowed browser origins for the MCP HTTP endpoint
- `POSTGRES_*` and `APP_PORT`: Compose-oriented runtime settings
