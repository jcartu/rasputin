import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "https://alfie-ui.vercel.app",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 30000,
    navigationTimeout: 60000,
    viewport: { width: 1920, height: 1080 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: [["list"], ["json", { outputFile: "./reports/live-results.json" }]],
  outputDir: "./reports/live-artifacts",
});
