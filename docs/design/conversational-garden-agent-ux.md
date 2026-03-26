# Conversational Garden-Agent UX Recommendation

Date: 2026-03-26
Owner: frontend-dev
Task: c9dab244
Status: research spike only, no UI implementation

## Purpose

Define how conversational garden-agent assistance should fit Saatgut without turning the product into a generic chat app or hiding consequential garden actions behind opaque automation.

This recommendation is grounded in:

- the shipped application shell and current user journey
- the garden-first product framing in `reference.md`
- the landed MCP/tooling contract in `src/lib/server/mcp/server.ts`
- the existing safety policy in `src/lib/server/mcp/prompts.ts`

## Product Position

Saatgut should present the agent as a guided garden helper, not as the primary interface to the system.

The assistant should:

- help users understand what matters now
- prepare structured garden actions from natural language
- show exactly what it plans to change before anything is written
- stay visibly tied to the user’s own workspace data, rules, and history

The assistant should not:

- replace the core catalog, profile, rules, planting, or print-sheet workflows
- appear as an always-dominant chat surface
- commit writes directly from free text without a review step
- answer from “general gardening knowledge” without clearly separating it from workspace-specific recommendations

## Recommended UX Model

### 1. Surface model

Use a sidecar assistant model, not a full-screen chat product.

Recommended shape:

- a persistent but low-prominence `Gartenhilfe` entry point in the authenticated shell
- a right-side drawer on desktop
- a full-height sheet on mobile
- contextual launch links from relevant surfaces

This matches the current app, which is still organized around:

- `Übersicht`
- `Katalog`
- `Profile`
- `Regeln`
- `Pflanzungen`
- `Druckbögen`
- workspace/account management

The assistant should support those surfaces, not compete with them.

### 2. Primary modes

The assistant should have three clearly separated modes:

1. Ask
   Read-only interpretation, explanation, and summarization.
2. Prepare
   Structured draft actions based on user intent, always previewed first.
3. Confirm
   Explicit user approval before any write is committed.

This mirrors the existing MCP model where write tools already support `dry_run=true`.

### 3. Conversation framing

Each conversation should begin with visible workspace context:

- active workspace name
- active growing profile, if any
- freshness marker such as “based on current data”
- whether the answer is read-only guidance or a change proposal

This reduces the risk that users treat the assistant like a general chatbot and assume unsupported certainty.

## Entry Point Recommendation Backlog

### P1. Global shell entry point

Recommendation:

- add a shell-level `Gartenhilfe` trigger near the existing workspace/account controls
- keep it available from every authenticated screen
- show unread/recent activity state only when relevant, not as a noisy badge system

User problem:
Without a stable global entry point, the assistant will feel bolted on or only discoverable from one screen.

Direction:
Make the assistant universally reachable, but visually secondary to the main navigation.

### P1. Dashboard contextual launch

Recommendation:

- add contextual prompts from `Übersicht`, especially near the 14-day calendar and seed-quality sections
- examples:
  - “Was soll ich diese Woche tun?”
  - “Welche Chargen sollte ich zuerst prüfen?”
  - “Hilf mir beim Einplanen dieser Kalenderpunkte”

User problem:
The dashboard is where users already ask “what matters now,” so this is the most natural first-use entry point.

Direction:
Make the dashboard the strongest read-only and planning launch surface.

### P2. Catalog contextual launch

Recommendation:

- add contextual agent entry points on variety and seed-batch detail surfaces
- examples:
  - “Bewerte diese Charge”
  - “Fasse Lager- und Keimlage zusammen”
  - “Bereite eine Korrektur vor”

User problem:
Catalog work often needs interpretation across stock, warnings, and test history.

Direction:
Use the assistant as a record-aware explainer and action-preparation layer.

### P2. Planting/rules/profile contextual launch

Recommendation:

- support lightweight prompts from:
  - `Profile`: “Wie gut passt mein Profil zur Saison?”
  - `Regeln`: “Prüfe, ob diese Regel vollständig genug ist”
  - `Pflanzungen`: “Bereite eine Aussaat aus dem Kalender vor”

