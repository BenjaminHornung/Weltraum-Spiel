import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson } from '../../src/contracts/validation.ts';
import { lab, git, node, sha, start, tree, base, prefix, directory, fresh, inventory, regular, json, gitRead, receiptPath, receiptHash, freezePath, freezeHash } from './phase2.mjs';
import { run } from './phase1.mjs';

const [mode, id, verificationId, packageId] = process.argv.slice(2);
if (!['package', 'postcommit'].includes(mode)) { throw new Error('Expected package or postcommit'); }
const root = fresh(id); const data = inventory(root); const verification = directory(verificationId);
const readJson = (file) => { regular(file); return JSON.parse(readFileSync(file)); };
const command = (name) => {
  const record = readJson(path.join(verification, `${name}.json`)); const bytes = readFileSync(path.join(verification, `${name}.log`));
  if (record.exitCode !== 0 || sha(bytes) !== record.logSha256) { throw new Error(`Fresh command failed/unbound: ${name}`); }
  return { ...record, durationMs: Date.parse(record.ended) - Date.parse(record.began) };
};
const commands = ['root-types', 'focused-types', 'focused-unit', 'boundary'].map(command);
const unit = readJson(path.join(verification, 'unit.json'));
if (!unit.success || unit.numTotalTests !== 20 || unit.numPassedTests !== 20 || unit.numFailedTests || unit.numPendingTests) { throw new Error('Original20 required unchanged PASS'); }
const source = readJson(path.join(verification, 'runtime-source-binding-unit.json')); const repairSource = readJson(path.join(verification, 'runtime-source-binding-repair.json'));
if (canonicalJson(source) !== canonicalJson(repairSource) || canonicalJson(source.files) !== canonicalJson(data.sourceFiles) || source.sourceBytesDigest !== data.receipt.sourceBytesDigest) { throw new Error('Raw/self/CSS disk proof mismatch'); }
const baseline = readJson(path.join(directory('phase2-32e88a34-20261004-admission-b'), 'admission.json'));
if (canonicalJson(baseline.startFiles) !== canonicalJson(data.startFiles)) { throw new Error('START32 files changed after admission'); }
const browserRoot = directory('phase2-32e88a34-20261004-browser-b'); const browser = readJson(path.join(browserRoot, 'browser-command.json'));
if (browser.exitCode !== 1 || sha(readFileSync(path.join(browserRoot, 'browser.log'))) !== browser.logSha256) { throw new Error('Preserve actual native failure'); }
const report = readJson(path.join(browserRoot, 'playwright-report.json'));
if (report.stats.expected !== 0 || report.stats.unexpected !== 10 || report.stats.skipped !== 0 || report.stats.flaky !== 0) { throw new Error('Expected actual ten executed failures, no reclassification'); }
const diagnosticRoot = directory('phase2-32e88a34-20261004-diagnostic-a'); const diagnostic = readJson(path.join(diagnosticRoot, 'collapsed-facts-reproduction.json'));
if (diagnostic.collapsed.innerText !== '' || diagnostic.collapsed.value.length !== 27221 || diagnostic.expanded.innerText !== diagnostic.expanded.value) { throw new Error('Actual collapsed-facts cause not bound'); }
const diagCleanup = readJson(path.join(diagnosticRoot, 'diagnostic-runtime-cleanup.json'));
if (!diagCleanup.runtimeDisposedBeforeContextClose || diagCleanup.owners.registeredMounts !== 0 || diagCleanup.owners.c0.renderloops !== 0 || diagCleanup.owners.rd11.renderloops !== 0) { throw new Error('Diagnostic cleanup incomplete'); }
const stopped = readJson(path.join(directory('phase2-32e88a34-20261004-preview-b'), 'preview-stopped.json'));
const port = readJson(path.join(directory('phase2-32e88a34-20261004-port-after-a'), 'port-free.json'));
if (stopped.pid !== 45028 || !stopped.ownedOnly || !port.exclusiveBindAndClose) { throw new Error('Own service/port cleanup not proven'); }

