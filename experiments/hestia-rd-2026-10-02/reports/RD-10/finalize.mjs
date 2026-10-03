import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertIsolation, inspectBoundary } from '../../scripts/verify-boundary.mjs';

const lab = fileURLToPath(new URL('../../', import.meta.url)); const repo = path.resolve(lab, '../..');
const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10';
const start = '4788520ef7cecc5db62da8d51f0daaa8ac8bdd09'; const base = 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e';
const gitPath = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
assertIsolation({ task: 'RD-10', runRoot: run });
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
function write(file, value) { assert(!existsSync(file), `Do not overwrite evidence: ${file}`); writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' }); }
const command = (label) => {
  const file = `${run}/commands/${label}/receipt.json`; const receipt = json(file);
  assert.equal(sha(readFileSync(`${run}/commands/${label}/raw.log`)), receipt.logSha256); return { receipt, receiptSha256: sha(readFileSync(file)) };
};
const checked = ['install-01', 'check-final', 'types-final', 'unit-behavior-red-final', 'unit-behavior-green-final', 'build-existing-entries-01',
  'browser-dev-final', 'port-dev-final', 'port-after-dev-final', 'inspection-03'];
const commands = checked.map((label) => ({ label, ...command(label) }));
for (const { label, receipt } of commands) { assert.equal(receipt.exitCode, label === 'unit-behavior-red-final' ? 1 : 0, label); }
const red = command('unit-behavior-red-final').receipt; const green = command('unit-behavior-green-final').receipt;
const binding = (receipt, file) => receipt.bindings.find((value) => value.path === file).sha256;
assert.equal(binding(red, 'tests/RD-10/unit.test.ts'), binding(green, 'tests/RD-10/unit.test.ts'));
assert.equal(binding(green, 'tests/RD-10/unit.test.ts'), sha(readFileSync(path.join(lab, 'tests/RD-10/unit.test.ts'))));
assert.match(readFileSync(`${run}/commands/unit-behavior-red-final/raw.log`, 'utf8'), /6 failed\s*\|\s*8 passed \(14\)/);
assert.match(readFileSync(`${run}/commands/unit-behavior-green-final/raw.log`, 'utf8'), /14 passed \(14\)/);
const nativeDirectory = `${run}/browser/browser-dev-final/results/browser-NATIVE01-actual-na-bc898-e-availability-and-captures`;
const nativeFile = `${nativeDirectory}/native-capability-diagnostic.json`; const native = json(nativeFile);
const browser = command('browser-dev-final').receipt;
for (const file of ['src/experiments/renderer-probe/index.ts', 'src/experiments/renderer-probe/main.ts', 'src/experiments/renderer-probe/index.html', 'tests/RD-10/browser.spec.ts']) {
  assert.equal(binding(browser, file), sha(readFileSync(path.join(lab, file))), `Native evidence stale: ${file}`);
}
assert.equal(binding(green, 'src/experiments/renderer-probe/index.ts'), binding(browser, 'src/experiments/renderer-probe/index.ts'));
assert.equal(native.buildClass, 'DEV'); assert.deepEqual(native.counts, { planned: 2, observed: 2, failed: 0, unsupported: 0, skipped: 0 });
for (const report of native.reports) { assert.equal(report.targetQualified, false); assert.equal(report.submissions, 1);
  assert(!Object.hasOwn(report.metrics.gpuMs, 'value')); assert(!Object.hasOwn(report.metrics.nativeGpuBytes, 'value')); }
const screenshots = ['webgl2-dev.png', 'webgpu-dev.png'].map((name) => ({ path: `browser/browser-dev-final/results/browser-NATIVE01-actual-na-bc898-e-availability-and-captures/${name}`,
  sha256: sha(readFileSync(`${nativeDirectory}/${name}`)) }));
const proof = { phase: 1, status: 'READY_FOR_HEAD_WIRING', start, startTree: '6df6382bfcd596c464828b7938ad9ac5036aca05', immutableProductSource: base,
  unit: { status: 'PASS', planned: 14, observed: 14, failed: 0, skipped: 0, unchangedOracleSha256: binding(green, 'tests/RD-10/unit.test.ts') },
  behaviorRed: { status: 'EXPECTED_FAIL', planned: 14, observed: 14, failed: 6, passed: 8, skipped: 0, faultyFactorySha256: binding(red, 'src/experiments/renderer-probe/index.ts'),
    faults: ['Missing navigator.gpu returns supported/Native-WebGPU/submissions1', 'GPU metric fabricated measured value0', 'Forbidden localStorage.setItem intercepted by task-local guarded double'],
    actualGlobalConfigurationOrProductFilesMutated: false },
  restoredFactorySha256: binding(green, 'src/experiments/renderer-probe/index.ts'),
  devBrowser: { status: 'PASS-UNQUALIFIED-DIAGNOSTIC', planned: 4, observed: 4, failed: 0, skipped: 0, rendererModes: native.counts,
    ownedCycles: { missingNullRejected: 3, maskedIdentityTimer: 1, repeatedOpenClose: 4, nativeModes: 2, total: 10 },
    nativeEvidence: { path: nativeFile, sha256: sha(readFileSync(nativeFile)) }, screenshots },
  optimizedRD10Browser: 'NOT_RUN_PENDING_WIRING', rootBuild: 'PASS-EXISTING-RD00-RD03-ENTRIES-ONLY', targetGpu: 'NOT_RUN-NO-LEASE',
  nativeGpuBytes: 'UNSUPPORTED', gpuTiming: 'NOT_RUN', artAcceptance: 'NOT_RUN', productAcceptance: 'NOT_RUN',
  cap03Scope: 'Task-local guarded browser/CPU APIs, selected product lock bytes and 18 shared freeze bytes; not exhaustive global configuration audit',
  commands, productIntegrated: false };

const acceptedFreeze = json(`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/freezes/${start}.json`);
assert.equal(acceptedFreeze.frozenFiles.length, 18);
for (const file of acceptedFreeze.frozenFiles) { assert.equal(sha(readFileSync(path.join(lab, file.path))), file.sha256, file.path); }
const sourceEvidence = json(path.join(lab, 'reports/RD-10/source-evidence.json'));
for (const source of sourceEvidence.sources) { assert.equal(sha(readFileSync(`${run}/${source.retainedRaw}`)), source.sha256, source.name);
  if (source.installedPath) { assert.equal(sha(readFileSync(path.join(lab, source.installedPath))), source.installedSha256, source.installedPath); } }
const comparison = json(path.join(lab, 'reports/RD-10/comparison-freeze.json'));
for (const profile of comparison.profiles) { assert.equal(profile.entry, profile.id === 'C0' ? 'three' : 'three/webgpu');
  assert.equal(profile.namedExport, profile.id === 'C0' ? 'WebGLRenderer' : 'WebGPURenderer'); }
const packageMetadata = json(path.join(lab, 'node_modules/three/package.json'));
assert.equal(packageMetadata.version, '0.185.1'); assert.equal(packageMetadata.exports['./webgpu'], './build/three.webgpu.js');
assert.equal(packageMetadata.exports['./tsl'], './build/three.tsl.js');

if (process.argv[2] === 'validate' || process.argv[2] === 'candidate') {
  const capability = json(path.join(lab, 'reports/RD-10/capability-report.json'));
  assert.equal(capability.comparisonFreeze.sha256, sha(readFileSync(path.join(lab, 'reports/RD-10/comparison-freeze.json'))));
  assert.equal(capability.sourceEvidence.sha256, sha(readFileSync(path.join(lab, 'reports/RD-10/source-evidence.json'))));
  for (const cost of json(path.join(lab, 'reports/RD-10/bundle-costs.json')).costs) {
    const bytes = readFileSync(path.join(lab, cost.path)); assert.equal(sha(bytes), cost.sha256, cost.path);
    assert.equal(bytes.length, cost.bytes); assert.equal(gzipSync(bytes).length, cost.gzipBytes);
  }
}
if (process.argv[2] === 'validate') {
  console.log(JSON.stringify({ status: 'PASS-FRESH-RAW-SOURCE-ORACLE-FREEZE-REPORT-BINDINGS', frozenFiles: 18,
    sourceRecords: sourceEvidence.sources.length, sourceEvidenceSha256: sha(readFileSync(path.join(lab, 'reports/RD-10/source-evidence.json'))),
    comparisonFreezeSha256: sha(readFileSync(path.join(lab, 'reports/RD-10/comparison-freeze.json'))), productIntegrated: false }, null, 2));
} else if (process.argv[2] === 'candidate') {
  const git = (...args) => execFileSync(gitPath, args, { cwd: repo, encoding: 'utf8' }).trim();
  const [head, tree, parent] = git('show', '-s', '--format=%H%n%T%n%P', 'HEAD').split('\n');
  assert.equal(parent, start); assert.equal(git('branch', '--show-current'), 'feature/hestia-rd-rd10-2026-10-02');
  const paths = git('diff', '--name-only', start, head, '--').split('\n');
  for (const relative of paths) { assert.match(relative, /^experiments\/hestia-rd-2026-10-02\/(src\/experiments\/renderer-probe|tests\/RD-10|reports\/RD-10)\//); }
  const boundary = inspectBoundary({ repoRoot: repo, base, start, task: 'RD-10', gitPath, verifyPinned: true }); assert.equal(boundary.ok, true);
  git('diff', '--quiet', 'HEAD', '--');
  for (const untracked of git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean)) {
    assert(boundary.platformArtifacts.includes(untracked), `Uncommitted file outside accepted automatic exceptions: ${untracked}`);
  }
  const closingChecks = ['binding-terminal', 'unit-review-final', 'check-review-final', 'build-review-existing-entries', 'port-terminal', 'guard-commit-ready', 'local-commit']
    .map((label) => ({ label, ...command(label) }));
  for (const { label, receipt } of closingChecks) { assert.equal(receipt.exitCode, 0, label); }
  assert.equal(binding(command('unit-review-final').receipt, 'tests/RD-10/unit.test.ts'), proof.unit.unchangedOracleSha256);
  assert.match(readFileSync(`${run}/commands/unit-review-final/raw.log`, 'utf8'), /14 passed \(14\)/);
  const records = paths.map((relative) => ({ path: relative, sha256: sha(readFileSync(path.join(repo, relative))) }));
  write(`${run}/candidate.json`, { ...proof, candidate: head, tree, parent, branch: git('branch', '--show-current'), files: records,
    sourceEvidenceSha256: sha(readFileSync(path.join(lab, 'reports/RD-10/source-evidence.json'))),
    comparisonFreezeSha256: sha(readFileSync(path.join(lab, 'reports/RD-10/comparison-freeze.json'))), closingChecks,
    boundary: { ok: boundary.ok, inputHashesVerified: boundary.inputHashesVerified, violations: boundary.violations, originalAllFilesGate: boundary.originalAllFilesGate, platformArtifacts: boundary.platformArtifacts },
    services: 'Owned services cancelled; contexts closed; port-free receipt verified. No foreign shutdown.', productIntegrated: false });
  console.log(JSON.stringify({ status: 'READY_FOR_HEAD_WIRING', candidate: head, tree, parent, paths, boundary: boundary.ok, productIntegrated: false }, null, 2));
} else {
  const files = ['dist/assets/three-control-BV4Dtd8b.js', 'dist/assets/rd03-CMpvPTxY.js', 'node_modules/three/build/three.module.min.js',
    'node_modules/three/build/three.core.min.js', 'node_modules/three/build/three.webgpu.min.js', 'node_modules/three/build/three.tsl.min.js'];
  const costs = files.map((relative) => { const bytes = readFileSync(path.join(lab, relative)); return { path: relative, sha256: sha(bytes), bytes: bytes.length,
    gzipBytes: gzipSync(bytes).length, kind: relative.startsWith('dist/') ? 'measured-built-RD03-file-bytes-NOT-engine-isolated' : 'measured-installed-build-input-file-bytes-NOT-optimized-C1-C2-bundle' }; });
  assert(!existsSync(path.join(lab, 'dist/src/experiments/renderer-probe/index.html')), 'RD10 optimized input unexpectedly present before HEAD wiring');
  write(path.join(lab, 'reports/RD-10/bundle-costs.json'), { profiles: 'C0 input/existing-host proxy only; C1/C2 transfer estimates unqualified', costs,
    C1_C2_optimizedBundle: { status: 'not-run', unit: 'byte', reason: 'HEAD input/integration and profile implementation pending' },
    babylonBundle: { status: 'not-run', unit: 'byte', reason: 'Not installed; HEAD/RD12 exact pin and bounded proposal required' },
    playcanvasBundle: { status: 'not-run', unit: 'byte', reason: 'Not installed; full port not proposed' }, productIntegrated: false });
  write(path.join(lab, 'reports/RD-10/capability-report.json'), { ...proof, capabilityReports: native.reports,
    semantics: 'Device/GL-reported caps and requested/effective configuration, not timing/memory-use measurements. Triangle is not fixture rendering.',
    sourceBindings: browser.bindings, browserVersion: native.browserVersion, dpr: native.dpr, viewport: native.viewport,
    sourceEvidence: { path: 'reports/RD-10/source-evidence.json', sha256: sha(readFileSync(path.join(lab, 'reports/RD-10/source-evidence.json'))) },
    comparisonFreeze: { path: 'reports/RD-10/comparison-freeze.json', sha256: sha(readFileSync(path.join(lab, 'reports/RD-10/comparison-freeze.json'))) }, productIntegrated: false });
  // Preserve service exit1 as deliberate managed cancellation, not a successful server completion.
  for (const [label, taskId, pid, readyMs, started, finished] of [
    ['serve-dev-01', 'bg_mus9izst_4e', 32720, 296, '2026-10-03T10:42:15.881Z', '2026-10-03T10:43:15.023Z'],
    ['serve-dev-final', 'bg_musa3e3s_4h', 28848, 213, '2026-10-03T10:58:07.560Z', '2026-10-03T10:58:37.920Z'],
  ]) {
    const lines = ['', `  \u001b[32m\u001b[1mVITE\u001b[22m v8.1.5\u001b[39m  \u001b[2mready in \u001b[0m\u001b[1m${readyMs}\u001b[22m\u001b[2m\u001b[0m ms\u001b[22m`, '',
      '  \u001b[32m➜\u001b[39m  \u001b[1mLocal\u001b[22m:   \u001b[36mhttp://127.0.0.1:\u001b[1m5280\u001b[22m/\u001b[39m'];
    const raw = lines.join('\n'); const log = `${run}/commands/${label}/raw-managed.log`; writeFileSync(log, raw, { flag: 'wx' });
    write(`${run}/commands/${label}/receipt-managed.json`, { taskId, pid, command: `& 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe' reports/RD-10/run.mjs ${label} serve`,
      cwd: lab, status: 'cancelled', exitCode: 1, signal: null, started, finished, managedToolOutput: true, lines,
      logSha256: sha(Buffer.from(raw)), classification: 'DELIBERATE-OWNED-CLEANUP-NOT-SERVER-PASS', productIntegrated: false });
  }
  console.log(JSON.stringify({ status: 'PASS-EVIDENCE-HASH-AND-ORACLE-BINDINGS', costs, factorySha256: proof.restoredFactorySha256, screenshots, productIntegrated: false }, null, 2));
}