User problem:
These are high-friction planning surfaces where users may know their goal but not the exact field-level action.

Direction:
Let the assistant bridge intent to structured forms.

### P3. Print-sheet and collaboration launch

Recommendation:

- later add agent entry points for:
  - generating a print-set recommendation
  - summarizing workspace activity for collaborators

User problem:
Useful, but not the first place to validate conversational assistance.

Direction:
Defer until core assistant trust patterns are proven.

## Trust And Confirmation Patterns

### A. Split answers from actions

Every assistant response should be labeled as one of:

- `Antwort`
- `Vorschlag`
- `Aktion zur Bestätigung`
- `Aktion ausgeführt`

User problem:
Users must never wonder whether the assistant already changed data.

Direction:
Use explicit status framing and color/label hierarchy, not subtle copy.

### B. Mandatory preview for writes

All write operations should follow:

1. user intent
2. assistant proposal
3. editable structured preview
4. explicit confirmation
5. result receipt

No write should jump directly from text prompt to committed mutation.

This should be hard-wired even if the backend technically allows direct MCP writes, because the product promise in `reference.md` is review-first and audit-friendly.

### C. Match confirmation strength to risk

Use three confirmation levels:

1. Low-risk
   Creating a draft task or logging a non-destructive observation.
2. Medium-risk
   Creating a planting event or updating an existing record.
3. High-risk
   Removing records, changing stock, changing member access, or running multi-step actions.

Recommended behavior:

- low-risk: single confirm button
- medium-risk: preview plus confirm
- high-risk: preview plus typed or second-step confirmation

### D. Show affected records before confirm

Every action preview should list:

- target records by name
- what will be created, edited, or removed
- stock effects
- dates used
- active profile or rules involved

User problem:
Garden work is record-heavy and similar names are common.

Direction:
Prevent wrong-record actions through visible grounding, not error handling after the fact.

## Editable Action Preview Model

### Core principle

The assistant should generate structured drafts, not locked summaries.

The preview should be editable in-place before confirmation.

### Recommended preview shapes

For planting creation:

- variety
- seed batch
- profile
- event type
- date
- quantity
- location note
- expected stock deduction

For task creation:

- title
- due date
- linked variety/batch/planting
- assignee
- tags

For observation logging:

- entry type
- title
- details
- date
- related records

For future stock or batch actions:

- current quantity
- proposed quantity delta or absolute quantity
- reason
- effective date
- reversal risk notice if applicable

### Preview affordances

Each preview should support:

- edit field
- clear field
- choose different record
- cancel entire proposal
- ask a follow-up question instead

### Multi-step plans

When the user asks for a compound intent such as:

- “Plane meine nächste Woche”
- “Bereite Tomaten für die Aussaat vor”

the assistant should return:

1. a short narrative summary
2. a grouped action list
3. per-action preview cards
4. confirm individually or confirm selected actions

Do not offer “run all” by default on first rollout.

## Provenance And Audit Expectations

### What the user should see

Every meaningful assistant answer should include a compact “based on” section when applicable:

- active profile used
- varieties or batches referenced
- calendar window used
- last relevant germination test or warning
- whether the answer used only workspace data or also general gardening guidance

This should read like provenance, not like raw backend diagnostics.

Example framing:

- “Basiert auf aktivem Profil: Hofgarten 2026”
- “Verwendete Daten: Charge Brandywine 2024, letzter Keimtest vom 12.03.2026”
- “Unsicher, weil für diese Sorte keine Anbauregel hinterlegt ist”

### What the audit system should capture

The user-facing UX should assume and expose that audit exists for:

- dry-run proposal generation for write tools
- confirmed action execution
- errors on attempted writes

Recommended future audit fields for the assistant experience:

- acting user
- assistant mode: read-only, proposal, confirmed write
- tool name
- dry-run vs committed
- affected record ids
- user-confirmed timestamp
- short natural-language intent summary

### User-visible history

Recommendation:

- add a future `Assistentenaktivität` history slice inside workspace/account or audit views
- show recent confirmed actions and failed write attempts

User problem:
Trust increases if users can answer “what did the assistant do?” after the fact.

