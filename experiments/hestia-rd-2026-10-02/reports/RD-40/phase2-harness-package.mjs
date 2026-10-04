import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson } from '../../src/contracts/validation.ts';
import { lab, node, sha, start, tree, base, prefix, directory, fresh, inventory, regular, json, gitRead, checked,
  receiptPath, receiptHash, freezePath, freezeHash, verificationParent } from './phase2.mjs';
import { run } from './phase1.mjs';

const ownedChanges = ['reports/RD-40/HARNESS-REPAIR-HANDOFF.md', 'reports/RD-40/HARNESS-REPAIR-PLAN.md',
  'reports/RD-40/phase2-harness-package.mjs', 'reports/RD-40/phase2.mjs', 'tests/RD-40/browser.spec.ts',
  'tests/RD-40/native-canvas-capture.ts', 'tests/RD-40/phase2-native.spec.ts'].sort();
const [mode, id, verificationId, packageId] = process.argv.slice(2);
if (!['package', 'postcommit'].includes(mode)) { throw new Error('Fresh harness-repair package or postcommit required'); }
if (!id?.startsWith('phase2-32e88a34-20261004-harness-repair-')) { throw new Error('Harness-repair output ID required'); }
const root = fresh(id); const data = inventory(root); const verification = directory(verificationId);
const readJson = (file) => { regular(file); return JSON.parse(readFileSync(file)); };
const commands = ['root-types', 'focused-types', 'focused-unit', 'boundary'].map((name) => {
  const record = readJson(path.join(verification, `${name}.json`));
  if (record.exitCode !== 0 || sha(readFileSync(path.join(verification, `${name}.log`))) !== record.logSha256) { throw new Error(`Fresh check unbound/failed: ${name}`); }
  return { ...record, durationMs: Date.parse(record.ended) - Date.parse(record.began) };
});
const unit = readJson(path.join(verification, 'unit.json'));
if (!unit.success || unit.numTotalTests !== 20 || unit.numPassedTests !== 20 || unit.numFailedTests || unit.numPendingTests) { throw new Error('Original unchanged20 PASS required'); }
const source = readJson(path.join(verification, 'runtime-source-binding-unit.json'));
if (canonicalJson(source) !== canonicalJson(readJson(path.join(verification, 'runtime-source-binding-repair.json')))
  || canonicalJson(source.files) !== canonicalJson(data.sourceFiles) || source.sourceBytesDigest !== data.receipt.sourceBytesDigest) { throw new Error('Actual disk/self/CSS source mismatch'); }
const historicalRoot = directory('phase2-32e88a34-20261004-reader-repair-package-a');
const historicalReceiptHash = '830983a9d3e695d412b8723b5834f3aaf972ddc49b902592d6f612a568b6b634';
const previous = checked(path.join(historicalRoot, 'receipt.json'), historicalReceiptHash);
const historicalProofHash = 'a0869753baa490af531fdfb7309217c9ba19f2c073e40ca78027a849d3081de1';
const historicalProof = checked(path.join(historicalRoot, 'final-proof.json'), historicalProofHash);
for (const row of historicalProof.files) { regular(path.join(historicalRoot, row.path)); if (sha(readFileSync(path.join(historicalRoot, row.path))) !== row.sha256) { throw new Error(`Historical reader package changed: ${row.path}`); } }
if (previous.actualBrowser.statistics.expected !== 7 || previous.actualBrowser.statistics.unexpected !== 4
  || previous.historical.statistics.expected !== 0 || previous.historical.statistics.unexpected !== 10) { throw new Error('Historical 7/4 and 0/10 outcomes must stay unchanged'); }
const browserRoot = directory('phase2-32e88a34-20261004-harness-repair-browser-a');
const browser = readJson(path.join(browserRoot, 'browser-command.json')); const report = readJson(path.join(browserRoot, 'playwright-report.json'));
if (browser.exitCode !== 0 || sha(readFileSync(path.join(browserRoot, 'browser.log'))) !== browser.logSha256
  || report.stats.expected !== 11 || report.stats.unexpected || report.stats.skipped || report.stats.flaky) { throw new Error('Fresh whole11 PASS, zero retry/skip required'); }
