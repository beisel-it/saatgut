# First Slice Test Cases

## Scope

These test cases cover Saatgut's agreed first runnable slice:

1. landing page render
2. value proposition clarity
3. CTA to waitlist form
4. waitlist submission with `email` and `interest`
5. in-place success confirmation

This document remains mostly stack-agnostic until the implementation exists, even though a JavaScript toolchain has now been initialized.

## Preconditions

- the app can be started locally from documented commands
- test or mock persistence is available for waitlist submissions
- the homepage is reachable in a browser

## Functional Test Cases

### TC-01 Startup Smoke

- Goal: prove the app shell starts and renders without crashing
- Steps:
  1. Install dependencies from repository instructions.
  2. Start the local app.
  3. Open the homepage.
- Expected result:
  - the page loads successfully
  - no fatal application error is shown
  - no critical console/runtime error appears during initial render

### TC-02 Hero Communicates Product Value

- Goal: confirm a first-time visitor can understand the offer quickly
- Steps:
  1. Open the homepage on desktop.
  2. Read only the header and hero content.
- Expected result:
  - the product purpose is understandable from the first screen
  - there is exactly one dominant primary CTA

### TC-03 CTA Reaches Waitlist Form

- Goal: verify the primary CTA leads directly into the only core flow
- Steps:
  1. Open the homepage.
  2. Activate the primary CTA.
- Expected result:
  - focus, scroll position, or visual attention moves to the waitlist form
  - no hidden intermediate steps or route changes are required

### TC-04 Required Form Fields

- Goal: verify the form surface matches the agreed minimal scope
- Steps:
  1. Open the waitlist form.
  2. Inspect visible required inputs.
- Expected result:
  - only `email` and one single-choice `interest` field are required
  - supported interest options are:
    - `Growing food at home`
    - `Learning what to plant`
    - `Getting updates when Saatgut launches`

### TC-05 Empty Submit Validation

- Goal: verify required-field validation
- Steps:
  1. Open the form.
  2. Submit without entering any value.
- Expected result:
  - inline validation appears for missing email
  - inline validation appears for missing interest
  - the user remains on the same page

### TC-06 Invalid Email Validation

- Goal: verify email format validation and value preservation
- Steps:
  1. Select a valid interest option.
  2. Enter an invalid email such as `abc`.
  3. Submit the form.
- Expected result:
  - an understandable inline email error is shown
  - the selected interest remains selected
  - the typed email remains visible for correction

### TC-07 Missing Interest Validation

- Goal: verify interest selection is required
- Steps:
  1. Enter a valid email.
  2. Leave interest unselected.
  3. Submit the form.
- Expected result:
  - an inline validation error is shown for the missing interest
  - the entered email remains visible

### TC-08 Happy Path Submission

- Goal: verify a valid user can complete the primary flow
- Steps:
  1. Open the form.
  2. Enter a valid email.
  3. Select one interest option.
  4. Submit the form.
- Expected result:
  - the submit action enters a visible loading state
  - inputs are temporarily disabled while the request is in flight
  - the submission reaches the configured data layer
  - the form is replaced or collapsed in place
  - a success state is shown without full page reload

### TC-09 Success State Echo

- Goal: confirm the result is specific to the submitted data
- Steps:
  1. Complete a valid submission.
  2. Inspect the success panel.
- Expected result:
  - the success state echoes the selected interest area
  - the user can clearly tell their submission was accepted

### TC-10 Submission Failure Recovery

- Goal: verify graceful handling of request failure
- Steps:
  1. Simulate a backend or network failure.
  2. Enter a valid email and interest.
  3. Submit the form.
- Expected result:
  - a form-level error message is shown
  - previously entered values remain intact
  - the user can retry immediately without re-entering data

### TC-11 Retry After Failure

- Goal: prove the error path does not dead-end the user
- Steps:
  1. Trigger the failure case from TC-10.
  2. Restore the backend or mock success path.
  3. Retry the same submission.
- Expected result:
  - the retry succeeds
  - the success panel appears in place

### TC-12 Mobile Layout

- Goal: validate the critical flow on a narrow viewport
- Steps:
  1. Open the homepage on a mobile-sized viewport.
  2. Complete the happy path.
- Expected result:
  - all required content and actions remain visible or reachable
  - no hidden required interactions block completion

### TC-13 Desktop Layout

- Goal: validate the critical flow on a standard desktop viewport
- Steps:
  1. Open the homepage on desktop.
  2. Complete the happy path.
- Expected result:
  - the primary CTA remains visually dominant
  - the full flow completes without layout breakage

## Planned Automated Coverage

When the implementation lands, automation should map to these minimum checks:

- unit test for email validation
- unit test for required interest validation
- integration test for CTA to form focus/scroll behavior
- integration test for happy-path submission and in-place success
- integration test for failed submission with preserved values and retry
- boundary test proving the submitted payload reaches persistence or mock persistence unchanged

## Current Blocker

The repository now includes a runtime manifest, but it still has no application source files and no configured automated test flow beyond a placeholder `npm test`. These cases define what QA will verify once the frontend and backend slices exist.
