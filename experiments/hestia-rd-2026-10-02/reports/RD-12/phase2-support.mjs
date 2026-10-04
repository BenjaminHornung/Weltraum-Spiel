import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { admit, directory, lab, sha, node, git, ownBindings, BASE } from './run.mjs';
import { assertPortFree, inspectBoundary } from '../../scripts/verify-boundary.mjs';

export { lab, sha, node, git, ownBindings, assertPortFree };
export const START2 = '5e4c1b8fea9026bc38aa38f4258d9892f2b848b7';
export const TREE2 = '6e7d9936f712fad8b9cd7183a528c487b4fa36b9';
export const owner = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-12';
export const commands = `${owner}/phase2-5e4c1b8f-20261004-a-commands`;
export const nativeOutput = `${owner}/phase2-5e4c1b8f-20261004-a`;
export const headRoot = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD';
export const freezePath = `${headRoot}/freezes/${START2}.json`;
export const freezeSha = '2ac99561ef9ff1327b58d5fc10a034698aa82dff4170085bb9830fd14ce59086';
export const leasePath = `${headRoot}/leases/RD12-native-5e4c1b8f-20261004-a.json`;
export const leaseSha = '2e7dd05452a3b071535503f7a3910e0568d383892cabc2a63097b77800b606f2';
export const buildProofPath = `${headRoot}/rd12-wired-head-5e4c1b8f.json`;
export const buildProofSha = 'a7d3a791e61980bc711eb8fdf15a2292e1b0f7d395231fd28bdc1cc5c8893bdd';
export const repairProofPath = `${headRoot}/rd12-repair-head-e4a62c1b.json`;
export const repairProofSha = '13ce598e6575f6f270904a04bc8e8f548e312755deac941e9079131e1b3ef172';
export const buildRoot = `${headRoot}/rd12-wiring-e4a62c1b-20261004-a/build`;
export const browserPath = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe';
export const browserSha = '409805a16d6416087e6b2f778df1cf8f7bbb267d6b99f6b5bb0a618eace234f2';
export const baseURL = 'http://127.0.0.1:5280';
export const runId = 'phase2-5e4c1b8f-20261004-a';
export const repo = path.resolve(lab, '../..');
export const playwrightCli = path.join(lab, 'node_modules/@playwright/test/cli.js');
export function mkdir(file) { directory(file, commands); }
export function fresh(file, data) {
  admit(file, { owner: commands }); mkdir(path.dirname(file));
  writeFileSync(file, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2), { flag: 'wx' });
}
export function regular(file, root = 'C:/IFI_SourceCode') {
  admit(file, { owner: root, fresh: false }); return readFileSync(file);
}
export function bound(file, root) { const bytes = regular(file, root); return { path: file, bytes: bytes.length, sha256: sha(bytes) }; }
export function json(file, expected) {
  const bytes = regular(file); if (expected) { assert.equal(sha(bytes), expected, `Immutable hash: ${file}`); }
  return JSON.parse(bytes.toString());
}
export function gitText(...args) { return execFileSync(git, args, { cwd: lab, encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 }).trim(); }
function safeRelative(relative) { assert(!path.isAbsolute(relative) && !relative.split(/[\\/]/).includes('..')); }
export function rehash(entries, root) {
  for (const entry of entries) {
    safeRelative(entry.path); const bytes = regular(path.join(root, entry.path), root);
    assert.equal(sha(bytes), entry.sha256, `Bytes changed: ${entry.path}`);
    if (entry.bytes !== undefined) { assert.equal(bytes.length, entry.bytes, entry.path); }
  }
}
export function files(root) {
  const result = [];
  function walk(directoryPath) {
    admit(directoryPath, { owner: root, fresh: false, directory: true });
    for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
      const full = path.join(directoryPath, entry.name); const stat = lstatSync(full);
      assert(!stat.isSymbolicLink(), full);
      if (stat.isDirectory()) { walk(full); }
      else { assert(stat.isFile() && stat.nlink === 1, full); result.push({ path: path.relative(root, full).replaceAll('\\', '/'), bytes: stat.size, sha256: sha(regular(full, root)) }); }
    }
  }
  walk(root); return result.sort((a, b) => a.path.localeCompare(b.path));
}
export function environment(label) {
  assert.match(label, /^[a-z0-9-]+$/); const root = `${commands}/${label}`; mkdir(`${root}/temp`); mkdir(`${root}/cache`);
  return { ...process.env, PATH: 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64;C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd;C:/IFI_SourceCode/Utils/PowerShell',
    TEMP: `${root}/temp`, TMP: `${root}/temp`, npm_config_cache: `${root}/cache`, npm_config_script_shell: 'C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe',
    HESTIA_RD_TASK: 'RD-12', HESTIA_RD12_BROWSER_EXECUTABLE: browserPath, HESTIA_RD12_NATIVE_BASE_URL: baseURL,
    HESTIA_RD12_NATIVE_OUTPUT: nativeOutput, HESTIA_RD12_PHASE2_SNAPSHOT: freezePath, HESTIA_RD12_PHASE2_SNAPSHOT_SHA256: freezeSha,
    HESTIA_RD12_NATIVE_LEASE: leasePath, HESTIA_RD12_NATIVE_LEASE_SHA256: leaseSha, HESTIA_RD_BROWSER_RUN_ID: runId };
}
export function immutable() {
  assert.equal(process.version, 'v22.23.2'); assert.equal(gitText('rev-parse', 'HEAD'), START2); assert.equal(gitText('rev-parse', 'HEAD^{tree}'), TREE2);
  const freeze = json(freezePath, freezeSha); const lease = json(leasePath, leaseSha); const proof = json(buildProofPath, buildProofSha); json(repairProofPath, repairProofSha);
  assert.equal(freeze.start, START2); assert.equal(freeze.tree, TREE2); assert.equal(lease.status, 'RD12_NATIVE_AUTHORIZED'); assert.equal(lease.functionalNativeDiagnosticOnly, true);
  assert.equal(lease.qualifiedGpuPerformance, 'NOT_GRANTED'); assert.equal(lease.productIntegrated, false); assert.equal(proof.start, START2); assert.equal(proof.tree, TREE2);
  for (const [key, value] of Object.entries({ start: START2, tree: TREE2, freezeSha256: freezeSha, runId, outputRoot: nativeOutput, executablePath: browserPath, baseURL })) { assert.equal(lease[key], value, key); }
  assert.equal(path.resolve(lease.buildRoot), path.resolve(buildRoot)); assert.equal(sha(regular(browserPath)), browserSha);
  assert.equal(proof.sourceFiles.length, 713); rehash(proof.sourceFiles, lab); assert.equal(freeze.frozenFiles.length, 18); rehash(freeze.frozenFiles, lab);
  assert.equal(proof.buildAssets.length, 509); rehash(proof.buildAssets, buildRoot);
  assert.deepEqual(files(buildRoot), [...proof.buildAssets].sort((a, b) => a.path.localeCompare(b.path)));
  const publicFiles = files(path.join(lab, 'fixtures')); assert.equal(publicFiles.length, 429); rehash(publicFiles, buildRoot);
  const priorPath = `${owner}/phase1-303e6d65-20261004-a/candidate-repair-phase1-final-01.json`;
  const prior = json(priorPath, '20dac27275fbd21889763f9197ed4fbc12b53992b192b316afeb25cd480ddde0');
  assert.equal(prior.api.length, 33); rehash(prior.api, path.join(lab, 'node_modules')); rehash(prior.mathBindings, path.join(lab, 'node_modules'));
  assert.equal(sha(regular(path.join(lab, 'package-lock.json'), lab)), 'b550953c353dacbe7cc8f869fb28d66fdf85e2e2d85827d08dd9e8812fb40404');
  const packages = ['@playwright/test', 'playwright', 'playwright-core', 'vite', '@babylonjs/core'].map((name) => {
    const file = path.join(lab, 'node_modules', name, 'package.json'); const pkg = json(file);
    assert.equal(pkg.version, name === 'vite' ? '8.1.5' : name === '@babylonjs/core' ? '9.29.0' : '1.61.1'); return { name, version: pkg.version, ...bound(file) };
  });
  const boundary = inspectBoundary({ repoRoot: repo, task: 'RD-12', start: START2, base: BASE }); assert.equal(boundary.ok, true); assert.equal(boundary.inputHashesVerified, 52);
  const executables = [node, git, browserPath, playwrightCli, path.join(lab, 'node_modules/vite/bin/vite.js')].map((file) => bound(file));
  return { schema: 'rd12-phase2-immutable-source-v1', checked: new Date().toISOString(), start: START2, tree: TREE2,
    freeze: bound(freezePath), lease: bound(leasePath), buildProof: bound(buildProofPath), repairProof: bound(repairProofPath), priorCandidate: bound(priorPath),
    sourceFiles: proof.sourceFiles, shared18: freeze.frozenFiles, api33: prior.api, math3: prior.mathBindings, public429: publicFiles,
    buildRoot, buildAssets: proof.buildAssets, executables, packages, boundary, productIntegrated: false, qualifiedGpuPerformance: 'NOT_GRANTED' };
}
export async function servedManifest(label) {
  const proof = json(buildProofPath, buildProofSha); const responses = [];
  for (const entry of proof.buildAssets) {
    const url = `${baseURL}/${entry.path}`; const response = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    const bytes = Buffer.from(await response.arrayBuffer()); assert.equal(response.status, 200, url); assert.equal(sha(bytes), entry.sha256, `Served body mismatch: ${url}`);
    responses.push({ path: entry.path, url, status: response.status, bytes: bytes.length, sha256: sha(bytes), contentType: response.headers.get('content-type') });
  }
  fresh(`${commands}/${label}/served-manifest.json`, { source: START2, tree: TREE2, baseURL, checked: new Date().toISOString(), buildProofSha, responses, productIntegrated: false });
  return responses;
}
if (process.argv[2] === 'preflight') {
  assert(!existsSync(commands), 'Fresh command-log root required'); assert(!existsSync(nativeOutput), 'Config, not preflight, owns native output admission');
  const started = new Date().toISOString(); fresh(`${commands}/preflight-started-01.json`, { started, pid: process.pid, script: bound(import.meta.filename), bindings: ownBindings(), nativeExecution: 'NOT_RUN_PREFLIGHT', productIntegrated: false });
  try {
    const proof = immutable(); await assertPortFree(); fresh(`${commands}/preflight-01.json`, { ...proof, started, finished: new Date().toISOString(), exitCode: 0, timedOut: false, port5280: 'FREE_EXCLUSIVE_BIND_RELEASED', nativeExecution: 'NOT_RUN_PREFLIGHT' });
    console.log(JSON.stringify({ status: 'PASS_PHASE2_IMMUTABLE_PREFLIGHT', sourceFiles: proof.sourceFiles.length, buildFiles: proof.buildAssets.length, publicFiles: proof.public429.length, port5280: 'FREE', proof: bound(`${commands}/preflight-01.json`) }));
  } catch (error) { fresh(`${commands}/preflight-failed-01.json`, { started, finished: new Date().toISOString(), exitCode: 1, timedOut: false, error: String(error), bindings: ownBindings(), productIntegrated: false }); throw error; }
}
