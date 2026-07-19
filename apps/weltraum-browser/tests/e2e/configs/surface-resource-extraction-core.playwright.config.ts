import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";

const configuredBrowserPath = process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH;
const launchOptions = configuredBrowserPath && existsSync(configuredBrowserPath)
  ? { executablePath: configuredBrowserPath }
  : undefined;

export default defineConfig({
  testDir: "..",
  testMatch: "surface-resource-extraction-core.spec.ts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: path.resolve(process.cwd(), "../../.devtoolbox/specs/changes/browser-surface-resource-extraction-core-v1/tests/playwright-output"),
  use: {
    baseURL: "http://127.0.0.1:5237",
    screenshot: "off",
    trace: "off",
    video: "off",
    launchOptions
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5237 --strictPort",
    cwd: process.cwd(),
    url: "http://127.0.0.1:5237/",
    reuseExistingServer: true,
    timeout: 20_000
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
