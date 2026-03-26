import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const webServerCommand =
  process.env.PLAYWRIGHT_SERVER_COMMAND ?? "bash -lc 'cp .env.example .env && docker compose up -d --build'";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL,
    headless: true,
  },
  webServer: {
    command: webServerCommand,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
