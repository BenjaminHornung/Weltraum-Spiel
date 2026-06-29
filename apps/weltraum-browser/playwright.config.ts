import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const configuredBrowserPath = process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH;
const launchOptions =
  configuredBrowserPath && existsSync(configuredBrowserPath) ? { executablePath: configuredBrowserPath } : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: "./evidence/playwright-output",
  reporter: [["list"], ["html", { outputFolder: "./evidence/playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    timeout: 20_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
