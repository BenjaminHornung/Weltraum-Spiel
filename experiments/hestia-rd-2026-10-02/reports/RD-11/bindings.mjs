import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { BASE, START, git, lab, out, ownBindings, sha, writeNew } from './run.mjs';

const repo = path.resolve(lab, '../..');
const prefix = 'experiments/hestia-rd-2026-10-02/';
const command = (args) => execFileSync(git, args, { cwd: repo, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
const [operation, label] = process.argv.slice(2);
assert(['verify', 'candidate'].includes(operation)); assert.match(label ?? '', /^[a-z0-9-]+$/);
const original = command(['ls-tree', '-r', '-z', START, '--', prefix]).split('\0').filter(Boolean).map((row) => {
  const [header, file] = row.split('\t'); const [mode, kind, blob] = header.split(' ');
  const full = path.join(repo, file); const bytes = readFileSync(full); const stat = lstatSync(full);
  assert.equal(mode, '100644'); assert.equal(kind, 'blob'); assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1);
  const rawBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  // Git's declared text=auto checkout boundary, not an agent byte rewrite.
  const filteredBlob = rawBlob === blob ? blob : command(['hash-object', '--path', file, file]);
  assert.equal(filteredBlob, blob, `START Git-bound bytes changed: ${file}`);
  return { path: file.slice(prefix.length), bytes: bytes.length, sha256: sha(bytes), blob, rawBlob,
    checkoutConversion: rawBlob === blob ? null : 'Git attributes checkout conversion; raw bytes retained and independently SHA-bound' };
});
const freezePath = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/CURRENT_FREEZE.json';
const freezeBytes = readFileSync(freezePath); const freeze = JSON.parse(freezeBytes);
assert.equal(freeze.start, START); assert.equal(freeze.tree, '487de40f20e51cd3dfd150fdc3af3ffe403954ed');
assert.equal(freeze.frozenFiles.length, 18);
for (const row of freeze.frozenFiles) { assert.equal(sha(readFileSync(path.join(lab, row.path))), row.sha256, `Shared freeze changed: ${row.path}`); }
const publicFiles = original.filter((row) => row.path.startsWith('fixtures/')); assert.equal(publicFiles.length, 429);
const baselinePath = `${out}/verify-baseline-02.json`;
const baselineBytes = readFileSync(baselinePath);
assert.equal(sha(baselineBytes), '75ab12c108b6bcf319c517dc78fee6f9b01b2b13795e638119463569d1b2c3c9');
const baseline = JSON.parse(baselineBytes);
assert.equal(original.length, baseline.originalFiles.length);
for (const row of original) {
  assert.equal(row.sha256, baseline.originalFiles.find((prior) => prior.path === row.path)?.sha256, `Original raw checkout bytes changed: ${row.path}`);
}
const protectedHead = [
  ['SO02-PREPARATION-510faffb.md', 'dc6b981e4c1a25e4093700f51adcde22c5df72b290158a7a05031e0a9dced391'],
  ['rd11-prelaunch-boundary-e42bf9e7.json', '9d6bfef51142df84c9737dc76e96d5210f6a48f72f9424861b6b09dbe63d938c'],
].map(([file, expected]) => {
  const actual = sha(readFileSync(`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/${file}`)); assert.equal(actual, expected);
  return { path: file, sha256: actual };
});
const installed = ['three', '@types/three'].map((name) => { const bytes = readFileSync(path.join(lab, 'node_modules', name, 'package.json'));
  const data = JSON.parse(bytes); assert.equal(data.version, '0.185.1'); return { name, version: data.version, packageSha256: sha(bytes) }; });
const apiPaths = ['three/src/renderers/webgpu/WebGPURenderer.js', 'three/src/renderers/common/Renderer.js',
  'three/src/renderers/common/Animation.js', 'three/src/renderers/webgpu/WebGPUBackend.js',
  'three/src/renderers/webgl-fallback/WebGLBackend.js', 'three/src/materials/nodes/NodeMaterial.js',
  'three/src/materials/nodes/MeshLambertNodeMaterial.js', 'three/src/renderers/webgl-fallback/utils/WebGLTextureUtils.js',
  'three/src/renderers/webgpu/utils/WebGPUTextureUtils.js', 'three/src/renderers/webgpu/utils/WebGPUUtils.js', '@types/three/src/renderers/common/Renderer.d.ts',
  '@types/three/src/renderers/webgpu/WebGPURenderer.d.ts', '@types/three/src/renderers/webgpu/WebGPUBackend.d.ts',
  '@types/three/src/materials/nodes/MeshLambertNodeMaterial.d.ts', '@types/three/src/Three.TSL.d.ts'];
const api = apiPaths.map((file) => ({ path: file, sha256: sha(readFileSync(path.join(lab, 'node_modules', file))) }));
const receipts = readdirSync(`${out}/commands`, { withFileTypes: true }).filter((entry) => entry.isDirectory()).flatMap((entry) => {
  const file = `${out}/commands/${entry.name}/receipt.json`; if (!lstatSync(file, { throwIfNoEntry: false })) { return []; }
  const data = JSON.parse(readFileSync(file)); assert.equal(sha(readFileSync(`${out}/commands/${entry.name}/raw.log`)), data.rawSha256);
  return [{ ...data, receiptSha256: sha(readFileSync(file)) }];
});
const interruptedCommands = readdirSync(`${out}/commands`, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name !== label).flatMap((entry) => {
  const root = `${out}/commands/${entry.name}`;
  if (lstatSync(`${root}/receipt.json`, { throwIfNoEntry: false })) { return []; }
  const started = JSON.parse(readFileSync(`${root}/started.json`));
  return [{ ...started, exitCode: null, nativeExitObserved: false, status: 'WRAPPER_INTERRUPTED_NO_EXIT_RECEIPT', rawSha256: sha(readFileSync(`${root}/raw.log`)) }];
});
const result = { schema: 'rd11-phase1-bindings-v1', status: 'PASS', label, START, BASE,
  head: command(['rev-parse', 'HEAD']), tree: command(['rev-parse', 'HEAD^{tree}']), parent: command(['rev-parse', 'HEAD^']),
  freeze: { path: freezePath, sha256: sha(freezeBytes), shared18: freeze.frozenFiles }, protectedHead,
  originalFiles: original, publicFiles: { count: publicFiles.length, status: 'UNCHANGED' }, installed, api,
  rawBaseline: { path: baselinePath, sha256: sha(baselineBytes), original622: 'BYTE_UNCHANGED', public429: 'BYTE_UNCHANGED' },
  ownFiles: ownBindings(), receipts, interruptedCommands, productIntegrated: false };
if (operation === 'candidate') {
  assert.equal(result.parent, START, 'Candidate must directly descend from immutable START');
  result.changedPaths = command(['diff', '--name-only', START, 'HEAD']).split('\n').filter(Boolean);
  assert(result.changedPaths.every((file) => ['src/experiments/three-webgpu/', 'tests/RD-11/', 'reports/RD-11/'].some((root) => file.startsWith(prefix + root))));
  const oracle = result.ownFiles.find((file) => file.path === 'tests/RD-11/unit.test.ts').sha256;
  const red = receipts.find((receipt) => receipt.operation === 'unit-red' && receipt.bindings.find((file) => file.path === 'tests/RD-11/unit.test.ts')?.sha256 === oracle);
  assert(red && red.exitCode === 1);
  assert.equal(red.bindings.find((file) => file.path === 'tests/RD-11/unit.test.ts').sha256, oracle, 'Original RED oracle changed');
  result.unitOracleSha256 = oracle;
  const first = readFileSync(`${out}/oracles/original14-unit.ts`); const prior = readFileSync(`${out}/oracles/replacement15-unit.ts`);
  const current = readFileSync(path.join(lab, 'tests/RD-11/unit.test.ts'));
  assert(current.subarray(0, first.length).equals(first) && current.subarray(0, prior.length).equals(prior), 'Original oracles were weakened/rewritten');
  result.original14OracleSha256 = sha(first); result.replacement15OracleSha256 = sha(prior);
  const green = receipts.filter((receipt) => receipt.operation === 'unit' && receipt.exitCode === 0
    && receipt.bindings.find((file) => file.path === 'tests/RD-11/unit.test.ts')?.sha256 === oracle).sort((a, b) => a.started.localeCompare(b.started)).at(-1);
  assert(green, 'Current same-oracle fresh GREEN missing');
  for (const row of result.ownFiles.filter((file) => file.path.startsWith('src/experiments/three-webgpu/'))) {
    assert.equal(green.bindings.find((file) => file.path === row.path)?.sha256, row.sha256, 'Runtime changed after fresh GREEN');
  }
  const roi = result.ownFiles.find((file) => file.path === 'reports/RD-11/oracle.ts');
  assert.equal(receipts.find((receipt) => receipt.label === 'behavioral-red-02').bindings.find((file) => file.path === roi.path).sha256, roi.sha256, 'Frozen ROI thresholds changed');
  result.sameOracleRedGreen = { red: red.label, green: green.label, oracleSha256: oracle, frozenRoiSha256: roi.sha256 };
  result.bindingsStatus = 'PASS'; result.status = 'CANDIDATE_WITH_TYPE_GATE_BLOCKER';
  result.verification = { cpuUnit: 'PASS_CONTROLLED_NOT_NATIVE', types: 'FAIL_TIMEOUT', inheritedBuild: 'PASS_NOT_RD11_ENTRY',
    optimizedRd11: 'NOT_RUN_HEAD_WIRING_REQUIRED', nativeBrowser: 'NOT_RUN_PHASE2', performance: 'NOT_RUN_NO_LEASE', art: 'NOT_RUN', product: 'NOT_RUN' };
  const staged = command(['diff', '--name-only']); assert.equal(staged, '', 'Tracked work must be committed');
}
const file = `${out}/${operation}-${label}.json`; writeNew(file, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ status: result.status, file, sha256: sha(readFileSync(file)), head: result.head, tree: result.tree,
  parent: result.parent, originalFiles: original.length, shared18: 18, public429: publicFiles.length, receipts: receipts.length,
  changedPaths: result.changedPaths, interruptedCommands: interruptedCommands.length, verification: result.verification, productIntegrated: false }));
