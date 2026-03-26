# Saatgut MVP Technical Specification

## Objective

Implement the first usable version of Saatgut as a self-hostable full-stack web application for seed-bank management and calendar-driven planting work.

The MVP covers:

- authentication
- species and variety catalog
- seed batch management
- growing profile management
- cultivation rules
- next-14-days calendar view
- planting event capture with stock deduction

## Stack Choice

The project will use:

- `Next.js 15` with App Router for the web application shell
- `TypeScript` across frontend and backend code
- `Prisma` for schema management and database access
- `PostgreSQL 16` for persistence
- `Zod` for request validation and shared input contracts
- `Tailwind CSS` for a fast responsive UI baseline
- `Vitest` for unit and API-level tests
- `Playwright` for end-to-end browser checks

This keeps the stack compact: one application container plus PostgreSQL for MVP, while still supporting REST endpoints, typed forms, server-side actions if needed, and a clean path to OpenAPI later.

## Architecture

### Runtime Shape

- `web` app serves the UI and API routes from one Next.js process
- `db` runs PostgreSQL
- future worker/MCP processes are deferred until V1

### Module Boundaries

- `src/app/*`: pages, layouts, route handlers
- `src/features/auth/*`: login, session, guards
- `src/features/catalog/*`: species, varieties, cultivation rules
- `src/features/seed-batches/*`: seed inventory workflows
- `src/features/profiles/*`: growing profile CRUD
- `src/features/calendar/*`: calendar calculation and view models
- `src/features/plantings/*`: planting event creation and history
- `src/lib/db/*`: Prisma client and persistence helpers
- `src/lib/validation/*`: Zod schemas

### API Style

Use versioned JSON REST endpoints under `/api/v1`.

Initial endpoint groups:

- `/api/v1/auth`
- `/api/v1/species`
- `/api/v1/varieties`
- `/api/v1/seed-batches`
- `/api/v1/profiles`
- `/api/v1/cultivation-rules`
- `/api/v1/calendar`
- `/api/v1/plantings`

## MVP Domain Model

### Core Entities

- `User`: id, email, passwordHash, role, createdAt, updatedAt
- `Workspace`: id, name, visibility, createdAt
- `Membership`: userId, workspaceId, role
- `Species`: id, workspaceId, commonName, latinName, category, notes
- `Variety`: id, workspaceId, speciesId, name, description, heirloom, notes
- `VarietySynonym`: id, varietyId, name
- `SeedBatch`: id, workspaceId, varietyId, source, harvestYear, quantity, unit, storageLocation, notes
- `GrowingProfile`: id, workspaceId, name, lastFrostDate, firstFrostDate, notes, isActive
- `CultivationRule`: id, varietyId, sowIndoorsStartWeeks, sowIndoorsEndWeeks, sowOutdoorsStartWeeks, sowOutdoorsEndWeeks, transplantStartWeeks, transplantEndWeeks, harvestStartDays, harvestEndDays, spacingCm, successionIntervalDays
- `PlantingEvent`: id, workspaceId, varietyId, seedBatchId, growingProfileId, type, plannedDate, actualDate, quantityUsed, locationNote, notes
- `AuditLog`: id, workspaceId, actorUserId, entityType, entityId, action, payload, createdAt

### Notes

- Shared workspaces exist in the schema to avoid repainting the data model later, but the MVP UI can operate against a default workspace.
- Germination tests, reminder tasks, uploads, and advanced logs are intentionally deferred.

## Calendar Logic

The first implementation uses frost-date-relative windows only.

Supported planning windows:

- sow indoors: relative weeks before last frost
- sow outdoors: relative weeks before last frost
- transplant: relative weeks after last frost
- harvest: relative days after planting event

The `/calendar` service should:

- resolve the active growing profile
- expand cultivation rules into planned events
- return only the next 14 days by default
- label each event as `planned` or `recorded`
- include enough metadata to start a planting action from the UI

Phänological triggers remain V1 work.

## UI Shape

The MVP should include:

- login screen
- authenticated app shell with sidebar/top navigation
- dashboard with upcoming 14-day calendar list
- varieties index and detail editor
- seed batch creation within a variety detail view
- growing profile editor
- cultivation rule editor
- planting event dialog/form launched from a calendar item
- simple history list on the variety detail page

The design direction should feel practical and field-ready rather than dashboard-heavy.

## Security Baseline

- password hashing with `bcrypt` or `argon2`
- session cookie auth for the web app
- route guards on all authenticated screens and API endpoints
- role checks in service-layer entry points
- audit log writes for mutations
- `.env.example` committed before any runtime secret is required

## Delivery Plan

### Devops

- initialize project runtime
- add `docker-compose.yml`
- add `.env.example`
- add CI workflow for install, lint, test, and build

### Backend

- define Prisma schema and initial migration
- implement auth and seed-bank/calendar endpoints
- implement calendar calculation service
- add unit and route tests

### Frontend

- implement app shell and authenticated routes
- implement CRUD forms for MVP entities
- integrate calendar-to-planting flow
- add responsive styling for mobile and desktop

### QA

- codify MVP acceptance checks
- add Playwright happy-path coverage
- validate invalid-input and stock-deduction scenarios

## Definition Of Done

- code merged to the main workspace
- Docker Compose boots successfully
- database migrations apply cleanly
- lint, unit tests, and end-to-end tests pass locally
- README documents setup, run, test, and seed data flow
- known gaps are documented explicitly
