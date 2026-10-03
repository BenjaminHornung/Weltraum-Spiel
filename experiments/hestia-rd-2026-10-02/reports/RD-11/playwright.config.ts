import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { admit, directory, git, lab, sha, START } from './run.mjs';

// READY only. Do not invoke before HEAD integration and its NEW immutable snapshot.
const snapshotPath = process.env.HESTIA_RD11_PHASE2_SNAPSHOT;
const runId = process.env.HESTIA_RD_BROWSER_RUN_ID;
if (!snapshotPath || !runId || !/^[a-z0-9-]+$/.test(runId)
  || path.basename(snapshotPath).toUpperCase() === 'CURRENT_FREEZE.JSON') { throw new Error('Explicit immutable HEAD snapshot and fresh RD11 run ID required'); }
const bytes = readFileSync(snapshotPath); const snapshot = JSON.parse(bytes);
if (!/^C:\/IFI_SourceCode\/Temp\/Hestia-RD-2026-10-02-runs\/HEAD\//.test(snapshotPath)
  || sha(bytes) !== process.env.HESTIA_RD11_PHASE2_SNAPSHOT_SHA256 || snapshot.start === START || snapshot.productIntegrated !== false
  || !/^[0-9a-f]{40}$/.test(snapshot.start) || !/^[0-9a-f]{40}$/.test(snapshot.tree)) { throw new Error('New SHA-bound snapshot required; no mutable HEAD/Phase1 default'); }
if (execFileSync(git, ['rev-parse', 'HEAD'], { cwd: lab, encoding: 'utf8' }).trim() !== snapshot.start
  || execFileSync(git, ['rev-parse', 'HEAD^{tree}'], { cwd: lab, encoding: 'utf8' }).trim() !== snapshot.tree) { throw new Error('Own checkout is not the immutable Phase2 snapshot'); }
const owner = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/browser';
const root = `${owner}/${runId}`;
if (process.env.HESTIA_RD11_ADMITTED_BROWSER_ROOT !== root) {
  admit(root, { owner }); directory(root, owner); process.env.HESTIA_RD11_ADMITTED_BROWSER_ROOT = root;
  admit(`${root}/results`, { owner }); admit(`${root}/results/.last-run.json`, { owner });
} else { admit(root, { owner, fresh: false, directory: true }); }
export default defineConfig({ testDir: fileURLToPath(new URL('../../tests/RD-11/', import.meta.url)), testMatch: 'browser.spec.ts',
  fullyParallel: false, workers: 1, retries: 0, timeout: 60_000, outputDir: `${root}/results`, reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5280', viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1,
    headless: true, launchOptions: { executablePath: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe' },
    trace: 'off', screenshot: 'off', video: 'off' } });
