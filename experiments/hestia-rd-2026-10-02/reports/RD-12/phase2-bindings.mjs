import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { commands, nativeOutput, lab, repo, START2, TREE2, git, gitText, json, regular, rehash, files, bound, fresh, ownBindings, sha, assertPortFree,
  freezeSha, leaseSha, buildProofSha, repairProofSha, buildRoot } from './phase2-support.mjs';
import { inspectBoundary } from '../../scripts/verify-boundary.mjs';

const label = process.argv[2]; assert.match(label ?? '', /^[a-z0-9-]+$/);
const precommit = process.argv[3] === 'precommit'; assert(process.argv[3] === undefined || precommit);
const started = new Date().toISOString(); const bindings = ownBindings();
fresh(`${commands}/${label}/started.json`, { started, script: bound(import.meta.filename), bindings, nativeExecution: 'NOT_RUN_POSTCOMMIT_BINDINGS', productIntegrated: false });
try {
  // Evidence is an additive child of the actually executed source, never direct303.
  const head = gitText('rev-parse', 'HEAD'); const tree = gitText('rev-parse', 'HEAD^{tree}'); const parent = precommit ? null : gitText('rev-parse', 'HEAD^');
  if (precommit) { assert.equal(head, START2); assert.equal(tree, TREE2); } else { assert.equal(parent, START2); }
  assert.equal(gitText('rev-parse', `${START2}^{tree}`), TREE2);
  assert.equal(gitText('branch', '--show-current'), 'feature/hestia-rd-rd12-2026-10-04');
  const prefix = 'experiments/hestia-rd-2026-10-02/';
  const delta = gitText('diff', ...(precommit ? ['--cached', '--name-status', START2] : ['--name-status', START2, 'HEAD'])).split(/\r?\n/).map((line) => {
    const [status, file] = line.split('\t'); assert.equal(status, 'A', 'No frozen source modifications');
    assert(file.startsWith(`${prefix}reports/RD-12/`) || file.startsWith(`${prefix}tests/RD-12/`), file); return file;
  }); assert(delta.length > 0);
  assert.equal(gitText('diff', '--name-only'), '');
  if (precommit) { assert.equal(gitText('status', '--porcelain=v1', '--untracked-files=all').split(/\r?\n/).filter((line) => line.startsWith('?? ')).join('\n'), '?? .opencode/throughput.jsonl\n?? .opencode/throughput.md'); }
  else { assert.equal(gitText('diff', '--cached', '--name-only'), ''); assert.equal(gitText('status', '--porcelain=v1', '--untracked-files=all'), '?? .opencode/throughput.jsonl\n?? .opencode/throughput.md'); }
  const preflightPath = `${commands}/preflight-01.json`; const preflight = json(preflightPath, '53bd76ab929cae77c6301dae5d8e92b35a49c794b0562f2aad3128d79d980dd6');
  assert.equal(preflight.start, START2); assert.equal(preflight.tree, TREE2); assert.equal(preflight.exitCode, 0); assert.equal(preflight.timedOut, false);
  for (const [field, expected] of Object.entries({ freeze: freezeSha, lease: leaseSha, buildProof: buildProofSha, repairProof: repairProofSha })) {
    assert.equal(preflight[field].sha256, expected); assert.equal(bound(preflight[field].path).sha256, expected);
  }
  assert.equal(preflight.sourceFiles.length, 713); assert.equal(preflight.shared18.length, 18); assert.equal(preflight.api33.length, 33); assert.equal(preflight.public429.length, 429);
  rehash(preflight.sourceFiles, lab); rehash(preflight.shared18, lab); rehash(preflight.api33, path.join(lab, 'node_modules')); rehash(preflight.math3, path.join(lab, 'node_modules'));
  rehash(preflight.public429, buildRoot); rehash(preflight.buildAssets, buildRoot); assert.deepEqual(files(buildRoot), [...preflight.buildAssets].sort((a, b) => a.path.localeCompare(b.path)));
  for (const entry of [...preflight.executables, ...preflight.packages, preflight.priorCandidate]) { assert.equal(bound(entry.path).sha256, entry.sha256, entry.path); }
  assert.equal(sha(regular(path.join(lab, 'package-lock.json'), lab)), 'b550953c353dacbe7cc8f869fb28d66fdf85e2e2d85827d08dd9e8812fb40404');
  const servedPath = `${commands}/readiness-01/served-manifest.json`; const served = json(servedPath); assert.equal(served.source, START2); assert.equal(served.responses.length, 509);
  for (const expected of preflight.buildAssets) { const actual = served.responses.find((entry) => entry.path === expected.path); assert(actual); assert.equal(actual.status, 200); assert.equal(actual.sha256, expected.sha256); assert.equal(actual.bytes, expected.bytes); }
  const checks = [];
  for (const [name, exitCode] of [['original-inventory-01', 0], ['original-native-01', 1], ['diagnosis-native-01', 0], ['functional-native-v2-01', 1],
    ['semantic-pre-native-01', 0], ['types-pre-native-01', 1], ['types-pre-native-02', 0], ['package-build-01', 0], ['package-verify-01', 0],
    ['types-final-01', 0], ['root-types-final-01', 0], ['semantic-final-01', 0], ['review-diff-final-01', 0], ['review-check-final-01', 0], ['guard-final-01', 0], ['precommit-bindings-01', 1],
    ['review-diff-final-02', 0], ['review-check-final-02', 0], ['guard-final-02', 0],
    ...(precommit ? [] : [['evidence-commit-01', 0]])]) {
    const receiptPath = `${commands}/${name}/receipt.json`; const receipt = json(receiptPath); assert.equal(receipt.exitCode, exitCode, name); assert.equal(receipt.timedOut, false, name);
    assert.equal(receipt.source, START2); assert.equal(receipt.productIntegrated, false);
    if (receipt.raw) { assert.equal(bound(receipt.raw.path).sha256, receipt.raw.sha256); }
    if (receipt.sourceSeal) {
      assert.equal(bound(receipt.sourceSeal.path).sha256, receipt.sourceSeal.sha256); const seal = json(receipt.sourceSeal.path);
      assert.equal(seal.source, START2); assert.equal(seal.tree, TREE2); assert.deepEqual(seal.bindings, receipt.bindings);
    }
    // Native code/sealed assertions stay byte-identical. The new progress doc alone
    // is intentionally updated after execution; frozen prior docs are in source713.
    for (const entry of receipt.bindings.filter((file) => /\.(?:ts|mjs)$/.test(file.path))) {
      const earlierTypedReader = ['semantic-pre-native-01', 'types-pre-native-01'].includes(name) && entry.path === 'reports/RD-12/native-reader-v2.ts';
      const earlierBindingHelper = ['package-verify-01', 'types-final-01', 'root-types-final-01', 'semantic-final-01', 'review-diff-final-01', 'review-check-final-01', 'guard-final-01', 'precommit-bindings-01'].includes(name)
        && entry.path === 'reports/RD-12/phase2-bindings.mjs';
      if (earlierTypedReader) { assert.equal(bound(`${commands}/superseded-reader-source-01/native-reader-v2.ts`).sha256, entry.sha256); }
      else if (earlierBindingHelper) { assert.equal(bound(`${commands}/precommit-bindings-01/phase2-bindings.mjs`).sha256, entry.sha256); }
      else { assert.equal(bound(path.join(lab, entry.path), lab).sha256, entry.sha256, `${name}: ${entry.path}`); }
    }
    if (['review-diff-final-02', 'review-check-final-02', 'guard-final-02', 'evidence-commit-01'].includes(name)) { assert.deepEqual(receipt.bindings, bindings, `Final all-file bindings: ${name}`); }
    checks.push({ name, ...bound(receiptPath), exitCode, timedOut: false, raw: receipt.raw ?? null, nativeExecution: receipt.nativeExecution ?? 'NOT_RUN_HELPER_BINDING_FAILURE' });
  }
  const inventory = json(`${commands}/inventory-01.json`); assert.equal(inventory.count, 16); assert.equal(inventory.titles.length, 16);
  const resultFiles = [['original', 'native-results.json', 0, 16], ['diagnosis-v1', 'diagnosis-v1-results.json', 3, 0], ['functional-v2', 'functional-v2-results.json', 12, 4]];
  const nativeResults = resultFiles.map(([version, file, passed, failed]) => {
    const full = `${nativeOutput}/${file}`; const result = json(full); assert.equal(result.stats.expected, passed); assert.equal(result.stats.unexpected, failed); assert.equal(result.stats.skipped, 0);
    return { version, ...bound(full), passed, failed, skipped: 0, stats: result.stats };
  });
  const slice = path.join(lab, 'reports/RD-12/phase2-slice-5e4c1b8f'); const manifest = json(path.join(slice, 'manifest.json')); assert.equal(manifest.source, START2); assert.equal(manifest.tree, TREE2);
  rehash(manifest.files, slice); assert.equal(files(slice).length, manifest.files.length + 1); assert.equal(manifest.images.length, 68);
  for (const report of manifest.reports) { const bytes = gunzipSync(regular(path.join(slice, report.portable.path), slice)); assert.equal(sha(bytes), report.source.sha256); assert.equal(bound(report.source.path).sha256, report.source.sha256); }
  const matrix = json(path.join(slice, 'result-matrix.json')); assert.equal(matrix.functionalV2.cases.length, 16);
  for (const test of matrix.functionalV2.cases) { assert.equal(test.network.offsite, 0); assert.equal(test.network.compilerRequests, 0); assert.deepEqual(test.network.pageErrors, []); }
  for (const failure of matrix.retainedFailureFiles) { assert.equal(bound(failure.source.path, nativeOutput).sha256, failure.source.sha256); }
  const cleanupPath = `${commands}/cleanup-01.json`; const cleanup = json(cleanupPath); assert.equal(cleanup.port5280, 'FREE_EXCLUSIVE_BIND_RELEASED');
  assert(cleanup.managedProcesses.every((entry) => entry.status === 'completed' && entry.exitCode === 0)); assert.equal(cleanup.foreignProcessesTouched, false); await assertPortFree();
  const boundary = inspectBoundary({ repoRoot: repo, task: 'RD-12', start: START2, base: 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e' }); assert.equal(boundary.ok, true); assert.equal(boundary.inputHashesVerified, 52);
  // Prove local LFS media objects as well as workspace bytes; no upload/fsck/move.
  const common = path.resolve(lab, gitText('rev-parse', '--git-common-dir')); const lfs = [];
  for (const file of delta) {
    const blob = execFileSync(git, ['show', precommit ? `:${file}` : `HEAD:${file}`], { cwd: lab, windowsHide: true, maxBuffer: 32 * 1024 * 1024 }); const actual = bound(path.join(repo, file), repo);
    if (blob.toString().startsWith('version https://git-lfs.github.com/spec/v1\n')) {
      const pointer = blob.toString().match(/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([a-f0-9]{64})\nsize (\d+)\n$/); assert(pointer, file);
      assert.equal(pointer[1], actual.sha256); assert.equal(Number(pointer[2]), actual.bytes);
      const object = path.join(common, 'lfs/objects', pointer[1].slice(0, 2), pointer[1].slice(2, 4), pointer[1]); assert.equal(bound(object).sha256, actual.sha256);
      lfs.push({ path: file, oid: pointer[1], bytes: actual.bytes, localObject: bound(object), published: false });
    } else { assert.equal(sha(blob), actual.sha256, `Committed bytes: ${file}`); }
  }
  const status = precommit ? 'PASS_PRECOMMIT_BINDINGS_NATIVE_QUALIFICATION_FAIL' : 'PASS_EVIDENCE_BINDINGS_NATIVE_QUALIFICATION_FAIL';
  const artifact = `${commands}/${precommit ? 'verify' : 'candidate'}-${label}.json`;
  fresh(artifact, { schema: 'rd12-phase2-evidence-candidate-v1', status, created: new Date().toISOString(),
    evidenceCommit: { committed: !precommit, head, tree, directParent: parent, deltaPaths: delta }, executedSource: { start: START2, tree: TREE2, preflight: bound(preflightPath), source713: preflight.sourceFiles,
      shared18: preflight.shared18, api33: preflight.api33, public429: preflight.public429, build509: preflight.buildAssets, executableBindings: preflight.executables },
    ownBindings: bindings, checks, nativeResults, inventory: bound(`${commands}/inventory-01.json`), servedManifest: bound(servedPath), sliceManifest: bound(path.join(slice, 'manifest.json')),
    measurements: json(path.join(slice, 'measurements.json')), boundary, cleanup: { ...cleanup, proof: bound(cleanupPath), freshPortProof: 'FREE_EXCLUSIVE_BIND_RELEASED' },
    retainedNativeFiles: files(nativeOutput), retainedCommandFiles: files(commands), localLfs: lfs, review: 'SELF_REVIEW_ONLY_NEW_HARNESS_EVIDENCE; HEAD earlier repair review separate',
    qualifiedGpuPerformance: 'NOT_GRANTED', nativeMemory: 'UNKNOWN_UNSUPPORTED', productIntegrated: false });
  fresh(`${commands}/${label}/receipt.json`, { started, finished: new Date().toISOString(), exitCode: 0, timedOut: false, source: START2, candidate: bound(artifact), bindings,
    nativeExecution: 'NOT_RUN_POSTCOMMIT_BINDINGS', productIntegrated: false });
  console.log(JSON.stringify({ status, evidenceCommit: { committed: !precommit, head, tree, parent }, deltaFiles: delta.length, localLfsFiles: lfs.length, artifact: bound(artifact) }));
} catch (error) {
  fresh(`${commands}/${label}/receipt.json`, { started, finished: new Date().toISOString(), exitCode: 1, timedOut: false, source: START2, error: String(error), bindings, nativeExecution: 'NOT_RUN_POSTCOMMIT_BINDINGS', productIntegrated: false }); throw error;
}
