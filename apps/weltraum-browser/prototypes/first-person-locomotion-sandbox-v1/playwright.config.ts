import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prototypeDirectory = path.dirname(fileURLToPath(import.meta.url));
const browserApplicationRoot = path.resolve(prototypeDirectory, "../..");
const repositoryE2eDirectory = path.resolve(browserApplicationRoot, "tests/e2e");
const configuredBrowserPath = process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH;
const launchOptions = configuredBrowserPath && existsSync(configuredBrowserPath)
  ? { executablePath: configuredBrowserPath }
  : undefined;

export default defineConfig({
  testDir: repositoryE2eDirectory,
  testMatch: "first-person-locomotion-sandbox.spec.ts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: path.join(prototypeDirectory, "locomotion-sandbox-playwright-output"),
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: path.join(prototypeDirectory, "locomotion-sandbox-playwright-report"),
        open: "never"
      }
    ]
  ],
  use: {
    baseURL: "http://127.0.0.1:5223",
    trace: "retain-on-failure",
    screenshot: "off"
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5223 --strictPort",
    cwd: browserApplicationRoot,
    url: "http://127.0.0.1:5223",
    reuseExistingServer: false,
    timeout: 20_000
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions
      }
    }
  ]
});
