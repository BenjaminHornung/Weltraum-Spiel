import { defineConfig } from '@playwright/test';
import { lstatSync } from 'node:fs';
import { assertIsolation } from './scripts/verify-boundary.mjs';

const task = process.env.HESTIA_RD_TASK ?? 'RD-00';
const run = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/${task}`;
// Shared by config and test in this process only; retain earlier smoke evidence.
process.env.HESTIA_RD_BROWSER_RUN_ID ??= (task === 'RD-00' ? process.env.RD00_BROWSER_RUN_ID : undefined) ?? `manual-${Date.now()}`;
if (task === 'RD-00') { process.env.RD00_BROWSER_RUN_ID = process.env.HESTIA_RD_BROWSER_RUN_ID; }
const browserRun = `${run}/browser/${process.env.HESTIA_RD_BROWSER_RUN_ID}`;
if (!/^[a-z0-9-]+$/.test(process.env.HESTIA_RD_BROWSER_RUN_ID)) { throw new Error('Unsafe browser artifact run ID'); }
const outputDir = `${browserRun}/results`;
const reportFile = `${browserRun}/report.json`;
assertIsolation({ task, runRoot: outputDir });
const reportStat = lstatSync(reportFile, { throwIfNoEntry: false });
if (reportStat && (reportStat.isSymbolicLink() || !reportStat.isFile())) { throw new Error('Browser report link/non-file forbidden'); }
export default defineConfig({ testDir: `./tests/${task}`, testMatch: '**/browser.spec.ts',
  fullyParallel: false, workers: 1, retries: 0, timeout: 30_000,
  outputDir,
  reporter: [['list'], ['json', { outputFile: reportFile }]],
  use: { baseURL: 'http://127.0.0.1:5280', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
    headless: true, launchOptions: { executablePath: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe' },
    trace: 'retain-on-failure', screenshot: 'only-on-failure' } });
