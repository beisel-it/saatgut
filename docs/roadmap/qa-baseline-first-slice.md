# QA Baseline For First Runnable Slice

## Purpose

Define the acceptance contract for the Saatgut seed-bank MVP.

## Flow Under Test

The MVP is complete only if a user can:

1. sign in
2. create or access a variety
3. add a seed batch
4. define an active growing profile
5. attach cultivation rules
6. view the next 14 days of planned calendar work
7. record a planting event from a planned item
8. see stock deduction and history confirmation

## Release Gate

1. local startup succeeds from documented commands
2. app and PostgreSQL start successfully
3. auth works for the seeded user path
4. catalog, batch, profile, and rule data persist correctly
5. calendar output matches the active profile and rule inputs
6. planting writes update stock and history consistently
7. automated checks pass
8. the main flow works on mobile and desktop

## Baseline Automated Checks

- startup smoke test
- calendar calculation unit tests
- auth and protected-route integration tests
- CRUD integration tests for varieties, seed batches, and profiles
- end-to-end test for the dashboard-to-planting happy path
- failure-path test for rejected planting writes
