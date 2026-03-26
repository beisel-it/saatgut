# Saatgut Project Context

## Product Frame

Saatgut is a self-hosted web app for maintaining a seed bank, documenting cultivation work, and deriving a practical sowing and planting calendar from local frost dates and variety rules.

The immediate milestone is a real MVP, not a marketing placeholder. The system should already behave like a useful private garden logbook with calendar support.

## MVP User Outcome

The first milestone succeeds when a user can:

1. sign in
2. create or browse a variety
3. add a seed batch for that variety
4. define a growing profile with frost dates
5. attach cultivation rules to the variety
6. view calculated upcoming work in a 14-day calendar list
7. record a planting event from that plan

This proves the product loop from reference data to actionable garden work.

## First Target User

The initial user is a self-managing hobby gardener who wants to replace a paper seed notebook with a structured digital system.

Operationally, that means:

- one admin-capable user is enough for MVP validation
- collaboration exists in the data model only where it does not add major complexity
- the app must work well on desktop and on a phone in the garden

## MVP Scope Boundaries

In scope:

- authentication with an initial admin/member model
- species, varieties, and cultivation rules
- seed batches with stock quantity and storage notes
- one active growing profile with first/last frost dates
- a calculated calendar list for the next 14 days
- planting event capture linked to a seed batch
- stock reduction and visible event history
- local setup, Docker Compose, and baseline automated checks

Out of scope:

- reminders and scheduled notifications
- germination test workflows and warning heuristics
- exports, imports, and backups beyond developer notes
- MCP server and agent skill integration
- image uploads and advanced observations
- advanced multi-workspace collaboration

## Technical Direction

The implementation should optimize for:

- one monorepo
- one web frontend
- one API backend
- PostgreSQL for persistence
- Docker Compose for local and Portainer-friendly deployment
- OpenAPI-described REST endpoints as the internal contract

## Delivery Priorities

1. lock the stack and technical spec
2. establish the runtime and CI baseline
3. implement backend and frontend MVP flows in parallel
4. validate the end-to-end path and merge the work

## Team Expectations

- `tech-lead` owns architecture, backlog coordination, review, and integration
- `devops` owns runtime and deployment scaffolding
- `backend-dev` owns the API, schema, migrations, and calendar engine
- `frontend-dev` owns the UI shell and MVP interaction flows
- `qa-engineer` owns acceptance criteria, automated checks, and final verification

## Constraints

- prefer a small, conventional stack
- avoid speculative V1/V2 features in MVP branches
- document contracts before parallel work starts
- keep the app deployable through a compact Docker stack

## Definition Of Progress

Progress counts only if it improves the usable seed-bank and calendar MVP described above.
