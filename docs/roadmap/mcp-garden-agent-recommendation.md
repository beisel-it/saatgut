# MCP Garden Agent Recommendation

## Goal

Assess whether the current Saatgut MCP surface and the `skills/saatgut-mcp-agent` package are sufficient for a garden agent that can safely read and mutate workspace data, and recommend the smallest credible path from today's implementation to that target.

## Current Baseline

### What already exists

- MCP endpoint: `POST /api/v1/mcp` using JSON-RPC over streamable HTTP.
- Authentication: bearer API token only. Session-cookie auth is explicitly rejected for MCP.
- Origin control: browser-origin requests are checked against `MCP_ALLOWED_ORIGINS`.
- Scope model: tools are gated by coarse token scopes (`READ`, `WRITE`, `ADMIN`, `EXPORT`).
- Auditing: every MCP tool call writes an `mcp.tool.call` audit entry with arguments and status.
- Prompt policy: the server and skill both instruct agents to use MCP-only data, ask follow-up questions on ambiguity, and preview writes with `dry_run=true`.

### Current tools

Read tools:

- `calendar_preview`
- `seed_batch_status`
- `list_varieties`
- `get_variety`

Write tools:

- `create_planting_event`
- `log_observation`
- `create_task`
- `complete_task`

### Current resources

- `saatgut://workspace/summary`
- `saatgut://profiles/active`
- `saatgut://calendar/next-14-days`

### Current prompts

- `weekly_plan`
- `conservation_review`
- `seed_quality_review`

## Recommendation

The current MCP surface is a useful planning assistant API, but not yet a safe first-class garden agent API.

It is strong enough for:

- read-only planning around the next calendar window
- limited write execution when a human or upstream orchestration already knows the correct IDs
- auditable, token-scoped automation for a narrow set of workflows

It is not strong enough for:

- autonomous workspace exploration
- safe mutation across the full gardening domain
- collaboration-aware agent actions in shared workspaces
- robust approval flows for higher-impact writes

Recommendation: keep the current MCP surface as the seed of the garden agent contract, but extend it in staged layers instead of exposing the full REST API wholesale through MCP.

## Capability Gaps

### 1. Discovery is too narrow

The skill asks the agent to inspect workspace state before acting, but the available resources and tools expose only a small slice of that state.

Missing high-value read coverage:

- species list/detail
- seed batch list/search/filter
- planting list/detail
- cultivation rule list/detail
- growing profile list/detail
- journal list/search/filter
- reminder task list/detail/filter
- workspace member list and role summary
- audit log read access for agent traceability
- richer workspace summaries such as urgent tasks, overdue actions, low-stock batches, missing germination tests, and recent activity

Effect: an agent cannot reliably understand the workspace before mutating it, so it will either ask too many follow-ups or act from partial context.

### 2. Mutation coverage is too shallow

The garden domain already has REST contracts for more than the MCP layer exposes. MCP currently cannot operate on many important entities it should understand.

Missing write coverage includes:

- update/delete for plantings
- profile updates including active-profile changes and phenology state
- cultivation rule updates
- seed batch corrections, stock reversals, and germination test creation
- task edits, reopen, reschedule, and delete
- journal edits where correction semantics matter
- collaborator-safe workflows where ownership or role restrictions matter

Effect: a garden agent can create a few records, but cannot manage the lifecycle of the data it creates or repair mistakes safely.

### 3. Safety is partly advisory, not protocol-enforced

The skill says writes should always be two-step with `dry_run=true`, but the server does not require that sequence. A caller can skip straight to mutation.

Other missing safety controls:

- no confirmation token linking a preview to the committed write
- no expiry window for a preview
- no idempotency key for retried writes
- no optimistic concurrency guard for update/delete flows
- no mutation classes more granular than `WRITE`
- no separate "planner" vs "actor" capability boundary

Effect: safe behavior depends on the caller following instructions, not on the contract rejecting unsafe patterns.

### 4. Shared-workspace boundaries are underspecified for agents

Current auth checks workspace membership and token scopes correctly, but agent-facing boundaries are still coarse.

Open questions the contract does not yet answer:

- Should an agent using a member-owned token be allowed to mutate records assigned to another member?
- Should agents be allowed to manage workspace membership at all?
- Which actions require owner/admin-only approval even when a token has `WRITE`?
- How should destructive or high-impact changes be surfaced to collaborators?

Effect: the API is secure at the transport/auth layer, but not yet fully policy-shaped for collaboration-aware automation.

### 5. Testing does not cover the risky paths yet

Current MCP tests cover initialization, listing, and origin parsing. They do not deeply cover:

- actual tool execution against the database
- scope denial by tool class
- audit entries for success vs dry-run vs failure
- attempts to bypass preview-first write policy
- ambiguous IDs or cross-workspace references
- browser-origin plus bearer-token edge cases

Effect: the surface is still lightly verified relative to the trust level required for an autonomous garden agent.

## Needed Contract Extensions

### Read model extensions

Add first-class MCP tools or resources for:

- `list_species`, `get_species`
- `list_seed_batches`, `get_seed_batch`
- `list_profiles`, `get_profile`
- `list_cultivation_rules`, `get_cultivation_rule`
- `list_plantings`, `get_planting`
- `list_journal_entries`, `get_journal_entry`
- `list_tasks`, `get_task`
- `get_workspace_members`
- `get_recent_audit_log`

