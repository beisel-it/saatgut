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

## Current Scaffold Scope

This baseline includes:

- a Next.js 15 App Router shell
- Prisma schema for the MVP seed-bank domain
- PostgreSQL container orchestration
- `/api/health` for runtime checks
- GitHub Actions CI for install, Prisma generation, migration deploy, lint, test, and build

Application feature work such as auth flows, CRUD screens, and calendar logic remains to be implemented on top of this scaffold.
