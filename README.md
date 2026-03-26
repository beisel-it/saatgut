# Saatgut

Saatgut is a small web application workspace for the first runnable slice: a landing-to-waitlist flow backed by a minimal TypeScript API.

## Backend Slice

- `GET /api/v1/health` returns `{ "status": "ok" }`
- `POST /api/v1/waitlist` validates `email` and `interestArea`
- successful submissions are stored in `data/waitlist-submissions.json`

## Local Setup

Install dependencies:

```bash
npm install
```

Run the API locally on `127.0.0.1:8000`:

```bash
npm run api:dev
```

Run the automated checks:

```bash
npm test
```

## Environment

Copy `.env.example` to `.env` if you want to customize the storage path.

- `SAATGUT_DATA_PATH`: path to the waitlist submissions file, defaults to `./data/waitlist-submissions.json`

## Example Request

```bash
curl -X POST http://127.0.0.1:8000/api/v1/waitlist \
  -H "Content-Type: application/json" \
  -d '{
    "email": "gardener@example.com",
    "interestArea": "Learning what to plant"
  }'
```