function walk(dir, output) {
  regular(dir, true);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name); if (entry.isDirectory()) { walk(full, output); }
    else { regular(full); output.push(full); }
  }
}
function hashes(files, parent) { return files.map((file) => ({ path: path.relative(parent, file).replaceAll('\\', '/'), sha256: sha(readFileSync(file)), bytes: readFileSync(file).length })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0); }
const outcome = { productIntegrated: false, status: 'BLOCKED_PROTECTED_BROWSER_FACTS_ORACLE', nativeAcceptance: 'FAIL', original5: '5 executed, all failed before acceptance flows',
  additive5: '5 executed, all failed before acceptance flows', retries: 0, skips: 0, cpu: { original13: 13, repair7: 7, passed: 20 },
  builtSource: { commit: start, tree, buildDigest: data.receipt.buildDigest, sourceBytesDigest: source.sourceBytesDigest, receiptPath, receiptSha256: receiptHash, freezePath, freezeSha256: freezeHash },
  actualNativeDiagnostic: { browser: diagnostic.nativeBrowserVersion, backend: JSON.parse(diagnostic.collapsed.value).state.submission.backend,
    collapsedInnerTextBytes: 0, actualValueBytes: 27221, visibleDisclosureMatchesActualValue: true, acceptanceRetry: false },
  blockedChecks: ['Nonzero A/B/A/native invalid seeks', 'Actual pre-copy and repeated-Bind regressions', 'C2 outcome and controlled denial', 'Keyboard/Escape/375px matrix', 'Own native PNG pair/stable export/contact sheet'],
  contactSheet: 'NOT_REACHED_NO_SYNTHETIC_SUBSTITUTE', screenshots: 'Actual failure captures and separately labelled initial native diagnostic; no UI40-43 acceptance image claim',
  originalREN12: 'FAIL_UNCHANGED_NOT_RERUN', visualAdoption: 'DEFER', gpuPerformanceArtProduct: 'NOT_RUN', wholeProgrammePackage: 'NOT_READY_RD51_RD52_LATER',
  cleanup: { diagnostic: diagCleanup, previewStopped: stopped, port5280Free: port, failedSuitePerTestRuntimeProof: 'INCOMPLETE: original five clicked Dispose then read failed; additive five capture-first hooks failed before Dispose; runner contexts closed', foreignTouched: false },
  nextAuthority: 'HEAD authorization for protected original facts-reader/disclosure correction and fresh native attempt; no source bug or new runtime freeze fabricated', review: 'SELF-DIFF; SUPPLIED-SO05-STATIC-FIXED-ZERO-ADDITIONAL; NO-NEW-INDEPENDENT-OR-HUMAN-REVIEW' };

