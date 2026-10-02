import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import path from "node:path";
import base from "./playwright.cut-v3.config";

const executablePath = process.env.WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH;
if (!executablePath || !path.isAbsolute(executablePath) || !existsSync(executablePath)) {
  throw new Error("K34 requires an installed, explicitly bound Chrome executable");
}

export default defineConfig({
  ...base,
  testMatch: "hvp-k34-50.spec.ts",
  timeout: 50 * 60_000,
  use: {
    ...base.use,
    headless: false,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    launchOptions: { executablePath },
  },
});
