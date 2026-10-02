import { defineConfig } from '@playwright/test';

const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00';
// Shared by config and test in this process only; retain earlier smoke evidence.
process.env.RD00_BROWSER_RUN_ID ??= `manual-${Date.now()}`;
const browserRun = `${run}/browser/${process.env.RD00_BROWSER_RUN_ID}`;
if (!/^[a-z0-9-]+$/.test(process.env.RD00_BROWSER_RUN_ID)) { throw new Error('Unsafe browser artifact run ID'); }
export default defineConfig({ testDir: './tests', testMatch: '**/browser.spec.ts',
  fullyParallel: false, workers: 1, retries: 0, timeout: 30_000,
  outputDir: `${browserRun}/results`,
  reporter: [['list'], ['json', { outputFile: `${browserRun}/report.json` }]],
  use: { baseURL: 'http://127.0.0.1:5280', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
    headless: true, launchOptions: { executablePath: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe' },
    trace: 'retain-on-failure', screenshot: 'only-on-failure' } });
