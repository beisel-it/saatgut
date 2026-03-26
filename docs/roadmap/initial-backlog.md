# Saatgut MVP Backlog

## MVP Goal

Deliver a self-hostable web application that lets a user:

- sign in to a private workspace
- maintain species and varieties
- track seed batches with stock information
- define one growing profile with frost dates
- maintain cultivation rules per variety
- view the next 14 days of calculated calendar work
- record planting events against a seed batch

This is the smallest slice that proves the product promise in `reference.md` without drifting into V1 features such as reminders, MCP, exports, or photo uploads.

## MVP Exit Criteria

- local development starts with one documented command
- Docker Compose starts the full stack with app and PostgreSQL
- authentication works for an initial admin user
- varieties and seed batches can be created, listed, and viewed
- planting profiles and cultivation rules can be created and edited
- the calendar endpoint returns the next 14 days of planned work for the active profile
- a planting event can be recorded from a planned calendar action
- recording a planting event updates seed batch stock and appears in history
- API contracts, database migrations, and UI happy-path checks pass locally

## Delivery Slices

### Slice 1: Architecture And Repo Foundation

Objective: choose the runtime and lock the module boundaries before parallel implementation.

- `tech-lead` owns architecture, stack choice, repository standards, and dependency graph
- `devops` owns local container runtime, environment template, and CI baseline
- output: technical spec, dev commands, Compose stack, CI skeleton

### Slice 2: Backend MVP Surface

Objective: build the API and data model for the MVP entities.

- `backend-dev` owns schema, migrations, auth, API routes, and calendar calculation service
- output: documented API for auth, varieties, seed batches, profiles, rules, plantings, and calendar

### Slice 3: Frontend MVP Surface

Objective: build the authenticated app shell and the main product flows.

- `frontend-dev` owns routing, app shell, list/detail forms, and calendar/planting interactions
- output: responsive UI for the MVP entities against the backend API

### Slice 4: Quality Gates

Objective: make the MVP safe to review and demo.

- `qa-engineer` owns acceptance criteria, API happy-path verification, and browser flow checks
- output: test plan, automated checks, and manual verification notes

## Task Map

1. `tech-lead`: finalize MVP technical specification and backlog
2. `devops`: scaffold runtime, Compose stack, env template, and CI baseline
3. `backend-dev`: implement backend API, schema, migrations, and tests
4. `frontend-dev`: implement web UI for MVP flows
5. `qa-engineer`: implement test coverage and acceptance verification
6. `tech-lead`: review, merge, integrate, and close project loop

## Dependency Rules

- frontend depends on the technical spec and backend contract
- backend depends on the technical spec and dev runtime conventions
- QA depends on the technical spec and then validates backend/frontend outputs
- final integration depends on devops, backend, frontend, and QA completing their work

## Explicit Out Of Scope

- shared workspaces and multi-role administration beyond the initial admin/member split
- germination test workflows
- reminders, notifications, or recurring task generation
- export/import features
- MCP server, agent skill package, and external integrations
- image uploads and advanced logging analytics

These stay in the backlog but do not block the MVP.
