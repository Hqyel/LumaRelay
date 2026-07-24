import { defineConfig, devices } from "@playwright/test";

const production = process.env.LUMARELAY_E2E_PRODUCTION === "true";

export default defineConfig({
  expect: {
    timeout: 5000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  fullyParallel: false,
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    {
      name: "edge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
  ],
  reporter: "line",
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  use: {
    baseURL: "http://127.0.0.1:4173",
    colorScheme: "dark",
    locale: "zh-CN",
    trace: "retain-on-failure",
  },
  webServer: {
    command: production
      ? "pnpm --filter @lumarelay/web exec vite preview --host 127.0.0.1 --port 4173"
      : "pnpm --filter @lumarelay/web dev --host 127.0.0.1 --port 4173",
    reuseExistingServer: process.env.CI !== "true",
    timeout: 120_000,
    url: "http://127.0.0.1:4173",
  },
});
