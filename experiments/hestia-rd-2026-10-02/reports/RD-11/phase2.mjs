import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { admit, BASE, directory, git, lab, node, ownBindings, sha, out as phase1 } from './run.mjs';
import { assertPortFree } from '../../scripts/verify-boundary.mjs';

export const START = 'c531783536cc0fc617e928781633101b43cd2bfa';
export const TREE = '49c4dccc756ff8916227db371296ff858de35f88';
export const root = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/phase2-c5317835-20261003';
export const freezePath = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/freezes/${START}.json`;
export const freezeSha = '282c235f1479bdfe71fa9d1d6f6a03973fedf477583337876ab0a15d8753ad96';
export const buildRoot = `${root}/build-optimized-01`;
const repo = path.resolve(lab, '../..'); const prefix = 'experiments/hestia-rd-2026-10-02/';
const branch = 'feature/hestia-rd-rd11-phase2-2026-10-03';
const original = `${root}/START-BINDINGS.json`;
const diagnosisLabel = 'native-diagnosis-02';
export const bytes = (file) => { admit(file, { owner: path.dirname(file), fresh: false }); return readFileSync(file); };
const json = (file) => JSON.parse(bytes(file));
const gitBytes = (args, input) => execFileSync(git, args, { cwd: repo, input, windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
const gitText = (args) => gitBytes(args).toString('utf8').trim();
const allowed = (file) => ['src/experiments/three-webgpu/', 'tests/RD-11/', 'reports/RD-11/'].some((part) => file.startsWith(prefix + part));
export function write(file, data) {
  admit(file, { owner: root }); directory(path.dirname(file), root); admit(file, { owner: root }); writeFileSync(file, data, { flag: 'wx' });
}
export const writeJson = (file, data) => write(file, JSON.stringify(data, null, 2));
export function environment(label) {
  const commandRoot = `${root}/commands/${label}`;
  return { ...process.env, PATH: 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64;C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd;C:/IFI_SourceCode/Utils/PowerShell',
    npm_config_script_shell: 'C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe', npm_config_cache: `${commandRoot}/npm-cache`,
    TEMP: `${commandRoot}/temp`, TMP: `${commandRoot}/temp`, HESTIA_RD_TASK: 'RD-11',
    HESTIA_RD11_PHASE2_SNAPSHOT: freezePath, HESTIA_RD11_PHASE2_SNAPSHOT_SHA256: freezeSha, HESTIA_RD11_OPTIMIZED_BUILD: buildRoot };
}
function frozen() {
  assert.equal(sha(bytes(freezePath)), freezeSha); const freeze = json(freezePath);
  assert.equal(freeze.start, START); assert.equal(freeze.tree, TREE); assert.equal(freeze.productIntegrated, false); assert.equal(freeze.frozenFiles.length, 18);
  for (const row of freeze.frozenFiles) { assert.equal(sha(bytes(path.join(lab, row.path))), row.sha256, row.path); }
  return freeze;
}
function snapshot() {
  assert.equal(gitText(['rev-parse', 'HEAD']), START); assert.equal(gitText(['rev-parse', 'HEAD^{tree}']), TREE); assert.equal(gitText(['branch', '--show-current']), branch);
  const freeze = frozen(); admit(root, { owner: path.dirname(root) }); directory(root, root);
  write(`${root}/original/freeze.json`, bytes(freezePath));
  const startFiles = gitBytes(['ls-tree', '-r', '-z', START, '--', prefix]).toString('utf8').split('\0').filter(Boolean).map((entry) => {
    const [metadata, file] = entry.split('\t'); const [mode, kind, blob] = metadata.split(' '); assert.equal(mode, '100644'); assert.equal(kind, 'blob');
    const data = bytes(path.join(repo, file));
    const rawBlob = createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
    const filteredBlob = rawBlob === blob ? rawBlob : gitBytes(['hash-object', `--path=${file}`, '--stdin'], data).toString('utf8').trim();
    assert.equal(filteredBlob, blob, `START Git-filtered bytes differ: ${file}`);
    return { path: file.slice(prefix.length), sha256: sha(data), bytes: data.length, blob, rawBlob, filteredBlob };
  });
  const source = ownBindings().filter((row) => startFiles.some((start) => start.path === row.path));
  assert.equal(source.length, 23);
  for (const row of source) { write(`${root}/original/source/${row.path}`, bytes(path.join(lab, row.path))); }
  const baseline = json(`${phase1}/verify-baseline-02.json`);
  assert.equal(baseline.originalFiles.length, 622);
  const wiring = ['src/registration.ts', 'vite.config.ts'];
  for (const row of baseline.originalFiles) { if (!wiring.includes(row.path)) { assert.equal(sha(bytes(path.join(lab, row.path))), row.sha256, row.path); } }
  const publicFiles = startFiles.filter((row) => row.path.startsWith('fixtures/')); assert.equal(publicFiles.length, 429);
  const api = json(`${phase1}/candidate-local-candidate-01.json`).api;
  for (const row of api) { assert.equal(sha(bytes(path.join(lab, 'node_modules', row.path))), row.sha256, row.path); }
  assert.equal(source.find((row) => row.path === 'tests/RD-11/unit.test.ts').sha256, '31def227fd4f4d129bb5173276524bbfdb7520aedd3cca90630b2e26ad9c1918');
  assert.equal(source.find((row) => row.path === 'reports/RD-11/oracle.ts').sha256, '4a194e1269db4b873eb1a87da94afea9a0f4dd9ba574c7ebbfe27c34761067da');
  writeJson(original, { schema: 'rd11-phase2-start-v1', START, TREE, BASE, branch, freezePath, freezeSha, shared18: freeze.frozenFiles, startFiles, source23: source,
    original622: baseline.originalFiles, allowedHistoricalWiringDelta: wiring, public429: publicFiles, api, productIntegrated: false });
  console.log(JSON.stringify({ status: 'PASS_START_SNAPSHOT', file: original, sha256: sha(bytes(original)), source23: source.length, startFiles: startFiles.length, public429: publicFiles.length, shared18: 18 }));
}
function bindings() {
  frozen(); const start = json(original);
  for (const row of start.startFiles) { assert.equal(sha(bytes(path.join(lab, row.path))), row.sha256, `Existing START source changed: ${row.path}`); }
  for (const row of start.source23) { assert.equal(sha(bytes(`${root}/original/source/${row.path}`)), row.sha256, 'START snapshot modified'); }
  for (const row of start.api) { assert.equal(sha(bytes(path.join(lab, 'node_modules', row.path))), row.sha256, row.path); }
  const paths = [...new Set([...gitText(['diff', '--name-only', START]).split('\n'), ...gitText(['ls-files', '--others', '--exclude-standard', '--', prefix]).split('\n')].filter(Boolean))];
  assert(paths.every(allowed), 'Phase2 delta outside RD11 roots');
  const own = ownBindings(); const source23 = start.source23.map((row) => ({ ...row, currentSha256: own.find((file) => file.path === row.path)?.sha256, changed: own.find((file) => file.path === row.path)?.sha256 !== row.sha256 }));
  assert.equal(sha(bytes(path.join(lab, 'reports/RD-11/oracle.ts'))), start.source23.find((row) => row.path === 'reports/RD-11/oracle.ts').sha256, 'Frozen ROI changed');
  assert.equal(sha(bytes(path.join(lab, 'tests/RD-11/unit.test.ts'))), start.source23.find((row) => row.path === 'tests/RD-11/unit.test.ts').sha256, 'Exact accepted17 oracle changed');
  assert.equal(sha(bytes(path.join(lab, 'tests/RD-11/browser.spec.ts'))), start.source23.find((row) => row.path === 'tests/RD-11/browser.spec.ts').sha256, 'Exact original browser oracle changed');
  return { status: 'PASS', head: gitText(['rev-parse', 'HEAD']), tree: gitText(['rev-parse', 'HEAD^{tree}']), parent: gitText(['rev-parse', 'HEAD^']), branch: gitText(['branch', '--show-current']),
    START, TREE, freezePath, freezeSha, startBindingSha256: sha(bytes(original)), currentShared18: start.shared18, original622: '620_BYTE_UNCHANGED_TWO_HEAD_WIRING_CHANGES_MATCH_CURRENT_FREEZE', public429: 'BYTE_UNCHANGED',
    source23, ownFiles: own, paths, cpuOracleSha256: sha(bytes(path.join(lab, 'tests/RD-11/unit.test.ts'))), roiSha256: sha(bytes(path.join(lab, 'reports/RD-11/oracle.ts'))), productIntegrated: false };
}
function treeFiles(folder, relative = '') {
  admit(folder, { owner: folder, fresh: false, directory: true }); const files = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name); const name = relative ? `${relative}/${entry.name}` : entry.name;
    assert(!lstatSync(full).isSymbolicLink(), 'Output link forbidden');
    if (entry.isDirectory()) { files.push(...treeFiles(full, name)); } else { const data = bytes(full); files.push({ path: name, bytes: data.length, sha256: sha(data) }); }
  }
  return files;
}
function buildBindings(label) {
  const files = treeFiles(buildRoot); const start = json(original);
  for (const row of start.public429) { assert.equal(files.find((file) => file.path === row.path.slice('fixtures/'.length))?.sha256, row.sha256, row.path); }
  const graph = files.filter((row) => row.path.endsWith('.html') || row.path.endsWith('.js'));
  assert.equal(graph.filter((row) => row.path.endsWith('.html')).length, 4); assert(graph.some((row) => row.path === 'src/experiments/three-webgpu/index.html'));
  const headBuild = `${phase1}/build-head-wiring-build-01`;
  for (const row of graph) { assert.equal(sha(bytes(path.join(headBuild, row.path))), row.sha256, `HEAD graph reference differs: ${row.path}`); }
  writeJson(`${root}/build-bindings-${label}.json`, { status: 'PASS', buildRoot, source: ownBindings(), graph, publicCopiesByteMatched: 429, files,
    historicalHeadBuildReadOnlyComparison: { path: headBuild, graphFilesByteMatched: graph.length, notFreshNativeEvidence: true }, productIntegrated: false });
  console.log(JSON.stringify({ status: 'PASS_BUILD_BINDINGS', buildRoot, graphFiles: graph.length, publicCopiesByteMatched: 429 }));
}
function evidence(label) {
  const browserRoot = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/browser/rd11-phase2-c5317835-native-01';
  const files = treeFiles(browserRoot); const nativeResults = json(`${root}/commands/native-01/test-results.json`);
  assert.equal(nativeResults.stats.expected, 8); assert.equal(nativeResults.stats.unexpected, 1); assert.equal(nativeResults.stats.skipped, 0);
  const captures = []; const modes = []; const scenarioBindings = [];
  function bindCapture(media, state, format) {
    assert.equal(sha(bytes(media.path)), media.sha256); const d = state.diagnostics;
    assert.equal(d.rendered.tick, d.frame.tick); assert.equal(d.rendered.fixtureDigest, d.fixtureDigest); assert.equal(d.rendered.sourceRevision, d.sourceRevision);
    if (format !== 'C0') { assert.equal(d.pending, false); assert.equal(d.rendered.cameraId, d.frame.cameraId); assert.equal(d.rendered.projectionGeneration, d.projectionGeneration); }
    captures.push({ media, mode: format, scenarioId: state.scenarioId, scenarioDigest: state.scenarioDigest, fixtureId: d.fixtureId, fixtureDigest: d.fixtureDigest,
      sourceRevision: d.sourceRevision, cameraId: d.frame.cameraId, frame: d.frame, rendered: d.rendered,
      pendingGate: format === 'C0' ? 'C0 readDiagnostics fails while pending; no new boolean invented' : d.pending, resolution: d.resolution });
  }
  let parity;
  for (const file of files.filter((row) => row.path.startsWith('cases/') && row.path.endsWith('.json'))) {
    const data = json(path.join(browserRoot, file.path));
    if (file.path.endsWith('/native.json')) {
      const mode = data.state.requestedMode; bindCapture(data.media, data.state, mode);
      assert.equal(data.state.diagnostics.backend.initialized, true); assert.equal(data.state.diagnostics.backend.fallbackObserved, false);
      assert.equal(data.state.diagnostics.backend.actual, mode === 'C1' ? 'webgl2' : 'webgpu');
      assert(!Object.hasOwn(data.state.diagnostics.gpuMs, 'value')); assert(!Object.hasOwn(data.state.diagnostics.nativeGpuBytes, 'value'));
      modes.push({ mode, backend: data.state.diagnostics.backend, quality: data.state.diagnostics.quality, browser: data.browser,
        submittedFrames: data.state.diagnostics.submittedFrames, sourceProfile: data.state.diagnostics.presentationProfile });
    } else if (file.path.endsWith('/replay.json')) {
      for (const row of data.observations) { bindCapture(row.media, row.observed, row.observed.requestedMode); }
      scenarioBindings.push(...data.observations.map(({ observed }) => ({ mode: observed.requestedMode, scenarioId: observed.scenarioId, scenarioDigest: observed.scenarioDigest,
        fixtureDigest: observed.diagnostics.fixtureDigest, sourceRevision: observed.diagnostics.sourceRevision, cameraId: observed.diagnostics.frame.cameraId,
        tick: observed.diagnostics.frame.tick, resetTick: observed.diagnostics.resetTick, payloadBindings: observed.diagnostics.payloadBindings,
        presentationProfile: observed.diagnostics.presentationProfile, ownerIds: observed.diagnostics.owners.map((owner) => owner.ownerId) })));
    } else if (file.path.endsWith('/parity.json')) {
      parity = { path: path.join(browserRoot, file.path), sha256: file.sha256, observations: data.observations };
      for (const row of data.states) {
        const png = path.join(browserRoot, path.dirname(file.path), `${row.mode}-C01-EYE.png`); const image = bytes(png);
        bindCapture({ path: png, sha256: sha(image), width: image.readUInt32BE(16), height: image.readUInt32BE(20) }, row.state, row.mode);
      }
    }
  }
  const f01Root = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/browser/rd11-phase2-c5317835-f01-native-03';
  const f01Files = treeFiles(f01Root); const f01Stats = json(`${root}/commands/f01-native-03/test-results.json`).stats;
  assert.equal(f01Stats.expected, 2); assert.equal(f01Stats.unexpected, 0); assert.equal(f01Stats.skipped, 0);
  for (const mode of ['C1', 'C2']) {
    const replay = json(`${f01Root}/${mode}/replay.json`);
    for (const row of replay.observations) { bindCapture(row.media, row.before, mode); assert.deepEqual(row.before.diagnostics.frame, row.after.diagnostics.frame); assert.deepEqual(row.before.diagnostics.rendered, row.after.diagnostics.rendered); }
    assert.deepEqual(replay.disposed.liveHosts, { renderers: 0, renderloops: 0, abortListeners: 0 });
    assert.equal(replay.advanced.diagnostics.frame.tick, replay.paused.diagnostics.frame.tick + 60);
    for (const ui of ['C07-visible-ui', 'play-pause-advance-visible-ui']) {
      const record = json(`${f01Root}/${mode}/${ui}.json`); assert.equal(sha(bytes(record.path)), record.sha256);
      assert.deepEqual(record.before.diagnostics.frame, record.after.diagnostics.frame); assert.deepEqual(record.before.diagnostics.rendered, record.after.diagnostics.rendered);
    }
  }
  const diagnosis = json(`${root}/diagnostics-${diagnosisLabel}/diagnosis.json`);
  assert.deepEqual(diagnosis.originalNegative.observations, diagnosis.reproducedNegative, 'Independent native fault reproduction differs');
  assert.equal(diagnosis.originalNegative.observations.find((row) => row.roi.id === 'coast-baked-ao').status, 'ORACLE_ACCEPTED');
  const diagnosisFiles = treeFiles(`${root}/diagnostics-${diagnosisLabel}`);
  const repairRoot = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/repair-node-defaults-eb7fe140-20261003';
  const oldSnapshotPath = `${repairRoot}/ORIGINAL-SNAPSHOT.json`;
  assert.equal(sha(bytes(oldSnapshotPath)), '35bdb4a913bba70db3fad80e3cfe118e89e29db603f268b7ebf942d463d4d854');
  const saved = json(oldSnapshotPath).saved;
  for (const row of saved) { assert.equal(sha(bytes(row.snapshot)), row.sha256, 'Historical snapshot changed');
    if (row.source.replaceAll('\\', '/').startsWith(phase1)) { assert.equal(sha(bytes(row.source)), row.sha256, 'Historical Phase1 producer changed'); } }
  const repairFinalPath = `${repairRoot}/FINAL-TYPE-REPAIR.json`;
  assert.equal(sha(bytes(repairFinalPath)), '721c0ecf05a8c8b5721d9f082501431753a9163192d5384aeebaa0780416b953');
  for (const receipt of json(repairFinalPath).receipts) { assert.equal(sha(bytes(`${repairRoot}/commands/${receipt.label}/raw.log`)), receipt.rawSha256, 'Historical repair log changed'); }
  writeJson(`${root}/evidence-${label}.json`, { status: 'PHASE2_EXECUTED_REN12_NEGATIVE_GATE_FAIL', adoptionDecision: 'DEFER_VALIDATED_VISUAL_COMPARISON_NO_ORACLE_CHANGE', browserRoot,
    nativeStats: nativeResults.stats, f01Root, f01Stats, f01Files, originalBrowserOracleSha256: sha(bytes(path.join(lab, 'tests/RD-11/browser.spec.ts'))), modes, parity, captures, scenarioBindings,
    nativePngCount: files.filter((row) => row.path.endsWith('.png')).length, nativeFiles: files, diagnosisLabel, diagnosisFiles, negativeDiagnosis: diagnosis,
    history: { oldSnapshotPath, oldSnapshotSha256: sha(bytes(oldSnapshotPath)), verifiedSavedOriginals: saved.length, repairFinalPath, repairFinalSha256: sha(bytes(repairFinalPath)),
      oldTypingFailuresAreHistoricalNotReissued: true, noMutableCurrentFreezeAdmission: true }, productIntegrated: false });
  console.log(JSON.stringify({ status: 'PHASE2_EXECUTED_REN12_NEGATIVE_GATE_FAIL', nativeStats: nativeResults.stats, nativePngCount: files.filter((row) => row.path.endsWith('.png')).length,
    boundPositiveCaptures: captures.length, scenarioObservations: scenarioBindings.length, historySnapshotsVerified: saved.length, modes }));
}
function final() {
  const current = bindings(); assert.equal(current.parent, START); assert.equal(current.branch, branch);
  assert.equal(gitText(['diff', '--name-only']), ''); assert.equal(gitText(['diff', '--cached', '--name-only']), '');
  const commandFolders = readdirSync(`${root}/commands`, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const receipts = commandFolders.map((entry) => {
    const file = `${root}/commands/${entry.name}/receipt.json`; const receipt = json(file);
    assert.equal(sha(bytes(`${root}/commands/${entry.name}/raw.log`)), receipt.rawSha256);
    if (receipt.testResults) { assert.equal(sha(bytes(receipt.testResults.path)), receipt.testResults.sha256); }
    return { ...receipt, receiptSha256: sha(bytes(file)) };
  });
  for (const operation of ['types-root', 'types-focused', 'unit', 'build', 'guard', 'diff-check', 'staged-check', 'commit', 'diagnostics', 'preview']) {
    assert(receipts.some((receipt) => receipt.operation === operation && receipt.exitCode === 0 && !receipt.timedOut), `Missing fresh ${operation} pass`);
  }
  const postGuard = receipts.find((receipt) => receipt.label === 'scope-postcommit-01');
  assert.equal(postGuard.exitCode, 0); assert.equal(postGuard.checkout, current.head);
  for (const receipt of receipts.filter((row) => row.operation === 'guard')) {
    const proof = json(`${root}/commands/${receipt.label}/raw.log`); assert.equal(proof.inputHashesVerified, 52); assert.deepEqual(proof.violations, []);
    assert.deepEqual(proof.platformArtifacts.toSorted(), ['.opencode/throughput.jsonl', '.opencode/throughput.md']);
  }
  const native = receipts.find((receipt) => receipt.operation === 'browser'); assert.equal(native.exitCode, 1); assert.equal(native.timedOut, false); assert.equal(native.checkout, START);
  const tested = ['src/experiments/three-webgpu/', 'tests/RD-11/', 'reports/RD-11/oracle.ts'];
  for (const label of ['root-types-final-01', 'focused-types-final-01', 'controlled-cpu-01', 'optimized-01', 'native-01']) {
    const receipt = receipts.find((row) => row.label === label); assert(receipt, `Missing current-source proof ${label}`);
    for (const row of receipt.source.filter((file) => tested.some((prefix) => file.path.startsWith(prefix)))) { assert.equal(sha(bytes(path.join(lab, row.path))), row.sha256, 'Evidence source no longer current'); }
  }
  const cpu = json(receipts.find((receipt) => receipt.operation === 'unit').testResults.path); assert.equal(cpu.numPassedTests, 17); assert.equal(cpu.numFailedTests, 0);
  const diagnosisReceipt = receipts.find((receipt) => receipt.label === diagnosisLabel);
  assert.equal(diagnosisReceipt.exitCode, 0); assert.equal(diagnosisReceipt.source.find((row) => row.path === 'reports/RD-11/native-diagnostics.mjs').sha256, sha(bytes(path.join(lab, 'reports/RD-11/native-diagnostics.mjs'))));
  const f01Receipt = receipts.find((receipt) => receipt.label === 'f01-native-03'); assert.equal(f01Receipt.exitCode, 0); assert.equal(f01Receipt.checkout, START);
  for (const row of f01Receipt.source.filter((file) => file.path === 'tests/RD-11/f01-phase2.spec.ts' || file.path === 'reports/RD-11/f01.playwright.config.ts')) { assert.equal(sha(bytes(path.join(lab, row.path))), row.sha256); }
  const evidenceRecord = json(`${root}/evidence-final-03.json`); const build = json(`${root}/build-bindings-final-01.json`);
  for (const row of build.files) { assert.equal(sha(bytes(path.join(buildRoot, row.path))), row.sha256, 'Optimized build changed'); }
  for (const row of evidenceRecord.nativeFiles) { assert.equal(sha(bytes(path.join(evidenceRecord.browserRoot, row.path))), row.sha256, 'Native evidence changed'); }
  for (const row of evidenceRecord.f01Files) { assert.equal(sha(bytes(path.join(evidenceRecord.f01Root, row.path))), row.sha256, 'F01 evidence changed'); }
  for (const row of evidenceRecord.diagnosisFiles) { assert.equal(sha(bytes(`${root}/diagnostics-${diagnosisLabel}/${row.path}`)), row.sha256, 'Diagnosis evidence changed'); }
  assert.equal(json(`${root}/port-free-after-preview-04.json`).status, 'PASS');
  const changedPaths = gitText(['diff', '--name-status', START, 'HEAD']); assert.equal(gitText(['rev-list', '--count', `${START}..HEAD`]), '1');
  const syntax = json(`${root}/syntax-final-02.json`);
  for (const row of syntax.files) { assert.equal(sha(bytes(path.join(lab, row.path))), row.sha256); }
  writeJson(`${root}/FINAL-PHASE2.json`, { ...current, status: evidenceRecord.status, adoptionDecision: evidenceRecord.adoptionDecision,
    candidate: current.head, candidateTree: current.tree, directParent: current.parent, changedPaths, diffStat: gitText(['diff', '--stat', START, 'HEAD']),
    receipts, syntaxBinding: { path: `${root}/syntax-final-02.json`, sha256: sha(bytes(`${root}/syntax-final-02.json`)), files: syntax.files.length },
    buildBinding: { path: `${root}/build-bindings-final-01.json`, sha256: sha(bytes(`${root}/build-bindings-final-01.json`)), graph: build.graph, public429: build.publicCopiesByteMatched },
    evidence: { path: `${root}/evidence-final-03.json`, sha256: sha(bytes(`${root}/evidence-final-03.json`)), nativeStats: evidenceRecord.nativeStats, f01Stats: evidenceRecord.f01Stats, f01Root: evidenceRecord.f01Root, nativePngCount: evidenceRecord.nativePngCount,
      modes: evidenceRecord.modes, parity: evidenceRecord.parity, history: evidenceRecord.history },
    verification: { types: 'PASS_ROOT_AND_FOCUSED_NATIVE', cpu: 'PASS_17_CONTROLLED_ONLY', build: 'PASS_ACTUAL_FOUR_ENTRIES_14_GRAPH_429_PUBLIC', browser: 'FAIL_8_PASS_1_FAIL_NO_SKIP',
      f01NativeKeyframesAndControls: 'PASS_C1_C2_2_OF_2_26_FRAMES_PLUS_4_VISIBLE_UI_CAPTURES', frozenSourceBindings: 'PASS', selfReview: 'PERFORMED_FINAL_DIFF_AND_REPRESENTATIVE_NATIVE_CAPTURES', independentPhase2Review: 'NOT_RUN_NO_DELEGATION',
      originalAllFilesGate: 'FAIL_ACCEPTED_NARROW_EXCEPTION_TWO_AUTOMATIC_REGULAR_UNTRACKED_THROUGHPUT_LOGS', gpuPerformance: 'NOT_RUN_NO_QUALIFIED_LEASE', art: 'NOT_RUN', product: 'NOT_RUN' },
    cleanup: { ownedPreview: 'CLOSED_RECEIPT_AND_MANAGED_EXIT0', ownedSdkContexts: 'CLOSED', port5280: 'PASS_FREE', artifacts: 'RETAINED_APPEND_ONLY', foreignCleanup: 'NONE' },
    managedLaunchFailures: json(`${root}/managed-launch-failures.json`), residualRisk: 'Frozen image oracle admits deliberate vertex-color loss; final canvas format/alpha, other camera/synthetic ROI and GPU buffer/depth readback are not established', productIntegrated: false });
  console.log(JSON.stringify({ status: evidenceRecord.status, candidate: current.head, tree: current.tree, parent: current.parent, changedPaths,
    finalPath: `${root}/FINAL-PHASE2.json`, finalSha256: sha(bytes(`${root}/FINAL-PHASE2.json`)), productIntegrated: false }));
}
async function health(label) {
  const urls = ['http://127.0.0.1:5280/', 'http://127.0.0.1:5280/src/experiments/three-webgpu/index.html?mode=C1&scenario=F01-HVP-COAST-REPLAY', 'http://127.0.0.1:5280/src/experiments/three-webgpu/index.html?mode=C2&scenario=F01-HVP-COAST-REPLAY'];
  const observations = [];
  for (const url of urls) {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) }); assert.equal(response.status, 200);
    const body = new Uint8Array(await response.arrayBuffer()); const file = path.join(buildRoot, new URL(url).pathname === '/' ? 'index.html' : new URL(url).pathname);
    assert.equal(sha(body), sha(bytes(file))); observations.push({ url, status: response.status, sha256: sha(body) });
  }
  writeJson(`${root}/health-${label}.json`, { status: 'PASS_SERVED_HASH_BOUND_OPTIMIZED_HTML_NOT_A_NEW_BROWSER_RUN', checkout: gitText(['rev-parse', 'HEAD']), observations, productIntegrated: false });
  console.log(JSON.stringify({ status: 'PASS_SERVED_HASH_BOUND_OPTIMIZED_HTML', observations }));
}
function plannerPackage() {
  const finalPath = `${root}/FINAL-PHASE2.json`; const result = json(finalPath); const record = json(result.evidence.path);
  const artifacts = treeFiles(root); const browserRoots = [...new Set(result.receipts.filter((receipt) => receipt.browserRunId).map((receipt) => {
    assert.match(receipt.browserRunId, /^rd11-phase2-c5317835-[a-z0-9-]+$/); return `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/browser/${receipt.browserRunId}`;
  }))];
  const browserArtifacts = browserRoots.flatMap((folder) => treeFiles(folder).map((file) => ({ ...file, path: path.join(folder, file.path) })));
  const captures = [...browserArtifacts.filter((file) => file.path.endsWith('.png')), ...artifacts.filter((file) => file.path.endsWith('.png')).map((file) => ({ ...file, path: path.join(root, file.path) }))];
  const source = ownBindings();
  writeJson(`${root}/PLANNER-REVIEW-PACKAGE.json`, { schema: 'rd11-planner-review-v1', status: 'USABLE_OPTIMIZED_LAB_VISUAL_ADOPTION_DEFERRED', finalPath, finalSha256: sha(bytes(finalPath)),
    candidate: result.candidate, tree: result.candidateTree, parent: START, branch, freezePath, freezeSha, source, cpuOracleSha256: result.cpuOracleSha256, roiSha256: result.roiSha256,
    optimizedBuild: buildRoot, buildBinding: result.buildBinding, statusMatrix: result.verification, nativeBackends: record.modes, nativeOriginalStats: record.nativeStats, f01Stats: record.f01Stats,
    rawMeasurements: { qualification: 'FUNCTIONAL_DIAGNOSTIC_ONLY_NOT_GPU_BENCHMARK', imageRoi: record.parity, negativeSensitivity: record.negativeDiagnosis.originalNegative.observations,
      commands: result.receipts.map(({ label, operation, binary, args, cwd, exitCode, signal, timedOut, elapsedSecondsDiagnosticOnly, rawSha256, testResults }) => ({ label, operation, binary, args, cwd, exitCode, signal, timedOut, elapsedSecondsDiagnosticOnly, rawSha256, testResults })),
      gpuMs: 'NOT_RUN_NO_QUALIFIED_LEASE', nativeGpuBytes: 'UNSUPPORTED', performanceRatios: 'NOT_RUN' },
    screenshots: captures, artifactRoots: { ownedRun: root, originalNative: record.browserRoot, finalF01Native: record.f01Root, allOwnedBrowserAttempts: browserRoots }, artifacts, browserArtifacts,
    reproduction: { cwd: lab, shell: 'C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe', startCommand: `& '${node}' 'reports/RD-11/phase2.mjs' repro-preview planner-preview-20261003-01`,
      stopCommand: `& '${node}' 'reports/RD-11/phase2.mjs' stop-preview planner-preview-20261003-01`, freshLabelRequired: true, timeoutMinutes: 25, strictPort: 5280,
      urls: ['http://127.0.0.1:5280/src/experiments/three-webgpu/index.html?mode=C1&scenario=F01-HVP-COAST-REPLAY', 'http://127.0.0.1:5280/src/experiments/three-webgpu/index.html?mode=C2&scenario=F01-HVP-COAST-REPLAY'],
      controlsVerified: ['Mount', 'Play', 'Pause', 'Advance 60 ticks', 'Seek', 'Reset', 'Resize', 'Dispose'], alreadyServing: false,
      admission: 'Human reproduction may serve source-identical verification-only child; original optimized SDK configs still require exact immutable wired HEAD', managedLaunchRequiredForAgent: true, durableGallery: 'HEAD_OWNED_AFTER_ACCEPTANCE' },
    adoptionDecision: result.adoptionDecision, independentPhase2Review: 'NOT_RUN', cleanup: result.cleanup, residualRisk: result.residualRisk, productIntegrated: false });
  console.log(JSON.stringify({ status: 'PLANNER_PACKAGE_READY_VISUAL_ADOPTION_DEFERRED', path: `${root}/PLANNER-REVIEW-PACKAGE.json`, sha256: sha(bytes(`${root}/PLANNER-REVIEW-PACKAGE.json`)), screenshots: captures.length, candidate: result.candidate }));
}
async function preview(label, reproduction = false) {
  assert.match(label ?? '', /^[a-z0-9-]+$/); frozen(); const checkout = gitText(['rev-parse', 'HEAD']);
  if (reproduction) {
    const bound = bindings(); assert.equal(bound.branch, branch); assert(checkout === START || bound.parent === START, 'Only immutable START or its source-identical verification-only child may serve reproduction');
    for (const row of json(`${root}/build-bindings-final-01.json`).files) { assert.equal(sha(bytes(path.join(buildRoot, row.path))), row.sha256, 'Reproduction build changed'); }
  } else { assert.equal(checkout, START); }
  const commandRoot = `${root}/commands/${label}`; admit(commandRoot, { owner: root }); directory(commandRoot, root);
  directory(`${commandRoot}/temp`, root); directory(`${commandRoot}/npm-cache`, root); const env = environment(label);
  Object.assign(process.env, env); await assertPortFree();
  const raw = `${commandRoot}/raw.log`; write(raw, ''); const started = new Date().toISOString();
  const metadata = { operation: 'preview', label, binary: node, binarySha256: sha(bytes(node)), pid: process.pid, cwd: lab,
    script: fileURLToPath(import.meta.url), scriptSha256: sha(bytes(fileURLToPath(import.meta.url))), source: ownBindings(), START, TREE, freezeSha, buildRoot,
    started, checkout, checkoutTree: gitText(['rev-parse', 'HEAD^{tree}']), reproductionOnly: reproduction, noSdkSnapshotBypass: true,
    portFreeBeforeListen: true, origin: 'http://127.0.0.1:5280', processLocal: { PATH: env.PATH, TEMP: env.TEMP, cache: env.npm_config_cache }, productIntegrated: false };
  writeJson(`${commandRoot}/started.json`, metadata);
  const log = (line) => { admit(raw, { owner: root, fresh: false }); appendFileSync(raw, `${line}\n`); console.log(line); };
  const { preview: startPreview } = await import(pathToFileURL(path.join(lab, 'node_modules/vite/dist/node/index.js')).href);
  const server = await startPreview({ root: lab, configLoader: 'native', build: { outDir: buildRoot }, preview: { host: '127.0.0.1', port: 5280, strictPort: true } });
  const stop = `${root}/STOP-${label}.json`; let stopping = false;
  const close = async (reason) => {
    if (stopping) { return; } stopping = true; clearInterval(poll); clearTimeout(deadline);
    await server.close(); log(`RD11_PREVIEW_CLOSED ${reason}`);
    writeJson(`${commandRoot}/receipt.json`, { ...metadata, finished: new Date().toISOString(), exitCode: 0, signal: null, reason, rawSha256: sha(bytes(raw)), ownedServerClosed: true });
  };
  const poll = setInterval(() => { if (lstatSync(stop, { throwIfNoEntry: false })) { json(stop); void close('OWNED_STOP_REQUEST'); } }, 250);
  const deadline = setTimeout(() => { void close('BOUNDED_25_MINUTE_DEADLINE'); }, 1_500_000);
  process.once('SIGTERM', () => { void close('SIGTERM'); }); process.once('SIGINT', () => { void close('SIGINT'); });
  log('RD11_PREVIEW_READY http://127.0.0.1:5280 optimized task-owned build');
}
async function run(label, operation) {
  assert.match(label ?? '', /^[a-z0-9-]+$/); const commandRoot = `${root}/commands/${label}`;
  admit(commandRoot, { owner: root }); directory(commandRoot, root); directory(`${commandRoot}/temp`, root); directory(`${commandRoot}/npm-cache`, root);
  const native = path.join(lab, 'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe');
  const commands = {
    'types-root': [native, ['--noEmit', '-p', 'tsconfig.json', '--extendedDiagnostics']],
    'types-focused': [native, ['--noEmit', '-p', 'reports/RD-11/tsconfig.json', '--extendedDiagnostics']],
    unit: [node, [path.join(lab, 'node_modules/vitest/vitest.mjs'), 'run', 'tests/RD-11', '--configLoader', 'native', '--reporter=json', `--outputFile=${commandRoot}/test-results.json`]],
    build: [node, [path.join(lab, 'node_modules/vite/bin/vite.js'), 'build', '--configLoader', 'native', '--outDir', buildRoot, '--emptyOutDir', 'false']],
    browser: [node, [path.join(lab, 'node_modules/@playwright/test/cli.js'), 'test', '--config=reports/RD-11/playwright.config.ts', '--reporter=list,json']],
    'browser-f01': [node, [path.join(lab, 'node_modules/@playwright/test/cli.js'), 'test', '--config=reports/RD-11/f01.playwright.config.ts', '--reporter=list,json']],
    diagnostics: [node, [path.join(lab, 'reports/RD-11/native-diagnostics.mjs'), label]],
    guard: [node, [path.join(lab, 'scripts/verify-boundary.mjs'), '--task', 'RD-11', '--start', START, '--base', BASE]],
    'diff-check': [git, ['diff', '--check']], 'staged-check': [git, ['diff', '--cached', '--check']],
    commit: [git, ['commit', '-m', 'RD-11: record native phase2 verification and ROI failure']],
  };
  assert(Object.hasOwn(commands, operation), 'Unknown bounded Phase2 operation');
  if (['build', 'browser', 'browser-f01', 'commit'].includes(operation)) { assert.equal(gitText(['rev-parse', 'HEAD']), START); assert.equal(gitText(['branch', '--show-current']), branch); }
  if (operation === 'build') { admit(buildRoot, { owner: root }); }
  const resultPath = ['unit', 'browser', 'browser-f01'].includes(operation) ? `${commandRoot}/test-results.json` : undefined;
  if (resultPath) { admit(resultPath, { owner: root }); }
  const env = environment(label);
  if (operation.startsWith('browser')) {
    env.HESTIA_RD_BROWSER_RUN_ID = `rd11-phase2-c5317835-${label}`; env.PLAYWRIGHT_JSON_OUTPUT_FILE = resultPath;
    admit(`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/browser/${env.HESTIA_RD_BROWSER_RUN_ID}`, { owner: 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-11/browser' }); frozen();
  }
  const [binary, args] = commands[operation]; const raw = `${commandRoot}/raw.log`; write(raw, ''); const started = new Date().toISOString(); const clock = performance.now();
  const child = spawn(binary, args, { cwd: lab, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const metadata = { label, operation, binary, binarySha256: sha(bytes(binary)), args, cwd: lab, started, pid: child.pid,
    source: ownBindings(), checkout: gitText(['rev-parse', 'HEAD']), checkoutTree: gitText(['rev-parse', 'HEAD^{tree}']), freezePath, freezeSha,
    processLocal: { PATH: env.PATH, shell: env.npm_config_script_shell, cache: env.npm_config_cache, TEMP: env.TEMP, TMP: env.TMP },
    browserRunId: env.HESTIA_RD_BROWSER_RUN_ID, optimizedBuild: buildRoot, watchdogMs: operation.startsWith('types-') ? 90_000 : operation.startsWith('browser') ? 870_000 : 240_000, qualification: 'FUNCTIONAL_DIAGNOSTIC_NOT_BENCHMARK', productIntegrated: false };
  writeJson(`${commandRoot}/started.json`, metadata);
  const append = (data) => { admit(raw, { owner: root, fresh: false }); appendFileSync(raw, data); process.stdout.write(data); };
  child.stdout.on('data', append); child.stderr.on('data', append); child.once('error', (error) => { append(Buffer.from(String(error))); });
  let timedOut = false; const timer = setTimeout(() => { timedOut = true; child.kill(); }, metadata.watchdogMs);
  const result = await new Promise((resolve) => { child.once('close', (exitCode, signal) => { resolve({ exitCode, signal }); }); }); clearTimeout(timer);
  const receipt = { ...metadata, ...result, timedOut, finished: new Date().toISOString(), elapsedSecondsDiagnosticOnly: (performance.now() - clock) / 1000, rawSha256: sha(bytes(raw)), rawBytes: bytes(raw).length,
    testResults: resultPath && lstatSync(resultPath, { throwIfNoEntry: false }) ? { path: resultPath, sha256: sha(bytes(resultPath)) } : null };
  writeJson(`${commandRoot}/receipt.json`, receipt); console.log(JSON.stringify({ label, operation, ...result, timedOut, elapsedSecondsDiagnosticOnly: receipt.elapsedSecondsDiagnosticOnly, rawSha256: receipt.rawSha256 })); process.exitCode = result.exitCode ?? 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [operation, label] = process.argv.slice(2);
  if (operation === 'snapshot') { snapshot(); }
  else if (operation === 'bindings') { const result = bindings(); writeJson(`${root}/bindings-${label}.json`, result); console.log(JSON.stringify({ status: result.status, ownFiles: result.ownFiles.length, paths: result.paths })); }
  else if (operation === 'build-bindings') { buildBindings(label); }
  else if (operation === 'evidence') { evidence(label); }
  else if (operation === 'final') { final(); }
  else if (operation === 'planner-package') { plannerPackage(); }
  else if (operation === 'health') { await health(label); }
  else if (operation === 'syntax') { const result = ownBindings().filter((row) => row.path.endsWith('.ts')).map((row) => ({ ...row, transformedSha256: sha(stripTypeScriptTypes(bytes(path.join(lab, row.path)).toString('utf8'), { mode: 'transform' })) }));
    writeJson(`${root}/syntax-${label}.json`, { status: 'PASS_SYNTAX_ONLY_NOT_TYPES', files: result }); console.log(JSON.stringify({ status: 'PASS_SYNTAX_ONLY_NOT_TYPES', files: result.length })); }
  else if (operation === 'port-free') { await assertPortFree(); writeJson(`${root}/port-free-${label}.json`, { status: 'PASS', origin: 'http://127.0.0.1:5280', checked: new Date().toISOString(), productIntegrated: false }); console.log('PASS_FREE_5280'); }
  else if (operation === 'preview') { await preview(label); }
  else if (operation === 'repro-preview') { await preview(label, true); }
  else if (operation === 'stop-preview') { assert.match(label ?? '', /^[a-z0-9-]+$/); writeJson(`${root}/STOP-${label}.json`, { requested: new Date().toISOString(), owner: 'RD-11', productIntegrated: false }); }
  else if (operation === 'record-launch-failures') { writeJson(`${root}/managed-launch-failures.json`, { productIntegrated: false, failures: [
    { taskId: 'bg_mustutss_5e', pid: 35344, exitCode: 1, started: '2026-10-03T20:11:20.294Z', finished: '2026-10-03T20:11:20.430Z', raw: '[ERROR] "&" kann syntaktisch an dieser Stelle nicht verarbeitet werden.', scope: 'Default shell rejected PowerShell syntax before the Node script ran', correction: 'New preview-02 label, explicit C-owned PowerShell' },
    { operation: 'Attempt to record the managed launch failure through inline Node', exitCode: 1, scope: 'PowerShell quoting failure; no successful evidence-write claim', correction: 'Record through this guarded script operation; no browser/runtime change' }
  ] }); }
  else { await run(label, operation); }
}
