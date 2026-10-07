import { defineConfig } from './runtime/node_modules/@playwright/test/index.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
const own = path.dirname(fileURLToPath(import.meta.url));
const runId = process.env.HESTIA_FOLLOWUP_RUN_ID, suite = process.env.HESTIA_FOLLOWUP_SUITE ?? 'ren12';
if (!/^[a-z0-9-]+$/.test(runId ?? '')) throw Error('Set a fresh HESTIA_FOLLOWUP_RUN_ID');
if (!['ren12', 'ray'].includes(suite)) throw Error('Only the existing ren12 or ray suite');
const windowReceipt = JSON.parse(readFileSync(path.join(own, 'device-window.json')));
if (!(Date.now() >= Date.parse(windowReceipt.startsUtc) && Date.now() < Date.parse(windowReceipt.expiresUtc)))
  throw Error('Preserve A0 priority: no current actual device window');
const run = path.join(own, 'runs', runId);
if (process.env.TEST_WORKER_INDEX === undefined) mkdirSync(run); // Main reserves once; pinned Playwright reloads config in its workers.
export default defineConfig({ testDir: path.resolve(own, suite === 'ray' ? '../../tests/RD-13' : '../../tests/RD-11-v2'),
  testMatch: suite === 'ray' ? 'native.spec.ts' : 'browser.spec.ts',
  tsconfig: path.join(own, 'tsconfig.playwright.json'), workers: 1, retries: 0, timeout: 180_000,
  outputDir: path.join(run, 'results'), reporter: [['list'], ['json', { outputFile: path.join(run, 'report.json') }]],
  use: { baseURL: 'http://127.0.0.1:5280', headless: true, viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1,
    launchOptions: { executablePath: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe' } } });
