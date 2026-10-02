import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repo = path.resolve(lab, '../..');
const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-01';
const prefix = 'experiments/hestia-rd-2026-10-02/';
const gitPath = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const original = '3298565993c01ad0c27d101674f25b1b581791b2';
const start = '89b55315fa7800a7a417c49e5e5a272f17410b4b';
const base = 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e';
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 1 && args[0] === '--prepare'));
const prepare = args.length === 1;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...argv) => execFileSync(gitPath, argv, { cwd: repo, timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
const text = (...argv) => git(...argv).toString('utf8').trim();
const bind = (file) => {
  const bytes = readFileSync(file);
  return { path: file, byteLength: bytes.length, sha256: sha256(bytes) };
};
const records = readFileSync(`${run}/commands.jsonl`, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
const required = ['repair-preflight', 'repair-red', 'repair-green', 'repair-head-retained-green',
  'repair-check', 'repair-typecheck', 'repair-unit', 'repair-build', 'repair-source-audit', 'repair-catalog', 'repair-boundary'];
if (!prepare) {
  required.push('repair-candidate-boundary', 'repair-diff-check', 'repair-commit', 'repair-postcommit-boundary');
}
const commands = required.map((label) => {
  const matches = records.filter((record) => record.label === label);
  assert.equal(matches.length, 1, label);
  const command = matches[0];
  assert.equal(command.exitCode, label === 'repair-red' ? 1 : 0, label);
  assert.equal(command.signal, null);
  assert.equal(command.log.startsWith(`${run}/logs/`), true);
  const binding = bind(command.log);
  assert.equal(binding.sha256, command.logSha256);
  assert.equal(binding.byteLength, command.logBytes);
  return command;
});
const command = (label) => commands.find((entry) => entry.label === label);
const originalAudit = JSON.parse(readFileSync(path.join(lab, 'reports/RD-01/source-audit.json')));
const audit = JSON.parse(readFileSync(command('repair-source-audit').log));
const preflight = JSON.parse(readFileSync(command('repair-preflight').log));
for (const key of ['inputs', 'assets', 'controls', 'frozenFiles']) {
  assert.deepEqual(audit[key], originalAudit[key]);
  assert.deepEqual(preflight[key], originalAudit[key]);
}
assert.equal(audit.frozenFiles.length, 18);
assert(audit.frozenFiles.every((file) => file.matches));
assert(command('repair-preflight').finished < command('repair-red').started);
const cliPath = 'src/tools/reference-index/cli.mjs';
const testPath = 'tests/RD-01/unit.test.ts';
const cli = bind(path.join(lab, cliPath));
const tests = readFileSync(path.join(lab, testPath));
const originalTests = git('show', `${original}:${prefix}${testPath}`);
assert(tests.subarray(0, originalTests.length).equals(originalTests), 'REF01..04 original bytes are an unchanged prefix');
const testSha256 = sha256(tests);
const caseEvidence = ['tIs6D3', 'gGz3Sj', 'kBRrcE'].map((suffix, index) => {
  const file = `${run}/repair-output-guard-${suffix}/evidence.json`;
  const evidence = JSON.parse(readFileSync(file));
  assert.equal(evidence.regressionTestSha256, testSha256);
  assert.equal(evidence.filesystemSinkExecuted, false);
  assert(evidence.destinationEntries.every((destination) => destination.entries.length === 0));
  assert.equal(evidence.sourceSha256, index === 0 ? sha256(git('show', `${original}:${prefix}${cliPath}`)) : cli.sha256);
  for (const label of ['live-junction', 'dangling-junction']) {
    const outcome = evidence.outcomes.find((entry) => entry.label === label);
    assert.equal(outcome.nativeCaseVariant, true);
    assert.equal(outcome.error, index === 0 ? null : 'Index output is not an own regular path');
    assert.equal(outcome.sinkCalls.length, index === 0 ? 1 : 0);
  }
  if (index !== 0) {
    for (const outcome of evidence.outcomes) {
      assert.equal(outcome.error, outcome.expectedReject ? 'Index output is not an own regular path' : null);
      assert.equal(outcome.sinkCalls.length, outcome.expectedReject ? 0 : 1);
    }
  }
  return { phase: ['RED', 'GREEN', 'FRESH_FINAL_UNIT'][index], binding: bind(file), ...evidence };
});
const producerRed = bind(`${run}/logs/head-case-link-guard-red-1790974865018.log`);
assert.equal(producerRed.sha256, '913ac445e5ae6c9f129f6478bf22b15086ed46e06e4cf3d714cf7e5af755ed30');
const originalReceipt = bind(`${run}/final-receipt.json`);
assert.equal(originalReceipt.sha256, '1a88d9db98e9a1a3956b5703cab6757633dbade521f695a10ac558151c3a6d07');
const originalPaths = text('diff', '--name-only', start, original).split('\n');
const protectedFiles = originalPaths.filter((file) => ![`${prefix}${cliPath}`, `${prefix}${testPath}`].includes(file)).map((file) => {
  const bytes = readFileSync(path.join(repo, file));
  assert(bytes.equals(git('show', `${original}:${file}`)), file);
  return { path: file, byteLength: bytes.length, sha256: sha256(bytes), byteEqualToOriginalCandidate: true };
});
assert.equal(protectedFiles.length, 23);
const catalogSummary = JSON.parse(readFileSync(command('repair-catalog').log));
const catalog = JSON.parse(readFileSync(catalogSummary.receiptPath));
assert.equal(catalog.normalReverseByteEqual, true);
assert.equal(catalog.trackedIndexByteEqual, true);
assert.equal(catalog.indexSha256, sha256(readFileSync(path.join(lab, 'reference-cards/index.json'))));
for (const child of catalog.commands) {
  assert.equal(child.exitCode, 0);
  assert.equal(bind(child.stdoutPath).sha256, child.stdoutSha256);
  assert.equal(bind(child.stderrPath).sha256, child.stderrSha256);
}
const guardCommand = command(prepare ? 'repair-boundary' : 'repair-postcommit-boundary');
assert.deepEqual(guardCommand.args.slice(-6), ['--task', 'RD-01', '--start', start, '--base', base]);
const guardLog = readFileSync(guardCommand.log, 'utf8');
const boundary = JSON.parse(guardLog.slice(guardLog.indexOf('\n{') + 1));
assert.equal(boundary.ok, true);
assert.equal(boundary.task, 'RD-01');
assert.equal(boundary.start, start);
assert.equal(boundary.base, base);
assert.equal(boundary.originalAllFilesGate, 'FAIL_ACCEPTED_NARROW_EXCEPTION');
assert.deepEqual(boundary.links, []);
assert.deepEqual(boundary.violations, []);
const head = text('rev-parse', 'HEAD');
const tree = text('rev-parse', 'HEAD^{tree}');
assert.equal(boundary.head, head);
assert.equal(text('branch', '--show-current'), 'feature/hestia-rd-rd01-2026-10-02');
const expectedPaths = [cliPath, testPath, 'reports/RD-01/repair-receipt.mjs',
  'reports/RD-01/REPAIR-HANDOFF-32985659.md', 'reports/RD-01/repair-verification-32985659.json'].map((file) => `${prefix}${file}`).sort();
let repairFiles = [];
let allChangedFilesSinceStart = [];
if (prepare) {
  assert.equal(head, original);
} else {
  assert.equal(text('rev-parse', 'HEAD^'), original);
  assert.equal(text('rev-list', '--count', `${original}..HEAD`), '1');
  const paths = text('diff', '--name-only', original, head).split('\n').sort();
  assert.deepEqual(paths, expectedPaths);
  const binding = (file) => {
    const bytes = readFileSync(path.join(repo, file));
    assert(bytes.equals(git('show', `${head}:${file}`)), file);
    return { path: file, blob: text('rev-parse', `${head}:${file}`), byteLength: bytes.length, sha256: sha256(bytes) };
  };
  repairFiles = paths.map(binding);
  allChangedFilesSinceStart = text('diff', '--name-only', start, head).split('\n').map(binding);
}
const receipt = { taskId: 'RD-01', recordedAt: new Date().toISOString(), productIntegrated: false,
  status: prepare ? 'REPAIR_VERIFIED_COMMIT_PENDING' : 'REPAIR_READY_FOR_HEAD_RECHECK_NOT_INTEGRATED',
  start, productReadBase: base, originalCandidate: { sha: original, tree: '29209cd06b0fbe903597e2d5caf45e158649f8ef', status: 'HOLD' },
  repair: { sha: prepare ? null : head, tree: prepare ? null : tree, parent: original, expectedPaths, files: repairFiles },
  allChangedFilesSinceStart, codeDelta: { cli, originalCliSha256: sha256(git('show', `${original}:${prefix}${cliPath}`)),
    testSha256, originalTestSha256: sha256(originalTests), originalFourTestsBytePrefixPreserved: true, addedTestId: 'REF05' },
  caseEvidence, producerRed, originalReceiptUnchanged: originalReceipt, protectedFiles, commands,
  sourceAndFreezeAudit: { binding: bind(command('repair-source-audit').log), freezeSha256: audit.freezeSha256,
    frozenFiles: audit.frozenFiles, controls: audit.controls, inputs: audit.inputs, assets: audit.assets },
  catalog: { binding: bind(catalogSummary.receiptPath), ...catalog },
  boundary: { task: boundary.task, start: boundary.start, base: boundary.base, head: boundary.head, tree: boundary.tree,
    ok: boundary.ok, originalAllFilesGate: boundary.originalAllFilesGate, platformArtifacts: boundary.platformArtifacts,
    inputHashesVerified: boundary.inputHashesVerified, links: boundary.links, violations: boundary.violations },
  checks: { red: 'EXPECTED_FAIL', greenAndFinalUnits: 'PASS_5_OF_5', retainedHeadProbe: 'PASS', labRootCheck: 'PASS',
    focusedTestTypecheck: 'PASS_CHECKJS_FALSE', labBuild: 'PASS', catalogEquality: 'PASS', sourceFreezeAndProtectedBytes: 'PASS',
    browser: 'NOT_APPLICABLE', mediaAndArt: 'NOT_RUN', gpuPerformanceAndProductAcceptance: 'NOT_AUTHORIZED', newIndependentReview: 'NOT_RUN' },
  rd40Import: "import text from '../reference-cards/index.json?raw'; const catalog = JSON.parse(text);",
  HEADRegistrationDelta: 'NONE_FOR_STATIC_CATALOG',
  cleanup: 'No background processes/services/browser started; original HEAD junction, new isolated fenced fixtures, logs, receipts, node_modules/dist/cache retained; no deletions or tool-log edits.',
  limits: ['Native live/dangling Windows junction aliases exercised. File symlink creation returned EPERM/-4048; no global settings changed.',
    'Write sink was fenced, not a foreign write exploit. Existing-target checks are not atomic protection against a concurrent target replacement.',
    'No source refetch/reclassification: seven JS challenges, no viewed media; six missing concept targets and five unavailable LFS image payloads remain unchanged.',
    'Self-review only for this repair; SO-01/HEAD acceptance remains pending.'] };
const output = prepare ? path.join(lab, 'reports/RD-01/repair-verification-32985659.json') : `${run}/repair-receipt-32985659.json`;
writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify({ status: receipt.status, path: output, ...bind(output), repair: receipt.repair,
  protectedFiles: protectedFiles.length, originalAllFilesGate: boundary.originalAllFilesGate }, null, 2));
