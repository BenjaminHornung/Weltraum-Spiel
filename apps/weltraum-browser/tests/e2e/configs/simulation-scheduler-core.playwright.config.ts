import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(configDir, "../../..");
const configuredBrowserPath = process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH;
const launchOptions =
  configuredBrowserPath && existsSync(configuredBrowserPath) ? { executablePath: configuredBrowserPath } : undefined;

export default defineConfig({
  testDir: path.resolve(configDir, ".."),
  testMatch: "simulation-scheduler-core.spec.ts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  forbidOnly: true,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: path.resolve(packageRoot, "evidence/playwright-output/simulation-scheduler-core"),
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5231",
    trace: "retain-on-failure",
    screenshot: "off",
    launchOptions
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5231 --strictPort",
    cwd: packageRoot,
    url: "http://127.0.0.1:5231",
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