const inspection = readJson(path.join(directory('phase2-32e88a34-20261004-harness-repair-inspection-a'), 'actual-native-results.json'));
if (inspection.reportSha256 !== sha(readFileSync(path.join(browserRoot, 'playwright-report.json'))) || inspection.tests.length !== 11
  || inspection.tests.some((test) => test.status !== 'expected' || test.results.length !== 1 || test.results[0].status !== 'passed' || test.results[0].errors.length)) { throw new Error('All eleven actual unfiltered cases required'); }
const cleanups = inspection.evidence.filter((row) => row.file.endsWith('cleanup.json'));
const captures = inspection.evidence.filter((row) => row.file.endsWith('-native-capture.json'));
if (cleanups.length !== 11 || cleanups.some((row) => !row.disposed || [row.owners.registeredMounts, ...Object.values(row.owners.c0), ...Object.values(row.owners.rd11)].some((count) => count !== 0))) { throw new Error('All eleven actual runtimes must dispose before context close'); }
if (captures.length !== 6 || captures.some((row) => row.decoded.width !== 640 || row.decoded.height !== 360 || row.dom.dpr !== 1
  || row.sourceBefore !== source.sourceBytesDigest || row.sourceAfter !== source.sourceBytesDigest || row.sourceCommit !== start)) { throw new Error('Six actual whole floating canvas captures must bind source/buffer640x360/DPR1'); }
for (const row of inspection.evidence) {
  const file = path.join(browserRoot, 'results', row.folder, row.file);
  if (sha(readFileSync(file)) !== row.sha256) { throw new Error('Actual native evidence changed'); }
  if (row.file.endsWith('-native-capture.json')) {
    const capture = readJson(file); const png = path.join(path.dirname(file), row.file.replace('-native-capture.json', '.png'));
    const bytes = readFileSync(png); const size = capture.before.state.submission.resolution;
    if (sha(bytes) !== row.pngSha256 || bytes.readUInt32BE(16) !== size.bufferWidth || bytes.readUInt32BE(20) !== size.bufferHeight
      || canonicalJson(capture.before.state.comparison) !== canonicalJson(capture.after.state.comparison)
      || canonicalJson(capture.before.source) !== canonicalJson(capture.after.source) || !capture.before.state.comparison.frame.paused
      || capture.clip.x < 0 || capture.clip.y < 0 || capture.clip.x + capture.clip.width > capture.dom.viewport.width
      || capture.clip.y + capture.clip.height > capture.dom.viewport.height || capture.runtimeOrStyleModified || capture.roundedOrPaddedOrRecoded) { throw new Error('Raw native PNG/source/frame capture binding failed'); }
  }
}
const contact = inspection.evidence.find((row) => row.file === 'native-contact-sheet-binding.json');
if (!contact || contact.decoded.width !== 1280 || contact.decoded.height !== 460 || contact.decoded.ownImages.length !== 2
  || contact.decoded.ownImages.some((image) => image.width !== 640 || image.height !== 360 || !image.rgbaEqual)) { throw new Error('Actual own contact-sheet decoded-image binding required'); }
const contactDir = path.join(browserRoot, 'results', contact.folder);
if (sha(readFileSync(path.join(contactDir, 'RD40-contact-sheet.png'))) !== contact.imageSha256
  || sha(readFileSync(path.join(contactDir, 'RD40-contact-sheet.json'))) !== contact.sidecarSha256
  || !readFileSync(path.join(contactDir, 'native-pair-0.json')).equals(readFileSync(path.join(contactDir, 'native-pair-1.json')))) { throw new Error('Actual contact downloads/stable pair byte binding failed'); }
