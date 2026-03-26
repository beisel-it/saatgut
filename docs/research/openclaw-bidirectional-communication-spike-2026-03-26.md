# OpenClaw Bidirectional Communication Spike

Date: 2026-03-26
Task: `6c44c316`
Scope: research only, no production integration

## Current Product Surface

The current application already exposes the pieces needed for an agent-facing integration:

- REST API with generated OpenAPI output at `/api/v1/openapi.json`
- session auth for browser users
- bearer API tokens for machine clients
- per-route in-memory rate limiting for users and API tokens
- MCP endpoint at `/api/v1/mcp`
- MCP transport implemented today: `streamable-http`
- MCP auth policy implemented today: bearer API token only
- MCP origin policy implemented today: requests with an `Origin` header must match `MCP_ALLOWED_ORIGINS`
- write-tool safety already present in the MCP layer: `dry_run=true` plus audit log entries per tool call

Relevant code and config:

- `src/app/api/v1/mcp/route.ts`
- `src/lib/server/mcp/server.ts`
- `src/lib/server/mcp/security.ts`
- `src/lib/server/auth-context.ts`
- `src/lib/server/rate-limit.ts`
- `skills/saatgut-mcp-agent/client-config.example.json`
- `docker-compose.portainer.yml`

## Experiments Run Against Local Compose

Local stack status at the time of the spike:

- `docker compose ps`: `app` and `db` healthy on `127.0.0.1:3000`

Observed MCP behavior:

1. `GET /api/v1/mcp` returns endpoint metadata successfully.
2. `POST /api/v1/mcp` without auth returns `401 UNAUTHORIZED`.
3. `POST /api/v1/mcp` with disallowed `Origin: http://evil.example` returns `403 MCP_ORIGIN_DENIED`.
4. `POST /api/v1/mcp` with a nominally allowed origin and fake bearer token failed with `500`.

Operational note from container logs:

- the `500` was not an MCP protocol issue
- the app log shows Prisma `P1000` database-auth failure during token lookup
- this means agent-facing POST flows can still appear healthy at the metadata level while failing once a DB-backed auth path is exercised

Implication:

- health validation for any OpenClaw integration should include at least one authenticated MCP or REST request, not only `/api/health` or `GET /api/v1/mcp`

## Integration Options

### Option A: OpenClaw as MCP client against Saatgut over Streamable HTTP

Shape:

- OpenClaw connects directly to `https://<saatgut>/api/v1/mcp`
- auth uses bearer API tokens issued by Saatgut
- OpenClaw consumes tools, resources, and prompts over JSON-RPC

Bidirectional behavior:

- agent-to-product: direct tool calls and resource reads
- product-to-agent: indirect only; Saatgut creates tasks/reminders/log entries and OpenClaw polls or is operator-invoked

Strengths:

- uses the product surface that already exists
- minimal translation layer and least duplicated business logic
- good semantic fit for garden-agent workflows
- audit and `dry_run` behavior are already aligned with agent safety
- simple self-hosted deployment if OpenClaw can reach the app over the same network or reverse proxy

Weaknesses:

- not truly push-based by itself
- current implementation is HTTP-only, while the reference doc still mentions stdio as a desired transport
- rate limiting is in-memory, so limits are per-process and not shared across replicas
- origin checks matter if a browser-hosted client is involved

Auth and session implications:

- do not use browser session cookies for OpenClaw
- issue dedicated API tokens with minimum scopes
- prefer one token per OpenClaw environment or agent role for revocation and audit clarity

Latency:

- lowest latency of the deployable options because there is no extra bridge hop
- good enough for interactive tool use and short polling

Deployment constraints:

- easiest for single-host Docker Compose and Portainer
- requires network reachability from OpenClaw to the Saatgut app
- requires the runtime `APP_URL`, token management, and `MCP_ALLOWED_ORIGINS` to be set coherently

### Option B: OpenClaw uses REST/OpenAPI only, with polling for changes

Shape:

- OpenClaw ignores MCP and calls REST endpoints directly using generated or handwritten clients
- periodic polling checks tasks, timeline entries, reminders, or export status

Bidirectional behavior:

- agent-to-product: straightforward
- product-to-agent: simulated via polling rather than push

Strengths:

- uses the broader API surface, not only the current MCP tool set
- OpenAPI can support client generation and validation
- easier fallback if MCP client support on the OpenClaw side is immature

Weaknesses:

- weaker semantic layer for agent orchestration; OpenClaw must know domain endpoints directly
- more application-specific prompting and more brittle agent behavior
- duplicates tool-selection logic already captured by MCP

Auth and session implications:

- same recommendation as Option A: API tokens only
- session auth remains browser-only

Latency:

- acceptable for minute-level automation
- worse than direct MCP for interactive workflows if the polling window is conservative

Deployment constraints:

- simplest fallback because every reverse proxy and self-hosted setup already understands HTTPS REST traffic

### Option C: Sidecar bridge near OpenClaw that exposes stdio locally and forwards to Saatgut HTTP

Shape:

- a small local process speaks stdio MCP to OpenClaw
- the sidecar translates requests to Saatgut REST or HTTP MCP

Bidirectional behavior:

- agent-to-product: yes
- product-to-agent: still indirect unless the bridge also runs a poller or queue consumer

Strengths:

- gives OpenClaw a local stdio surface even though Saatgut does not implement stdio today
- keeps secrets local to the host running OpenClaw
- useful where the OpenClaw runtime strongly prefers local MCP server definitions

Weaknesses:

- another moving part to package, supervise, update, and secure
- translation bugs become a new failure mode
- if it merely forwards existing MCP calls, it adds complexity without adding capability

Auth and session implications:

- bridge still needs a Saatgut API token
- local file or process-based secret handling becomes part of the deployment design

Latency:

- slightly higher than Option A due to one extra hop
- still acceptable for human-in-the-loop tool use

Deployment constraints:

- best for local workstation or single-node deployments
- worse fit for Portainer-style stack deployments unless the sidecar is packaged and monitored explicitly

### Option D: Event bridge or queue-backed callback layer

Shape:

- Saatgut emits domain events to Redis, NATS, a webhook relay, or a custom callback service
- OpenClaw consumes events and answers through MCP or REST writes

Bidirectional behavior:

- closest to true near-real-time, push-style integration

Strengths:

- best latency for timely garden-agent reactions
- clean separation between user traffic and automation traffic
- can support retries, dead-lettering, and backpressure

Weaknesses:

- highest implementation and operations cost
- requires new event contracts, new infrastructure, and stronger delivery semantics
- out of proportion for the current single-app self-hosted footprint

Auth and session implications:

- introduces service-to-service auth in addition to API tokens
- likely requires signing, replay protection, and event idempotency keys

Latency:

- best option for push and background automation

Deployment constraints:

- poor fit for the current Compose/Portainer baseline unless the product is explicitly moving toward multi-service infrastructure

## Comparison Summary

| Option | Best Use | Bidirectional Quality | Ops Cost | Fit With Current Repo |
|---|---|---:|---:|---|
| A. Direct HTTP MCP | primary agent workflow | medium | low | strong |
| B. REST + polling | fallback and broad API coverage | low to medium | low | strong |
| C. Local stdio bridge | local OpenClaw host integration | medium | medium | moderate |
| D. Queue/event bridge | near-real-time automation | high | high | weak today |

## Recommendation

Recommend a two-layer approach:

1. Primary path: direct OpenClaw-to-Saatgut integration over the existing Streamable HTTP MCP endpoint.
2. Fallback path: REST/OpenAPI plus polling for tasks, timeline updates, reminders, and export readiness.

Why this is the best fit now:

- it reuses the implemented MCP server instead of inventing a new control plane
- it preserves the product architecture from `reference.md`, where MCP is a thin wrapper over the same services
- it keeps self-hosted deployment simple for Docker Compose and Portainer operators
- it avoids committing the team to queue infrastructure before there is proof that push-style automation is required

Reserve Option C for local power-user setups where OpenClaw materially benefits from a local stdio adapter, and reserve Option D for a later phase only if timely autonomous reactions become a product requirement rather than an operator convenience.

## Recommended Operational Design

- issue dedicated API tokens for OpenClaw, one per environment or agent role
- scope tokens as tightly as possible; prefer `READ` for planning agents and separate write-capable tokens for action agents
- keep browser sessions out of the integration path entirely
- validate MCP availability with an authenticated request, not just metadata or generic app health
- treat current in-memory rate limiting as single-instance only; if the app is replicated later, move the limiter to shared storage
- keep OpenClaw and Saatgut on the same private network where possible, fronted by HTTPS if crossing hosts
- if a browser-based MCP client is ever used, keep `MCP_ALLOWED_ORIGINS` explicit and minimal

## Suggested Experimentation Sequence For A Future Implementation Task

1. Stand up OpenClaw against the existing HTTP MCP endpoint with a read-only token.
2. Exercise `initialize`, `tools/list`, `resources/list`, and one read tool end to end.
3. Add a write-capable token and validate the `dry_run=true` then commit flow for one non-destructive write tool.
4. Measure perceived latency for interactive agent use.
5. Only if polling proves too slow, prototype an event or callback bridge.

## Risks To Track

- DB-backed auth failures can make authenticated MCP calls fail even while the app and metadata endpoint appear healthy.
- The current limiter is process-local, so distributed deployments will not enforce a global request budget.
- Saatgut currently exposes HTTP MCP but not stdio, so any stdio-based OpenClaw plan needs an adapter or additional server transport work.