## Failure State Recommendation

### 1. Ambiguous records

Example:
Multiple Brandywine-related varieties or batches exist.

UX response:

- stop the action
- ask a clarifying question
- show selectable candidates
- do not guess

### 2. Missing planning inputs

Examples:

- no active growing profile
- no cultivation rule for the requested variety
- no seed batch linked to a sowing request

UX response:

- explain what is missing in garden language
- offer direct next-step actions such as “Profil anlegen” or “Regel ergänzen”
- optionally prepare the missing record instead of failing hard

### 3. Unsafe or unsupported write

Examples:

- destructive action without confirmation
- unsupported batch correction flow
- role/removal action blocked by permission

UX response:

- explain that the action cannot be completed here
- show whether the limit is permission, missing contract, or missing data
- offer the nearest safe alternative

### 4. Stale-data conflict

Example:
Stock changed after preview but before confirmation.

UX response:

- block confirmation
- refresh proposal
- clearly say what changed

This is critical for seed quantities and collaborator management.

### 5. Agent uncertainty

Example:
The agent can answer generally but not from workspace evidence.

UX response:

- say what is known
- say what is inferred
- say what is missing
- ask whether the user wants general gardening guidance or only workspace-grounded answers

## Recommended Rollout Proposal

### Phase 0. Contract and policy alignment

Goal:
Align product, backend, and QA before any assistant UI ships.

Deliverables:

- explicit frontend/backlog slice for assistant shell entry point
- confirmed mapping from user-visible action previews to MCP `dry_run` write tools
- audit-log visibility requirements
- copy guidelines for “answer vs proposal vs confirmed action”

### Phase 1. Read-only assistant in dashboard and catalog

Goal:
Ship trustable value without mutation risk.

Scope:

- global assistant entry point
- read-only prompts for:
  - weekly plan
  - seed quality review
  - variety lookup
  - batch status review
- provenance panel in every answer

Success criteria:

- users can ask what matters now and get clearly sourced answers
- no writes are possible yet

### Phase 2. Guided write previews for one narrow workflow

Goal:
Validate review-first write UX with the safest high-value action.

Recommended first write workflow:

- `create_planting_event`

Why:

- already central to the product loop
- already modeled in the app
- already has dry-run support in MCP
- easy to explain and verify in the UI

Scope:

- conversational intent to structured planting draft
- editable preview card
- confirm/cancel flow
- success receipt
- audit visibility

Success criteria:

- no silent writes
- users can inspect exact stock impact before confirming

### Phase 3. Expand to observation and task workflows

Goal:
Broaden assistant usefulness without jumping to destructive administration.

Scope:

- `log_observation`
- `create_task`
- `complete_task`

Reason:

- still useful
- lower risk than stock corrections or member management

### Phase 4. Higher-risk actions and batch plans

Goal:
Support compound garden operations after trust is established.

Scope:

- multi-action weekly plan confirmation
- future stock/correction flows
- collaborator-oriented summaries

Guardrails:

- selected-actions confirm only
- stronger confirmation for destructive or access-related actions
- stale-data revalidation before commit

## Recommended Backlog Priority

### P1

- define assistant surface architecture: shell drawer/sheet, not full chat page
- define answer/proposal/confirmation state language and component model
- define provenance block requirements
- ship read-only dashboard and catalog assistance first
- ship planting-event preview as the first write workflow

### P2

- add contextual launches from dashboard, catalog, profiles, rules, and plantings
- add user-visible assistant activity history
- support selected multi-action confirmation
- add stale-data conflict handling UX

### P3

- assistant support for print-sheet recommendations
- collaboration-aware assistant summaries
- more advanced write batching and workflow orchestration

## Final Recommendation

Saatgut should not launch “chat” as a new primary product area.

It should launch a garden assistant that:

- lives beside the main workflows
- starts read-only
- grounds every answer in workspace data
- prepares editable action previews instead of hiding form logic
- makes confirmation and audit visibility part of the user experience

The best first implementation is a shell-integrated sidecar with dashboard-first read-only guidance and one narrow, review-first planting action flow.
