# Saatgut First-Screen Flow

## Purpose

Define the first usable authenticated dashboard flow for the seed-bank MVP.

## First User Outcome

A gardener signs in, sees the next practical garden work derived from the active frost profile, and records one planting event against a seed batch without leaving the main workflow.

## Primary MVP Flow

1. User signs in.
2. User lands on the dashboard.
3. User sees the active profile and the next 14 days of planned work.
4. User opens one planned calendar item.
5. User selects a seed batch and quantity.
6. User records the planting event.
7. User sees updated stock and history confirmation.

## First-Screen Information Architecture

### 1. App Shell

- Saatgut wordmark
- primary navigation
- active growing profile indicator

### 2. Dashboard Header

- page title
- compact summary of the active profile
- quick links to varieties and profiles

### 3. Upcoming Calendar List

- grouped by date
- event type, variety, and due date
- action to record planting

### 4. Context Panel

- profile summary
- relevant stock cues
- direct link to related variety details

### 5. Planting Capture Surface

- seed batch selector
- quantity used
- actual date
- optional notes and location
- inline validation and in-place success or failure feedback

1. Five-second test: show the first screen and ask what the product offers.
2. CTA clarity test: ask a user what they would click first.
3. Form comprehension test: confirm all fields are understandable without explanation.
4. Error recovery test: submit invalid data and verify recovery is obvious.
5. Completion test: submit valid data and confirm the success state is unmissable.

## Handoff Notes

For the next disciplines, this UX definition implies:

- `frontend-dev`: build the authenticated dashboard, upcoming calendar list, and planting capture surface
- `backend-dev`: provide the auth, calendar, seed-batch, and planting endpoints required by the main workflow
- `tester`: verify sign-in, calendar rendering, planting validation, stock deduction, failure recovery, and mobile usability

This keeps the first runnable slice small while still proving the full loop from authenticated planning to recorded planting work.
