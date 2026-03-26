# First Slice Test Cases

## Scope

These test cases cover the seed-bank MVP:

1. authentication
2. variety creation
3. seed batch creation
4. growing profile creation
5. cultivation rule creation
6. 14-day calendar generation
7. planting event recording with stock deduction

## Preconditions

- the app can be started locally from documented commands
- PostgreSQL is available through the documented runtime flow
- a seeded user can sign in

## Functional Test Cases

### TC-01 Startup Smoke

- Goal: prove the app boots without crashing
- Expected result:
  - the UI loads successfully
  - migrations complete successfully

### TC-02 Authenticated Entry

- Goal: verify the protected shell is reachable after sign-in
- Expected result:
  - the user reaches the dashboard

### TC-03 Create Variety

- Goal: verify a species and variety can be created
- Expected result:
  - the new variety appears in list and detail views

### TC-04 Add Seed Batch

- Goal: verify stock can be attached to a variety
- Expected result:
  - the batch is saved and visible on the variety detail page

### TC-05 Create Growing Profile

- Goal: verify an active frost-based profile can be created
- Expected result:
  - the profile is saved and marked active

### TC-06 Create Cultivation Rule

- Goal: verify planning rules can be attached to a variety
- Expected result:
  - the rule persists and becomes available to calendar generation

### TC-07 Calendar Generation

- Goal: verify the 14-day list is computed from rule and profile inputs
- Expected result:
  - planned work appears with date, event type, and variety

### TC-08 Record Planting Event

- Goal: verify a planned item can be turned into real history
- Expected result:
  - the event is recorded
  - batch quantity is reduced
  - history reflects the write
