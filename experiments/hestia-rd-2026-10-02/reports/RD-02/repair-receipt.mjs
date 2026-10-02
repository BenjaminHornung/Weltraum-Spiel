import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { sha } from '../../exporters/fixture-export.mjs';
import { LAB, REPO, RUN, GIT, START, BASE, ownedPath, verifyFreeze, writeOwned } from '../../exporters/stage-source.mjs';

const repair = `${RUN}/repair-dangling-v1`; const parentSha = 'e6d41867f0fd3257428132c6463ff7d1f80f91af';
const git = (...args) => execFileSync(GIT, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 1_048_576, windowsHide: true }).trim();
const candidateSha = git('rev-parse', 'HEAD'); const candidateTree = git('rev-parse', 'HEAD^{tree}');
if (git('branch', '--show-current') !== 'feature/hestia-rd-rd02-2026-10-02' || git('rev-parse', 'HEAD^') !== parentSha
  || git('rev-parse', `${parentSha}^`) !== START) { throw new Error('Not one local child of e6 on the exact branch/start'); }
const parentReceiptBytes = readFileSync(`${RUN}/final-receipt.json`);
if (sha(parentReceiptBytes) !== 'bd054767f38180191cc6b47eaa18b707a76f9ef133b3ab51f978fb3244c91f0f'
  || !parentReceiptBytes.equals(readFileSync(`${repair}/parent-receipt.json`))) { throw new Error('e6 receipt changed'); }
const parentReceipt = JSON.parse(parentReceiptBytes);
if (parentReceipt.candidateSha !== parentSha || git('rev-parse', `${parentSha}^{tree}`) !== parentReceipt.candidateTree) { throw new Error('e6 parent mapping mismatch'); }
const commands = readFileSync(`${RUN}/commands.jsonl`, 'utf8').trim().split('\n').map(JSON.parse);
for (const command of commands) {
  const bytes = readFileSync(command.log);
  if (bytes.length !== command.logBytes || sha(bytes) !== command.logSha256) { throw new Error('Producer/raw command log drift'); }
}
const fresh = label => commands.findLast(c => c.label === `repair-${label}`);
for (const label of ['fx10-green', 'head-existing-green', 'export-normal', 'export-reverse', 'annotations',
  'final-unit', 'final-check', 'final-rd02-typecheck', 'final-build', 'post-commit-boundary']) {
  if (fresh(label)?.exitCode !== 0) { throw new Error(`Required fresh check missing: ${label}`); }
}
if (fresh('fx10-red')?.exitCode !== 1 || !readFileSync(fresh('final-unit').log, 'utf8').includes('10 passed (10)')) {
  throw new Error('Actual RED/GREEN/ten-test evidence missing');
}
const rawGate = readFileSync(fresh('post-commit-boundary').log, 'utf8'); const gate = JSON.parse(rawGate.slice(rawGate.indexOf('{')));
if (!gate.ok || gate.head !== candidateSha || gate.tree !== candidateTree || gate.start !== START || gate.base !== BASE
  || gate.task !== 'RD-02' || gate.inputHashesVerified !== 52 || gate.violations.length || gate.links.length
  || gate.originalAllFilesGate !== 'FAIL_ACCEPTED_NARROW_EXCEPTION') { throw new Error('Exact committed boundary mismatch'); }
if (git('diff', '--name-only', 'HEAD') || git('diff', '--cached', '--name-only')) { throw new Error('Uncommitted tracked changes'); }
const prefix = 'experiments/hestia-rd-2026-10-02/'; const changedPaths = git('diff', '--name-only', parentSha, 'HEAD').split('\n');
const fullPaths = git('diff', '--name-only', START, 'HEAD').split('\n');
if (fullPaths.some(p => !['exporters/', 'fixtures/', 'tests/RD-02/', 'reports/RD-02/'].some(scope => p.startsWith(prefix + scope)))) {
  throw new Error('Candidate outside original task scope');
}
const index = new Map(git('ls-tree', '-r', 'HEAD', '--', `${prefix}exporters`, `${prefix}fixtures`, `${prefix}tests/RD-02`, `${prefix}reports/RD-02`)
  .split('\n').map(line => { const match = line.match(/^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/);
    if (!match) { throw new Error('Non-regular candidate Git entry'); }
    return [match[3], { mode: match[1], blobSha: match[2] }]; }));
