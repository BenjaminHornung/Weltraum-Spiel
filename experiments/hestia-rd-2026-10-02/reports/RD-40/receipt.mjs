import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson } from '../../src/contracts/validation.ts';
import { lab, git, node, start, sha, freshRoot, run, environment } from './phase1.mjs';

const prefix = 'experiments/hestia-rd-2026-10-02/'; const repo = path.resolve(lab, '../..');
const mode = process.argv[2]; const root = freshRoot(process.argv[3]);
const command = (...args) => execFileSync(git, args, { cwd: repo, env: environment(root), encoding: 'utf8', timeout: 120_000 });
const rows = command('ls-tree', '-r', '-z', start, '--', prefix).split('\0').filter(Boolean).map((entry) => {
  const [metadata, full] = entry.split('\t'); const [fileMode, kind, blob] = metadata.split(' ');
  if (!['100644', '100755'].includes(fileMode) || kind !== 'blob' || !full.startsWith(prefix)) { throw new Error('Unexpected START file identity'); }
  const stat = lstatSync(path.join(repo, full)); if (!stat.isFile() || stat.isSymbolicLink()) { throw new Error(`Non-regular START file: ${full}`); }
  const bytes = readFileSync(path.join(repo, full));
  const actualBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  let comparison = 'RAW_BYTES_MATCH_GIT_BLOB';
  if (actualBlob !== blob) {
    const attrs = command('check-attr', '-z', 'text', 'eol', 'filter', '--', full).split('\0');
    // The admitted Windows checkout already uses autocrlf for .mts (no eol pin).
    // Never execute an external clean/LFS filter or rewrite the working file.
    if (!full.endsWith('.mts') || attrs[2] !== 'auto' || attrs[5] !== 'unspecified' || attrs[8] !== 'unspecified'
      || command('config', '--get', 'core.autocrlf').trim() !== 'true'
      || command('hash-object', `--path=${full}`, full).trim() !== blob) { throw new Error(`START bytes changed: ${full}`); }
    comparison = 'GIT_BUILTIN_TEXT_AUTO_CRLF_CLEAN_MATCH_NO_FILE_WRITE';
  }
  return { path: full.slice(prefix.length), blob, sha256: sha(bytes), bytes: bytes.length, comparison };
});
if (rows.length !== 645) { throw new Error(`Expected 645 immutable START lab files, observed ${rows.length}`); }
const fixtureMedia = rows.filter((row) => row.path.startsWith('fixtures/') || row.path.startsWith('media/'));
if (fixtureMedia.length !== 429) { throw new Error(`Expected 429 fixture/media files, observed ${fixtureMedia.length}`); }
const headRoot = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/';
const freezeBytes = readFileSync(`${headRoot}freezes/${start}.json`);
if (sha(freezeBytes) !== '282c235f1479bdfe71fa9d1d6f6a03973fedf477583337876ab0a15d8753ad96') { throw new Error('HEAD freeze pin mismatch'); }
const freeze = JSON.parse(freezeBytes); const shared18 = freeze.frozenFiles.map((row) => {
  const actual = sha(readFileSync(path.join(lab, row.path))); if (actual !== row.sha256) { throw new Error(`Shared18 changed: ${row.path}`); } return { path: row.path, sha256: actual };
});
if (shared18.length !== 18) { throw new Error('Expected current shared18'); }
const sourcePaths = ['src/registration.ts', 'package-lock.json', 'reference-cards/index.json', 'reference-cards/concepts.json'];
for (const directory of ['src/contracts', 'src/runner', 'src/experiments/three-control', 'src/experiments/three-webgpu', 'src/tools/variant-gallery']) {
  for (const name of readdirSync(path.join(lab, directory))) {
    if (name.endsWith('.ts') || (directory.endsWith('variant-gallery') && (name.endsWith('.css') || name === 'index.html'))) { sourcePaths.push(`${directory}/${name}`); }
  }
}
sourcePaths.sort(); const sourceFiles = sourcePaths.map((file) => ({ path: file, sha256: sha(readFileSync(path.join(lab, file))) }));
const source = { sourceDigest: 'RD40-GALLERY-PHASE1', sourceBytesDigest: sha(canonicalJson(sourceFiles)), lockDigest: sourceFiles.find((file) => file.path === 'package-lock.json').sha256, files: sourceFiles };
if (process.argv[4] && /^c5317835-phase1-[a-z0-9-]+$/.test(process.argv[4])) {
  const runtimeSource = JSON.parse(readFileSync(`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-40/${process.argv[4]}/runtime-source-binding.json`));
  const differences = [...new Set([...source.files, ...runtimeSource.files].map((file) => file.path))].map((file) => ({ path: file,
    actual: source.files.find((row) => row.path === file)?.sha256 ?? null, runtime: runtimeSource.files.find((row) => row.path === file)?.sha256 ?? null })).filter((row) => row.actual !== row.runtime);
  writeFileSync(path.join(root, 'source-compare.json'), JSON.stringify({ source, runtimeSource, differences }, null, 2), { flag: 'wx' });
  if (differences.length) { throw new Error(`Raw-source binding mismatch: ${JSON.stringify(differences)}`); }
}
const head = command('rev-parse', 'HEAD').trim(); const tree = command('rev-parse', 'HEAD^{tree}').trim();
const changed = mode === 'postcommit' ? command('diff', '--no-renames', '--name-only', '-z', start, head).split('\0').filter(Boolean)
  : command('ls-files', '--others', '--exclude-standard', '-z', '--', `${prefix}src/tools/variant-gallery`, `${prefix}tests/RD-40`, `${prefix}reports/RD-40`).split('\0').filter(Boolean);
