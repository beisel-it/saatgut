# QA Implementation Readiness Review

## Summary

QA should target the seed-bank MVP only. The earlier waitlist slice is obsolete and should not be used as a quality baseline.

## Current Readiness Assessment

1. Product direction is explicit in `reference.md` and the roadmap docs.
2. The repository still needs a runnable integrated application for executable QA.
3. Automated checks must target auth, catalog, profiles, calendar, and planting flows.

## Minimum Unblock Conditions

- a documented app startup command
- a documented automated test command
- a deterministic sign-in path
- one end-to-end path covering variety, batch, profile, calendar, and planting work
