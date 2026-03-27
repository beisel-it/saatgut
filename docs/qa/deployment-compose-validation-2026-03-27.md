# Compose Deployment Validation - 2026-03-27

## Scope

Validated task `4a972a61` against current `main` after devops alignment commit `d789cc8`.

Documented deployment variants covered:

1. Local compose path via `docker-compose.yml`
2. Portainer-oriented path via `docker-compose.portainer.yml`

The Portainer validation used locally built images tagged from the current workspace:

- `saatgut-qa-app:d789cc8`
- `saatgut-qa-db:d789cc8`

## Environment Contracts Verified

- `AUTH_SECRET` is required and the runtime accepts a strong secret.
- `APP_URL`, `WEBAUTHN_RP_ID`, and `WEBAUTHN_ALLOWED_ORIGINS` work with the documented `localhost` browser origin pattern.
- `POSTGRES_*` values correctly derive the app container `DATABASE_URL`.
- `MEDIA_STORAGE_DIR` stays writable under the mounted `/app/var/media` volume.
- `MCP_ALLOWED_ORIGINS` is reflected by the shipped power-user guidance.

## Validation Performed

### `docker-compose.yml` on `http://localhost:3301`

- Brought the stack up with `docker compose -p saatgutqa-compose --env-file /tmp/saatgut-compose.env up --build -d`.
- Confirmed cold-start migration application through `0008_variety_companions` from the app container logs.
- Ran `/tmp/deployment-validate.mjs` against the live stack to verify:
  - `/api/health`
  - password registration, session creation, logout, and password login
  - OpenAPI discovery at `/api/v1/openapi.json`
  - API token creation
  - MCP metadata and authenticated `initialize`
  - species, variety, and seed-batch writes
  - representative-image and packet-photo upload, retrieval, and deletion
  - media persistence after `docker compose restart app`
- Ran `tests/e2e/passkey-management.spec.ts` against the compose runtime and it passed.
- Opened the shipped auth shell in `agent-browser`; the German-first landing surface loaded and reported no page errors or console noise on load.

### `docker-compose.portainer.yml` on `http://localhost:3302`

- Brought the stack up with `docker compose -f docker-compose.portainer.yml -p saatgutqa-portainer --env-file /tmp/saatgut-portainer.env up -d`.
- Confirmed the image-based variant behaved the same as the local compose file under the documented env contract.
- Ran `/tmp/deployment-validate.mjs` against the live stack to verify the same auth, OpenAPI, token, MCP, media, and restart-persistence checks.
- Ran `tests/e2e/passkey-management.spec.ts` against the Portainer-file runtime and it passed.
- Opened the shipped auth shell in `agent-browser`; the same German-first landing surface rendered and showed no browser-reported errors on load.

## Result

Both documented compose deployment variants are green for this slice.

No new deployment-path bugs were found during this validation pass.

## Commands

- `docker compose -p saatgutqa-compose --env-file /tmp/saatgut-compose.env up --build -d`
- `node /tmp/deployment-validate.mjs http://localhost:3301 saatgutqa-compose /tmp/saatgut-compose.env`
- `PLAYWRIGHT_BASE_URL=http://localhost:3301 NODE_PATH=/home/florian/.openclaw/workspace/saatgut/node_modules ./node_modules/.bin/playwright test --reporter=line --workers=1 tests/e2e/passkey-management.spec.ts`
- `docker compose -f docker-compose.portainer.yml -p saatgutqa-portainer --env-file /tmp/saatgut-portainer.env up -d`
- `node /tmp/deployment-validate.mjs http://localhost:3302 saatgutqa-portainer /tmp/saatgut-portainer.env docker-compose.portainer.yml`
- `PLAYWRIGHT_BASE_URL=http://localhost:3302 NODE_PATH=/home/florian/.openclaw/workspace/saatgut/node_modules ./node_modules/.bin/playwright test --reporter=line --workers=1 tests/e2e/passkey-management.spec.ts`
- `/home/florian/.npm-global/bin/agent-browser --session deploy-compose open http://localhost:3301`
- `/home/florian/.npm-global/bin/agent-browser --session deploy-portainer open http://localhost:3302`