Also add aggregate resources that reduce exploratory tool chatter:

- `saatgut://workspace/dashboard`
- `saatgut://seed-batches/attention`
- `saatgut://tasks/open`
- `saatgut://journal/recent`

Design preference: use resources for common snapshots and tools for targeted search/detail operations.

### Write model extensions

Expose only the write workflows a garden agent can complete safely end to end:

- `update_planting`
- `delete_planting`
- `update_task`
- `reopen_task`
- `reschedule_task`
- `create_germination_test`
- `create_seed_batch_correction`
- `reverse_seed_batch_transaction`
- `update_profile_phenology`
- `update_cultivation_rule`

Do not expose workspace membership or admin-user mutation through MCP in the first garden-agent release.

### Safer write protocol

Move from optional previewing to enforced review/commit semantics:

1. `tools/call` with `mode=preview` returns:
   - normalized input
   - affected entities
   - computed diff
   - business-rule warnings
   - a short-lived `confirmationToken`
2. `tools/call` with `mode=commit` must present that token unchanged.
3. The server rejects commits without a valid preview token.

Also add:

- `idempotencyKey` on all write tools
- optional `expectedUpdatedAt` or equivalent revision guard for update/delete
- explicit `riskLevel` metadata per tool so orchestration can decide whether human confirmation is required

### Finer-grained capabilities

The current `READ` and `WRITE` scopes are too broad for agent automation. Add MCP-facing capability groups such as:

- `MCP_READ_CATALOG`
- `MCP_READ_OPERATIONS`
- `MCP_WRITE_JOURNAL`
- `MCP_WRITE_TASKS`
- `MCP_WRITE_PLANTINGS`
- `MCP_WRITE_SEED_STOCK`
- `MCP_ADMIN_AUDIT`

These can still map internally to the existing token model at first, but the registry should be ready for narrower grants.

### Agent-trace metadata

Extend MCP auditing with run-level metadata:

- `agentRunId`
- `conversationId`
- `previewOf` or `confirmationToken`
- optional human approver identity when commits are confirmed externally

This keeps the audit log useful when an agent performs multiple related calls in one session.

## Security Boundaries

### Boundaries that are already good

- MCP rejects cookie/session auth and requires bearer API tokens.
- Token scope checks are enforced server-side.
- Workspace membership is enforced server-side.
- Requests from browsers can be origin-restricted.
- Every tool call is audited.
- Underlying domain services already enforce some role and membership restrictions.

### Boundaries that should remain hard limits

- No anonymous MCP writes.
- No cookie-auth fallback for MCP.
- No cross-workspace references.
- No silent destructive writes without explicit commit semantics.
- No membership/admin mutations via garden-agent MCP until the approval model is defined.

### Boundaries that need strengthening

- Treat preview-first as an enforced protocol, not a skill instruction.
- Split write authority into smaller capability classes.
- Add stronger replay protection and retry semantics.
- Add better correlation between MCP actions and audit log records.
- Add explicit policy for shared-workspace actions that affect another member's work.

## Skill Package Changes

The current `skills/saatgut-mcp-agent/SKILL.md` is directionally correct but too small for a broader garden agent. It should be updated after the contract changes, not before.

Recommended additions:

- distinguish planning-only tools from mutation tools
- require reading workspace dashboard resources before mutation
- require confirmation-token commit flow, not just `dry_run=true`
- define escalation rules for ambiguous ownership, low-confidence IDs, or destructive actions
- define a maximum mutation batch size per run
- define when the agent must stop and hand back to a human

The skill should stay conservative. Safety-critical behavior belongs in the server contract, with the skill reinforcing it.

## Staged Implementation Plan

### Stage 0: Research closeout

- approve this memo as the target direction
- decide whether the first garden agent is read-mostly or read/write
- decide whether shared-workspace agent writes are in scope for v1

### Stage 1: Read-complete garden context

- add missing list/detail tools and dashboard-style resources
- add MCP tests for real reads, scope checks, and cross-workspace denials
- update the skill to use the new read surface

Outcome: a useful planning and review agent with low operational risk.

### Stage 2: Safe write protocol

- replace informal `dry_run` guidance with preview/commit confirmation tokens
- add idempotency keys and revision guards
- expand audit metadata for agent-run correlation
- add tests for replay, stale previews, and denied commits

Outcome: writes become contractually safe enough for supervised automation.

### Stage 3: Targeted operational mutations

- expose a limited set of high-value, reversible write tools
- start with tasks, journal entries, planting edits, phenology updates, and seed quality operations
- keep admin and collaborator-management flows out of scope

Outcome: the garden agent can perform practical day-to-day operations without broad admin power.

### Stage 4: Human-in-the-loop automation

- add optional external approval hooks for elevated mutations
- surface risk classes in tool metadata
- require human confirmation for destructive or collaborator-affecting actions

Outcome: the system can support more autonomous workflows without lowering the safety bar.

## Bottom Line

Use the current MCP layer as the foundation, but do not treat it as garden-agent ready yet.

The immediate next move should be to make the read surface broad enough for trustworthy workspace understanding, then enforce preview/commit semantics for writes before expanding mutation coverage. The safest first release is a read-complete planning agent with a small set of reversible, strongly-audited write tools.
