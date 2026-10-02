import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { inspectBoundary } from '../../scripts/verify-boundary.mjs';

const gitPath = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const oracleRoot = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00/oracles';
const lab = 'experiments/hestia-rd-2026-10-02';
mkdirSync(oracleRoot, { recursive: true });
const root = mkdtempSync(`${oracleRoot}/boundary-program-`);
const git = (...args) => execFileSync(gitPath,
  ['-c', 'user.name=HEAD boundary oracle', '-c', 'user.email=rd-head@invalid.local', ...args],
  { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
git('init', '-b', 'feature/head-boundary-oracle');
writeFileSync(`${root}/README.md`, 'immutable product control\n');
git('add', 'README.md'); git('commit', '-m', 'oracle product base');
const base = git('rev-parse', 'HEAD');
mkdirSync(`${root}/${lab}/fixtures`, { recursive: true });
writeFileSync(`${root}/${lab}/fixtures/fixture.json`, '{}\n');
git('add', `${lab}/fixtures/fixture.json`); git('commit', '-m', 'oracle initial fixture');
const start = git('rev-parse', 'HEAD');
const options = { repoRoot: root, base, start, gitPath, verifyPinned: false, task: 'RD-02' };
writeFileSync(`${root}/${lab}/fixtures/fixture.json`, '{"revision":1}\n');
assert.equal(inspectBoundary(options).ok, true, 'RD-02 may revise its own existing fixture');
assert.equal(inspectBoundary({ ...options, task: 'RD-01' }).ok, false, 'Sibling cannot change fixtures');
assert.throws(() => inspectBoundary({ ...options, start: undefined }), /Explicit immutable task start/);
assert.throws(() => inspectBoundary({ ...options, task: 'RD-99' }), /Unknown task/);
git('add', `${lab}/fixtures/fixture.json`); git('commit', '-m', 'oracle permitted fixture revision');
assert.equal(inspectBoundary(options).ok, true, 'Committed own-card delta is allowed');
mkdirSync(`${root}/${lab}/src/contracts`, { recursive: true });
writeFileSync(`${root}/${lab}/src/contracts/forbidden.ts`, 'export const forbidden = true;\n');
assert.match(inspectBoundary(options).violations.join('\n'), /RD-02 allowlist.*src\/contracts/);
assert.equal(inspectBoundary({ ...options, task: 'HEAD' }).ok, true, 'Only HEAD owns shared lab files');
mkdirSync(`${root}/${lab}/.opencode`);
writeFileSync(`${root}/${lab}/.opencode/throughput.jsonl`, 'synthetic automatic location-log oracle\n');
assert.equal(inspectBoundary({ ...options, task: 'HEAD' }).originalAllFilesGate, 'FAIL_ACCEPTED_NARROW_EXCEPTION');
git('add', `${lab}/.opencode/throughput.jsonl`);
assert.match(inspectBoundary({ ...options, task: 'HEAD' }).violations.join('\n'), /automatic logs must never be tracked\/staged\/committed/);
git('commit', '-m', 'oracle prohibited tracked location log');
assert.equal(inspectBoundary({ ...options, task: 'HEAD', start: git('rev-parse', 'HEAD') }).ok, false,
  'Changing the comparison start cannot launder a committed log');
writeFileSync(`${root}/README.md`, 'forbidden product edit\n');
assert.match(inspectBoundary({ ...options, task: 'HEAD' }).violations.join('\n'), /outside RD root.*README.md/);
console.log(JSON.stringify({ status: 'PASS', oracle: root, taskboardProfiles: ['RD-02', 'RD-01', 'HEAD'], productIntegrated: false }));
