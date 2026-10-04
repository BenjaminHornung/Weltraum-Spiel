import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson } from '../../src/contracts/validation.ts';
import { lab, git, node, sha, start, tree, base, prefix, directory, fresh, inventory, regular, json, gitRead, checked,
  receiptPath, receiptHash, freezePath, freezeHash, verificationParent } from './phase2.mjs';
import { run } from './phase1.mjs';

const [mode, id, verificationId, packageId] = process.argv.slice(2);
if (!['package', 'postcommit'].includes(mode)) { throw new Error('Expected fresh reader-repair package or postcommit'); }
if (!id?.startsWith('phase2-32e88a34-20261004-reader-repair-')) { throw new Error('Reader-repair output ID required'); }
const root = fresh(id); const data = inventory(root); const verification = directory(verificationId);
const readJson = (file) => { regular(file); return JSON.parse(readFileSync(file)); };
const commands = ['root-types', 'focused-types', 'focused-unit', 'boundary'].map((name) => {
  const record = readJson(path.join(verification, `${name}.json`));
  if (record.exitCode !== 0 || sha(readFileSync(path.join(verification, `${name}.log`))) !== record.logSha256) { throw new Error(`Fresh command failed/unbound: ${name}`); }
  return { ...record, durationMs: Date.parse(record.ended) - Date.parse(record.began) };
});
const unit = readJson(path.join(verification, 'unit.json'));
if (!unit.success || unit.numTotalTests !== 20 || unit.numPassedTests !== 20 || unit.numFailedTests || unit.numPendingTests) { throw new Error('Unchanged original20 PASS required'); }
const source = readJson(path.join(verification, 'runtime-source-binding-unit.json'));
if (canonicalJson(source) !== canonicalJson(readJson(path.join(verification, 'runtime-source-binding-repair.json')))
  || canonicalJson(source.files) !== canonicalJson(data.sourceFiles) || source.sourceBytesDigest !== data.receipt.sourceBytesDigest) { throw new Error('Actual disk/raw/self/CSS source proof mismatch'); }
const previousReceiptPath = path.join(directory('phase2-32e88a34-20261004-candidate-a'), 'receipt.json');
const previousReceiptHash = 'a6c830c8bfff359ad9efcc271c16cf946072a64095f0969574380a8c5ac44af1';
const previous = checked(previousReceiptPath, previousReceiptHash);
const historicalRoot = directory('phase2-32e88a34-20261004-package-a');
const historicalProofHash = 'e5a07ab20036fdb8a2a7328921629c9c914917c15135d2507d98d527d94ea180';
const historicalProof = checked(path.join(historicalRoot, 'final-proof.json'), historicalProofHash);
for (const row of historicalProof.files) { regular(path.join(historicalRoot, row.path)); if (sha(readFileSync(path.join(historicalRoot, row.path))) !== row.sha256) { throw new Error(`Historical blocked package changed: ${row.path}`); } }
if (previous.actualBrowser.statistics.unexpected !== 10 || previous.actualBrowser.statistics.expected !== 0) { throw new Error('Historical ten FAIL must remain FAIL'); }
const browserRoot = directory('phase2-32e88a34-20261004-reader-repair-browser-a');
const browser = readJson(path.join(browserRoot, 'browser-command.json')); const report = readJson(path.join(browserRoot, 'playwright-report.json'));
if (browser.exitCode !== 1 || sha(readFileSync(path.join(browserRoot, 'browser.log'))) !== browser.logSha256
  || report.stats.expected !== 7 || report.stats.unexpected !== 4 || report.stats.skipped || report.stats.flaky) { throw new Error('Preserve actual 7 PASS / 4 FAIL / no retry or skip'); }
