# QA Implementation Readiness Review

## Summary

QA should target the seed-bank MVP only. The earlier waitlist slice is obsolete and should not be used as a quality baseline.

## Current Readiness Assessment

1. Product direction is explicit in `reference.md` and the roadmap docs.
2. The repository still needs a runnable integrated application for executable QA.
3. `package.json` does not yet define the install, dev, lint, test, or e2e scripts implied by the roadmap and README.
4. The runtime scaffold for the selected stack is not present yet: there is no Next.js app setup, Prisma schema, Docker Compose file, or Playwright/Vitest configuration.
5. Automated checks must target auth, catalog, profiles, calendar, and planting flows once the runtime scaffold exists.

## Minimum Unblock Conditions

- a documented app startup command
- a documented automated test command
- package scripts that implement those documented commands
- a deterministic sign-in path
- one end-to-end path covering variety, batch, profile, calendar, and planting work
