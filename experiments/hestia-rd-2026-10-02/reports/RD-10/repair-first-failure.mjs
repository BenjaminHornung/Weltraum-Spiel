import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertIsolation, inspectBoundary } from '../../scripts/verify-boundary.mjs';

const lab = fileURLToPath(new URL('../../', import.meta.url)); const repo = path.resolve(lab, '../..');
const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10';
const out = `${run}/repair-first-failure-20261003`;
const parent = '5bd233c8f950423f4bbf73c872aca6610792c377';
const start = '4788520ef7cecc5db62da8d51f0daaa8ac8bdd09'; const base = 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e';
const gitPath = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const env = { ...process.env, PATH: 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64;C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd;C:/IFI_SourceCode/Utils/PowerShell',
  TEMP: `${run}/temp`, TMP: `${run}/temp` };
assertIsolation({ task: 'RD-10', runRoot: out });
const bytes = (file) => readFileSync(file);
const sha = (data) => createHash('sha256').update(data).digest('hex');
const json = (file) => JSON.parse(bytes(file));
const write = (name, value) => writeFileSync(`${out}/${name}`, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
const git = (...args) => execFileSync(gitPath, args, { cwd: repo, env, encoding: 'utf8' }).trim();
const unitPath = 'experiments/hestia-rd-2026-10-02/tests/RD-10/unit.test.ts';
const factoryPath = 'experiments/hestia-rd-2026-10-02/src/experiments/renderer-probe/index.ts';
const mode = process.argv[2];
if (mode === 'preflight') {
  assert.equal(git('rev-parse', 'HEAD'), parent); assert(!existsSync(out)); mkdirSync(out);
  const own = git('diff', '--name-only', start, parent, '--').split('\n'); assert.equal(own.length, 18);
  const freeze = json(`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/freezes/${start}.json`);
  for (const file of freeze.frozenFiles) { assert.equal(sha(bytes(path.join(lab, file.path))), file.sha256, file.path); }
  const files = own.map((relative) => ({ path: relative, sha256: sha(bytes(path.join(repo, relative))) }));
  const cards = Array.from({ length: 7 }, (_, index) => `reference-cards/RR-0${index + 1}.json`)
    .map((relative) => ({ path: relative, sha256: sha(bytes(path.join(lab, relative))) }));
  writeFileSync(`${out}/unit-before.ts`, bytes(path.join(repo, unitPath)), { flag: 'wx' });
  writeFileSync(`${out}/factory-before.ts`, bytes(path.join(repo, factoryPath)), { flag: 'wx' });
  write('baseline.json', { parent, tree: git('show', '-s', '--format=%T', parent), start, base, files, cards,
    freezeFiles: freeze.frozenFiles, originalCandidateSha256: sha(bytes(`${run}/candidate.json`)),
    headProbePath: 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/rd10-first-failure-probe.mjs',
    headProbeScriptSha256: sha(bytes('C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/rd10-first-failure-probe.mjs')),
    headPriorFailure: 'User-reported actual factory reproduction; tool transcript retained by HEAD; no raw-log SHA invented',
    productIntegrated: false });
  console.log('PASS: baseline parent/tree, original 18 files, 18 shared frozen bytes, 7 cards and original evidence bound');
} else if (mode === 'commit') {
  assert.equal(git('rev-parse', 'HEAD'), parent);
  const args = ['commit', '-m', 'RD-10: preserve first renderer probe failure'];
  const raw = execFileSync(gitPath, args, { cwd: repo, env }); writeFileSync(`${out}/commit.raw.log`, raw, { flag: 'wx' });
  write('commit-command.json', { binary: gitPath, args, cwd: repo, exitCode: 0, rawSha256: sha(raw), productIntegrated: false });
  process.stdout.write(raw);
} else if (mode === 'verify' || mode === 'receipt') {
  const baseline = json(`${out}/baseline.json`); const commands = [];
  for (const label of ['repair-first-failure-red', 'repair-first-failure-green', 'repair-first-failure-check', 'repair-first-failure-types',
    'repair-first-failure-build', 'repair-first-failure-boundary']) {
    const receipt = json(`${run}/commands/${label}/receipt.json`); const raw = bytes(`${run}/commands/${label}/raw.log`);
    assert.equal(sha(raw), receipt.logSha256); assert.equal(receipt.exitCode, label.endsWith('-red') ? 1 : 0);
    commands.push({ label, receipt, receiptSha256: sha(bytes(`${run}/commands/${label}/receipt.json`)) });
  }
  const binding = (label, relative) => commands.find((command) => command.label === label).receipt.bindings.find((file) => file.path === relative).sha256;
  assert.equal(binding('repair-first-failure-red', 'tests/RD-10/unit.test.ts'), binding('repair-first-failure-green', 'tests/RD-10/unit.test.ts'));
  assert.equal(binding('repair-first-failure-green', 'tests/RD-10/unit.test.ts'), sha(bytes(path.join(repo, unitPath))));
  assert.equal(binding('repair-first-failure-red', 'src/experiments/renderer-probe/index.ts'), sha(bytes(`${out}/factory-before.ts`)));
  assert.equal(binding('repair-first-failure-green', 'src/experiments/renderer-probe/index.ts'), sha(bytes(path.join(repo, factoryPath))));
  assert.match(bytes(`${run}/commands/repair-first-failure-red/raw.log`).toString(), /2 failed\s*\|\s*14 passed \(16\)/);
  assert.match(bytes(`${run}/commands/repair-first-failure-green/raw.log`).toString(), /16 passed \(16\)/);
  for (const file of baseline.files) { if (file.path !== factoryPath && file.path !== unitPath) { assert.equal(sha(bytes(path.join(repo, file.path))), file.sha256, file.path); } }
  for (const file of [...baseline.freezeFiles, ...baseline.cards]) { assert.equal(sha(bytes(path.join(lab, file.path))), file.sha256, file.path); }
  assert.equal(sha(bytes(`${run}/candidate.json`)), baseline.originalCandidateSha256);
  assert.equal(sha(bytes(baseline.headProbePath)), baseline.headProbeScriptSha256);
  const original = json(`${run}/candidate.json`);
  for (const command of [...original.commands, ...original.closingChecks]) {
    assert.equal(sha(bytes(`${run}/commands/${command.label}/receipt.json`)), command.receiptSha256);
    assert.equal(sha(bytes(`${run}/commands/${command.label}/raw.log`)), command.receipt.logSha256);
  }
  for (const source of json(path.join(lab, 'reports/RD-10/source-evidence.json')).sources) {
    assert.equal(sha(bytes(`${run}/${source.retainedRaw}`)), source.sha256);
  }
  if (mode === 'verify') {
    console.log('PASS: unchanged RED/GREEN oracle, original reports/candidate/raw source and receipt bindings, shared18/cards7; no current browser proof claimed');
  } else {
  const [candidate, tree, actualParent] = git('show', '-s', '--format=%H%n%T%n%P', 'HEAD').split('\n'); assert.equal(actualParent, parent);
  git('diff', '--quiet', 'HEAD', '--');
  const boundary = inspectBoundary({ repoRoot: repo, task: 'RD-10', start, base, gitPath, verifyPinned: true }); assert.equal(boundary.ok, true);
  for (const untracked of git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean)) { assert(boundary.platformArtifacts.includes(untracked)); }
  const paths = git('diff', '--name-only', parent, candidate, '--').split('\n');
  for (const relative of paths) { assert.match(relative, /^experiments\/hestia-rd-2026-10-02\/(src\/experiments\/renderer-probe|tests\/RD-10|reports\/RD-10)\//); }
  const commit = json(`${out}/commit-command.json`); assert.equal(sha(bytes(`${out}/commit.raw.log`)), commit.rawSha256);
  write('receipt.json', { status: 'REPAIRED_READY_FOR_HEAD_RECHECK_AND_WIRING', candidate, tree, parent: actualParent, start, base,
    factorySha256Before: sha(bytes(`${out}/factory-before.ts`)), factorySha256After: sha(bytes(path.join(repo, factoryPath))),
    originalOracleSha256: sha(bytes(`${out}/unit-before.ts`)), unchangedNewOracleSha256: sha(bytes(path.join(repo, unitPath))),
    files: paths.map((relative) => ({ path: relative, sha256: sha(bytes(path.join(repo, relative))) })), baseline, commands, commit,
    red: { planned: 16, observed: 16, failed: 2, passed: 14, skipped: 0 }, green: { planned: 16, observed: 16, failed: 0, passed: 16, skipped: 0 },
    scenarios: ['Actual factory/native EventTarget queued compile-cleanup loss preserves first reason/errors', 'Async WebGPU device-loss callback then init catch preserves first reason/errors', 'Supported context loss remains visible and cleans once'],
    originalDevProof: 'HISTORICAL-5bd233c8-FACTORY-NOT-RELABELLED-CURRENT', browser: 'NOT_RUN_PENDING_WIRING', headOriginalProbe: 'NOT_RUN_BY_LEAF; HEAD can rerun unchanged script; permanent regression exercises actual factory with same queued-loss ordering',
    rootBuild: 'PASS-EXISTING-RD00-RD03-ENTRIES-ONLY', newGpuBrowserServices: 0, cleanup: 'All owned test handles disposed; mounted count0, guarded globals restored',
    review: 'Self diff review; repair independent review not run', boundary: { ok: boundary.ok, inputHashesVerified: boundary.inputHashesVerified,
      violations: boundary.violations, originalAllFilesGate: boundary.originalAllFilesGate, platformArtifacts: boundary.platformArtifacts }, productIntegrated: false });
  console.log(JSON.stringify({ candidate, tree, parent: actualParent, paths, boundary: boundary.ok, status: 'REPAIRED_READY_FOR_HEAD_RECHECK_AND_WIRING', productIntegrated: false }, null, 2));
  }
} else { throw new Error('Expected preflight/verify/commit/receipt'); }
