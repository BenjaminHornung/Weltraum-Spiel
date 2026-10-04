import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assertIsolation } from '../../scripts/verify-boundary.mjs';

const root = process.env.RD40_PHASE2_RUN_ROOT;
if (!root || !/^C:[/\\]IFI_SourceCode[/\\]Temp[/\\]Hestia-RD-2026-10-02-runs[/\\]RD-40[/\\]phase2-32e88a34-20261004-[a-z0-9-]+$/i.test(root)) { throw new Error('Fresh owned phase2 artifact root required'); }
assertIsolation({ task: 'RD-40', runRoot: root });
const receiptPath = process.env.HESTIA_RD40_HEAD_RECEIPT;
if (process.env.HESTIA_RD40_PHASE2_BROWSER_GRANTED !== '1' || !receiptPath) { throw new Error('Explicit native phase2 grant required'); }
const bytes = readFileSync(receiptPath);
if (createHash('sha256').update(bytes).digest('hex') !== '00fee3e3fece1fa317a6ec8f63167d565b137b33fc7ced6a5e0da184165292f0') { throw new Error('Frozen HEAD receipt mismatch'); }
export default defineConfig({ testDir: '../../tests/RD-40', testMatch: ['browser.spec.ts', 'phase2-native.spec.ts'],
  fullyParallel: false, workers: 1, retries: 0, timeout: 30_000, forbidOnly: true,
  outputDir: path.join(root, 'results'), reporter: [['list'], ['json', { outputFile: path.join(root, 'playwright-report.json') }]],
  use: { baseURL: 'http://127.0.0.1:5280', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, headless: true,
    launchOptions: { executablePath: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe' },
    trace: 'on', screenshot: 'only-on-failure' } });