if (mode === 'package') {
  if (gitRead(root, 'rev-parse', 'HEAD') !== start) { throw new Error('Package execution must remain on actual32'); }
  const copied = [];
  const copy = (file, relative) => {
    regular(file); const target = path.join(root, relative); mkdirSync(path.dirname(target), { recursive: true }); regular(path.dirname(target), true);
    const bytes = readFileSync(file); writeFileSync(target, bytes, { flag: 'wx' }); copied.push({ source: file, path: relative, sha256: sha(bytes), bytes: bytes.length });
  };
  for (const attempt of ['admission-a', 'admission-b', 'verify-a', 'verify-b', 'verify-c', 'verify-d', 'port-before-a', 'port-before-b', 'preview-a', 'preview-b', 'served-a', 'served-b', 'browser-a', 'browser-b', 'diagnostic-a', 'port-after-a']) {
    const sourceRoot = directory(`phase2-32e88a34-20261004-${attempt}`); const files = [];
    for (const name of readdirSync(sourceRoot)) {
      const file = path.join(sourceRoot, name);
      if (name === 'results') { walk(file, files); }
      else if (name !== 'temp' && name !== 'npm-cache' && !name.startsWith('stop-preview')) { regular(file); files.push(file); }
    }
    for (const file of files) { copy(file, `attempts/${attempt}/${path.relative(sourceRoot, file).replaceAll('\\', '/')}`); }
  }
  copy(path.join(diagnosticRoot, 'diagnostic-collapsed-ready.png'), 'captures/diagnostic-collapsed-ready.png');
  copy(path.join(diagnosticRoot, 'diagnostic-collapsed-ready.json'), 'captures/diagnostic-collapsed-ready.json');
  copy(receiptPath, 'manifests/HEAD-RECEIPT.json'); copy(freezePath, 'manifests/HEAD-FREEZE.json');
  json(path.join(root, 'results.json'), outcome); json(path.join(root, 'copied-manifest.json'), { copied, noAutomaticLogsReadOrCopied: true });
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>RD40 phase2 — BLOCKED</title><style>body{max-width:1000px;margin:2rem auto;padding:1rem;font:16px system-ui;background:#101719;color:#e4eeee}a{color:#9dd8e6}img{max-width:100%;height:auto}code{overflow-wrap:anywhere}</style><h1>RD40 phase2: native acceptance FAIL</h1><p>ProductIntegrated=false · RD40 slice only · RD51/RD52 wholeprogramme NOT_READY.</p><p>Original5 + additive5 executed: 0 PASS / 10 FAIL / 0 skip. Closed diagnostic details return empty innerText to the protected facts reader. Actual value/textContent contain matching native READY C0 facts. No source/oracle patch or acceptance retry.</p><ul><li><a href="results.json">Qualified results and cleanup</a></li><li><a href="receipt.json">Complete postcommit receipt</a></li><li><a href="copied-manifest.json">Exact copied bytes / SHA manifest</a></li><li><a href="attempts/browser-b/playwright-report.json">Actual ten-test native report</a> · <a href="attempts/browser-b/browser.log">raw failures</a></li><li><a href="attempts/browser-a/playwright-report.json">Earlier worker-config failure (not native)</a></li><li><a href="attempts/diagnostic-a/collapsed-facts-reproduction.json">Actual DOM reproduction</a> · <a href="attempts/diagnostic-a/diagnostic-runtime-cleanup.json">explicit owned cleanup</a></li><li><a href="attempts/served-b/served447.json">447 actual HTTP bodies</a></li><li><a href="manifests/HEAD-RECEIPT.json">immutable wired source/build</a></li></ul><h2>Separate initial native diagnostic, not UI40–43 acceptance</h2><p>C0 / F01 / tick0. No nonzero matrix, comparison pair or contact-sheet success; those are NOT_REACHED. REN12 FAIL / visual adoption DEFER; no qualified GPU/performance/art/product claim.</p><a href="captures/diagnostic-collapsed-ready.json">Same-runtime PNG facts/hash</a><img src="captures/diagnostic-collapsed-ready.png" alt="Actual initial READY C0 diagnostic, not acceptance evidence" loading="lazy"></html>`;
  writeFileSync(path.join(root, 'index.html'), html, { flag: 'wx' });
  const files = []; walk(root, files); const manifest = hashes(files, root);
  json(path.join(root, 'package-manifest.json'), { classification: 'BLOCKED-RD40-SLICE-NOT-WHOLEPROGRAMME', files: manifest, manifestSha256: sha(canonicalJson(manifest)) });
  console.log(JSON.stringify({ root, copied: copied.length, status: outcome.status, productIntegrated: false }));
} else {
  const head = gitRead(root, 'rev-parse', 'HEAD'); const candidateTree = gitRead(root, 'rev-parse', 'HEAD^{tree}');
  if (gitRead(root, 'rev-parse', 'HEAD^') !== start || gitRead(root, 'branch', '--show-current') !== 'feature/hestia-rd-rd40-phase2-2026-10-04'
    || gitRead(root, 'diff', '--name-only') || gitRead(root, 'diff', '--cached', '--name-only')) { throw new Error('Clean direct verification child of32 required'); }
  const changed = gitRead(root, 'diff', '--name-only', '-z', start, head).split('\0').filter(Boolean);
  if (changed.length !== 10 || changed.some((file) => !file.startsWith(prefix + 'reports/RD-40/') && file !== prefix + 'tests/RD-40/phase2-native.spec.ts')) { throw new Error('Only ten additive verification paths allowed'); }
  const status = gitRead(root, 'diff', '--name-status', start, head).split('\n'); if (status.some((row) => !row.startsWith('A\t'))) { throw new Error('Existing files must not change'); }
  if (run(root, 'postcommit-boundary', node, ['scripts/verify-boundary.mjs', '--task', 'RD-40', '--start', start, '--base', base]) !== 0) { throw new Error('Fresh full52 postcommit guard failed'); }
  const guard = readJson(path.join(root, 'postcommit-boundary.log')); if (!guard.ok || guard.inputHashesVerified !== 52 || guard.violations.length) { throw new Error('Original52 guard incomplete'); }
  const packageRoot = directory(packageId); const packageManifest = readJson(path.join(packageRoot, 'package-manifest.json'));
  for (const row of packageManifest.files) { regular(path.join(packageRoot, row.path)); if (sha(readFileSync(path.join(packageRoot, row.path))) !== row.sha256) { throw new Error('Retained package bytes changed'); } }
  const receipt = { schema: 'rd40-phase2-blocked-receipt-v1', ...outcome, candidateCommit: head, candidateTree, candidateParent: start,
    source21: data.source21, shared18: data.shared18, allStartFiles: { count: data.startFiles.length, sha256: sha(canonicalJson(data.startFiles)) }, original645: data.original645, original429: data.original429,
    public429: data.publicFiles, sourceBinding: source, built447: data.receipt.builtFiles, verification: { root: verification, commands, original20Passed: 20, unitJsonSha256: sha(readFileSync(path.join(verification, 'unit.json'))) },
    actualBrowser: { ...browser, durationMs: Date.parse(browser.ended) - Date.parse(browser.began), reportSha256: sha(readFileSync(path.join(browserRoot, 'playwright-report.json'))), statistics: report.stats },
    changedFiles: changed.map((file) => ({ path: file.slice(prefix.length), sha256: sha(readFileSync(path.resolve(lab, '../..', file))) })),
    guard: { original52: guard.inputHashesVerified, violations: guard.violations, originalAllFilesGate: guard.originalAllFilesGate, rawSha256: sha(readFileSync(path.join(root, 'postcommit-boundary.log'))) },
    package: { root: packageRoot, manifestSha256: sha(readFileSync(path.join(packageRoot, 'package-manifest.json'))), packageFiles: packageManifest.files.length } };
  json(path.join(root, 'receipt.json'), receipt); writeFileSync(path.join(packageRoot, 'receipt.json'), JSON.stringify(receipt, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ root, receiptSha256: sha(readFileSync(path.join(root, 'receipt.json'))), candidateCommit: head, candidateTree, packageRoot, status: outcome.status, productIntegrated: false }));
}
