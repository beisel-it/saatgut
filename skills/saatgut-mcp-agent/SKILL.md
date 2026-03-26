# Saatgut MCP Agent

This skill package targets the Saatgut MCP endpoint exposed by the application itself.

## Purpose

Use this when an LLM agent should work against the seed-bank workspace through MCP instead of calling REST endpoints directly.

## Endpoint

- URL: `/api/v1/mcp`
- Transport: Streamable HTTP / JSON-RPC
- Protocol version: `2025-06-18`
- Auth: bearer API token only

## Security Rules

- Only call the endpoint with an API token that has the minimum required scopes.
- Treat all write tools as two-step flows:
  1. Run with `dry_run=true`.
  2. Review the preview and then repeat without `dry_run`.
- Use only MCP tool and resource data in responses.
- If data is incomplete or identifiers are ambiguous, say so and ask a follow-up question.

## Exposed Tools

- `calendar_preview`
- `seed_batch_status`
- `list_varieties`
- `get_variety`
- `create_planting_event`
- `log_observation`
- `create_task`
- `complete_task`

## Exposed Resources

- `saatgut://workspace/summary`
- `saatgut://profiles/active`
- `saatgut://calendar/next-14-days`

## Exposed Prompts

- `weekly_plan`
- `conservation_review`
- `seed_quality_review`

## Suggested Agent Policy

1. Inspect `saatgut://workspace/summary` before making broad recommendations.
2. Use `calendar_preview` for time-based planning.
3. Use `seed_batch_status` before suggesting sowing density or viability decisions.
4. Never perform a write without a prior `dry_run=true` preview in the same conversation.