const previewRoot = directory('phase2-32e88a34-20261004-harness-repair-preview-a'); const preview = readJson(path.join(previewRoot, 'preview.json'));
const stopped = readJson(path.join(previewRoot, 'preview-stopped.json')); const managed = readJson(path.join(previewRoot, 'managed-process.json'));
const portRoot = directory('phase2-32e88a34-20261004-harness-repair-port-after-a'); const port = readJson(path.join(portRoot, 'port-free.json'));
if (!stopped.ownedOnly || stopped.pid !== preview.pid || managed.actualNodePid !== preview.pid || managed.exitCode !== 0 || !port.exclusiveBindAndClose) { throw new Error('Own preview stop/port proof incomplete'); }
const servedPath = path.join(directory('phase2-32e88a34-20261004-harness-repair-served-a'), 'served447.json');
if (sha(readFileSync(servedPath)) !== browser.servedReceiptSha256) { throw new Error('Fresh served447 proof changed'); }
const outcome = { productIntegrated: false, status: 'RD40_OPTIMIZED_NATIVE_FUNCTIONAL_PASS', nativeAcceptance: 'PASS_FUNCTIONAL_GALLERY_ONLY',
  actualStatistics: report.stats, cases: inspection.tests, original5: { pass: 5, fail: 0 }, additive5: { pass: 5, fail: 0 }, readerRegression: { pass: 1, fail: 0 },
  denominator: 11, retries: 0, cpu: { original13: 13, repair7: 7, passed: 20 }, owningHarnessRepair: data.readerRepair,
  captureClassification: 'NATIVE-COMPOSITOR-WHOLE-ACTUAL-FLOAT-CANVAS-NOT-DIRECT-GPU-BUFFER', canvasCaptures: captures, contactSheet: contact,
  ordinaryPngPairStableExport: 'PASS', contactSheetOwnDownloadsAndDecodedBindings: 'PASS', nativeCaptureDpr1: 'PASS', nativeCaptureDpr2: 'NOT_RUN_NOT_DECLARED_BY_THESE_CASES',
  builtSource: { commit: start, tree, sourceBytesDigest: source.sourceBytesDigest, buildDigest: data.receipt.buildDigest, receiptPath, receiptSha256: receiptHash, freezePath, freezeSha256: freezeHash },
  historical: { readerNativeAcceptance: 'FAIL', readerStatistics: previous.actualBrowser.statistics, readerReceiptSha256: historicalReceiptHash, readerFinalProofSha256: historicalProofHash,
    olderNativeAcceptance: 'FAIL', olderStatistics: previous.historical.statistics, originalAllFailuresPreserved: true },
  nativeDriverDevice: 'UNKNOWN_UNQUALIFIED_NOT_MEASURED', qualifiedGpuPerformance: 'NOT_RUN', originalREN12: 'FAIL_UNCHANGED_NOT_RERUN', visualAdoption: 'DEFER',
  wholeProgrammePackage: 'NOT_READY_RD51_RD52_LATER', cleanup: { actualRuntimesDisposedBeforeContextClose: cleanups, previewStopped: stopped, managedProcess: managed, port5280Free: port, foreignTouched: false },
  review: 'SELF-DIFF-AND-THREE-ACTUAL-NATIVE-IMAGE-READS; NO-INDEPENDENT-REVIEW-CLAIM-FOR-THIS-DELTA' };

