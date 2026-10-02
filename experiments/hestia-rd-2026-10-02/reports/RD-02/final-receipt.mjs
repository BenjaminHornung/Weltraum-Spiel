import { readFileSync, lstatSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { sha } from '../../exporters/fixture-export.mjs';
import { LAB, REPO, RUN, GIT, START, BASE, verifyFreeze, writeOwned } from '../../exporters/stage-source.mjs';

const git = (...args) => execFileSync(GIT, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1_048_576, windowsHide: true }).trim();
const candidateSha = git('rev-parse', 'HEAD'); const candidateTree = git('rev-parse', 'HEAD^{tree}');
const branch = git('branch', '--show-current');
if (branch !== 'feature/hestia-rd-rd02-2026-10-02' || git('rev-parse', 'HEAD^') !== START) { throw new Error('Wrong candidate branch or parent'); }
const changedPaths = git('diff', '--name-only', START, 'HEAD').split('\n');
const prefix = 'experiments/hestia-rd-2026-10-02/';
if (changedPaths.some(p => !['exporters/', 'fixtures/', 'tests/RD-02/', 'reports/RD-02/'].some(scope => p.startsWith(prefix + scope)))) {
  throw new Error('Committed file outside exact RD-02 scope');
}
const index = new Map(git('ls-tree', '-r', 'HEAD', '--', `${prefix}exporters`, `${prefix}fixtures`, `${prefix}tests/RD-02`, `${prefix}reports/RD-02`)
  .split('\n').map(line => { const match = line.match(/^(\d+) blob ([0-9a-f]{40})\t(.+)$/);
    if (!match || !['100644', '100755'].includes(match[1])) { throw new Error('Non-regular candidate Git entry'); }
    return [match[3], { mode: match[1], blobSha: match[2] }]; }));
const changedFiles = changedPaths.map(relative => {
  const file = path.join(REPO, relative); if (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink()) { throw new Error('Non-regular candidate file'); }
  const bytes = readFileSync(file); const entry = index.get(relative);
  const actualBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (!entry || actualBlob !== entry.blobSha) { throw new Error('Candidate Git bytes differ from verified checkout (including possible LFS/text filter)'); }
  return { path: relative, bytes: bytes.length, sha256: sha(bytes), ...entry };
});
const commands = readFileSync(`${RUN}/commands.jsonl`, 'utf8').trim().split('\n').map(line => JSON.parse(line));
for (const command of commands) {
  const bytes = readFileSync(command.log);
  if (bytes.length !== command.logBytes || sha(bytes) !== command.logSha256) { throw new Error('Raw log changed'); }
}
const boundary = commands.findLast(c => c.label === 'post-commit-boundary');
if (!boundary || boundary.exitCode !== 0) { throw new Error('Fresh committed-candidate boundary required'); }
const raw = readFileSync(boundary.log, 'utf8'); const gate = JSON.parse(raw.slice(raw.indexOf('{')));
if (!gate.ok || gate.head !== candidateSha || gate.tree !== candidateTree || gate.start !== START || gate.base !== BASE
  || gate.task !== 'RD-02' || gate.inputHashesVerified !== 52 || gate.violations.length || gate.links.length
  || gate.originalAllFilesGate !== 'FAIL_ACCEPTED_NARROW_EXCEPTION') { throw new Error('Committed candidate gate mismatch'); }
if (git('diff', '--name-only', 'HEAD') || git('diff', '--cached', '--name-only')) { throw new Error('Uncommitted tracked changes remain'); }
const inventoryBytes = readFileSync(path.join(LAB, 'fixtures/inventory.json'));
const inventory = JSON.parse(inventoryBytes);
const receipt = { schema: 'rd02-final-handoff-v1', status: 'PASS', task: 'RD-02', fachlicherOwner: 'SO-01',
  candidateSha, candidateTree, branch, startSha: START, startTree: 'addf696048a320b9739fc1dc901047600d52e51c', productReadBase: BASE,
  productIntegrated: false, freeze: verifyFreeze(), changedFiles, changedFileCount: changedFiles.length,
  fixtureInventoryPath: `${prefix}fixtures/inventory.json`, fixtureInventorySha256: sha(inventoryBytes),
  fixtures: inventory.fixtures, scenarios: inventory.scenarios, commands, committedBoundary: boundary,
  originalAllFilesGate: gate.originalAllFilesGate, acceptedScopeDeviation: gate.acceptedScopeDeviation,
  review: { self: 'PASS', independent: 'NOT_RUN', human: 'NOT_RUN', HEADVerification: 'pending; not pre-authorized' },
  browser: 'NOT_APPLICABLE', gpuRuntimePerformance: 'NOT_RUN', artAcceptance: 'NOT_RUN',
  cleanup: 'No services/ports/tabs/agents started; own source/log/export/install/build artifacts retained. Automatic throughput files untouched/untracked/unpublished.',
  noPublication: true, blockers: [] };
writeOwned(`${RUN}/final-receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ status: receipt.status, candidateSha, candidateTree, startSha: START, startTree: receipt.startTree,
  changedFileCount: changedFiles.length, fixtureInventorySha256: receipt.fixtureInventorySha256,
  receiptPath: `${RUN}/final-receipt.json`, receiptSha256: sha(readFileSync(`${RUN}/final-receipt.json`)),
  productIntegrated: false, originalAllFilesGate: gate.originalAllFilesGate, fixtures: inventory.fixtures.map(f => ({
    id: f.id, sourceRevision: f.sourceRevision, revisionLabel: f.revisionLabel, manifestPath: `${prefix}fixtures/${f.manifestPath}`, fixtureDigest: f.fixtureDigest })) }, null, 2));
