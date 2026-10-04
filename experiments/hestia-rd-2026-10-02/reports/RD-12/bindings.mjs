import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { BASE, START, REPAIR_PARENT, git, lab, out, ownBindings, sha, writeNew } from './run.mjs';

const repo = path.resolve(lab, '../..'); const prefix = 'experiments/hestia-rd-2026-10-02/';
const command = (args) => execFileSync(git, args, { cwd: repo, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
const repairDelta = ['reports/RD-12/bindings.mjs', 'reports/RD-12/HANDOFF-REPAIR-09ca699f-20261004-A.md', 'reports/RD-12/PLAN-REPAIR-09ca699f.md',
  'reports/RD-12/playwright.config.ts', 'reports/RD-12/qualification-v2.ts', 'reports/RD-12/run.mjs', 'reports/RD-12/vitest.config.ts',
  'src/experiments/babylon/index.ts', 'src/experiments/babylon/projection.ts', 'tests/RD-12/browser.spec.ts',
  'tests/RD-12/native-config.unit.test.ts', 'tests/RD-12/repair.unit.test.ts'].sort();
const [operation, label] = process.argv.slice(2); assert(['baseline', 'seal', 'verify', 'candidate'].includes(operation)); assert.match(label ?? '', /^[a-z0-9-]+$/);
const originalFiles = command(['ls-tree', '-r', '-z', START, '--', prefix]).split('\0').filter(Boolean).map((row) => {
  const [header, file] = row.split('\t'); const [mode, kind, blob] = header.split(' '); const full = path.join(repo, file);
  const bytes = readFileSync(full); const stat = lstatSync(full); assert.equal(mode, '100644'); assert.equal(kind, 'blob'); assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1);
  const rawBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(rawBlob === blob ? blob : command(['hash-object', '--path', file, file]), blob, `START bytes changed: ${file}`);
  return { path: file.slice(prefix.length), bytes: bytes.length, sha256: sha(bytes), blob, rawBlob,
    checkoutConversion: rawBlob === blob ? null : 'Declared Git text=auto; original raw checkout bytes independently bound' };
});
assert.equal(originalFiles.length, 689); assert.equal(originalFiles.filter((row) => row.path.startsWith('fixtures/')).length, 429);
const headRoot = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/';
const freezePath = `${headRoot}freezes/${START}.json`; const freezeBytes = readFileSync(freezePath); const freeze = JSON.parse(freezeBytes);
assert.equal(sha(freezeBytes), '00d3994ad6d26da280090bf9bffbac5ac46c21e48be82a6668f15ec3c07497ba');
assert.equal(freeze.start, START); assert.equal(freeze.tree, '7e051ab7576653c57ad362d2aa9ab7a872522126'); assert.equal(freeze.frozenFiles.length, 18);
for (const row of freeze.frozenFiles) { assert.equal(sha(readFileSync(path.join(lab, row.path))), row.sha256, `Shared changed: ${row.path}`); }
const headBindings = [
  ['SO02-RD12-READINESS-32e88a34.md', '95fe486ce3f5a721107789996f69850d06ecf5ddf2d48b96de22e56774e374d0'],
  ['rd12-prelaunch-boundary-303e6d65.json', 'fce142dfa31ada5ab077736b53d4af245c00a07c0ca3c2f1a37971c2a78de739'],
].map(([file, expected]) => { const bytes = readFileSync(headRoot + file); assert.equal(sha(bytes), expected); return { path: headRoot + file, sha256: expected }; });
const baselinePath = `${out}/baseline-start.json`;
if (operation === 'baseline') {
  assert.equal(command(['rev-parse', 'HEAD']), START);
  writeNew(baselinePath, JSON.stringify({ START, BASE, tree: freeze.tree, originalFiles, shared18: freeze.frozenFiles,
    freezeSha256: sha(freezeBytes), headBindings, productIntegrated: false }, null, 2));
  writeNew(`${out}/immutable-start-freeze.json`, freezeBytes);
  console.log(JSON.stringify({ file: baselinePath, sha256: sha(readFileSync(baselinePath)), original689: 689, shared18: 18, public429: 429, productIntegrated: false }));
} else if (operation === 'seal') {
  for (const file of ['tests/RD-12/unit.test.ts', 'reports/RD-12/oracle.ts', 'tests/RD-12/browser.spec.ts',
    'reports/RD-12/qualification-v2.ts', 'tests/RD-12/repair.unit.test.ts', 'tests/RD-12/native-config.unit.test.ts']) {
    const bytes = readFileSync(path.join(lab, file)); writeNew(`${out}/oracles/${label}/${path.basename(file)}`, bytes);
    console.log(JSON.stringify({ originalOracle: file, sha256: sha(bytes), productIntegrated: false }));
  }
} else {
  const baselineBytes = readFileSync(baselinePath); const baseline = JSON.parse(baselineBytes);
  assert.deepEqual(originalFiles, baseline.originalFiles, 'Original raw bytes changed after baseline');
  const packageBytes = readFileSync(path.join(lab, 'node_modules/@babylonjs/core/package.json')); assert.equal(JSON.parse(packageBytes).version, '9.29.0');
  const api = ['Engines/engine.js', 'Engines/engine.pure.js', 'Engines/thinEngine.pure.js', 'Engines/engine.pure.d.ts', 'Engines/engine.d.ts', 'Engines/engine.common.js', 'Engines/engine.common.d.ts',
    'Engines/abstractEngine.js', 'Engines/abstractEngine.pure.js', 'Engines/webgpuEngine.js', 'Engines/webgpuEngine.pure.js', 'Engines/webgpuEngine.pure.d.ts', 'Engines/webgpuEngine.d.ts',
    'Engines/WebGPU/webgpuBufferManager.js', 'scene.js', 'scene.pure.js', 'scene.d.ts', 'Meshes/mesh.js', 'Meshes/mesh.vertexData.js', 'Materials/standardMaterial.js',
    'Materials/standardMaterial.pure.js', 'Materials/material.pure.js', 'Materials/material.pure.d.ts', 'Materials/shaderLanguage.js', 'Materials/imageProcessingConfiguration.js', 'Cameras/freeCamera.js',
    'Cameras/cameraInputsManager.d.ts', 'Lights/hemisphericLight.js', 'Lights/directionalLight.js', 'ShadersWGSL/default.vertex.js', 'ShadersWGSL/default.fragment.js',
    'Shaders/default.vertex.js', 'Shaders/default.fragment.js'].map((file) => ({ path: `@babylonjs/core/${file}`, sha256: sha(readFileSync(path.join(lab, 'node_modules/@babylonjs/core', file))) }));
  let installedRegularFiles = 0;
  function inspect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name); const stat = lstatSync(full); assert(!stat.isSymbolicLink(), `Installed link: ${full}`);
      if (entry.isDirectory()) { inspect(full); } else { assert(stat.isFile() && stat.nlink === 1); installedRegularFiles += 1; }
    }
  }
  inspect(path.join(lab, 'node_modules'));
  const receipts = readdirSync(`${out}/commands`, { withFileTypes: true }).flatMap((entry) => {
    const file = `${out}/commands/${entry.name}/receipt.json`; if (!entry.isDirectory() || !lstatSync(file, { throwIfNoEntry: false })) { return []; }
    const data = JSON.parse(readFileSync(file)); assert.equal(sha(readFileSync(`${out}/commands/${entry.name}/raw.log`)), data.rawSha256);
    if (data.testResults) { assert.equal(sha(readFileSync(data.testResults.path)), data.testResults.sha256, `Test result changed: ${entry.name}`); }
    return [{ ...data, receiptSha256: sha(readFileSync(file)) }];
  });
  const result = { status: 'PASS_PHASE1_REPAIR_SOURCE_BINDINGS', START, BASE, branch: command(['rev-parse', '--abbrev-ref', 'HEAD']), head: command(['rev-parse', 'HEAD']), tree: command(['rev-parse', 'HEAD^{tree}']),
    parent: command(['rev-parse', 'HEAD^']), freeze: { path: freezePath, sha256: sha(freezeBytes), shared18: freeze.frozenFiles },
    baseline: { path: baselinePath, sha256: sha(baselineBytes) }, originalFiles, headBindings,
    installed: { version: '9.29.0', packageSha256: sha(packageBytes), regularFiles: installedRegularFiles, links: 0 }, api,
    ownFiles: ownBindings(), receipts, productIntegrated: false };
  const priorPath = `${out}/candidate-phase1-final-01.json`; const priorBytes = readFileSync(priorPath); const prior = JSON.parse(priorBytes);
  assert.equal(sha(priorBytes), '20560983d84e8b9bd3b4d135ded003dc20896630266dd2ba22291f540d5c0ad1');
  assert.equal(prior.head, REPAIR_PARENT); assert.equal(prior.tree, '1749306fd35cd525aeff3c0e36d43e8f711e4845'); assert.equal(prior.parent, START); assert.equal(prior.ownFiles.length, 19);
  assert.equal(command(['rev-parse', `${REPAIR_PARENT}^{tree}`]), prior.tree); assert.equal(command(['rev-parse', `${REPAIR_PARENT}^`]), START);
  assert.deepEqual(result.originalFiles, prior.originalFiles); assert.deepEqual(result.freeze, prior.freeze); assert.deepEqual(result.api, prior.api); assert.deepEqual(result.installed, prior.installed);
  const headRepairProofPath = headRoot + 'rd12-phase1-head-09ca699f.json'; const headRepairProof = readFileSync(headRepairProofPath);
  assert.equal(sha(headRepairProof), 'e84ac212c19fda9bf9ac7c3f5df0ac816a8218456091590b00730e5c656cd165');
  const headReview = JSON.parse(headRepairProof); assert.equal(headReview.candidate, REPAIR_PARENT); assert.equal(headReview.tree, prior.tree);
  for (const binding of prior.ownFiles.filter((row) => !repairDelta.includes(row.path))) {
    assert.equal(result.ownFiles.find((row) => row.path === binding.path)?.sha256, binding.sha256, `Unrelated original candidate file changed: ${binding.path}`);
  }
  result.repairLineage = { originalStart: START, repairParent: REPAIR_PARENT, priorTree: prior.tree,
    preservedCandidate: { path: priorPath, sha256: sha(priorBytes) }, headDisposition: 'NOT_YET_ACCEPTED; three owning P2 repairs authorized',
    headProof: { path: headRepairProofPath, sha256: sha(headRepairProof) }, declaredDelta: repairDelta, nativeExecution: 'NOT_RUN', productIntegrated: false };
  result.mathBindings = ['Maths/math.vector.js', 'Maths/math.vector.pure.js', 'Maths/math.vector.pure.d.ts'].map((file) => ({ path: `@babylonjs/core/${file}`, sha256: sha(readFileSync(path.join(lab, 'node_modules/@babylonjs/core', file))) }));
  result.runtimeInventory = result.ownFiles.filter((row) => row.path.startsWith('src/experiments/babylon/')).map((row) => {
    const bytes = readFileSync(path.join(lab, row.path)); return { ...row, bytes: bytes.length, lines: bytes.toString('utf8').split('\n').length - 1 };
  });
  const built = receipts.filter((row) => row.operation === 'build' && row.exitCode === 0).sort((a, b) => a.finished.localeCompare(b.finished)).at(-1);
  if (built) {
    const buildRoot = `${out}/build-${built.label}`; const files = [];
    function walk(directory) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name); const stat = lstatSync(file); assert(!stat.isSymbolicLink());
        if (entry.isDirectory()) { walk(file); } else { assert(stat.isFile() && stat.nlink === 1); const bytes = readFileSync(file); files.push({ path: path.relative(buildRoot, file).replaceAll('\\', '/'), bytes: bytes.length, sha256: sha(bytes) }); }
      }
    }
    walk(buildRoot);
    for (const original of originalFiles.filter((row) => row.path.startsWith('fixtures/'))) { assert.equal(files.find((row) => row.path === original.path.slice(9))?.sha256, original.sha256, `Optimized public fixture changed: ${original.path}`); }
    assert(files.some((row) => row.path === 'src/experiments/babylon/index.html')); assert(files.some((row) => /^assets\/rd12-.+\.js$/.test(row.path)));
    const entryBytes = readFileSync(path.join(buildRoot, 'src/experiments/babylon/index.html'), 'utf8'); assert.match(entryBytes, /\/assets\/rd12-.+\.js/);
    result.optimizedBuild = { root: buildRoot, receipt: built.label, mode: 'standalone-RD12-production-entry', fixture429Unchanged: true, assets: files,
      jsBytes: files.filter((row) => row.path.endsWith('.js')).reduce((sum, row) => sum + row.bytes, 0), sdkChunkWarning: 'Main Babylon chunk >500kB; preserved, no config threshold change', nativeExecution: 'NOT_RUN' };
  }
  if (operation === 'candidate') {
    assert.equal(result.branch, 'feature/hestia-rd-rd12-2026-10-04');
    assert.equal(result.parent, REPAIR_PARENT, 'Repair must directly parent 09, never pretend direct303'); result.status = 'PASS_PHASE1_REPAIR_BINDINGS';
    result.changedPaths = command(['diff', '--name-only', START, 'HEAD']).split('\n').filter(Boolean);
    result.deltaPaths = command(['diff', '--name-only', REPAIR_PARENT, 'HEAD']).split('\n').filter(Boolean);
    assert.deepEqual(result.deltaPaths, repairDelta.map((file) => prefix + file).sort(), 'Actual repair delta differs from declared paths');
    assert.deepEqual(result.changedPaths, result.ownFiles.map((row) => prefix + row.path).sort(), 'Unexpected original+repair owned path inventory');
    assert(result.changedPaths.every((file) => ['src/experiments/babylon/', 'tests/RD-12/', 'reports/RD-12/'].some((root) => file.startsWith(prefix + root))));
    const oraclePaths = ['tests/RD-12/unit.test.ts', 'reports/RD-12/oracle.ts'];
    const red = receipts.find((row) => row.operation === 'unit-red' && row.exitCode === 1 && oraclePaths.every((file) => row.bindings.find((binding) => binding.path === file)?.sha256 === result.ownFiles.find((binding) => binding.path === file)?.sha256)); assert(red, 'Same-oracle owning behavioral RED missing');
    const green = receipts.filter((row) => row.operation === 'unit' && row.exitCode === 0).sort((a, b) => a.finished.localeCompare(b.finished)).at(-1); assert(green);
    for (const file of oraclePaths) {
      const current = result.ownFiles.find((row) => row.path === file); assert(current);
      assert.equal(red.bindings.find((row) => row.path === file)?.sha256, current.sha256, 'RED oracle changed');
      assert.equal(green.bindings.find((row) => row.path === file)?.sha256, current.sha256, 'GREEN oracle changed');
      assert.equal(sha(readFileSync(`${out}/oracles/oracle-seal-v2-02/${path.basename(file)}`)), current.sha256, 'Preserved owning v2 oracle changed');
    }
    for (const op of ['unit', 'types', 'root-types', 'build', 'guard']) {
      const latest = receipts.filter((row) => row.operation === op).sort((a, b) => a.finished.localeCompare(b.finished)).at(-1);
      assert(latest && latest.exitCode === 0 && !latest.timedOut, `Fresh ${op} missing`);
      assert.equal(latest.nativeExecution, 'NOT_RUN_PHASE1_CPU_ONLY', `${op} lacks explicit CPU/native NOT_RUN scope`);
      for (const current of result.ownFiles.filter((row) => row.path.startsWith('src/experiments/babylon/') || row.path.startsWith('tests/RD-12/') || /\.(ts|mjs|json)$/.test(row.path))) {
        assert.equal(latest.bindings.find((row) => row.path === current.path)?.sha256, current.sha256, `${op} predates current code`);
      }
    }
    result.sameOracleRedGreen = { red: red.label, green: green.label };
    result.preservedOriginalOracleV1 = { path: `${out}/oracles/unit.test.ts`, sha256: sha(readFileSync(`${out}/oracles/unit.test.ts`)), firstRed: 'owning-red-01',
      outcome: '12 FAILED / 1 PASSED; two later shared-budget timeouts and initial typed accessor failure preserved',
      revision: 'v2 repairs hasVertexAlpha public SDK binding plus type-only casts/non-null assertions; unchanged titles, numeric/visual thresholds, source inputs and reference data' };
    assert.equal(result.preservedOriginalOracleV1.sha256, 'f63eb38d5d39e70e625bf62c0f76cc6f1efc4c49377972ab783912c0c1a92e9b');
    assert(result.optimizedBuild, 'Actual optimized entry asset proof absent');
    const nativeV1Sha256 = sha(readFileSync(`${out}/oracles/native-spec-seal-03/browser.spec.ts`));
    assert.equal(nativeV1Sha256, prior.ownFiles.find((row) => row.path === 'tests/RD-12/browser.spec.ts').sha256, 'Historical native spec seal changed');
    const repairTests = ['tests/RD-12/repair.unit.test.ts', 'tests/RD-12/native-config.unit.test.ts'];
    const repairRed = receipts.find((row) => row.label === 'repair-owning-red-03'); const repairGreen = receipts.filter((row) => row.operation === 'unit-repair').sort((a, b) => a.finished.localeCompare(b.finished)).at(-1);
    assert(repairRed && repairRed.exitCode === 1 && !repairRed.timedOut && repairGreen && repairGreen.exitCode === 0 && !repairGreen.timedOut);
    const redResults = JSON.parse(readFileSync(repairRed.testResults.path)); const greenResults = JSON.parse(readFileSync(repairGreen.testResults.path));
    assert.equal(redResults.numFailedTests, 5); assert.equal(redResults.numPassedTests, 1); assert.equal(greenResults.numPassedTests, 6); assert.equal(greenResults.numFailedTests, 0);
    for (const file of repairTests) {
      const current = result.ownFiles.find((row) => row.path === file); assert(current);
      assert.equal(repairRed.bindings.find((row) => row.path === file)?.sha256, current.sha256, 'Owning repair RED test changed');
      assert.equal(repairGreen.bindings.find((row) => row.path === file)?.sha256, current.sha256, 'Owning repair GREEN test changed');
      assert.equal(sha(readFileSync(`${out}/oracles/repair-oracle-red-seal-03/${path.basename(file)}`)), current.sha256, 'Repair RED oracle seal changed');
    }
    const repairOracleFiles = ['reports/RD-12/oracle.ts', 'reports/RD-12/qualification-v2.ts', 'tests/RD-12/browser.spec.ts', ...repairTests];
    for (const file of repairOracleFiles) {
      const current = result.ownFiles.find((row) => row.path === file); assert(current);
      assert.equal(sha(readFileSync(`${out}/oracles/repair-oracle-green-seal-01/${path.basename(file)}`)), current.sha256, 'Fresh versioned qualification/spec/test seal changed');
      assert.equal(repairGreen.bindings.find((row) => row.path === file)?.sha256, current.sha256, 'Repair GREEN predates qualified gate/native caller');
    }
    for (const op of ['review-diff', 'review-check', 'repair-commit', 'guard']) {
      const latest = receipts.filter((row) => row.operation === op).sort((a, b) => a.finished.localeCompare(b.finished)).at(-1);
      assert(latest && latest.exitCode === 0 && !latest.timedOut, `Final ${op} missing`); assert.deepEqual(latest.bindings, result.ownFiles, `${op} predates final owned files`);
    }
    result.versionedRepairOracles = { red: repairRed.label, green: repairGreen.label, tests: repairTests.map((file) => result.ownFiles.find((row) => row.path === file)),
      qualificationVersion: 'rd12-material-depth-qualification-v2', currentSeal: `${out}/oracles/repair-oracle-green-seal-01`, preservedNativeV1Sha256: nativeV1Sha256,
      distinction: 'v1 ROI/math/numeric thresholds retained byte-identically; v2 additionally requires the deliberate fault to reject positive acceptance', nativeExecution: 'NOT_RUN' };
    result.verification = { unit: 'PASS_CONTROLLED_NOT_NATIVE', types: 'PASS', rootTypes: 'PASS', standaloneOptimizedEntry: 'PASS_BUILD_ONLY',
      nativeBrowser: 'NOT_RUN_PHASE2', screenshots: 'NOT_RUN_PHASE2', native20Cycles: 'NOT_RUN', stockMaterialParity: 'NOT_RUN', gpuPerformance: 'NOT_RUN',
      nativeAllocation: 'UNSUPPORTED', mappedBuffers: 'UNSUPPORTED_NOT_QUALIFIED', canonicalShaderWaterShadowParity: 'UNSUPPORTED', art: 'NOT_RUN', product: 'NOT_RUN' };
    assert.equal(command(['diff', '--name-only']), ''); assert.equal(command(['diff', '--cached', '--name-only']), '');
  }
  const file = `${out}/${operation}-${label}.json`; writeNew(file, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ file, sha256: sha(readFileSync(file)), status: result.status, head: result.head, tree: result.tree, parent: result.parent, changedPaths: result.changedPaths, deltaPaths: result.deltaPaths,
    apiFiles: api.length, installed: result.installed, runtimeInventory: result.runtimeInventory,
    optimizedSummary: result.optimizedBuild ? { files: result.optimizedBuild.assets.length, jsBytes: result.optimizedBuild.jsBytes,
      entry: result.optimizedBuild.assets.find((row) => row.path === 'src/experiments/babylon/index.html'), main: result.optimizedBuild.assets.find((row) => /^assets\/rd12-.+\.js$/.test(row.path)) } : null,
    latestChecks: ['unit', 'types', 'root-types', 'build', 'guard', 'review-check'].map((operation) => receipts.filter((row) => row.operation === operation).sort((a, b) => a.finished.localeCompare(b.finished)).at(-1)).filter(Boolean).map((row) => ({ label: row.label, operation: row.operation, exitCode: row.exitCode, started: row.started, finished: row.finished, rawSha256: row.rawSha256, testResults: row.testResults })),
    original689: 689, shared18: 18, public429: 429, verification: result.verification, productIntegrated: false }));
}
