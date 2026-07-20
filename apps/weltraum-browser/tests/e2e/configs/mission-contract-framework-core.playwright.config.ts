import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";

const configuredBrowserPath = process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH;
const launchOptions =
  configuredBrowserPath && existsSync(configuredBrowserPath) ? { executablePath: configuredBrowserPath } : undefined;

export default defineConfig({
  testDir: "..",
  testMatch: "mission-contract-framework-core.spec.ts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  outputDir: path.resolve(process.env.TEMP ?? process.cwd(), "weltraum-mission-contract-playwright-output"),
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5233",
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5233 --strictPort",
    url: "http://127.0.0.1:5233",
    reuseExistingServer: false,
    timeout: 20_000
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
