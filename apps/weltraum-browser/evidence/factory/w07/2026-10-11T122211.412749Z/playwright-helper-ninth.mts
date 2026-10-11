import { defineConfig } from "/workspace/Weltraum-Spiel/apps/weltraum-browser/node_modules/@playwright/test/index.mjs";
import original from "/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/playwright.config.ts";
const app = "/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser";
const run = process.env.FP06_E2E_RUN_DIR;
if (!run || !run.startsWith(app + "/evidence/factory/w07/")) throw new Error("Expected actual scoped w07 evidence run");
export default defineConfig({
  ...original,
  testDir: app + "/tests/e2e",
  outputDir: run + "/playwright-output",
  reporter: [["list"], ["html", { outputFolder: run + "/playwright-report", open: "never" }]],
  use: { ...original.use, baseURL: "http://127.0.0.1:5174" },
  webServer: { ...original.webServer, command: "npm run dev -- --host 127.0.0.1 --port 5174 --strictPort", url: "http://127.0.0.1:5174", cwd: app },
});
