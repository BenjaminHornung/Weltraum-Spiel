import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, lstatSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repo = path.resolve(lab, '../..');
const prefix = 'experiments/hestia-rd-2026-10-02/';
const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-01';
const start = '89b55315fa7800a7a417c49e5e5a272f17410b4b';
const base = 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e';
const git = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const gitBytes = (...args) => execFileSync(git, args, { cwd: repo, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
const gitText = (...args) => gitBytes(...args).toString('utf8').trim();
const readJson = (relative) => JSON.parse(readFileSync(path.join(lab, relative)));
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 1 && args[0] === '--prepare'));
const prepare = args.includes('--prepare');
const commandLog = `${run}/commands.jsonl`;
const allCommands = readFileSync(commandLog, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
const required = ['install', 'red', 'green', 'source-fetch', 'source-audit', 'final-check', 'final-unit',
  'final-typecheck', 'final-build', 'final-source-audit', 'final-catalog', 'final-boundary'];
if (!prepare) {
  required.push('candidate-boundary', 'candidate-diff-check', 'commit', 'postcommit-boundary');
}
const commands = required.map((label) => {
  const records = allCommands.filter((command) => command.label === label);
  assert.equal(records.length, 1, `Exactly one recorded ${label} command required`);
  const command = records[0];
  assert.equal(command.exitCode, label === 'red' ? 1 : 0);
  assert.equal(command.signal, null);
  assert(realpathSync(command.log).startsWith(`${realpathSync(run)}${path.sep}logs${path.sep}`));
  const bytes = readFileSync(command.log);
  assert.equal(bytes.length, command.logBytes);
  assert.equal(sha256(bytes), command.logSha256);
  return command;
});
const command = (label) => commands.find((entry) => entry.label === label);
const finalAudit = JSON.parse(readFileSync(command('final-source-audit').log, 'utf8'));
const originalAudit = readJson('reports/RD-01/source-audit.json');
const preflightPath = `${run}/preflight-freeze.json`;
const preflightBytes = readFileSync(preflightPath);
const preflight = JSON.parse(preflightBytes);
assert.equal(preflight.start, start);
assert.equal(preflight.freezeSha256, finalAudit.freezeSha256);
assert.equal(preflight.files.length, 18);
assert(preflight.files.every((entry) => entry.pass && entry.sha256 === entry.actual));
assert(Date.parse(preflight.checkedAt) < Date.parse(command('install').started));
for (const key of ['inputs', 'assets', 'controls', 'frozenFiles']) {
  assert.deepEqual(finalAudit[key], originalAudit[key]);
}
const guardCommand = command(prepare ? 'final-boundary' : 'postcommit-boundary');
const guardLog = readFileSync(guardCommand.log, 'utf8');
const boundary = JSON.parse(guardLog.slice(guardLog.indexOf('\n{') + 1));
assert.equal(boundary.ok, true);
assert.equal(boundary.task, 'RD-01');
assert.equal(boundary.start, start);
assert.equal(boundary.base, base);
assert.equal(boundary.originalAllFilesGate, 'FAIL_ACCEPTED_NARROW_EXCEPTION');
assert.deepEqual(boundary.links, []);
assert.deepEqual(boundary.violations, []);
const redTest = readFileSync(`${run}/red-unit.test.ts`);
assert.equal(sha256(redTest), 'f14fee378888f2cb3122fe69f8ec9537f984b476e39c3f2ea82045ced006c517');
assert(redTest.equals(readFileSync(path.join(lab, 'tests/RD-01/unit.test.ts'))), 'RED/GREEN test bytes and thresholds unchanged');
const currentSources = readJson('reports/RD-01/sources-current.json');
const catalog = readJson('reports/RD-01/catalog-verification.json');
assert.equal(catalog.indexSha256, sha256(readFileSync(path.join(lab, 'reference-cards/index.json'))));
const branch = gitText('branch', '--show-current');
assert.equal(branch, 'feature/hestia-rd-rd01-2026-10-02');
const candidateSha = gitText('rev-parse', 'HEAD');
assert.equal(boundary.head, candidateSha);
if (prepare) {
  assert.equal(candidateSha, start);
} else {
  assert.notEqual(candidateSha, start);
  assert.equal(gitText('rev-parse', 'HEAD^'), start);
  assert.equal(gitText('rev-list', '--count', `${start}..HEAD`), '1');
}
const status = gitBytes('status', '--porcelain=v1', '-z', '--untracked-files=all').toString('utf8').split('\0').filter(Boolean);
const automaticPaths = ['.opencode/throughput.jsonl', '.opencode/throughput.md',
  `${prefix}.opencode/throughput.jsonl`, `${prefix}.opencode/throughput.md`];
const ownPath = (relative) => relative.startsWith(prefix)
  && /^(reference-cards\/|src\/tools\/reference-index\/|tests\/RD-01\/|reports\/RD-01\/)/.test(relative.slice(prefix.length));
for (const record of status) {
  const relative = record.slice(3);
  if (automaticPaths.includes(relative)) {
    const full = path.join(repo, relative);
    const stats = lstatSync(full);
    assert(record.startsWith('?? ') && stats.isFile() && !stats.isSymbolicLink() && stats.nlink === 1 && realpathSync(full) === full);
  } else {
    assert(prepare && ownPath(relative), `Unexpected dirty/outside path: ${record}`);
  }
}
const changedPaths = prepare ? [] : gitBytes('diff', '--name-only', '--no-renames', '-z', start, 'HEAD')
  .toString('utf8').split('\0').filter(Boolean);
const changedFiles = changedPaths.map((relative) => {
  assert(ownPath(relative), `Outside changed path: ${relative}`);
  const bytes = readFileSync(path.join(repo, relative));
  assert(bytes.equals(gitBytes('show', `HEAD:${relative}`)), `Committed/working byte mismatch: ${relative}`);
  return { path: relative, blob: gitText('rev-parse', `HEAD:${relative}`), byteLength: bytes.length, sha256: sha256(bytes) };
});
const result = { schemaVersion: 1, taskId: 'RD-01', recordedAt: new Date().toISOString(),
  status: prepare ? 'VERIFICATION_COMPLETE_CANDIDATE_PENDING' : 'READY_FOR_HEAD_REVIEW', productIntegrated: false,
  branch, start, startTree: 'cec8bddf28b3b4f7aafc716d64e20d3e9e0a0681', productReadBase: base,
  candidateSha: prepare ? null : candidateSha, candidateTree: prepare ? null : gitText('rev-parse', 'HEAD^{tree}'),
  candidateParent: start, changedPaths, changedFiles,
  catalog: { indexPath: `${prefix}reference-cards/index.json`, indexBytes: catalog.indexBytes, indexSha256: catalog.indexSha256,
    normalReverseByteEqual: catalog.normalReverseByteEqual, trackedIndexByteEqual: catalog.trackedIndexByteEqual,
    inputBindings: catalog.inputBindings, cliCommands: catalog.commands, bodyBindings: catalog.bodyBindings },
  sources: { originalInputBindings: finalAudit.inputs, conceptAssets: finalAudit.assets,
    currentAccess: currentSources.records.map((record) => ({ id: record.id, url: record.requestedUrl, checkedAt: record.requestedAt,
      timeoutMs: record.timeoutMs, byteCap: record.byteCap, httpStatus: record.httpStatus, contentType: record.contentType,
      accessClass: record.accessClass, author: record.author, license: record.license, mediaStatus: record.mediaStatus,
      observedIntervals: record.observedIntervals, publicDeveloperLinks: record.publicDeveloperLinks,
      bodyByteLength: record.body.byteLength, bodySha256: record.body.sha256 })) },
  frozenFiles: finalAudit.frozenFiles, frozenControls: finalAudit.controls, freezeSha256: finalAudit.freezeSha256,
  preWorkFreeze: { path: preflightPath, sha256: sha256(preflightBytes), checkedAt: preflight.checkedAt, matchedFiles: preflight.files.length },
  redGreen: { unchangedTestBytes: true, testSha256: sha256(redTest), red: command('red'), green: command('final-unit'),
    originalRedState: { path: `${run}/red-state.json`, sha256: sha256(readFileSync(`${run}/red-state.json`)) } },
  commands,
  boundary: { task: boundary.task, start: boundary.start, base: boundary.base, head: boundary.head, tree: boundary.tree,
    ok: boundary.ok, originalAllFilesGate: boundary.originalAllFilesGate, platformArtifacts: boundary.platformArtifacts,
    links: boundary.links, violations: boundary.violations, inputHashesVerified: boundary.inputHashesVerified },
  checks: { catalogFunctionality: 'PASS', ref01ToRef04: 'PASS', labCheck: 'PASS', focusedTestTypecheck: 'PASS', labBuild: 'PASS',
    sourceAndFreezeBytes: 'PASS', browser: 'NOT_APPLICABLE', mediaPlayback: 'NOT_RUN', artAcceptance: 'NOT_RUN',
    gpuBenchmark: 'NOT_AUTHORIZED', productAndPerformanceAcceptance: 'NOT_AUTHORIZED', independentReview: 'NOT_RUN', HEADAcceptance: 'PENDING' },
  review: 'Own data/code/diff review; index generated bytes checked, output-parent link refusal tightened. No independent/human review claimed.',
  rd40Import: { artifact: 'reference-cards/index.json', fromLabSrcModule: "import text from '../reference-cards/index.json?raw'; const references = JSON.parse(text);",
    fields: ['references', 'concepts', 'experiments', 'issues', 'inputBindings'], HEADRegistrationDelta: 'NONE_FOR_RD01_STATIC_CATALOG' },
  openVisualQuestions: 'reports/RD-01/OPEN-VISUAL-QUESTIONS.md',
  cleanup: 'No services, tabs, agents or GPU jobs started. Own node_modules/dist/cache/raw evidence retained; no deletion. Automatic throughput files untouched/untracked/unpublished.',
  residualRisk: 'Post/author/media/license inaccessible; six concept targets missing and five image payloads absent behind LFS pointers. Only catalog functionality is verified.' };
const target = prepare ? path.join(lab, 'reports/RD-01/verification.json') : `${run}/final-receipt.json`;
const output = `${JSON.stringify(result, null, 2)}\n`;
writeFileSync(target, output, { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, receipt: target, receiptSha256: sha256(output), candidateSha: result.candidateSha,
  candidateTree: result.candidateTree, candidateParent: result.candidateParent, changedPathCount: changedPaths.length,
  indexSha256: catalog.indexSha256, originalAllFilesGate: boundary.originalAllFilesGate, productIntegrated: false }, null, 2));
