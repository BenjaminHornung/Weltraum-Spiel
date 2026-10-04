import { readFileSync, readdirSync, lstatSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson } from '../../src/contracts/validation.ts';
import { lab, node, start, sha, freshRoot, run } from './phase1.mjs';
import { parent, headProof, originalOracle, owned, check } from './repair.mjs';

const [mode, id, verificationId, redProofId] = process.argv.slice(2);
if (!/^c5317835-phase1-repair-[a-z0-9-]+$/.test(id)) { throw new Error('Fresh repair receipt ID required'); }
const root = freshRoot(id); const prefix = 'experiments/hestia-rd-2026-10-02/'; const repo = path.resolve(lab, '../..');
const runRoot = (value) => {
  if (!/^c5317835-phase1-repair-[a-z0-9-]+$/.test(value)) { throw new Error('Repair evidence ID required'); }
  return `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-40/${value}`;
};
const pinned = (file, expected) => { const bytes = readFileSync(file); if (sha(bytes) !== expected) { throw new Error(`Preserved receipt/oracle changed: ${file}`); } return bytes; };
const originalPath = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-40/c5317835-phase1-20261004-candidate-a/receipt.json';
const original = JSON.parse(pinned(originalPath, '42715dbfb5467b97433959c07918f846670c44f92610020c753a384cd3c7f2db'));
const headBytes = pinned(headProof, '53b114d1e5388a2c48c1072a09ef5f44315c8be3d0b5338aed930d64d035bd00');
pinned(path.join(lab, 'tests/RD-40/unit.test.ts'), originalOracle);
pinned(path.join(lab, 'tests/RD-40/browser.spec.ts'), '91c06b7e1bdb0002a110a5e44563454bc36af701347e64e0f28baa03fafb5440');
pinned(path.join(lab, 'reports/RD-11/oracle.ts'), '4a194e1269db4b873eb1a87da94afea9a0f4dd9ba574c7ebbfe27c34761067da');
const oracleSha256 = sha(readFileSync(path.join(lab, 'tests/RD-40/repair.test.ts')));
if (oracleSha256 !== 'd6c28f0b947658063f5a8bd1a28e23df3bedac53f2bf5f5baa0d590c358be38c') { throw new Error('Unchanged RED-to-GREEN oracle required'); }
function commandReceipt(directory, name, expectedExit = 0) {
  const bytes = readFileSync(path.join(directory, `${name}.json`)); const result = JSON.parse(bytes);
  if (result.exitCode !== expectedExit || sha(readFileSync(path.join(directory, `${name}.log`))) !== result.logSha256) { throw new Error(`Command/raw receipt mismatch: ${name}`); }
  return { ...result, durationMs: Date.parse(result.ended) - Date.parse(result.began), receiptSha256: sha(bytes) };
}
if (mode === 'red') {
  if (check(root, 'rev-parse', 'HEAD') !== parent) { throw new Error('RED must run at the original candidate'); }
  const source = original.scope.filter((row) => row.path.startsWith('src/tools/variant-gallery/'));
  for (const row of source) { pinned(path.join(lab, row.path), row.sha256); }
  const directory = runRoot(verificationId); const unitBytes = readFileSync(path.join(directory, 'unit.json')); const unit = JSON.parse(unitBytes);
  if (source.length !== 8 || unit.numTotalTests !== 7 || unit.numFailedTests !== 6 || unit.numPassedTests !== 1) { throw new Error('Expected genuine owning-source RED'); }
  const receipt = { productIntegrated: false, classification: 'CONTROLLED-CPU-ACTUAL-MAIN-LISTENERS-NOT-NATIVE-UI', parent,
    source, oracleSha256, originalOracle, command: commandReceipt(directory, 'repair-red', 1), unitSha256: sha(unitBytes),
    tests: unit.testResults.flatMap((suite) => suite.assertionResults.map((test) => ({ title: test.title, status: test.status, durationMs: test.duration, failureMessages: test.failureMessages }))) };
  const bytes = Buffer.from(JSON.stringify(receipt, null, 2)); writeFileSync(path.join(root, 'receipt.json'), bytes, { flag: 'wx' });
  console.log(JSON.stringify({ root, sha256: sha(bytes), failed: 6, passed: 1, sourceFilesUnmodified: 8, oracleSha256, productIntegrated: false }));
} else {
  if (!['precommit', 'postcommit'].includes(mode)) { throw new Error('Expected red/precommit/postcommit'); }
  const head = check(root, 'rev-parse', 'HEAD'); const tree = check(root, 'rev-parse', 'HEAD^{tree}');
  if ((mode === 'precommit' && head !== parent) || (mode === 'postcommit' && (check(root, 'rev-parse', 'HEAD^') !== parent || check(root, 'diff', '--name-only') || check(root, 'diff', '--cached', '--name-only')))) { throw new Error('Clean exact child of original candidate required'); }
  const redBytes = pinned(path.join(runRoot(redProofId), 'receipt.json'), '2f9842cdcb4591b37d100ac9c7e1d1384ab7d8c8981e013c8868f6549181071b'); const red = JSON.parse(redBytes);
  if (red.oracleSha256 !== oracleSha256 || red.parent !== parent || red.source.length !== 8) { throw new Error('RED oracle/source binding mismatch'); }
  const directory = runRoot(verificationId); const commands = ['root-types', 'focused-types', 'focused-unit', 'gallery-build', 'boundary'].map((name) => commandReceipt(directory, name));
  const unitBytes = readFileSync(path.join(directory, 'unit.json')); const unit = JSON.parse(unitBytes);
  if (!unit.success || unit.numPassedTests !== 20 || unit.numFailedTests !== 0) { throw new Error('Expected original13 + unchanged repair7 GREEN'); }
  const sourceBytes = readFileSync(path.join(directory, 'runtime-source-binding.json')); const source = JSON.parse(sourceBytes);
  const sourcePaths = ['src/registration.ts', 'package-lock.json', 'reference-cards/index.json', 'reference-cards/concepts.json'];
  for (const dir of ['src/contracts', 'src/runner', 'src/experiments/three-control', 'src/experiments/three-webgpu', 'src/tools/variant-gallery']) {
    for (const name of readdirSync(path.join(lab, dir))) { if (name.endsWith('.ts') || (dir.endsWith('variant-gallery') && (name.endsWith('.css') || name === 'index.html'))) { sourcePaths.push(`${dir}/${name}`); } }
  }
  sourcePaths.sort(); const actualSource = sourcePaths.map((file) => ({ path: file, sha256: sha(readFileSync(path.join(lab, file))) }));
  if (canonicalJson(actualSource) !== canonicalJson(source.files) || sha(canonicalJson(actualSource)) !== source.sourceBytesDigest
    || source.sourceDigest !== 'RD40-GALLERY-PHASE1' || source.lockDigest !== original.source.lockDigest) { throw new Error('Actual disk/self/CSS source binding mismatch'); }
  const protectedFiles = original.immutableStart.files;
  for (const row of protectedFiles) { const full = path.join(lab, row.path); const stat = lstatSync(full); if (!stat.isFile() || stat.isSymbolicLink()) { throw new Error('START regular-file identity changed'); } pinned(full, row.sha256); }
  if (protectedFiles.length !== 645 || protectedFiles.filter((row) => row.path.startsWith('fixtures/') || row.path.startsWith('media/')).length !== 429) { throw new Error('START/fixture inventory incomplete'); }
  const freezePath = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/freezes/${start}.json`;
  const freeze = JSON.parse(pinned(freezePath, '282c235f1479bdfe71fa9d1d6f6a03973fedf477583337876ab0a15d8753ad96'));
  if (freeze.frozenFiles.length !== 18) { throw new Error('Current shared18 missing'); }
  for (const row of freeze.frozenFiles) { pinned(path.join(lab, row.path), row.sha256); }
  const changed = check(root, 'diff', '--no-renames', '--name-only', '-z', parent, ...(mode === 'postcommit' ? [head] : [])).split('\0').filter(Boolean);
  if (mode === 'precommit') { changed.push(...check(root, 'ls-files', '--full-name', '--others', '--exclude-standard', '-z', '--', ...owned).split('\0').filter(Boolean)); }
  for (const file of changed) { if (!owned.some((dir) => file.startsWith(prefix + dir))) { throw new Error(`Outside repair scope: ${file}`); } }
  const built = []; const buildRoot = path.join(directory, 'build');
  function buildFiles(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name); if (entry.isSymbolicLink()) { throw new Error('Build link forbidden'); }
      if (entry.isDirectory()) { buildFiles(full); } else { built.push({ path: path.relative(buildRoot, full).replaceAll('\\', '/'), sha256: sha(readFileSync(full)) }); }
    }
  }
  buildFiles(buildRoot); built.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  if (built.length !== 432 || !built.some((row) => row.path === 'src/tools/variant-gallery/index.html')) { throw new Error('Actual gallery entry/build432 missing'); }
  if (run(root, 'full-guard', node, [path.join(lab, 'scripts/verify-boundary.mjs'), '--task', 'RD-40', '--start', start, '--base', 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e']) !== 0) { throw new Error('Fresh full52 guard failed'); }
  const guardBytes = readFileSync(path.join(root, 'full-guard.log')); const guard = JSON.parse(guardBytes);
  if (!guard.ok || guard.inputHashesVerified !== 52 || guard.violations.length) { throw new Error('Original52 guard incomplete'); }
  const commitRoot = mode === 'postcommit' ? runRoot('c5317835-phase1-repair-20261004-commit-a') : null;
  const receipt = { schema: 'rd40-phase1-repair-receipt-v1', productIntegrated: false, mode, taskStart: start, parent, candidateCommit: mode === 'postcommit' ? head : null,
    candidateTree: mode === 'postcommit' ? tree : null, changedFiles: [...new Set(changed)].sort().map((file) => ({ path: file.slice(prefix.length), sha256: sha(readFileSync(path.join(repo, file))) })),
    headProof: { path: headProof, sha256: sha(headBytes), preserved: true }, originalReceipt: { path: originalPath, sha256: sha(readFileSync(originalPath)), preserved: true },
    originalOracle, repairOracle: oracleSha256, originalBrowserOracle: '91c06b7e1bdb0002a110a5e44563454bc36af701347e64e0f28baa03fafb5440',
    red: { root: runRoot(redProofId), sha256: sha(redBytes), receipt: red }, verification: { root: directory, commands, unitPassed: 20, original13: 13, repair7: 7, unitSha256: sha(unitBytes),
      classification: 'CONTROLLED-CPU-NOT-NATIVE-UI', sourceBindingSha256: sha(sourceBytes), source, buildRoot, buildDigest: sha(canonicalJson(built)), built },
    protections: { startFiles: 645, inventorySha256: original.immutableStart.sha256, fixtureMedia: 429, fixtureMediaSha256: original.fixtureMedia.sha256, shared18: freeze.frozenFiles },
    guard: { original52: 52, violations: [], originalAllFilesGate: guard.originalAllFilesGate, rawSha256: sha(guardBytes) },
    localCommit: commitRoot ? { root: commitRoot, commands: ['staged-diff-check', 'staged-diff', 'local-commit'].map((name) => commandReceipt(commitRoot, name)) } : null,
    review: 'SUPPLIED-SO05-INDEPENDENT-STATIC-FINDINGS-REPAIRED; SELF-REVIEW-NO-NEW-INDEPENDENT-REVIEW', originalREN12: 'FAIL_UNCHANGED_NOT_RERUN', visualAdoption: 'DEFER',
    browser: 'NOT_RUN', screenshots: 'NOT_RUN', gpuPerformance: 'NOT_RUN', services: 0, ports: 'NOT_RUN', delegation: 'NOT_RUN', publication: 'NOT_RUN',
    cleanup: 'No services; prior attempts/dependencies/receipts retained; automatic logs untouched', limits: ['HEAD entry/navigation wiring still required', 'RD51/RD52 wholeprogramme package remains later'] };
  const bytes = Buffer.from(JSON.stringify(receipt, null, 2)); writeFileSync(path.join(root, 'receipt.json'), bytes, { flag: 'wx' });
  console.log(JSON.stringify({ root, receiptSha256: sha(bytes), candidateCommit: receipt.candidateCommit, candidateTree: receipt.candidateTree, changedFiles: receipt.changedFiles.length,
    sourceBytesDigest: source.sourceBytesDigest, repairOracleSha256: oracleSha256, original13: 13, repair7: 7, buildDigest: receipt.verification.buildDigest, productIntegrated: false }, null, 2));
}