const fullFiles = fullPaths.map(relative => {
  const file = path.join(REPO, relative); const stat = lstatSync(file); const bytes = readFileSync(file); const entry = index.get(relative);
  const blobSha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (!stat.isFile() || stat.isSymbolicLink() || !entry || blobSha !== entry.blobSha) { throw new Error('Candidate checkout/Git blob mismatch'); }
  return { path: relative, bytes: bytes.length, sha256: sha(bytes), ...entry };
});
function tree(root, relative = '') {
  const rows = [];
  for (const name of readdirSync(path.join(root, relative)).sort()) {
    const rel = path.posix.join(relative, name); const file = path.join(root, rel); const stat = lstatSync(file);
    if (stat.isSymbolicLink()) { throw new Error('Linked evidence artifact'); }
    if (stat.isDirectory()) { rows.push(...tree(root, rel)); }
    else if (stat.isFile()) { const bytes = readFileSync(file); rows.push({ path: rel, bytes: bytes.length, sha256: sha(bytes) }); }
    else { throw new Error('Non-regular evidence artifact'); }
  }
  return rows;
}
const fixtureRoot = ownedPath(path.join(LAB, 'fixtures'), true); const fixtureRows = tree(fixtureRoot);
for (const root of [`${repair}/export-normal`, `${repair}/export-reverse`]) {
  if (JSON.stringify(fixtureRows) !== JSON.stringify(tree(ownedPath(root)))) { throw new Error('Static/export tree drift'); }
  for (const row of fixtureRows) {
    if (!readFileSync(path.join(fixtureRoot, row.path)).equals(readFileSync(path.join(root, row.path)))) { throw new Error('Actual export bytes differ'); }
  }
}
const nativeRows = tree(ownedPath(`${repair}/stage`));
if (JSON.stringify(nativeRows) !== JSON.stringify(tree(ownedPath(`${RUN}/stage-v1`)))) { throw new Error('Native/original/erased/adapted/proof bytes changed'); }
const inventoryBytes = readFileSync(path.join(fixtureRoot, 'inventory.json')); const inventory = JSON.parse(inventoryBytes);
const annotations = JSON.parse(readFileSync(`${repair}/annotation-bindings.json`));
const annotationPaths = new Set(annotations.changed.map(row => row.path.slice('fixtures/'.length)));
for (const row of fixtureRows) {
  const old = readFileSync(`${RUN}/export-final-normal/${row.path}`); const current = readFileSync(path.join(fixtureRoot, row.path));
  if (!annotationPaths.has(row.path) && !old.equals(current)) { throw new Error('Parent manifest/payload/scenario drift'); }
}
for (const row of annotations.changed) {
  const relative = row.path.slice('fixtures/'.length);
  if (sha(readFileSync(`${RUN}/export-final-normal/${relative}`)) !== row.oldSha256
    || sha(readFileSync(path.join(fixtureRoot, relative))) !== row.newSha256) { throw new Error('Annotation byte-binding drift'); }
}
const redBindings = JSON.parse(readFileSync(`${repair}/red/bindings.json`));
for (const row of redBindings.redSourceFiles) {
  const bytes = readFileSync(row.retained);
  if (bytes.length !== row.bytes || sha(bytes) !== row.sha256) { throw new Error('Retained RED source drift'); }
}
if (sha(readFileSync(`${RUN}/logs/head-dangling-path-red-1790967702845.log`)) !== redBindings.headRedLogSha256) { throw new Error('HEAD RED log drift'); }
const costs = readdirSync(RUN).filter(name => /^export-\d+-(normal|reverse)\.json$/.test(name))
  .map(name => ({ path: `${RUN}/${name}`, ...JSON.parse(readFileSync(`${RUN}/${name}`, 'utf8')) }))
  .filter(cost => [path.resolve(`${repair}/export-normal`), path.resolve(`${repair}/export-reverse`)].includes(cost.out));
if (costs.length !== 2) { throw new Error('Missing current normal/reverse diagnostics'); }
const receipt = { schema: 'rd02-bounded-repair-handoff-v1', status: 'PASS', task: 'RD-02', candidateSha, candidateTree,
  parentSha, parentTree: parentReceipt.candidateTree, parentReceiptPath: `${RUN}/final-receipt.json`, parentReceiptSha256: sha(parentReceiptBytes),
  startSha: START, startTree: 'addf696048a320b9739fc1dc901047600d52e51c', productReadBase: BASE, productIntegrated: false,
  changedPaths, changedFiles: fullFiles.filter(f => changedPaths.includes(f.path)), fullCandidateFiles: fullFiles,
  freeze: verifyFreeze(), fixtures: inventory.fixtures, scenarios: inventory.scenarios, fixtureInventorySha256: sha(inventoryBytes),
  comparison: { fixtureFileCount: fixtureRows.length, fixtureTreeSha256: sha(JSON.stringify(fixtureRows)),
    staticNormalReverseActualBytesEqual: true, parentManifestPayloadScenarioBytesEqual: true, nativeStageActualTreeUnchanged: true },
  annotations, redBindings, commands: commands.filter(c => c.label.startsWith('repair-')), exportCosts: costs,
  committedBoundary: fresh('post-commit-boundary'), originalAllFilesGate: gate.originalAllFilesGate,
  acceptedScopeDeviation: gate.acceptedScopeDeviation, review: { self: 'PASS', independent: 'NOT_RUN', human: 'NOT_RUN', HEAD: 'pending' },
  browser: 'NOT_APPLICABLE', gpuRuntimePerformance: 'NOT_RUN', productBuild: 'NOT_RUN', noPublication: true,
  cleanup: 'Own additive probes/links and source/export/log/install/build evidence retained; no services/tabs/agents or foreign cleanup. Automatic throughput files untouched/untracked/unpublished.' };
const receiptPath = `${repair}/repair-receipt.json`; writeOwned(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', candidateSha, candidateTree, parentSha, startSha: START, changedPathCount: changedPaths.length,
  fullCandidatePathCount: fullPaths.length, fixtureInventorySha256: receipt.fixtureInventorySha256, comparison: receipt.comparison,
  receiptPath, receiptSha256: sha(readFileSync(receiptPath)), originalAllFilesGate: gate.originalAllFilesGate, productIntegrated: false }, null, 2));
