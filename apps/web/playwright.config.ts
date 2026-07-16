import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 5000 },
  fullyParallel: false,
  reporter: "line",
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --filter @newemby/web dev --host 127.0.0.1 --port 4173",
    reuseExistingServer: process.env.CI !== "true",
    timeout: 120_000,
    url: "http://127.0.0.1:4173",
  },
});
