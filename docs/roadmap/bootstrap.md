# Bootstrap Notes

This document records the agreed runtime conventions for the Saatgut seed-bank MVP.

## Selected Runtime

- application: Next.js 15 with TypeScript
- persistence: PostgreSQL 16
- ORM and migrations: Prisma
- validation: Zod
- unit and integration tests: Vitest
- browser tests: Playwright
- local orchestration: Docker Compose

## Local Runtime Conventions

- work from `/home/florian/.openclaw/workspace/saatgut`
- keep one install command, one dev run command, and one verification command
- prefer `package.json` scripts for application workflows
- use Docker Compose for full-stack verification
- default local web port is `3000`

## Environment Notes

- keep secrets only in `.env.local` or `.env`
- document every required variable in `.env.example`
- use responsibility-based names such as `DATABASE_URL` and `AUTH_SECRET`

## Constraint

Do not add or preserve a parallel waitlist or Python runtime. All bootstrap work should strengthen the single seed-bank MVP stack.
