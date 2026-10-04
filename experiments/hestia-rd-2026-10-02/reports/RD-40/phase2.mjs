import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, watch, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from '../../src/contracts/validation.ts';
import { assertIsolation, assertPortFree } from '../../scripts/verify-boundary.mjs';
import { lab, git, node, sha, environment, run } from './phase1.mjs';

export { lab, git, node, sha };
export const start = '32e88a34f417ae4f92fa7ed278e772846928eaf5';
export const tree = 'a0c26c6d7e530f70dae8326eb50115b4aa92781c';
export const base = 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e';
export const receiptPath = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/RD40-PHASE2-HEAD-RECEIPT-32e88a34.json';
export const receiptHash = '00fee3e3fece1fa317a6ec8f63167d565b137b33fc7ced6a5e0da184165292f0';
export const freezePath = `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/HEAD/freezes/${start}.json`;
export const freezeHash = '2310ee20028cfa52e0150dffc37bb74d24620ed5f925ea625a97285353e86aa3';
export const chrome = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe';
export const prefix = 'experiments/hestia-rd-2026-10-02/';
export const verificationParent = '453bbbf680e32352accd2255aea50a52dfdb9b61';
export const readerOracles = [
  { path: 'tests/RD-40/browser.spec.ts', oldSha256: '91c06b7e1bdb0002a110a5e44563454bc36af701347e64e0f28baa03fafb5440', newSha256: 'be1dad08c168160e8faffa4cef034e1235171a114b26628a8a8735ad9a138dcd' },
  { path: 'tests/RD-40/phase2-native.spec.ts', oldSha256: '1653aa5dd772b06d05eba454fd948d6fcb8c57700cb7da8a2b37811c1118d1a9', newSha256: 'ab15639b7db4c5f084704f39d99f9bfa72a11547092be7f580a5cf5c067405b6' },
];
export function oracleReadRepair(root) {
  for (const row of readerOracles) {
    const old = execFileSync(git, ['show', `${verificationParent}:${prefix}${row.path}`], { cwd: lab, env: environment(root) });
    regular(path.join(lab, row.path));
    if (sha(old) !== row.oldSha256 || sha(readFileSync(path.join(lab, row.path))) !== row.newSha256) { throw new Error(`Only declared reader/cleanup/regression delta admitted: ${row.path}`); }
  }
  const exactDiff = gitRead(root, 'diff', '--no-ext-diff', '--no-renames', '--unified=3', verificationParent, '--', ...readerOracles.map((row) => row.path));
  return { authorization: 'HEAD narrow facts-reader repair, one native regression and verification-only cleanup', verificationParent, oracles: readerOracles,
    originalTenFlowsAssertionsTimeoutsUnchanged: true, injectedFactsOrDetailsState: false, exactDiff, exactDiffSha256: sha(exactDiff) };
}
export function directory(id) {
  if (!/^phase2-32e88a34-20261004-[a-z0-9-]+$/.test(id)) { throw new Error('Fresh phase2 ID required'); }
  return `C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-40/${id}`;
}
export function regular(file, directoryOnly = false) {
  if (!/^C:[/\\]IFI_SourceCode[/\\]/i.test(path.resolve(file))) { throw new Error('C-only path required'); }
  for (let cursor = path.resolve(file); cursor !== path.dirname(cursor); cursor = path.dirname(cursor)) {
    const stat = lstatSync(cursor, { throwIfNoEntry: false });
    if (stat && (stat.isSymbolicLink() || (cursor !== path.resolve(file) && !stat.isDirectory()))) { throw new Error(`Link/non-directory ancestor: ${cursor}`); }
  }
  const stat = lstatSync(file);
  if (directoryOnly ? !stat.isDirectory() : !stat.isFile()) { throw new Error(`Wrong path type: ${file}`); }
  if (realpathSync(file).toLowerCase() !== path.resolve(file).toLowerCase()) { throw new Error(`Reparse path forbidden: ${file}`); }
}
export function fresh(id) {
  const root = directory(id); assertIsolation({ task: 'RD-40', runRoot: root });
  if (existsSync(root)) { throw new Error('Retain prior attempt; choose fresh ID'); }
  mkdirSync(root); regular(root, true); return root;
}
export function json(file, value) { writeFileSync(file, JSON.stringify({ productIntegrated: false, ...value }, null, 2), { flag: 'wx' }); }
export function checked(file, hash) { regular(file); const bytes = readFileSync(file); if (sha(bytes) !== hash) { throw new Error(`Pinned bytes changed: ${file}`); } return JSON.parse(bytes); }
export function gitRead(root, ...args) { return execFileSync(git, args, { cwd: lab, env: environment(root), maxBuffer: 32 * 1024 * 1024 }).toString().trim(); }
function unitRun(root, args) {
  const env = environment(root); delete env.RD40_CPU_EVIDENCE_ROOT; env.RD40_PHASE2_CPU_ROOT = root;
  const began = new Date().toISOString(); const result = spawnSync(node, args, { cwd: lab, env, timeout: 180_000, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const bytes = Buffer.from(`${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`);
  writeFileSync(path.join(root, 'focused-unit.log'), bytes, { flag: 'wx' });
  const receipt = { binary: node, args, cwd: lab, began, ended: new Date().toISOString(), exitCode: result.status, signal: result.signal, logSha256: sha(bytes),
    original20Unchanged: true, originalOptionalPhase1Emitter: 'NOT_APPLICABLE-PHASE2-PATH', equivalentDiskSelfCssProof: 'phase2-source-proof.ts', phase2CpuRoot: root };
  json(path.join(root, 'focused-unit.json'), receipt); console.log(JSON.stringify(receipt)); console.log(bytes.toString()); return result.status ?? 1;
}
export function inventory(root) {
  const receipt = checked(receiptPath, receiptHash); const freeze = checked(freezePath, freezeHash);
  const readerRepair = oracleReadRepair(root);
  const baseline = checked(path.join(directory('phase2-32e88a34-20261004-reader-repair-preedit-a'), 'preedit.json'), 'd40f41953e2eae297bb2ab06bb11ae4a97d1dc6e2c649efbe1f9fce1e912338d');
  if (receipt.sourceCommit !== start || receipt.sourceTree !== tree || freeze.start !== start || freeze.tree !== tree
    || receipt.productIntegrated !== false || !receipt.entryWired || !receipt.port5280Released) { throw new Error('Immutable phase2 admission mismatch'); }
  if (gitRead(root, 'rev-parse', `${start}^{tree}`) !== tree) { throw new Error('START tree mismatch'); }
  const scoped = gitRead(root, 'ls-tree', '-r', '--full-name', '--name-only', start, '--', 'src/tools/variant-gallery', 'tests/RD-40', 'reports/RD-40').split('\n');
  const source21 = scoped.map((file) => {
    const relative = file.slice(prefix.length); const full = path.join(lab, relative); regular(full);
    const expected = execFileSync(git, ['show', `${start}:${file}`], { cwd: lab, env: environment(root) });
    const actual = sha(readFileSync(full)); const admitted = readerOracles.find((row) => row.path === relative);
    if (admitted ? sha(expected) !== admitted.oldSha256 || actual !== admitted.newSha256 : actual !== sha(expected)) { throw new Error(`Source21 changed outside exact oracle admission: ${relative}`); }
    return { path: relative, sha256: actual };
  });
  if (source21.length !== 21 || receipt.shared18.length !== 18 || canonicalJson(receipt.shared18) !== canonicalJson(freeze.frozenFiles)) { throw new Error('Source21/shared18 inventory incomplete'); }
  for (const row of receipt.shared18) { regular(path.join(lab, row.path)); if (sha(readFileSync(path.join(lab, row.path))) !== row.sha256) { throw new Error(`Shared18 changed: ${row.path}`); } }
  regular(receipt.buildRoot, true);
  for (const row of receipt.builtFiles) {
    const file = path.join(receipt.buildRoot, row.path); regular(file);
    if (sha(readFileSync(file)) !== row.sha256) { throw new Error(`Built bytes changed: ${row.path}`); }
  }
  if (receipt.builtFiles.length !== 447 || sha(canonicalJson(receipt.builtFiles)) !== receipt.buildDigest) { throw new Error('Build447 identity mismatch'); }
  const builtPaths = [];
  function walkBuild(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { regular(full, true); walkBuild(full); }
      else { regular(full); builtPaths.push(path.relative(receipt.buildRoot, full).replaceAll('\\', '/')); }
    }
  }
  walkBuild(receipt.buildRoot);
  if (canonicalJson(builtPaths.sort()) !== canonicalJson(receipt.builtFiles.map((row) => row.path).sort())) { throw new Error('Extra/missing actual build files'); }
  const publicFiles = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name); if (entry.isDirectory()) { regular(file, true); walk(file); }
      else { regular(file); const relative = path.relative(path.join(lab, 'fixtures'), file).replaceAll('\\', '/'); const hash = sha(readFileSync(file));
        if (receipt.builtFiles.find((row) => row.path === relative)?.sha256 !== hash) { throw new Error(`Public bytes changed: ${relative}`); }
        publicFiles.push({ path: relative, sha256: hash }); }
    }
  }
  walk(path.join(lab, 'fixtures')); if (publicFiles.length !== 429) { throw new Error('Public429 incomplete'); }
  const sourcePaths = ['src/registration.ts', 'package-lock.json', 'reference-cards/index.json', 'reference-cards/concepts.json'];
  for (const dir of ['src/contracts', 'src/runner', 'src/experiments/three-control', 'src/experiments/three-webgpu', 'src/tools/variant-gallery']) {
    for (const name of readdirSync(path.join(lab, dir))) { if (name.endsWith('.ts') || (dir.endsWith('variant-gallery') && (name.endsWith('.css') || name === 'index.html'))) { sourcePaths.push(`${dir}/${name}`); } }
  }
  const sourceFiles = sourcePaths.sort().map((file) => ({ path: file, sha256: sha(readFileSync(path.join(lab, file))) }));
  if (sha(canonicalJson(sourceFiles)) !== receipt.sourceBytesDigest) { throw new Error('Actual disk/self/CSS source binding mismatch'); }
  const original = checked('C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-40/c5317835-phase1-20261004-candidate-a/receipt.json', '42715dbfb5467b97433959c07918f846670c44f92610020c753a384cd3c7f2db');
  for (const row of original.immutableStart.files) {
    const expected = receipt.shared18.find((shared) => shared.path === row.path)?.sha256 ?? row.sha256;
    regular(path.join(lab, row.path)); if (sha(readFileSync(path.join(lab, row.path))) !== expected) { throw new Error(`Original START bytes changed: ${row.path}`); }
  }
  const startFiles = gitRead(root, 'ls-tree', '-r', '--full-name', '--name-only', start, '--', '.').split('\n').map((file) => {
    const relative = file.slice(prefix.length); regular(path.join(lab, relative)); return { path: relative, sha256: sha(readFileSync(path.join(lab, relative))) };
  });
  if (startFiles.length !== 672 || baseline.startFiles.length !== 672) { throw new Error('Complete START672 inventory required'); }
  for (const row of baseline.startFiles) {
    const admitted = readerOracles.find((oracle) => oracle.path === row.path);
    const expected = admitted ? admitted.newSha256 : row.sha256;
    if ((admitted && row.sha256 !== admitted.oldSha256) || startFiles.find((current) => current.path === row.path)?.sha256 !== expected) { throw new Error(`START672 changed outside exact oracle admission: ${row.path}`); }
  }
  regular(chrome);
  return { receipt, source21, sourceFiles, publicFiles, startFiles, shared18: receipt.shared18, original645: original.immutableStart.sha256,
    originalSource21: baseline.source21, originalStart672: baseline.startFiles, readerRepair,
    original429: original.fixtureMedia.sha256, browserExecutable: chrome, browserExecutableSha256: sha(readFileSync(chrome)) };
}
export async function served(root) {
  const { receipt } = inventory(root); const responses = [];
  for (const row of receipt.builtFiles) {
    const url = new URL(row.path, 'http://127.0.0.1:5280/'); const response = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    const bytes = new Uint8Array(await response.arrayBuffer()); const actual = sha(bytes);
    if (response.status !== 200 || actual !== row.sha256) { throw new Error(`Actual HTTP body mismatch: ${row.path}`); }
    responses.push({ path: row.path, url: url.href, status: response.status, bytes: bytes.length, sha256: actual, contentType: response.headers.get('content-type') });
  }
  const response = await fetch('http://127.0.0.1:5280/', { signal: AbortSignal.timeout(10_000) }); const rootBytes = new Uint8Array(await response.arrayBuffer());
  if (response.status !== 200 || sha(rootBytes) !== receipt.builtFiles.find((row) => row.path === 'index.html')?.sha256) { throw new Error('Visible root HTML mismatch'); }
  json(path.join(root, 'served447.json'), { sourceCommit: start, sourceTree: tree, buildDigest: receipt.buildDigest,
    receiptSha256: receiptHash, actualHttpResponses: responses.length, responses, root: { status: response.status, sha256: sha(rootBytes) } });
}
const [action, id, otherId] = process.argv.slice(2);
let outputRoot;
try {
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = action === 'stop' ? directory(id) : fresh(id);
  if (action !== 'stop') { outputRoot = root; }
  const data = inventory(root);
  if (['admission', 'verify', 'preview', 'browser'].includes(action) && gitRead(root, 'rev-parse', 'HEAD') !== verificationParent) { throw new Error('Actual verification parent453 required; built source remains32'); }
  if (action === 'admission') {
    json(path.join(root, 'admission.json'), { phase: 'RD40-PHASE2', taskStart: start, actualHead: gitRead(root, 'rev-parse', 'HEAD'), actualTree: gitRead(root, 'rev-parse', 'HEAD^{tree}'),
      freeze: { path: freezePath, sha256: freezeHash }, receipt: { path: receiptPath, sha256: receiptHash }, ...data });
    process.exitCode = run(root, 'boundary', node, ['scripts/verify-boundary.mjs', '--task', 'RD-40', '--start', start, '--base', base]);
  } else if (action === 'verify') {
    for (const [name, binary, args] of [
      ['root-types', path.join(lab, 'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe'), ['--noEmit', '-p', 'tsconfig.json']],
      ['focused-types', path.join(lab, 'node_modules/@typescript/typescript-win32-x64/lib/tsc.exe'), ['--noEmit', '-p', 'reports/RD-40/tsconfig.phase2.json']],
      ['focused-unit', node, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'reports/RD-40/vitest.phase2.config.ts', 'tests/RD-40/unit.test.ts', 'tests/RD-40/repair.test.ts', '--reporter=json', `--outputFile=${path.join(root, 'unit.json')}`]],
      ['boundary', node, ['scripts/verify-boundary.mjs', '--task', 'RD-40', '--start', start, '--base', base]],
    ]) { const exit = name === 'focused-unit' ? unitRun(root, args) : run(root, name, binary, args); if (exit !== 0) { process.exitCode = exit; break; } }
    json(path.join(root, 'protected.json'), { phase: 'RD40-PHASE2', taskStart: start, ...data });
  } else if (action === 'port') {
    await assertPortFree(); json(path.join(root, 'port-free.json'), { host: '127.0.0.1', port: 5280, exclusiveBindAndClose: true, readiness: false });
  } else if (action === 'served') { await served(root);
  } else if (action === 'preview') {
    await assertPortFree(); Object.assign(process.env, environment(root));
    const { preview } = await import('vite');
    const server = await preview({ configFile: path.join(lab, 'vite.config.ts'), configLoader: 'native', build: { outDir: data.receipt.buildRoot }, preview: { host: '127.0.0.1', port: 5280, strictPort: true, open: false } });
    json(path.join(root, 'preview.json'), { pid: process.pid, host: '127.0.0.1', port: 5280, sourceCommit: start, sourceTree: tree, buildRoot: data.receipt.buildRoot, buildDigest: data.receipt.buildDigest,
      started: new Date().toISOString(), deadlineMs: 900_000, executable: node, arguments: process.argv.slice(1) });
    let closing = false; const stop = async (reason) => {
      if (closing) { return; } closing = true; watcher.close(); clearTimeout(deadline);
      await new Promise((resolve, reject) => { server.httpServer.close((error) => { if (error) { reject(error); } else { resolve(); } }); server.httpServer.closeAllConnections(); });
      json(path.join(root, 'preview-stopped.json'), { pid: process.pid, stopped: new Date().toISOString(), reason, ownedOnly: true }); console.log('RD40_PHASE2_PREVIEW_STOPPED');
    };
    const watcher = watch(root, () => { if (existsSync(path.join(root, 'stop-preview'))) { void stop('Owned stop marker'); } });
    const deadline = setTimeout(() => { void stop('Bounded deadline'); }, 900_000);
    process.once('SIGINT', () => { void stop('Owned SIGINT'); }); process.once('SIGTERM', () => { void stop('Owned SIGTERM'); });
    console.log('RD40_PHASE2_PREVIEW_READY');
  } else if (action === 'stop') { writeFileSync(path.join(root, 'stop-preview'), 'Stop only this owned preview\n', { flag: 'wx' });
  } else if (action === 'browser') {
    // Only the launcher can admit a fresh output directory. Playwright re-imports config in each worker after creating it.
    if (existsSync(path.join(root, 'results')) || existsSync(path.join(root, 'playwright-report.json'))) { throw new Error('Never overwrite an earlier browser attempt'); }
    const servedRoot = directory(otherId); const proof = JSON.parse(readFileSync(path.join(servedRoot, 'served447.json')));
    if (proof.sourceCommit !== start || proof.buildDigest !== data.receipt.buildDigest || proof.actualHttpResponses !== 447) { throw new Error('Actual served447 proof required before browser'); }
    const env = { ...environment(root), RD40_PHASE2_RUN_ROOT: root, RD40_PHASE2_SERVED_RECEIPT: path.join(servedRoot, 'served447.json'),
      HESTIA_RD_TASK: 'RD-40', HESTIA_RD40_PHASE2_BROWSER_GRANTED: '1', HESTIA_RD40_HEAD_RECEIPT: receiptPath,
      HESTIA_RD40_HEAD_RECEIPT_SHA256: receiptHash, WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH: chrome.replaceAll('/', '\\') };
    const args = ['node_modules/@playwright/test/cli.js', 'test', '--config', 'reports/RD-40/playwright.phase2.config.ts'];
    const began = new Date().toISOString(); const result = spawnSync(node, args, { cwd: lab, env, timeout: 600_000, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const bytes = Buffer.from(`${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`);
    writeFileSync(path.join(root, 'browser.log'), bytes, { flag: 'wx' }); json(path.join(root, 'browser-command.json'), { binary: node, args, cwd: lab, began, ended: new Date().toISOString(), exitCode: result.status, signal: result.signal,
      logSha256: sha(bytes), sourceCommit: start, sourceTree: tree, buildDigest: data.receipt.buildDigest, servedReceipt: env.RD40_PHASE2_SERVED_RECEIPT, servedReceiptSha256: sha(readFileSync(env.RD40_PHASE2_SERVED_RECEIPT)),
      browserExecutable: chrome, browserExecutableSha256: data.browserExecutableSha256, env: Object.fromEntries(Object.entries(env).filter(([key]) => /^(RD40_|HESTIA_|WELTRAUM_)/.test(key))) });
    console.log(bytes.toString()); process.exitCode = result.status ?? 1;
  } else { throw new Error('Unknown phase2 action'); }
}
} catch (error) {
  const bytes = Buffer.from(`${error.stack ?? String(error)}\nNode.js ${process.version}\n`);
  if (outputRoot) {
    writeFileSync(path.join(outputRoot, 'driver-error.log'), bytes, { flag: 'wx' });
    json(path.join(outputRoot, 'driver-error.json'), { binary: node, args: process.argv.slice(1), cwd: lab, exitCode: 1, logSha256: sha(bytes), classification: 'PRESERVED-ATTEMPT-ERROR' });
  }
  console.error(error); process.exitCode = 1;
}
