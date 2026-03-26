# QA Implementation Readiness Review

## Summary

QA should target the seed-bank MVP only. The earlier waitlist slice is obsolete and should not be used as a quality baseline.

## Current Readiness Assessment

1. Product direction is explicit in `reference.md` and the roadmap docs.
2. The runtime scaffold is now present and baseline verification passes for `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
3. The repository includes the expected seed-bank MVP baseline pieces: Next.js app shell, Prisma schema and migrations, Docker Compose, health route, and Vitest configuration.
4. Executable QA for the product flow is still blocked on missing feature implementation for auth, catalog, seed batches, growing profiles, cultivation rules, calendar logic, and planting writes.
5. Automated checks still need to expand from the current health smoke test to the MVP flows described in the roadmap.

## Minimum Unblock Conditions

- a deterministic sign-in path
- one end-to-end path covering variety, batch, profile, calendar, and planting work
- API and UI surfaces for catalog, seed batches, profiles, rules, calendar, and planting flows
- automated coverage for unit, integration, and end-to-end MVP scenarios beyond the current health check
