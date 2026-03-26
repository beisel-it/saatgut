import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3005",
    headless: true,
  },
  webServer: {
    command:
      "bash -lc 'cp .env.example .env && cp .env.example .env.local && docker compose up -d db && DATABASE_URL=\"postgresql://postgres:postgres@127.0.0.1:5432/saatgut?schema=public\" npm run db:deploy && APP_URL=\"http://127.0.0.1:3005\" npm run build && APP_URL=\"http://127.0.0.1:3005\" npm run start -- --port 3005'",
    url: "http://127.0.0.1:3005",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
