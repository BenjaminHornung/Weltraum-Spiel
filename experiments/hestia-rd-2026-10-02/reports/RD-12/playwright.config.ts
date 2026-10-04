import { defineConfig } from '@playwright/test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, resolve } from 'node:path';
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { admit, directory, git, lab, sha, START } from './run.mjs';

// AUTHORED/COMPILED ONLY. No webServer, port discovery, browser installation,
// default executable or native invocation in phase1. HEAD supplies an actual
// locked optimized entry + qualified C-only executable after phase1 admission.
const executablePath = process.env.HESTIA_RD12_BROWSER_EXECUTABLE;
const baseURL = process.env.HESTIA_RD12_NATIVE_BASE_URL;
const outputRoot = process.env.HESTIA_RD12_NATIVE_OUTPUT;
function ownedPath(value: string | undefined, root: string): value is string {
  if (!value || !isAbsolute(value) || !resolve(value).replaceAll('\\', '/').startsWith(root)) { return false; }
  for (let current = resolve(value); dirname(current) !== current; current = dirname(current)) { if (existsSync(current) && lstatSync(current).isSymbolicLink()) { return false; } }
  return true;
}
if (!ownedPath(executablePath, 'C:/IFI_SourceCode/') || !lstatSync(executablePath).isFile() || lstatSync(executablePath).nlink !== 1) { throw new Error('HEAD-admitted regular C-only browser executable required; native NOT_RUN in phase1'); }
if (!baseURL || !['http://127.0.0.1', 'http://localhost'].some((origin) => new URL(baseURL).origin.startsWith(origin + ':'))) { throw new Error('HEAD-leased exact local optimized server URL required'); }
const owner = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-12/'; const headRoot = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/';
const snapshotPath = process.env.HESTIA_RD12_PHASE2_SNAPSHOT; const snapshotSha256 = process.env.HESTIA_RD12_PHASE2_SNAPSHOT_SHA256;
const leasePath = process.env.HESTIA_RD12_NATIVE_LEASE; const leaseSha256 = process.env.HESTIA_RD12_NATIVE_LEASE_SHA256; const runId = process.env.HESTIA_RD_BROWSER_RUN_ID;
assert(snapshotPath && leasePath && runId && /^[a-z0-9-]+$/.test(runId), 'Explicit immutable HEAD freeze/native lease and run ID required; native NOT_RUN in Phase1');
admit(snapshotPath, { owner: headRoot + 'freezes', fresh: false }); admit(leasePath, { owner: headRoot + 'leases', fresh: false });
const snapshotBytes = readFileSync(snapshotPath); const freeze = JSON.parse(snapshotBytes.toString()); const leaseBytes = readFileSync(leasePath); const lease = JSON.parse(leaseBytes.toString());
assert.equal(sha(snapshotBytes), snapshotSha256, 'Immutable HEAD snapshot SHA mismatch'); assert.equal(sha(leaseBytes), leaseSha256, 'HEAD native lease SHA mismatch');
assert.equal(snapshotPath, `${headRoot}freezes/${freeze.start}.json`, 'Immutable full-SHA freeze path required; no current alias');
assert(/^[0-9a-f]{40}$/.test(freeze.start) && /^[0-9a-f]{40}$/.test(freeze.tree) && freeze.start !== START && freeze.productIntegrated === false, 'New immutable HEAD snapshot required');
assert.equal(execFileSync(git, ['rev-parse', 'HEAD'], { cwd: lab, encoding: 'utf8' }).trim(), freeze.start, 'Checkout differs from HEAD freeze');
assert.equal(execFileSync(git, ['rev-parse', 'HEAD^{tree}'], { cwd: lab, encoding: 'utf8' }).trim(), freeze.tree, 'Checkout tree differs from HEAD freeze');
assert(lease.status === 'RD12_NATIVE_AUTHORIZED' && /^[a-z0-9-]+$/.test(lease.id) && lease.productIntegrated === false, 'Explicit HEAD native lease required');
for (const [key, value] of Object.entries({ start: freeze.start, tree: freeze.tree, freezeSha256: snapshotSha256, runId, outputRoot, executablePath, baseURL })) { assert.equal(lease[key], value, `HEAD lease ${key} mismatch`); }
assert(ownedPath(outputRoot, owner), 'Fresh owned C-only native output required');
const recordPath = outputRoot + '/admission.json'; const outputDir = outputRoot + '/results';
// Record lives OUTSIDE Playwright's results cleanup. Worker inheritance is a
// capability only for this exact immutable freeze + lease + run + paths/URL.
const admission = JSON.stringify({ schema: 'rd12-native-output-admission-v1', snapshotPath, snapshotSha256, start: freeze.start, tree: freeze.tree,
  leasePath, leaseSha256, leaseId: lease.id, runId, executablePath, baseURL, outputRoot, productIntegrated: false }, null, 2);
const admissionSha256 = sha(Buffer.from(admission));
if (process.env.HESTIA_RD12_ADMITTED_BROWSER_ROOT !== outputRoot) {
  admit(outputRoot, { owner }); directory(outputRoot, owner); admit(recordPath, { owner }); writeFileSync(recordPath, admission, { flag: 'wx' });
  admit(outputDir, { owner }); admit(outputDir + '/.last-run.json', { owner });
  process.env.HESTIA_RD12_ADMITTED_BROWSER_ROOT = outputRoot; process.env.HESTIA_RD12_ADMISSION_SHA256 = admissionSha256;
} else {
  assert.equal(process.env.HESTIA_RD12_ADMISSION_SHA256, admissionSha256, 'Foreign/stale output admission identity');
  admit(outputRoot, { owner, fresh: false, directory: true }); admit(recordPath, { owner, fresh: false });
  assert.equal(sha(readFileSync(recordPath)), admissionSha256, 'Foreign/stale output admission record');
  admit(outputDir, { owner, fresh: false, directory: true });
}
export default defineConfig({ testDir: '../../tests/RD-12', testMatch: 'browser.spec.ts', workers: 1, fullyParallel: false, timeout: 120_000,
  outputDir, reporter: [['list'], ['json', { outputFile: outputRoot + '/native-results.json' }]],
  use: { baseURL, viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1, launchOptions: { executablePath }, trace: 'retain-on-failure', screenshot: 'only-on-failure' } });
