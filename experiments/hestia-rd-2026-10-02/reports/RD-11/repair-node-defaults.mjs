import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { admit, BASE, directory, git, lab, node, out as phase1, ownBindings, sha, START } from './run.mjs';

export const repair = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/repair-node-defaults-eb7fe140-20261003';
const PARENT = 'eb7fe140f0d6d49be4e1b19764e211fd1ade8b88';
const repo = path.resolve(lab, '../..'); const prefix = 'experiments/hestia-rd-2026-10-02/';
const branch = 'feature/hestia-rd-rd11-2026-10-02';
const gitBytes = (args) => execFileSync(git, args, { cwd: repo, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
const gitText = (args) => gitBytes(args).toString('utf8').trim();
const bytes = (file) => { admit(file, { fresh: false, owner: path.dirname(file) }); return readFileSync(file); };
const json = (file) => JSON.parse(bytes(file));
function write(file, data) {
  admit(file, { owner: repair }); directory(path.dirname(file), repair);
  admit(file, { owner: repair }); writeFileSync(file, data, { flag: 'wx' });
}
const writeJson = (file, data) => write(file, JSON.stringify(data, null, 2));
const allowed = (file) => ['src/experiments/three-webgpu/', 'tests/RD-11/', 'reports/RD-11/'].some((root) => file.startsWith(prefix + root));
const snapshotPath = `${repair}/ORIGINAL-SNAPSHOT.json`;

function snapshot() {
  assert.equal(gitText(['rev-parse', 'HEAD']), PARENT); assert.equal(gitText(['branch', '--show-current']), branch);
  admit(repair, { owner: path.dirname(repair) }); directory(repair, repair);
  const saved = [];
  function copy(source, relative, expected) {
    const data = bytes(source); if (expected) { assert.equal(sha(data), expected, source); }
    const sink = `${repair}/original/${relative}`; write(sink, data);
    saved.push({ source, snapshot: sink, sha256: sha(data), bytes: data.length });
  }
  const candidatePath = `${phase1}/candidate-local-candidate-01.json`;
  copy(candidatePath, 'candidate.json', '36a144c01a7ba972877bef3471341d825a2a3936c56aea7c8aa8ab148198b28d');
  const candidate = json(candidatePath); assert.equal(candidate.head, PARENT); assert.equal(candidate.ownFiles.length, 19);
  for (const row of candidate.ownFiles) { copy(path.join(lab, row.path), `source/${row.path}`, row.sha256); }
  copy(`${phase1}/FINAL-PHASE1.json`, 'FINAL-PHASE1.json', '7a4d37a3d0bcd3ea5aa59aa2c39bf09067337b916325eba7cffa9aaec5139228');
  copy(`${phase1}/verify-baseline-02.json`, 'baseline.json', '75ab12c108b6bcf319c517dc78fee6f9b01b2b13795e638119463569d1b2c3c9');
  for (const entry of readdirSync(`${phase1}/oracles`)) { copy(`${phase1}/oracles/${entry}`, `oracles/${entry}`); }
  for (const entry of readdirSync(`${phase1}/commands`, { withFileTypes: true })) {
    if (!entry.isDirectory()) { continue; }
    for (const file of ['started.json', 'raw.log', 'receipt.json', 'test-results.json']) {
      const source = `${phase1}/commands/${entry.name}/${file}`;
      if (lstatSync(source, { throwIfNoEntry: false })) { copy(source, `commands/${entry.name}/${file}`); }
    }
  }
  const proof = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/rd11-phase1-type-hold-eb7fe140.json';
  copy(proof, 'HEAD-type-hold.json', 'd9c870141b52d1a8f74a95cae718a7f6af2d9fabadebb8f7836dd5683cc90cd2');
  copy('C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/reviews/SO-02-eb7fe140-rd11-static.md', 'SO02-static-eb7fe140.md');
  for (const diagnostic of json(proof).diagnostics) {
    const root = path.dirname(diagnostic.path); const name = path.basename(root);
    copy(diagnostic.path, `${name}/summary.json`, diagnostic.sha256);
    for (const entry of readdirSync(root, { withFileTypes: true }).filter((row) => row.isDirectory())) {
      for (const file of readdirSync(path.join(root, entry.name))) {
        const source = path.join(root, entry.name, file);
        if (lstatSync(source).isFile()) { copy(source, `${name}/${entry.name}/${file}`); }
      }
    }
  }
  const baseline = json(`${repair}/original/baseline.json`);
  for (const row of baseline.originalFiles) { assert.equal(sha(bytes(path.join(lab, row.path))), row.sha256, row.path); }
  writeJson(snapshotPath, { schema: 'rd11-type-repair-original-v1', parent: PARENT, parentTree: gitText(['rev-parse', 'HEAD^{tree}']),
    branch, START, BASE, saved, originalSource19: candidate.ownFiles, original622: baseline.originalFiles,
    api: candidate.api,
    shared18: baseline.freeze.shared18, public429: baseline.originalFiles.filter((row) => row.path.startsWith('fixtures/')),
    plan: ['Preserve original evidence before edits', 'Correct only redundant color/unsupported Lambert emissive assignments and two property assertions',
      'Actual native smoke/root/focused types, focused CPU RED/GREEN, syntax, source/scope/diff checks', 'Self-review, local direct-child commit, postcommit bindings'],
    prohibited: ['delegation', 'browser', 'GPU qualification', 'shared writes', 'build', 'publication', 'deletion'], productIntegrated: false });
  console.log(JSON.stringify({ status: 'ORIGINAL_SNAPSHOT_PRESERVED', snapshotPath, sha256: sha(bytes(snapshotPath)), files: saved.length }));
}

function bindings() {
  const original = json(snapshotPath);
  const repaired = ['src/experiments/three-webgpu/projection.ts', 'tests/RD-11/unit.test.ts'];
  for (const row of original.saved) {
    if (!repaired.some((file) => path.resolve(row.source) === path.resolve(lab, file))) { assert.equal(sha(bytes(row.source)), row.sha256, `Historical source changed: ${row.source}`); }
    assert.equal(sha(bytes(row.snapshot)), row.sha256, `Snapshot changed: ${row.snapshot}`); }
  // Only the two explicitly repaired originals may differ; all other source19 remain byte-bound.
  const source19 = original.originalSource19.map((row) => {
    const current = sha(bytes(path.join(lab, row.path)));
    if (!repaired.includes(row.path)) { assert.equal(current, row.sha256, row.path); }
    return { ...row, currentSha256: current, changed: current !== row.sha256 };
  });
  for (const row of original.original622) { assert.equal(sha(bytes(path.join(lab, row.path))), row.sha256, row.path); }
  for (const row of original.shared18) { assert.equal(sha(bytes(path.join(lab, row.path))), row.sha256, row.path); }
  for (const row of original.api) { assert.equal(sha(bytes(path.join(lab, 'node_modules', row.path))), row.sha256, row.path); }
  assert.equal(original.original622.length, 622); assert.equal(original.public429.length, 429); assert.equal(original.shared18.length, 18);
  const current = ownBindings(); const paths = [...new Set([...gitText(['diff', '--name-only', PARENT]).split('\n'),
    ...gitText(['ls-files', '--others', '--exclude-standard', '--', prefix]).split('\n')].filter(Boolean))];
  assert(paths.every(allowed), 'Repair diff outside original RD11 allowlist');
  const packages = ['three', '@types/three', 'typescript'].map((name) => {
    const file = path.join(lab, 'node_modules', name, 'package.json'); const data = json(file);
    assert.equal(data.version, name === 'typescript' ? '7.0.2' : '0.185.1'); return { name, version: data.version, sha256: sha(bytes(file)) };
  });
  const api = ['three/src/materials/nodes/NodeMaterial.js', 'three/src/materials/nodes/MeshLambertNodeMaterial.js',
    'three/src/nodes/accessors/MaterialNode.js', '@types/three/src/materials/nodes/NodeMaterial.d.ts',
    '@types/three/src/materials/nodes/MeshLambertNodeMaterial.d.ts'].map((file) => ({ path: file, sha256: sha(bytes(path.join(lab, 'node_modules', file))) }));
  const oldUnit = bytes(`${repair}/original/source/tests/RD-11/unit.test.ts`).toString('utf8');
  const corrected16 = oldUnit.replace("import { materialColor, materialOpacity } from 'three/tsl';", "import { materialOpacity } from 'three/tsl';")
    .replace("import { type MeshLambertNodeMaterial } from 'three/webgpu';", "import { NodeMaterial, type MeshLambertNodeMaterial } from 'three/webgpu';")
    .replace('expect(material.colorNode).toBe(materialColor);', 'expect(material.colorNode).toBeNull();')
    .replace('expect(material.emissiveNode).not.toBeNull();', "expect(material).not.toHaveProperty('emissiveNode');");
  assert(bytes(path.join(lab, 'tests/RD-11/unit.test.ts')).subarray(0, Buffer.byteLength(corrected16)).equals(Buffer.from(corrected16)), 'Substantive original16 assertions changed');
  assert.equal(sha(bytes(`${repair}/oracles/native-default17-unit.ts`)), current.find((row) => row.path === 'tests/RD-11/unit.test.ts').sha256, 'Corrected RED oracle changed');
  return { status: 'PASS', head: gitText(['rev-parse', 'HEAD']), tree: gitText(['rev-parse', 'HEAD^{tree}']),
    directParent: gitText(['rev-parse', 'HEAD^']), branch: gitText(['branch', '--show-current']), originalSnapshotSha256: sha(bytes(snapshotPath)),
    source19, original622: 'BYTE_UNCHANGED', shared18: 'BYTE_UNCHANGED', public429: 'BYTE_UNCHANGED',
    frozenRoiSha256: current.find((row) => row.path === 'reports/RD-11/oracle.ts').sha256,
    originalUnitSha256: source19.find((row) => row.path === 'tests/RD-11/unit.test.ts').sha256,
    currentUnitSha256: source19.find((row) => row.path === 'tests/RD-11/unit.test.ts').currentSha256,
    originalOracleUnchanged: false, original16SubstantiveAssertionsPreserved: true, corrected16PrefixSha256: sha(corrected16),
    ownFiles: current, paths, packages, api, productIntegrated: false };
}

async function run(label, operation) {
  assert.match(label ?? '', /^[a-z0-9-]+$/); const root = `${repair}/commands/${label}`;
  admit(root, { owner: repair }); directory(root, repair); directory(`${root}/temp`, repair); directory(`${root}/npm-cache`, repair);
  const types = operation.startsWith('types-'); const native = path.join(lab, 'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe');
  const commands = {
    'types-smoke': [native, ['--noEmit', '-p', 'reports/RD-11/tsconfig.native-default-smoke.json', '--extendedDiagnostics']],
    'types-smoke-single': [native, ['--noEmit', '-p', 'reports/RD-11/tsconfig.native-default-smoke.json', '--singleThreaded', '--extendedDiagnostics']],
    'types-focused': [native, ['--noEmit', '-p', 'reports/RD-11/tsconfig.json', '--extendedDiagnostics']],
    'types-root': [native, ['--noEmit', '-p', 'tsconfig.json', '--extendedDiagnostics']],
    unit: [node, ['node_modules/vitest/vitest.mjs', 'run', 'tests/RD-11', '--configLoader', 'native', '--reporter=json', `--outputFile=${root}/test-results.json`]],
    guard: [node, ['scripts/verify-boundary.mjs', '--task', 'RD-11', '--start', PARENT, '--base', BASE]],
    'diff-check': [git, ['diff', '--check']], 'staged-check': [git, ['diff', '--cached', '--check']],
    commit: [git, ['commit', '-m', 'RD-11: use pinned Lambert node defaults to repair type gates']],
  };
  assert(Object.hasOwn(commands, operation), 'Unknown bounded repair operation');
  if (operation === 'commit') { assert.equal(gitText(['rev-parse', 'HEAD']), PARENT); assert.equal(gitText(['branch', '--show-current']), branch); }
  if (operation === 'unit') { admit(`${root}/test-results.json`, { owner: repair }); }
  const [binary, args] = commands[operation]; const source = ownBindings(); const raw = `${root}/raw.log`; write(raw, '');
  const environment = { ...process.env, PATH: 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64;C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd;C:/IFI_SourceCode/Utils/PowerShell',
    npm_config_script_shell: 'C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe', npm_config_cache: `${root}/npm-cache`, TEMP: `${root}/temp`, TMP: `${root}/temp`, HESTIA_RD_TASK: 'RD-11' };
  const started = new Date().toISOString(); const clock = performance.now();
  const child = spawn(binary, args, { cwd: lab, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const metadata = { label, operation, binary, binarySha256: sha(bytes(binary)), args, cwd: lab, started, pid: child.pid, bindings: source,
    processLocal: { PATH: environment.PATH, scriptShell: environment.npm_config_script_shell, cache: environment.npm_config_cache, TEMP: environment.TEMP, TMP: environment.TMP },
    watchdogMs: types ? 90_000 : 240_000, nativeDirectNoWrapperChild: types, productIntegrated: false };
  writeJson(`${root}/started.json`, metadata);
  const append = (data) => { admit(raw, { fresh: false, owner: repair }); appendFileSync(raw, data); process.stdout.write(data); };
  child.stdout.on('data', append); child.stderr.on('data', append);
  let timedOut = false; const timer = setTimeout(() => { timedOut = true; child.kill(); }, metadata.watchdogMs);
  child.once('error', (error) => { append(Buffer.from(String(error))); });
  const result = await new Promise((resolve) => { child.once('close', (exitCode, signal) => { resolve({ exitCode, signal }); }); });
  clearTimeout(timer);
  const receipt = { ...metadata, ...result, timedOut, finished: new Date().toISOString(), elapsedSeconds: (performance.now() - clock) / 1000,
    rawSha256: sha(bytes(raw)), rawBytes: bytes(raw).length,
    testResults: operation === 'unit' && lstatSync(`${root}/test-results.json`, { throwIfNoEntry: false }) ? { path: `${root}/test-results.json`, sha256: sha(bytes(`${root}/test-results.json`)) } : null };
  writeJson(`${root}/receipt.json`, receipt); console.log(JSON.stringify({ label, operation, ...result, timedOut, elapsedSeconds: receipt.elapsedSeconds, rawSha256: receipt.rawSha256 }));
  process.exitCode = result.exitCode ?? 1;
}

function final() {
  const binding = bindings(); assert.equal(binding.directParent, PARENT); assert.equal(binding.branch, branch);
  assert.equal(gitText(['diff', '--name-only']), ''); assert.equal(gitText(['diff', '--cached', '--name-only']), '');
  const receipts = readdirSync(`${repair}/commands`, { withFileTypes: true }).filter((row) => row.isDirectory()).map((row) => {
    const file = `${repair}/commands/${row.name}/receipt.json`; const receipt = json(file);
    assert.equal(sha(bytes(`${repair}/commands/${row.name}/raw.log`)), receipt.rawSha256);
    return { ...receipt, path: file, receiptSha256: sha(bytes(file)) };
  });
  for (const operation of ['types-smoke', 'types-focused', 'types-root', 'unit', 'guard']) {
    const passed = receipts.filter((row) => row.operation === operation && row.exitCode === 0 && !row.timedOut).sort((a, b) => a.started.localeCompare(b.started)).at(-1);
    assert(passed, `Fresh real ${operation} pass required`);
    for (const row of binding.ownFiles.filter((file) => file.path.startsWith('src/') || file.path.startsWith('tests/') || file.path.endsWith('native-default-smoke.ts') || file.path.endsWith('tsconfig.native-default-smoke.json'))) {
      assert.equal(passed.bindings.find((prior) => prior.path === row.path)?.sha256, row.sha256, `Source changed after ${operation}: ${row.path}`);
    }
  }
  for (const row of receipts.filter((receipt) => receipt.testResults)) { assert.equal(sha(bytes(row.testResults.path)), row.testResults.sha256); }
  const red = receipts.find((row) => row.label === 'corrected-oracle-red-01'); const green = receipts.find((row) => row.label === 'corrected-oracle-green-01');
  assert.equal(red.exitCode, 1); assert.equal(green.exitCode, 0);
  const oracleOf = (row) => row.bindings.find((file) => file.path === 'tests/RD-11/unit.test.ts').sha256;
  assert.equal(oracleOf(red), binding.currentUnitSha256); assert.equal(oracleOf(green), binding.currentUnitSha256);
  const redTests = json(red.testResults.path); const greenTests = json(green.testResults.path);
  assert.equal(redTests.numTotalTests, 17); assert.equal(redTests.numFailedTests, 2); assert.equal(greenTests.numPassedTests, 17); assert.equal(greenTests.numFailedTests, 0);
  const syntaxPath = `${repair}/syntax-final-01.json`; const syntax = json(syntaxPath);
  for (const row of syntax) { assert.equal(binding.ownFiles.find((file) => file.path === row.path).sha256, row.sha256, 'Source changed after syntax check'); }
  const result = { schema: 'rd11-type-repair-final-v1', ...binding, status: 'TYPE_REPAIR_VERIFIED_HEAD_REVIEW_PENDING',
    changedPaths: gitText(['diff', '--name-only', PARENT, 'HEAD']).split('\n'), receipts,
    correctedOracleRedGreen: { oracleSha256: binding.currentUnitSha256, red: red.label, green: green.label, redFailed: 2, greenPassed: 17,
      redResultSha256: red.testResults.sha256, greenResultSha256: green.testResults.sha256 },
    syntax: { path: syntaxPath, sha256: sha(bytes(syntaxPath)), files: syntax.length, status: 'PASS_SYNTAX_ONLY_NOT_TYPES' },
    verification: { rootTypes: 'PASS', focusedTypes: 'PASS', nativeDefaultSmoke: 'PASS_REAL_NATIVE_COMPILER', cpu: 'PASS_CONTROLLED_NOT_NATIVE',
      sourceBindings: 'PASS_ORIGINAL622_SHARED18_PUBLIC429_AND_17_UNCHANGED_SOURCE19', selfReview: 'PERFORMED', independentReview: 'NOT_RUN_BY_LEAF',
      originalAllFilesGate: 'FAIL_ACCEPTED_NARROW_EXCEPTION', build: 'NOT_RUN_BY_GRANT', browser: 'NOT_RUN_BY_GRANT', gpu: 'NOT_RUN_NO_LEASE', art: 'NOT_RUN', product: 'NOT_RUN' },
    cleanup: 'Every spawned job has observed close/exit receipt; no browser/server started; artifacts retained, no deletion or foreign cleanup',
    limitations: 'Bounded type repair only, not whole Phase1 acceptance. HEAD fresh review/integration/new immutable snapshot still required.', productIntegrated: false };
  const file = `${repair}/FINAL-TYPE-REPAIR.json`; writeJson(file, result);
  console.log(JSON.stringify({ status: result.status, file, sha256: sha(bytes(file)), head: result.head, tree: result.tree, directParent: result.directParent, changedPaths: result.changedPaths, verification: result.verification }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [operation, label] = process.argv.slice(2);
  if (operation === 'snapshot') { snapshot(); }
  else if (operation === 'bindings') { assert.match(label ?? '', /^[a-z0-9-]+$/); const result = bindings(); const file = `${repair}/bindings-${label}.json`; writeJson(file, result);
    console.log(JSON.stringify({ file, sha256: sha(bytes(file)), ...result, ownFiles: result.ownFiles.length })); }
  else if (operation === 'syntax') {
    assert.match(label ?? '', /^[a-z0-9-]+$/);
    const result = ownBindings().filter((row) => row.path.endsWith('.ts')).map((row) => ({ ...row,
      transformedSha256: sha(stripTypeScriptTypes(bytes(path.join(lab, row.path)).toString('utf8'), { mode: 'transform' })), status: 'PASS_SYNTAX_ONLY_NOT_TYPES' }));
    const file = `${repair}/syntax-${label}.json`; writeJson(file, result); console.log(JSON.stringify({ file, sha256: sha(bytes(file)), files: result.length, status: 'PASS_SYNTAX_ONLY_NOT_TYPES' }));
  } else if (operation === 'final') { final(); }
  else { await run(label, operation); }
}