const nativeInspection = readJson(path.join(directory('phase2-32e88a34-20261004-reader-repair-inspection-a'), 'actual-native-results.json'));
if (nativeInspection.reportSha256 !== sha(readFileSync(path.join(browserRoot, 'playwright-report.json'))) || nativeInspection.tests.length !== 11) { throw new Error('All eleven actual cases required'); }
const cleanups = nativeInspection.evidence.filter((row) => row.file.endsWith('cleanup.json'));
if (cleanups.length !== 11 || cleanups.some((row) => !row.disposed || [row.owners.registeredMounts, ...Object.values(row.owners.c0), ...Object.values(row.owners.rd11)].some((count) => count !== 0))) { throw new Error('Every actual runtime must have zero-owner proof before context close'); }
for (const row of cleanups) { if (sha(readFileSync(path.join(browserRoot, 'results', row.folder, row.file))) !== row.sha256) { throw new Error('Cleanup proof bytes changed'); } }
const previewRoot = directory('phase2-32e88a34-20261004-reader-repair-preview-a'); const preview = readJson(path.join(previewRoot, 'preview.json'));
const stopped = readJson(path.join(previewRoot, 'preview-stopped.json')); const managed = readJson(path.join(previewRoot, 'managed-process.json'));
const portRoot = directory('phase2-32e88a34-20261004-reader-repair-port-after-a'); const port = readJson(path.join(portRoot, 'port-free.json'));
if (!stopped.ownedOnly || stopped.pid !== preview.pid || managed.exitCode !== 0 || managed.actualNodePid !== preview.pid || !port.exclusiveBindAndClose) { throw new Error('Own preview stop/port proof incomplete'); }
const servedPath = path.join(directory('phase2-32e88a34-20261004-reader-repair-served-a'), 'served447.json');
if (sha(readFileSync(servedPath)) !== browser.servedReceiptSha256) { throw new Error('Actual fresh served body binding changed'); }
const executed = nativeInspection.tests.map((test) => ({ title: test.title, status: test.status, durationMs: test.results[0].duration, errors: test.results[0].errors }));
const outcome = { productIntegrated: false, status: 'READER_FIXED_NATIVE_ACCEPTANCE_PARTIAL_FAIL', nativeAcceptance: 'FAIL', readerRegression: 'PASS',
  actualStatistics: report.stats, cases: executed, original5: { pass: 3, fail: 2 }, additive5: { pass: 3, fail: 2 }, extraReaderCase: { pass: 1, fail: 0 }, retries: 0,
  cpu: { original13: 13, repair7: 7, passed: 20 }, readerRepair: data.readerRepair,
  builtSource: { commit: start, tree, sourceBytesDigest: source.sourceBytesDigest, buildDigest: data.receipt.buildDigest, receiptPath, receiptSha256: receiptHash, freezePath, freezeSha256: freezeHash },
  historical: { nativeAcceptance: 'FAIL', statistics: previous.actualBrowser.statistics, receiptPath: previousReceiptPath, receiptSha256: previousReceiptHash, blockedPackageFinalProofSha256: historicalProofHash, preserved: true },
  remainingFailures: ['Original UI40/UI43 exact Fixture label locator times out; retained accessibility snapshot contains Fixture combobox', 'Additive pending Bind/contact-sheet reject actual 640x361 screenshot PNG versus actual 640x360 buffer; strict binding unchanged'],
  contactSheet: 'NOT_REACHED_NO_SUBSTITUTE', ordinaryPngPairExport: 'NOT_REACHED', nativeDriverDevice: 'UNQUALIFIED_NOT_MEASURED', qualifiedGpuPerformance: 'NOT_RUN',
  originalREN12: 'FAIL_UNCHANGED_NOT_RERUN', visualAdoption: 'DEFER', wholeProgrammePackage: 'NOT_READY_RD51_RD52_LATER',
  cleanup: { actualRuntimesDisposedBeforeContextClose: cleanups, previewStopped: stopped, managedProcess: managed, port5280Free: port, foreignTouched: false },
  nextAuthority: 'HEAD narrow locator/capture oracle correction and fresh native grant; no runtime bug or new freeze fabricated', review: 'SELF-DIFF; NO-NEW-INDEPENDENT-OR-HUMAN-REVIEW' };

