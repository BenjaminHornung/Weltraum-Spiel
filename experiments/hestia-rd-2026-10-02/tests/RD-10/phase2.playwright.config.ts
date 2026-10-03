import { defineConfig } from '@playwright/test';
import path from 'node:path';
import root from '../../playwright.config';
import { assertIsolation } from '../../scripts/verify-boundary.mjs';

if (process.env.HESTIA_RD_TASK !== 'RD-10' || process.env.HESTIA_RD10_BUILD_CLASS !== 'OPTIMIZED') { throw new Error('Explicit RD10 OPTIMIZED binding required'); }
const output = String(root.outputDir); assertIsolation({ task: 'RD-10', runRoot: path.dirname(output) });
if (path.resolve(process.env.HESTIA_RD10_ADMITTED_BROWSER_ROOT ?? '') !== path.resolve(path.dirname(output))) { throw new Error('Caller pre-CLI root admission binding required'); }
// The caller admits a nonexistent run root once, BEFORE the runner creates it.
// Workers deserialize this config after that creation (Playwright1.61.1 workerProcessEntry), so do not reject their own active output.
export default defineConfig({ ...root, testDir: path.resolve(import.meta.dirname), testMatch: 'phase2.browser.spec.ts',
  use: { ...root.use, screenshot: 'off', trace: 'off' } }); // Explicit admitted captures only; no hidden failure-image mutations.