function walk(dir, files) {
  regular(dir, true);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name); if (entry.isDirectory()) { walk(file, files); } else { regular(file); files.push(file); }
  }
}
function hashes(files, parent) { return files.map((file) => ({ path: path.relative(parent, file).replaceAll('\\', '/'), sha256: sha(readFileSync(file)), bytes: readFileSync(file).length })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0); }
if (mode === 'package') {
  if (gitRead(root, 'rev-parse', 'HEAD') !== verificationParent) { throw new Error('Actual parent649 required before verification-only child'); }
  const copied = []; const copy = (file, relative) => {
    regular(file); const target = path.join(root, relative); mkdirSync(path.dirname(target), { recursive: true }); regular(path.dirname(target), true);
    const bytes = readFileSync(file); writeFileSync(target, bytes, { flag: 'wx' }); copied.push({ source: file, path: relative, sha256: sha(bytes), bytes: bytes.length });
  };
  const history = []; walk(historicalRoot, history);
  for (const file of history) { copy(file, `history/reader-partial/${path.relative(historicalRoot, file).replaceAll('\\', '/')}`); }
  const attempts = ['preedit-a', 'admission-a', 'verify-a', path.basename(verification).replace('phase2-32e88a34-20261004-harness-repair-', ''), 'port-before-a', 'preview-a', 'served-a', 'browser-a', 'inspection-a', 'port-after-a'];
  for (const attempt of new Set(attempts)) {
    const attemptRoot = directory(`phase2-32e88a34-20261004-harness-repair-${attempt}`); const files = [];
    for (const entry of readdirSync(attemptRoot, { withFileTypes: true })) {
      const file = path.join(attemptRoot, entry.name);
      if (entry.name === 'results') { walk(file, files); }
      else if (!['temp', 'npm-cache', 'stop-preview'].includes(entry.name)) { regular(file); files.push(file); }
    }
    for (const file of files) { copy(file, `attempts/${attempt}/${path.relative(attemptRoot, file).replaceAll('\\', '/')}`); }
  }
  copy(receiptPath, 'manifests/HEAD-RECEIPT.json'); copy(freezePath, 'manifests/HEAD-FREEZE.json');
  json(path.join(root, 'results.json'), outcome); json(path.join(root, 'copied-manifest.json'), { copied, noAutomaticLogsReadOrCopied: true });
  const images = copied.filter((row) => row.path.startsWith('attempts/browser-a/results/') && row.path.endsWith('.png'));
  const links = images.map((row) => `<li><a href="${encodeURI(row.path)}">${path.basename(row.path)}</a> · SHA ${row.sha256}</li>`);
  const contactPath = `attempts/browser-a/results/${contact.folder}/RD40-contact-sheet.png`;
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>RD40 optimized native functional PASS</title><style>body{max-width:1100px;margin:2rem auto;padding:1rem;font:16px system-ui;background:#101719;color:#e4eeee}a{color:#9dd8e6}li{margin:.6rem 0;overflow-wrap:anywhere}img{max-width:100%}</style><h1>RD40: optimized native functional PASS</h1><p>ProductIntegrated=false · original5 + additive5 + reader1 = 11 PASS / 0 FAIL / 0 skip / 0 flaky · worker1/retries0.</p><p>Only owning test selectors/capture changed. Runtime source32, source bytes, self/CSS, build447 and public429 remain unchanged. Native whole actual float canvas clips at DPR1 decode640×360; no rectangle rounding, crop, padding, PNG re-encoding or runtime-style change. This is compositor-visible evidence, not direct GPU-buffer identity.</p><img src="${encodeURI(contactPath)}" alt="Actual downloaded RD40 contact sheet from its byte-bound A/B images"><ul><li><a href="results.json">Functional cases, capture bindings and all11 cleanup</a></li><li><a href="receipt.json">Full local-child proof and exact command receipts</a></li><li><a href="final-proof.json">Final package hashes and latest5280-free proof</a></li><li><a href="copied-manifest.json">Copied artifact byte manifest</a></li><li><a href="attempts/browser-a/playwright-report.json">Fresh all11 native report</a> · <a href="attempts/browser-a/browser.log">raw log</a></li><li><a href="attempts/inspection-a/actual-native-results.json">Actual fractional clip/PNG/frame and zero-owner records</a></li><li><a href="attempts/served-a/served447.json">Fresh447 HTTP body hashes</a></li><li><a href="history/reader-partial/index.html">Unchanged historical7/4 package (includes older0/10)</a></li><li><a href="manifests/HEAD-RECEIPT.json">Immutable runtime32/build receipt</a></li></ul><h2>Actual captures and downloads</h2><ul>${links.join('')}</ul><p>Actual C2 WebGPU success is distinct from CONTROLLED denied-C2/File-spy/read-delay/HTTP-delay cases. Native device/driver unknown and unqualified. DPR2 capture NOT_RUN. Qualified GPU/performance NOT_RUN. REN12 FAIL / visual adoption DEFER; missing Reddit/concept/LFS media remain unacquired. RD40 slice only: not RD51/RD52 wholeprogramme, art or product acceptance.</p></html>`;
  writeFileSync(path.join(root, 'index.html'), html, { flag: 'wx' });
  const files = []; walk(root, files); const manifest = hashes(files, root);
  json(path.join(root, 'package-manifest.json'), { classification: 'RD40-NATIVE-FUNCTIONAL-PASS-NOT-WHOLEPROGRAMME', files: manifest, manifestSha256: sha(canonicalJson(manifest)) });
  console.log(JSON.stringify({ root, copied: copied.length, status: outcome.status, productIntegrated: false }));
} else {
  const head = gitRead(root, 'rev-parse', 'HEAD'); const candidateTree = gitRead(root, 'rev-parse', 'HEAD^{tree}');
  if (gitRead(root, 'rev-parse', 'HEAD^') !== verificationParent || gitRead(root, 'branch', '--show-current') !== 'feature/hestia-rd-rd40-phase2-2026-10-04'
    || gitRead(root, 'diff', '--name-only') || gitRead(root, 'diff', '--cached', '--name-only')) { throw new Error('Clean direct649 child required'); }
  const changed = gitRead(root, 'diff', '--name-only', verificationParent, head).split('\n').map((file) => file.slice(prefix.length)).sort();
  if (canonicalJson(changed) !== canonicalJson(ownedChanges)) { throw new Error('Only the seven declared owning harness/report paths may change'); }
  if (run(root, 'postcommit-boundary', node, ['scripts/verify-boundary.mjs', '--task', 'RD-40', '--start', start, '--base', base]) !== 0) { throw new Error('Fresh postcommit full52 failed'); }
  const guard = readJson(path.join(root, 'postcommit-boundary.log'));
  if (!guard.ok || guard.inputHashesVerified !== 52 || guard.violations.length) { throw new Error('Original52 incomplete'); }
  const packageRoot = directory(packageId); const manifest = readJson(path.join(packageRoot, 'package-manifest.json'));
  for (const row of manifest.files) { regular(path.join(packageRoot, row.path)); if (sha(readFileSync(path.join(packageRoot, row.path))) !== row.sha256) { throw new Error(`Package bytes changed: ${row.path}`); } }
  const receipt = { schema: 'rd40-phase2-owning-harness-repair-receipt-v1', ...outcome, candidateCommit: head, candidateTree, candidateParent: verificationParent,
    originalSource21: data.originalSource21, currentSource21: data.source21, originalStart672Sha256: sha(canonicalJson(data.originalStart672)), currentStart672Sha256: sha(canonicalJson(data.startFiles)),
    startProtection: '671 exact unchanged; one explicitly versioned original browser test oracle, historical reader/owning harness diffs retained', shared18: data.shared18,
    original645: data.original645, original429: data.original429, public429: data.publicFiles, sourceBinding: source, built447: data.receipt.builtFiles,
    verification: { root: verification, commands, original20Passed: 20, unitJsonSha256: sha(readFileSync(path.join(verification, 'unit.json'))) },
    actualBrowser: { ...browser, durationMs: Date.parse(browser.ended) - Date.parse(browser.began), reportSha256: sha(readFileSync(path.join(browserRoot, 'playwright-report.json'))), statistics: report.stats },
    changedFiles: changed.map((file) => ({ path: file, sha256: sha(readFileSync(path.join(lab, file))) })),
    guard: { original52: guard.inputHashesVerified, violations: guard.violations, originalAllFilesGate: guard.originalAllFilesGate, rawSha256: sha(readFileSync(path.join(root, 'postcommit-boundary.log'))) },
    package: { root: packageRoot, manifestSha256: sha(readFileSync(path.join(packageRoot, 'package-manifest.json'))), filesBeforeSelfAndReceipt: manifest.files.length } };
  json(path.join(root, 'receipt.json'), receipt); writeFileSync(path.join(packageRoot, 'receipt.json'), readFileSync(path.join(root, 'receipt.json')), { flag: 'wx' });
  console.log(JSON.stringify({ root, receiptSha256: sha(readFileSync(path.join(root, 'receipt.json'))), candidateCommit: head, candidateTree, packageRoot, status: outcome.status, productIntegrated: false }));
}