function walk(dir, files) {
  regular(dir, true);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name); if (entry.isDirectory()) { walk(file, files); } else { regular(file); files.push(file); }
  }
}
function hashes(files, parent) { return files.map((file) => ({ path: path.relative(parent, file).replaceAll('\\', '/'), sha256: sha(readFileSync(file)), bytes: readFileSync(file).length })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0); }
if (mode === 'package') {
  if (gitRead(root, 'rev-parse', 'HEAD') !== verificationParent) { throw new Error('Actual verification parent453 required before local child'); }
  const copied = []; const copy = (file, relative) => {
    regular(file); const target = path.join(root, relative); mkdirSync(path.dirname(target), { recursive: true }); regular(path.dirname(target), true);
    const bytes = readFileSync(file); writeFileSync(target, bytes, { flag: 'wx' }); copied.push({ source: file, path: relative, sha256: sha(bytes), bytes: bytes.length });
  };
  const historicalFiles = []; walk(historicalRoot, historicalFiles);
  for (const file of historicalFiles) { copy(file, `history/blocked/${path.relative(historicalRoot, file).replaceAll('\\', '/')}`); }
  const attempts = ['preedit-a', 'admission-a', 'verify-a', path.basename(verification).replace('phase2-32e88a34-20261004-reader-repair-', ''), 'port-before-a', 'preview-a', 'served-a', 'browser-a', 'inspection-a', 'port-after-a'];
  for (const attempt of new Set(attempts)) {
    const attemptRoot = directory(`phase2-32e88a34-20261004-reader-repair-${attempt}`); const files = [];
    for (const entry of readdirSync(attemptRoot, { withFileTypes: true })) {
      const file = path.join(attemptRoot, entry.name);
      if (entry.name === 'results') { walk(file, files); }
      else if (!['temp', 'npm-cache', 'stop-preview'].includes(entry.name)) { regular(file); files.push(file); }
    }
    for (const file of files) { copy(file, `attempts/${attempt}/${path.relative(attemptRoot, file).replaceAll('\\', '/')}`); }
  }
  copy(receiptPath, 'manifests/HEAD-RECEIPT.json'); copy(freezePath, 'manifests/HEAD-FREEZE.json');
  json(path.join(root, 'results.json'), outcome); json(path.join(root, 'copied-manifest.json'), { copied, noAutomaticLogsReadOrCopied: true });
  const captures = [];
  for (const row of copied.filter((row) => row.path.startsWith('attempts/browser-a/results/') && row.path.endsWith('.png'))) {
    captures.push(`<li><a href="${encodeURI(row.path)}">${path.basename(row.path)}</a> · SHA ${row.sha256}</li>`);
  }
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>RD40 reader fixed — native partial FAIL</title><style>body{max-width:1100px;margin:2rem auto;padding:1rem;font:16px system-ui;background:#101719;color:#e4eeee}a{color:#9dd8e6}li{margin:.6rem 0;overflow-wrap:anywhere}</style><h1>RD40: reader fixed, native acceptance FAIL</h1><p>ProductIntegrated=false · 7 PASS / 4 FAIL / 0 skip / 0 flaky · worker1/retries0 · RD40 slice only, not RD51/RD52 wholeprogramme.</p><p>Closed-output actual DOM regression PASS. Old ten failures remain FAIL, preserved below. Two exact Fixture locator timeouts and two strict PNG binding failures (actual PNG640×361 vs native buffer640×360) remain unaltered. No runtime repair, capture substitution or weakened validation. Pair/contact-sheet success NOT_REACHED.</p><ul><li><a href="results.json">Qualified outcomes, cases, identities and cleanup11/11</a></li><li><a href="receipt.json">Full postcommit receipt</a></li><li><a href="copied-manifest.json">Exact copied byte hashes</a></li><li><a href="attempts/browser-a/playwright-report.json">Fresh all11 native report</a> · <a href="attempts/browser-a/browser.log">raw log</a></li><li><a href="attempts/inspection-a/actual-native-results.json">Actual facts, PNG dimensions and zero-owner proofs</a></li><li><a href="attempts/served-a/served447.json">Fresh actual447 HTTP bodies</a></li><li><a href="history/blocked/index.html">Historical blocked native package, unchanged</a></li><li><a href="manifests/HEAD-RECEIPT.json">Immutable built source32 receipt</a></li></ul><h2>Actual native captures — qualified per-case facts alongside each image</h2><ul>${captures.join('')}</ul><p>Actual C2 WebGPU and separately CONTROLLED denial/File-spy/HTTP-delay are not qualified GPU/performance evidence. Driver/device unqualified. REN12 FAIL / visual adoption DEFER; missing media unacquired.</p></html>`;
  writeFileSync(path.join(root, 'index.html'), html, { flag: 'wx' });
  const files = []; walk(root, files); const manifest = hashes(files, root);
  json(path.join(root, 'package-manifest.json'), { classification: 'RD40-READER-FIXED-NATIVE-PARTIAL-FAIL-NOT-WHOLEPROGRAMME', files: manifest, manifestSha256: sha(canonicalJson(manifest)) });
  console.log(JSON.stringify({ root, copied: copied.length, status: outcome.status, productIntegrated: false }));
} else {
  const head = gitRead(root, 'rev-parse', 'HEAD'); const candidateTree = gitRead(root, 'rev-parse', 'HEAD^{tree}');
  if (gitRead(root, 'rev-parse', 'HEAD^') !== verificationParent || gitRead(root, 'branch', '--show-current') !== 'feature/hestia-rd-rd40-phase2-2026-10-04'
    || gitRead(root, 'diff', '--name-only') || gitRead(root, 'diff', '--cached', '--name-only')) { throw new Error('Clean direct child453 required'); }
  const expected = ['reports/RD-40/READER-REPAIR-HANDOFF.md', 'reports/RD-40/READER-REPAIR-PLAN.md', 'reports/RD-40/phase2-reader-package.mjs', 'reports/RD-40/phase2.mjs', 'tests/RD-40/browser.spec.ts', 'tests/RD-40/phase2-native.spec.ts'].sort();
  const changed = gitRead(root, 'diff', '--name-only', verificationParent, head).split('\n').map((file) => file.slice(prefix.length)).sort();
  if (canonicalJson(changed) !== canonicalJson(expected)) { throw new Error('Only exact six reader-repair verification paths allowed'); }
  if (run(root, 'postcommit-boundary', node, ['scripts/verify-boundary.mjs', '--task', 'RD-40', '--start', start, '--base', base]) !== 0) { throw new Error('Fresh postcommit full52 failed'); }
  const guard = readJson(path.join(root, 'postcommit-boundary.log'));
  if (!guard.ok || guard.inputHashesVerified !== 52 || guard.violations.length) { throw new Error('Original52 incomplete'); }
  const packageRoot = directory(packageId); const manifest = readJson(path.join(packageRoot, 'package-manifest.json'));
  for (const row of manifest.files) { regular(path.join(packageRoot, row.path)); if (sha(readFileSync(path.join(packageRoot, row.path))) !== row.sha256) { throw new Error(`Package bytes changed: ${row.path}`); } }
  const receipt = { schema: 'rd40-phase2-reader-repair-receipt-v1', ...outcome, candidateCommit: head, candidateTree, candidateParent: verificationParent,
    originalSource21: data.originalSource21, currentSource21: data.source21, originalStart672Sha256: sha(canonicalJson(data.originalStart672)), currentStart672Sha256: sha(canonicalJson(data.startFiles)),
    startProtection: '671 exact unchanged; one explicitly admitted original browser oracle hash, full old/new diff retained', shared18: data.shared18, original645: data.original645, original429: data.original429,
    public429: data.publicFiles, sourceBinding: source, built447: data.receipt.builtFiles, verification: { root: verification, commands, original20Passed: 20, unitJsonSha256: sha(readFileSync(path.join(verification, 'unit.json'))) },
    actualBrowser: { ...browser, durationMs: Date.parse(browser.ended) - Date.parse(browser.began), reportSha256: sha(readFileSync(path.join(browserRoot, 'playwright-report.json'))), statistics: report.stats },
    changedFiles: changed.map((file) => ({ path: file, sha256: sha(readFileSync(path.join(lab, file))) })),
    guard: { original52: guard.inputHashesVerified, violations: guard.violations, originalAllFilesGate: guard.originalAllFilesGate, rawSha256: sha(readFileSync(path.join(root, 'postcommit-boundary.log'))) },
    package: { root: packageRoot, manifestSha256: sha(readFileSync(path.join(packageRoot, 'package-manifest.json'))), packageFilesBeforeSelfAndReceipt: manifest.files.length } };
  json(path.join(root, 'receipt.json'), receipt); writeFileSync(path.join(packageRoot, 'receipt.json'), readFileSync(path.join(root, 'receipt.json')), { flag: 'wx' });
  console.log(JSON.stringify({ root, receiptSha256: sha(readFileSync(path.join(root, 'receipt.json'))), candidateCommit: head, candidateTree, packageRoot, status: outcome.status, productIntegrated: false }));
}
