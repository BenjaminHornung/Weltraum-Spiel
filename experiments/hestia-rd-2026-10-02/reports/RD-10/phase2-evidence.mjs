import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertIsolation, inspectBoundary } from '../../scripts/verify-boundary.mjs';

const lab = fileURLToPath(new URL('../../', import.meta.url)); const repo = path.resolve(lab, '../..');
const run = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-10'; const out = `${run}/phase2-84aeadb1-20261003`;
const start = '84aeadb11a2cf49acf83c8326f7eeac1898c6da9'; const tree = 'f8e0bbf253d13683b3570820196a90e954f681b1';
const base = 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e'; const origin = 'http://127.0.0.1:5280';
const entry = 'src/experiments/renderer-probe/index.html';
const gitPath = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const environment = { ...process.env, PATH: 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64;C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd;C:/IFI_SourceCode/Utils/PowerShell', TEMP: `${out}/temp`, TMP: `${out}/temp` };
const git = (...args) => execFileSync(gitPath, args, { cwd: repo, env: environment, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
const bytes = (file) => readFileSync(file); const sha = (data) => createHash('sha256').update(data).digest('hex');
const json = (file) => JSON.parse(bytes(file));
const write = (name, value) => writeFileSync(`${out}/${name}`, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
assertIsolation({ task: 'RD-10', runRoot: out });
function walk(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name); assert(!lstatSync(file).isSymbolicLink(), `No fixture/artifact links: ${file}`);
    if (entry.isDirectory()) { return walk(file); }
    assert(entry.isFile(), `Regular file required: ${file}`); return [file];
  }).sort();
}
function unchanged() {
  const baseline = json(`${out}/baseline.json`);
  for (const file of [...baseline.originalFiles, ...baseline.cards, ...baseline.productSelected]) { assert.equal(sha(bytes(path.join(lab, file.path))), file.sha256, file.path); }
  for (const file of baseline.shared) { assert.equal(sha(bytes(path.join(lab, file.path))), file.sha256, file.path); }
  for (const file of baseline.historicalArtifacts) { assert.equal(sha(bytes(file.path)), file.sha256, file.path); }
  for (const file of baseline.publicFiles) { assert.equal(sha(bytes(path.join(lab, 'fixtures', file.path))), file.sha256, file.path); }
  return baseline;
}
function disk() {
  const baseline = unchanged(); const dist = path.join(lab, 'dist'); const visited = new Set(); const graph = []; const inlineAssets = [];
  function visit(relative) {
    if (visited.has(relative)) { return; } visited.add(relative);
    const file = path.join(dist, relative); assert(!lstatSync(file).isSymbolicLink()); const data = bytes(file);
    graph.push({ path: relative, bytes: data.length, sha256: sha(data) });
    const text = data.toString();
    assert(!text.includes('/@vite/client'), 'Optimized graph must not include DEV client');
    const pattern = relative.endsWith('.html') ? /(?:src|href)=["']([^"']+)["']/g
      : /["']((?:\.\.?\/|\/)[^"'<>\s]+\.(?:js|css)(?:\?[^"'<>\s]*)?)["']/g;
    for (const match of text.matchAll(pattern)) {
      if (match[1] === 'data:,') { // Existing empty favicon: no network request or external media.
        inlineAssets.push({ owner: relative, value: match[1], sha256: sha(Buffer.from(match[1])), kind: 'EMPTY-DATA-FAVICON-NO-REQUEST' }); continue;
      }
      const url = new URL(match[1], `${origin}/${relative}`); assert.equal(url.origin, origin, 'No third-party assets');
      const target = decodeURIComponent(url.pathname).slice(1);
      assert(!path.relative(dist, path.resolve(dist, target)).startsWith('..'), 'Asset graph escape');
      if (/\.(js|css)$/.test(target)) { visit(target); }
    }
  }
  visit(entry); assert(graph.some((file) => file.path.endsWith('.js')), 'Real optimized JS must be referenced');
  assert(!bytes(path.join(dist, entry)).toString().includes('/main.ts'), 'Source alias is not optimized proof');
  for (const file of baseline.publicFiles) { const copied = bytes(path.join(dist, file.path)); assert.equal(copied.length, file.bytes); assert.equal(sha(copied), file.sha256, file.path); }
  return { class: 'OPTIMIZED', url: `${origin}/${entry}`, graph, inlineAssets, publicFiles: baseline.publicFiles, publicCount: baseline.publicFiles.length,
    sourceFactorySha256: sha(bytes(path.join(lab, 'src/experiments/renderer-probe/index.ts'))), shared: baseline.shared, productIntegrated: false };
}
async function http() {
  const built = json(`${out}/built.json`); const records = [];
  for (const file of [...built.graph, ...built.publicFiles]) {
    const url = `${origin}/${file.path}`; const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { 'Accept-Encoding': 'identity' } });
    assert.equal(response.status, 200, url); const data = new Uint8Array(await response.arrayBuffer());
    assert.equal(data.length, file.bytes, url); assert.equal(sha(data), file.sha256, url);
    records.push({ path: file.path, bytes: data.length, sha256: sha(data), status: response.status, contentType: response.headers.get('content-type') });
  }
  const label = process.env.HESTIA_RD10_COMMAND_LABEL; assert.match(label ?? '', /^[a-z0-9-]+$/);
  write(`http-${label}.json`, { class: 'OPTIMIZED', origin, checked: records.length, graphCount: built.graph.length, publicCount: built.publicFiles.length,
    builtSha256: sha(bytes(`${out}/built.json`)), records, productIntegrated: false });
  console.log(JSON.stringify({ status: 'PASS-OPTIMIZED-HTTP-BYTE-BINDINGS', graph: built.graph.length, public: built.publicFiles.length, productIntegrated: false }));
}
function commands() {
  return readdirSync(`${out}/commands`).sort().map((label) => {
    const directory = `${out}/commands/${label}`; const raw = bytes(`${directory}/raw.log`);
    const file = `${directory}/receipt.json`;
    if (existsSync(file)) {
      const record = json(file); assert.equal(record.logSha256, sha(raw)); assert.equal(record.logBytes, raw.length);
      return { ...record, receiptSha256: sha(bytes(file)), rawPath: `${directory}/raw.log` };
    }
    if (label.startsWith('preview-')) {
      const managed = json(`${out}/${label}-managed.json`); assert.equal(managed.status, 'cancelled'); assert.equal(managed.exitCode, 1);
      assert.equal(managed.cwd, lab.replaceAll('\\', '/').replace(/\/$/, ''));
      return { ...json(`${directory}/started.json`), managed, managedSha256: sha(bytes(`${out}/${label}-managed.json`)),
        logSha256: sha(raw), logBytes: raw.length, rawPath: `${directory}/raw.log`, qualification: 'OWNED-MANAGED-CANCEL-NOT-SERVER-PASS' };
    }
    // The calling report/verify/candidate command is still writing its own raw log; never hash that as complete evidence.
    assert.equal(label, process.env.HESTIA_RD10_COMMAND_LABEL, 'Every earlier command must have a completed or managed receipt'); return undefined;
  }).filter(Boolean);
}
function evidence() {
  const baseline = unchanged(); const built = json(`${out}/built.json`); assert.deepEqual(disk(), built);
  const http = json(`${out}/http-http-02.json`); assert.equal(http.builtSha256, sha(bytes(`${out}/built.json`)));
  assert.equal(http.checked, 434); assert.equal(http.publicCount, 429); assert.equal(http.graphCount, built.graph.length);
  for (const file of [...built.graph, ...built.publicFiles]) {
    const served = http.records.find((record) => record.path === file.path); assert(served); assert.equal(served.status, 200);
    assert.equal(served.sha256, file.sha256); assert.equal(served.bytes, file.bytes);
  }
  const browserRoot = `${run}/browser/phase2-browser-02`; assertIsolation({ task: 'RD-10', runRoot: browserRoot });
  const report = json(`${browserRoot}/report.json`); assert.equal(report.stats.expected, 6); assert.equal(report.stats.unexpected, 0);
  assert.equal(report.stats.skipped, 0); assert.equal(report.stats.flaky, 0); assert.deepEqual(report.errors, []);
  const files = walk(`${browserRoot}/results`); const find = (name) => {
    const matches = files.filter((file) => path.basename(file) === name); assert.equal(matches.length, 1, name); return matches[0];
  };
  const nativeFile = find('native-capability-diagnostic.json'); const native = json(nativeFile);
  assert.equal(native.buildClass, 'OPTIMIZED'); assert.equal(native.phase, 'PHASE2'); assert.equal(native.htmlSha256, built.graph[0].sha256);
  assert.equal(native.counts.planned, 2); assert.equal(native.counts.observed, native.reports.length); assert.equal(native.counts.skipped, 0);
  const supported = native.reports.filter((row) => row.status === 'supported').length;
  assert.equal(native.counts.failed, native.reports.filter((row) => row.status === 'failed').length);
  assert.equal(native.counts.unsupported, native.reports.filter((row) => row.status === 'unsupported').length);
  assert.equal(supported + native.counts.failed + native.counts.unsupported, native.counts.observed);
  for (const row of native.reports) {
    assert.equal(row.experimentId, 'RD-10'); assert.equal(row.variantId, `native-${row.mode}`); assert.equal(row.sourceRevision, row.frame.sourceRevision);
    assert.equal(row.frame.seconds, row.frame.tick / 60); assert.equal(row.targetQualified, false); assert.equal(row.productIntegrated, false);
    assert.equal(row.geometry, 'diagnostic-triangle-not-fixture-scene');
    for (const metric of Object.values(row.metrics)) { assert(!Object.hasOwn(metric, 'value'), 'Unavailable timing/bytes cannot be zero placeholders'); }
    if (row.status === 'supported') { assert.equal(row.backend, row.mode === 'webgpu' ? 'Native-WebGPU' : 'Native-WebGL2'); assert.equal(row.submissions, 1); }
  }
  assert.deepEqual(native.errors, []); for (const url of native.requests) { assert.equal(new URL(url).origin, origin); }
  const firstFailure = json(find('first-failure.json')); assert.equal(firstFailure.after.reason, firstFailure.first.reason);
  assert.match(firstFailure.after.reason, /phase2 controlled first compile failure/); assert.equal(firstFailure.stats.lossCalls, 1);
  assert(firstFailure.stats.lossEvents > 0); assert.equal(firstFailure.after.status, 'failed'); assert.equal(firstFailure.after.submissions, 0);
  assert(Object.values(firstFailure.after.liveOwned).every((value) => value === 0));
  const abort = json(find('abort-late-device.json')); assert.equal(abort.destroyed, 1); assert.equal(abort.requested, 1);
  assert.equal(abort.report.disposed, true); assert.notEqual(abort.report.status, 'supported'); assert.equal(abort.report.submissions, 0);
  assert(Object.values(abort.report.liveOwned).every((value) => value === 0));
  const media = files.filter((file) => file.endsWith('.png')).map((file) => ({ path: file, sha256: sha(bytes(file)), bytes: bytes(file).length,
    admission: existsSync(`${file}.admission.json`) ? json(`${file}.admission.json`) : undefined }));
  const captures = media.filter((file) => file.admission); assert.equal(captures.length, 3);
  for (const capture of captures) {
    assert.equal(capture.admission.point, 'PREWRITE-ADMITTED'); assert.equal(capture.admission.existed, false);
    assert.equal(capture.sha256, capture.admission.imageSha256); assert.equal(capture.bytes, capture.admission.imageBytes);
    assert.equal(path.resolve(capture.path), path.resolve(capture.admission.path));
  }
  for (const copy of media.filter((file) => !file.admission)) {
    assert(path.basename(path.dirname(copy.path)) === 'attachments', 'Only SDK attachment copies lack a new capture admission');
    assert(captures.some((capture) => capture.sha256 === copy.sha256), 'SDK image copies must equal admitted captures');
  }
  const commandRecords = commands(); const command = (label) => { const record = commandRecords.find((row) => row.label === label); assert(record, label); return record; };
  const red = command('admission-red-01'); const green = command('admission-green-01'); assert.equal(red.exitCode, 1); assert.equal(green.exitCode, 0);
  const unitPath = 'tests/RD-10/phase2/unit.test.ts';
  assert.equal(red.bindings.find((row) => row.path === unitPath).sha256, green.bindings.find((row) => row.path === unitPath).sha256);
  assert.equal(green.bindings.find((row) => row.path === unitPath).sha256, sha(bytes(path.join(lab, unitPath))));
  assert.match(bytes(red.rawPath).toString(), /1 failed \| 1 passed/); assert.match(bytes(green.rawPath).toString(), /2 passed/);
  assert.equal(command('phase2-browser-01').exitCode, 1); assert.equal(command('phase2-browser-02').exitCode, 0);
  assert.equal(command('port-after-preview-02').exitCode, 0);
  for (const file of ['src/experiments/renderer-probe/index.ts', 'src/experiments/renderer-probe/main.ts', 'src/experiments/renderer-probe/index.html',
    'tests/RD-10/unit.test.ts', 'tests/RD-10/browser.spec.ts', 'tests/RD-10/phase2-artifacts.ts', 'tests/RD-10/phase2.browser.spec.ts', 'tests/RD-10/phase2.playwright.config.ts']) {
    assert.equal(command('phase2-browser-02').bindings.find((row) => row.path === file).sha256, sha(bytes(path.join(lab, file))), file);
  }
  assert.equal(sha(bytes(baseline.browserBinary.path)), baseline.browserBinary.sha256);
  return { status: 'OPTIMIZED_FUNCTIONAL_EVIDENCE_READY_FOR_HEAD_RECHECK', start, tree, base,
    baseline: { path: `${out}/baseline.json`, sha256: sha(bytes(`${out}/baseline.json`)), installed: baseline.installed },
    freezeSha256: baseline.freezeSha256, shared: baseline.shared, sourceFactorySha256: built.sourceFactorySha256,
    originalUnit16Sha256: sha(bytes(path.join(lab, 'tests/RD-10/unit.test.ts'))),
    preserved: { originalOwned: 20, shared: 18, cards: 7, public: 429, historicalArtifacts: baseline.historicalArtifacts.length },
    graph: built.graph, inlineAssets: built.inlineAssets, http: { path: `${out}/http-http-02.json`, sha256: sha(bytes(`${out}/http-http-02.json`)), checked: 434 },
    browser: { binary: baseline.browserBinary, version: native.browserVersion, headless: true, viewport: native.viewport, dpr: native.dpr,
      reportSha256: sha(bytes(`${browserRoot}/report.json`)), counts: { planned: 6, observed: 6, passed: 6, failed: 0, skipped: 0, notRun: 0 },
      nativeRecord: { path: nativeFile, sha256: sha(bytes(nativeFile)) }, nativeModeCounts: { ...native.counts, supported }, reports: native.reports, media,
      ownedCycles: 12, cleanup: '6 task-owned contexts closed;12 fresh-canvas cycles include2 controlled failure/abort cases;mounts/owned logical resources zero after close,not native memory-free proof' },
    behavioralRedGreen: { red: { observed: 2, failed: 1, passed: 1, skipped: 0 }, green: { observed: 2, failed: 0, passed: 2, skipped: 0 }, unitPath,
      oracleSha256: green.bindings.find((row) => row.path === unitPath).sha256, faults: 'CPU guarded double: omit existing-leaf rejection; no actual file/link/global/Product mutation' },
    negativeEvidence: { firstFailure, abort, missingGpuCases: '3 original CAP01 fault cases;explicit unsupported/failed,no fallback',
      guardedApis: 'Selected storage/indexedDB/service-worker/same-origin requests plus product lock bytes;NOT exhaustive global audit' },
    commands: commandRecords, retainedFailures: { disk01: 'Empty inline favicon parser assumption,not behavior RED', browser01: 'Config worker reload before context setup:1 failed/5 not run,not native proof' },
    profileAvailability: { C0: 'Existing RD03 Three control only,NOT this native triangle', C1: 'NOT_IMPLEMENTED', C2: 'NOT_IMPLEMENTED', B: 'PENDING_HEAD_RD12_PIN_NOT_INSTALLED',
      comparisonFreezeSha256: sha(bytes(path.join(lab, 'reports/RD-10/comparison-freeze.json'))), sourceEvidenceSha256: sha(bytes(path.join(lab, 'reports/RD-10/source-evidence.json'))) },
    cleanup: { previews: ['preview-01', 'preview-02'].map((label) => ({ path: `${out}/${label}-managed.json`, sha256: sha(bytes(`${out}/${label}-managed.json`)), ...json(`${out}/${label}-managed.json`) })),
      port5280: 'PASS_FREE_AFTER_PREVIEW02;fresh closing check recorded separately', artifacts: 'Retained,no deletion', foreignCleanup: false },
    review: { self: '3 admitted screenshots inspected;final diff review recorded in closeout/candidate', independentPhase2: 'NOT_RUN_LEAF_HEAD_REVIEW_PENDING' },
    qualifications: { Q1: 'NOT_RUN', Q2: 'NOT_RUN', targetGpu: 'NOT_RUN_NO_QUALIFIED_LEASE', performance: 'NOT_RUN', art: 'NOT_RUN', productAcceptance: 'NOT_RUN',
      gpuMs: 'NOT_RUN_NO_VALUE', nativeGpuBytes: 'UNSUPPORTED_NO_VALUE', limits: 'DEVICE_DECLARED_CAPS_NOT_MEASURED_PERFORMANCE_OR_MEMORY_USE',
      geometry: 'DIAGNOSTIC_TRIANGLE_NOT_FIXTURE_OR_C0_C1_C2_COMPARISON' }, productIntegrated: false };
}
const mode = process.argv[2];
if (mode === 'preflight') {
  assert.equal(git('rev-parse', 'HEAD'), start); assert.equal(git('show', '-s', '--format=%T', 'HEAD'), tree);
  assert.equal(git('branch', '--show-current'), 'feature/hestia-rd-rd10-phase2-2026-10-02');
  const freezeFile = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/freezes/${start}.json`;
  const current = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/CURRENT_FREEZE.json';
  assert.equal(sha(bytes(current)), sha(bytes(freezeFile))); const freeze = json(freezeFile); assert.equal(freeze.frozenFiles.length, 18);
  for (const file of freeze.frozenFiles) { assert.equal(sha(bytes(path.join(lab, file.path))), file.sha256); }
  const originalPaths = git('ls-files', '--', 'experiments/hestia-rd-2026-10-02/src/experiments/renderer-probe', 'experiments/hestia-rd-2026-10-02/tests/RD-10', 'experiments/hestia-rd-2026-10-02/reports/RD-10').split('\n');
  assert.equal(originalPaths.length, 20);
  const originalFiles = originalPaths.map((relative) => ({ path: path.relative(lab, path.join(repo, relative)).replaceAll('\\', '/'), sha256: sha(bytes(path.join(repo, relative))) }));
  const cards = Array.from({ length: 7 }, (_, index) => `reference-cards/RR-0${index + 1}.json`).map((relative) => ({ path: relative, sha256: sha(bytes(path.join(lab, relative))) }));
  const publicFiles = walk(path.join(lab, 'fixtures')).map((file) => ({ path: path.relative(path.join(lab, 'fixtures'), file).replaceAll('\\', '/'), bytes: bytes(file).length, sha256: sha(bytes(file)) }));
  assert.equal(publicFiles.length, 429); assert.equal(sha(bytes(path.join(lab, 'fixtures/inventory.json'))), freeze.currentFixtureInventorySha256);
  const historical = [`${run}/candidate.json`, `${run}/repair-first-failure-20261003/receipt.json`, `${run}/repair-first-failure-20261003/baseline.json`, `${run}/repair-first-failure-20261003/factory-before.ts`, `${run}/repair-first-failure-20261003/unit-before.ts`];
  const original = json(`${run}/candidate.json`); const repair = json(`${run}/repair-first-failure-20261003/receipt.json`);
  for (const command of [...original.commands, ...original.closingChecks, ...repair.commands]) {
    historical.push(`${run}/commands/${command.label}/receipt.json`, `${run}/commands/${command.label}/raw.log`);
  }
  historical.push(`${run}/repair-first-failure-20261003/commit-command.json`, `${run}/repair-first-failure-20261003/commit.raw.log`);
  for (const source of json(path.join(lab, 'reports/RD-10/source-evidence.json')).sources) { historical.push(`${run}/${source.retainedRaw}`); }
  const integrationFile = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/RD10-PHASE1-INTEGRATION.json';
  historical.push(freezeFile, integrationFile);
  write('baseline.json', { start, tree, branch: git('branch', '--show-current'), base, freezeSha256: sha(bytes(freezeFile)), currentFreezeSha256: sha(bytes(current)),
    shared: freeze.frozenFiles, originalFiles, cards, publicFiles, historicalArtifacts: [...new Set(historical)].map((file) => ({ path: file, sha256: sha(bytes(file)) })),
    productSelected: [{ path: '../../apps/weltraum-browser/package-lock.json', sha256: sha(bytes(path.join(repo, 'apps/weltraum-browser/package-lock.json'))) }],
    browserBinary: { path: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe', sha256: sha(bytes('C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe')) },
    installed: ['three', 'typescript', 'vite', 'vitest', '@playwright/test'].map((name) => ({ name, version: json(path.join(lab, 'node_modules', name, 'package.json')).version })),
    productIntegrated: false });
  console.log('PASS: new SHA/tree/branch,18shared,CURRENT equality,20original owned files,7cards,429public and historical evidence bound');
} else if (mode === 'disk') {
  const built = disk(); write('built.json', built); console.log(JSON.stringify({ status: 'PASS-REAL-RD10-OPTIMIZED-DIST', graph: built.graph, publicCount: built.publicCount, productIntegrated: false }, null, 2));
} else if (mode === 'http') { await http();
} else if (mode === 'verify') {
  const proof = evidence(); console.log(JSON.stringify({ status: 'PASS', preserved: proof.preserved, browser: proof.browser.counts, native: proof.browser.nativeModeCounts, productIntegrated: false }));
} else if (mode === 'report') {
  const proof = evidence(); writeFileSync(path.join(lab, 'reports/RD-10/capability-report-phase2-20261003.json'), `${JSON.stringify(proof, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ status: proof.status, graph: proof.graph.length, browser: proof.browser.counts, native: proof.browser.nativeModeCounts, productIntegrated: false }));
} else if (mode === 'candidate') {
  const proof = evidence(); const head = git('rev-parse', 'HEAD'); const parent = git('show', '-s', '--format=%P', 'HEAD'); assert.equal(parent, start);
  assert.equal(git('branch', '--show-current'), 'feature/hestia-rd-rd10-phase2-2026-10-02'); git('diff', '--exit-code', 'HEAD');
  const gitStatus = git('status', '--porcelain', '--untracked-files=all');
  const acceptedLogs = ['.opencode/throughput.jsonl', '.opencode/throughput.md', 'experiments/hestia-rd-2026-10-02/.opencode/throughput.jsonl', 'experiments/hestia-rd-2026-10-02/.opencode/throughput.md'];
  for (const line of gitStatus.split('\n').filter(Boolean)) { assert(line.startsWith('?? ') && acceptedLogs.includes(line.slice(3)), `Unexpected postcommit status: ${line}`); }
  const changed = git('diff', '--name-only', start, 'HEAD').split('\n'); const prefix = 'experiments/hestia-rd-2026-10-02/';
  for (const file of changed) { assert(['src/experiments/renderer-probe/', 'tests/RD-10/', 'reports/RD-10/'].some((area) => file.startsWith(`${prefix}${area}`))); }
  const boundary = inspectBoundary({ repoRoot: repo, base, start, task: 'RD-10', gitPath }); assert(boundary.ok, JSON.stringify(boundary.violations));
  const report = path.join(lab, 'reports/RD-10/capability-report-phase2-20261003.json');
  const published = json(report);
  for (const key of ['shared', 'graph', 'browser', 'negativeEvidence', 'behavioralRedGreen', 'profileAvailability', 'qualifications']) { assert.deepEqual(published[key], proof[key], `Published ${key} binding`); }
  write('candidate.json', { status: 'READY_FOR_HEAD_OPTIMIZED_RECHECK_AND_INTEGRATION', head, tree: git('show', '-s', '--format=%T', 'HEAD'), parent,
    branch: git('branch', '--show-current'), source: base, changed: changed.map((file) => ({ path: file, sha256: sha(bytes(path.join(repo, file))) })),
    reportSha256: sha(bytes(report)), report: path.relative(repo, report).replaceAll('\\', '/'), gitStatus, boundary, proof,
    review: { self: 'PASS_FINAL_DIFF_AND3_ADMITTED_SCREENSHOTS', independentPhase2: 'NOT_RUN_LEAF_HEAD_REVIEW_PENDING' }, publication: 'NOT_RUN', productIntegrated: false });
  console.log(JSON.stringify({ status: 'READY_FOR_HEAD_OPTIMIZED_RECHECK_AND_INTEGRATION', head, tree: git('show', '-s', '--format=%T', 'HEAD'), parent, paths: changed.length,
    guardInputs: boundary.inputHashesVerified, violations: boundary.violations.length, productIntegrated: false }));
} else { throw new Error('Expected preflight/disk/http/verify/report/candidate'); }
