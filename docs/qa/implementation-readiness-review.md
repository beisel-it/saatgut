# QA Implementation Readiness Review

## Summary

QA should target the seed-bank MVP only. The earlier waitlist slice is obsolete and should not be used as a quality baseline.

## Current Readiness Assessment

1. Product direction is explicit in `reference.md` and the roadmap docs.
2. The runtime scaffold is now present and baseline verification passes for `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
3. The repository includes the expected seed-bank MVP baseline pieces: Next.js app shell, Prisma schema and migrations, Docker Compose, health route, and Vitest configuration.
4. The landed implementation now exposes the MVP feature flow for auth, catalog, seed batches, growing profiles, cultivation rules, calendar, and planting writes.
5. Follow-up epics are now covered in automated QA for admin invites and user management, search and filters, germination tests, reminders, exports, API token issuance, OpenAPI exposure, MCP initialization, and a narrow mobile shell pass.
6. Automated coverage now includes both the original auth-to-planting browser path and a follow-up operations browser path, alongside the existing Vitest suite.
7. Local feature validation is green on an isolated Postgres-backed app runtime. Docker Compose deployment validation remains a separate tracked regression because auth-backed requests still depend on the upstream Compose database fix.

## Verification Evidence

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3004 npm run test:e2e -- --reporter=line`
- `npm run build`

## Residual Risk

- Browser coverage is stronger, but invalid-input and failure-recovery scenarios still need dedicated cases.
- Compose deployment validation is still partially blocked by the separately tracked Postgres authentication regression.
