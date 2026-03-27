# QA Implementation Readiness Review

## Summary

QA should target the seed-bank MVP only. The earlier waitlist slice is obsolete and should not be used as a quality baseline.

## Current Readiness Assessment

1. Product direction is explicit in `reference.md` and the roadmap docs.
2. The runtime scaffold is now present and baseline verification passes for `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
3. The repository includes the expected seed-bank MVP baseline pieces: Next.js app shell, Prisma schema and migrations, Docker Compose, health route, and Vitest configuration.
4. The landed implementation now exposes the MVP feature flow for auth, catalog, seed batches, growing profiles, cultivation rules, calendar, and planting writes.
5. Follow-up epics are now covered in automated QA for admin invites and user management, search and filters, germination tests, reminders, exports, API token issuance, OpenAPI exposure, MCP initialization, and a narrow mobile shell pass.
6. Automated coverage now includes both the original auth-to-planting browser path and a follow-up operations browser path, alongside the existing Vitest suite.
7. Local feature validation is green on an isolated Postgres-backed app runtime.
8. The documented deployment variants are now validated on current `main`: `docker-compose.yml` and `docker-compose.portainer.yml` both boot cleanly, apply all Prisma migrations on first start, accept password and passkey auth, serve media from persisted volumes across app restarts, and expose the documented OpenAPI and MCP surfaces.

## Verification Evidence

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3004 npm run test:e2e -- --reporter=line`
- `npm run build`
- `docker compose -p saatgutqa-compose --env-file /tmp/saatgut-compose.env up --build -d`
- `node /tmp/deployment-validate.mjs http://localhost:3301 saatgutqa-compose /tmp/saatgut-compose.env`
- `PLAYWRIGHT_BASE_URL=http://localhost:3301 NODE_PATH=/home/florian/.openclaw/workspace/saatgut/node_modules ./node_modules/.bin/playwright test --reporter=line --workers=1 tests/e2e/passkey-management.spec.ts`
- `docker compose -f docker-compose.portainer.yml -p saatgutqa-portainer --env-file /tmp/saatgut-portainer.env up -d`
- `node /tmp/deployment-validate.mjs http://localhost:3302 saatgutqa-portainer /tmp/saatgut-portainer.env docker-compose.portainer.yml`
- `PLAYWRIGHT_BASE_URL=http://localhost:3302 NODE_PATH=/home/florian/.openclaw/workspace/saatgut/node_modules ./node_modules/.bin/playwright test --reporter=line --workers=1 tests/e2e/passkey-management.spec.ts`
- `/home/florian/.npm-global/bin/agent-browser --session deploy-compose open http://localhost:3301`
- `/home/florian/.npm-global/bin/agent-browser --session deploy-portainer open http://localhost:3302`

## Residual Risk

- Browser coverage is stronger, but invalid-input and failure-recovery scenarios still need dedicated cases.
- The deployment checks used local override env files and locally built images for the Portainer compose path, so registry publishing and external reverse-proxy/TLS behavior are still outside this QA slice.