for (const file of changed) {
  if (![`${prefix}src/tools/variant-gallery/`, `${prefix}tests/RD-40/`, `${prefix}reports/RD-40/`].some((owned) => file.startsWith(owned))) { throw new Error(`Outside RD40: ${file}`); }
}
const exit = run(root, 'full-guard', node, [path.join(lab, 'scripts/verify-boundary.mjs'), '--task', 'RD-40', '--start', start, '--base', 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e']);
if (exit !== 0) { throw new Error('Full guard failed'); }
const boundary = JSON.parse(readFileSync(path.join(root, 'full-guard.log'), 'utf8'));
if (!boundary.ok || boundary.inputHashesVerified !== 52 || boundary.violations.length !== 0) { throw new Error('Incomplete original52 guard'); }
let verification = null;
if (process.argv[4]) {
  if (!/^c5317835-phase1-[a-z0-9-]+$/.test(process.argv[4])) { throw new Error('Invalid verification ID'); }
  const verifyRoot = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-40/${process.argv[4]}`;
  const commands = ['root-types', 'focused-types', 'focused-unit', 'gallery-build', 'boundary'].map((name) => {
    const bytes = readFileSync(path.join(verifyRoot, `${name}.json`)); const result = JSON.parse(bytes);
    if (result.exitCode !== 0 || sha(readFileSync(path.join(verifyRoot, `${name}.log`))) !== result.logSha256) { throw new Error(`Fresh command/log mismatch: ${name}`); }
    return { ...result, receiptSha256: sha(bytes) };
  });
  const unitBytes = readFileSync(path.join(verifyRoot, 'unit.json')); const unit = JSON.parse(unitBytes);
  if (!unit.success || unit.numFailedTests !== 0 || unit.numPassedTests !== 13) { throw new Error('Expected fresh focused CPU 13/13'); }
  const runtimeSource = readFileSync(path.join(verifyRoot, 'runtime-source-binding.json'));
  if (canonicalJson(JSON.parse(runtimeSource)) !== canonicalJson(source)) { throw new Error('CPU/Vite raw runtime source binding differs from exact source bytes'); }
  const built = []; const buildRoot = path.join(verifyRoot, 'build');
  function buildFiles(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) { buildFiles(full); } else { built.push({ path: path.relative(buildRoot, full).replaceAll('\\', '/'), sha256: sha(readFileSync(full)) }); }
    }
  }
  buildFiles(buildRoot); built.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  verification = { root: verifyRoot, commands, unit: { passed: unit.numPassedTests, failed: unit.numFailedTests, sha256: sha(unitBytes), classification: 'CONTROLLED-CPU-NOT-NATIVE-UI' },
    runtimeSourceBinding: { status: 'PASS', sha256: sha(runtimeSource), sourceBytesDigest: source.sourceBytesDigest },
    buildRoot, buildDigest: sha(canonicalJson(built)), built, productionRootWiring: 'NOT_RUN-HEAD-OWNED', browser: 'NOT_RUN', screenshots: 'NOT_RUN', gpu: 'NOT_RUN' };
}
if (mode === 'postcommit') {
  if (command('rev-parse', 'HEAD^').trim() !== start || command('diff', '--cached', '--name-only').trim() || command('diff', '--name-only').trim()) { throw new Error('Candidate must be a clean direct child of accepted START'); }
} else if (mode !== 'precommit' || head !== start) { throw new Error('Expected precommit at START or direct postcommit candidate'); }
const receipt = { schema: 'rd40-phase1-receipt-v1', productIntegrated: false, mode, acceptedStart: start,
  acceptedTree: '49c4dccc756ff8916227db371296ff858de35f88', productReadbase: 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e', candidateCommit: mode === 'postcommit' ? head : null, candidateTree: mode === 'postcommit' ? tree : null,
  scope: changed.map((file) => ({ path: file.slice(prefix.length), sha256: sha(readFileSync(path.join(repo, file))) })),
  immutableStart: { count: rows.length, sha256: sha(canonicalJson(rows)), files: rows, checkoutEol: rows.filter((row) => row.comparison !== 'RAW_BYTES_MATCH_GIT_BLOB') }, fixtureMedia: { count: fixtureMedia.length, sha256: sha(canonicalJson(fixtureMedia)) }, shared18, source,
  focusedOracleSha256: sha(readFileSync(path.join(lab, 'tests/RD-40/unit.test.ts'))), originalREN12OracleSha256: sha(readFileSync(path.join(lab, 'reports/RD-11/oracle.ts'))),
  originalREN12: 'FAIL_UNCHANGED_NOT_RERUN', visualAdoption: 'DEFER', verification, fullGuard: { receipt: 'full-guard.log', sha256: sha(readFileSync(path.join(root, 'full-guard.log'))),
    original52: boundary.inputHashesVerified, violations: boundary.violations, originalAllFilesGate: boundary.originalAllFilesGate },
  review: 'SELF-REVIEW-ONLY', servicesStarted: 0, portAccess: 'NOT_RUN', delegation: 'NOT_RUN', cleanup: 'No services; dependencies and all attempts retained; automatic logs untouched',
  limits: ['HEAD entry/navigation wiring still required', 'Browser/native renderer/screenshots/GPU/performance NOT_RUN', 'RD51/RD52 wholeprogramme package remains later'] };
const bytes = Buffer.from(JSON.stringify(receipt, null, 2)); writeFileSync(path.join(root, 'receipt.json'), bytes, { flag: 'wx' });
console.log(JSON.stringify({ root, receiptSha256: sha(bytes), candidateCommit: receipt.candidateCommit, candidateTree: receipt.candidateTree, changedFiles: changed.length,
  original52: 52, immutableStart: rows.length, immutableStartSha256: receipt.immutableStart.sha256, fixtureMedia: fixtureMedia.length, fixtureMediaSha256: receipt.fixtureMedia.sha256,
  shared18: shared18.length, sourceBytesDigest: source.sourceBytesDigest, focusedOracleSha256: receipt.focusedOracleSha256, originalREN12OracleSha256: receipt.originalREN12OracleSha256,
  unitSha256: verification?.unit.sha256 ?? null, buildDigest: verification?.buildDigest ?? null, productIntegrated: false }, null, 2));
