import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.02,
    },
  },
  fullyParallel: false,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  testDir: "./visual",
  use: {
    baseURL: "http://127.0.0.1:6006",
    colorScheme: "dark",
    locale: "zh-CN",
  },
  webServer: {
    command: "pnpm storybook --ci --no-open",
    reuseExistingServer: true,
    timeout: 120_000,
    url: "http://127.0.0.1:6006",
  },
});
