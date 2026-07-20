import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const configuredBrowserPath = process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH;
const launchOptions =
  configuredBrowserPath && existsSync(configuredBrowserPath) ? { executablePath: configuredBrowserPath } : undefined;
const configuredArtifactGroup = process.env.WELTRAUM_PLAYWRIGHT_ARTIFACT_GROUP;

if (configuredArtifactGroup !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(configuredArtifactGroup)) {
  throw new Error(
    "WELTRAUM_PLAYWRIGHT_ARTIFACT_GROUP must contain lowercase letters, digits, and single hyphen separators only."
  );
}

const artifactSuffix = configuredArtifactGroup === undefined ? "" : `/${configuredArtifactGroup}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  forbidOnly: process.env.CI === "true",
  workers: process.env.CI === "true" ? 1 : 2,
  outputDir: `./evidence/playwright-output${artifactSuffix}`,
  reporter: [["list"], ["html", { outputFolder: `./evidence/playwright-report${artifactSuffix}`, open: "never" }]],
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
