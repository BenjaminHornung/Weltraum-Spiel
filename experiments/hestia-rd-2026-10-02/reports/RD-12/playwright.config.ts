import { defineConfig } from '@playwright/test';
import { dirname, isAbsolute, resolve } from 'node:path';
import { existsSync, lstatSync } from 'node:fs';

// AUTHORED/COMPILED ONLY. No webServer, port discovery, browser installation,
// default executable or native invocation in phase1. HEAD supplies an actual
// locked optimized entry + qualified C-only executable after phase1 admission.
const executablePath = process.env.HESTIA_RD12_BROWSER_EXECUTABLE;
const baseURL = process.env.HESTIA_RD12_NATIVE_BASE_URL;
const outputDir = process.env.HESTIA_RD12_NATIVE_OUTPUT;
function ownedPath(value: string | undefined, root: string): value is string {
  if (!value || !isAbsolute(value) || !resolve(value).replaceAll('\\', '/').startsWith(root)) { return false; }
  for (let current = resolve(value); dirname(current) !== current; current = dirname(current)) { if (existsSync(current) && lstatSync(current).isSymbolicLink()) { return false; } }
  return true;
}
if (!ownedPath(executablePath, 'C:/IFI_SourceCode/') || !lstatSync(executablePath).isFile() || lstatSync(executablePath).nlink !== 1) { throw new Error('HEAD-admitted regular C-only browser executable required; native NOT_RUN in phase1'); }
if (!baseURL || !['http://127.0.0.1', 'http://localhost'].some((origin) => new URL(baseURL).origin.startsWith(origin + ':'))) { throw new Error('HEAD-leased exact local optimized server URL required'); }
if (!ownedPath(outputDir, 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-12/') || existsSync(outputDir)) { throw new Error('Fresh owned C-only native output required; reject any existing sink before Playwright cleanup'); }
export default defineConfig({ testDir: '../../tests/RD-12', testMatch: 'browser.spec.ts', workers: 1, fullyParallel: false, timeout: 120_000,
  outputDir, reporter: [['list'], ['json', { outputFile: outputDir + '/native-results.json' }]],
  use: { baseURL, viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1, launchOptions: { executablePath }, trace: 'retain-on-failure', screenshot: 'only-on-failure' } });
