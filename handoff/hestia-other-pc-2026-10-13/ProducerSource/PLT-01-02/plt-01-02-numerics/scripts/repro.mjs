import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { startProbeServer } from './server.mjs';
import { sampleQuery } from '../src/fixture.mjs';
import { bindQuery } from '../web/probe.mjs';
import { validateBrowserReport, validateServedBindings } from '../src/report-validation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };
const runId = option('--run-id', new Date().toISOString().replace(/[:.]/g, '-'));
if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error('INVALID_RUN_ID');
const out = resolve(root, 'tests/runs', runId);
mkdirSync(resolve(root, 'tests/runs'), { recursive: true });
mkdirSync(out, { recursive: false }); // EEXIST prevents historical evidence replacement.
const selected = option('--browser', 'both');
if (!['both', 'chromium', 'firefox', 'none'].includes(selected)) throw new Error('INVALID_BROWSER');
const browserPaths = {
  chromium: option('--chromium', 'C:/Program Files/Google/Chrome/Application/chrome.exe'),
  firefox: option('--firefox', 'C:/Program Files/Mozilla Firefox/firefox.exe')
};
const summary = { runId, environment: 'LOCAL_WINDOWS_ISOLATED', purpose: 'FUNCTIONAL_DIAGNOSTIC',
  node: process.version, architecture: process.arch, hostLoad: 'CONCURRENT_SESSIONS_UNCONTROLLED', commands: [], browsers: [] };
function check(name, command, commandArgs) {
  const started = Date.now();
  const result = spawnSync(command, commandArgs, { cwd: root, windowsHide: true, encoding: 'utf8' });
  writeFileSync(resolve(out, name + '.log'), (result.stdout || '') + (result.stderr || '') + (result.error ? String(result.error) : ''));
  summary.commands.push({ name, command: [command, ...commandArgs], exitCode: result.status, elapsedMs: Date.now() - started });
  if (result.status !== 0) throw new Error(name + ' failed: ' + result.status);
}
try {
  if (!args.includes('--skip-build')) check('build', process.execPath, ['scripts/build.mjs']);
  const digest = path => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
  const list = folder => readdirSync(resolve(root, folder), { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? list(folder + '/' + entry.name) : [folder + '/' + entry.name]);
  const servedPaths = ['NumericsProfile.json', ...['src', 'web', 'snapshot', 'fixtures', 'wasm'].flatMap(list)];
  summary.servedBindings = validateServedBindings(servedPaths.map(path => ({ path, sourceDigest: digest(path), servedDigest: digest('dist/' + path) })));
  check('unit', process.execPath, ['--test', 'tests/integration.test.mjs', 'tests/numerics.test.mjs']);
  const numericProfile = JSON.parse(readFileSync(resolve(root, 'NumericsProfile.json')));
  summary.profileDigest = numericProfile.contentDigest;
  const queries = JSON.parse(readFileSync(resolve(root, 'fixtures/queries.json')));
  const expectedOutputs = [];
  for (let i = 0; i < queries.length; ++i) {
    const result = await sampleQuery(bindQuery(queries[i], numericProfile, i), numericProfile);
    expectedOutputs.push({ hex: result.canonicalHex, digest: result.snapshotDigest });
  }
  const wasmBindings = JSON.parse(readFileSync(resolve(root, 'wasm/bindings.json'))).bindings;
  summary.sourceBindings = ['src/numerics.mjs', 'src/fixture.mjs', 'src/wasm-loader.mjs', 'web/probe.mjs', 'web/worker.mjs',
    'src/report-validation.mjs', 'web/index.html', 'scripts/server.mjs', 'scripts/repro.mjs', 'scripts/build.mjs', 'scripts/seal.mjs',
    'scripts/generate-goldens.py', 'scripts/prepare-rust.ps1', 'tests/integration.test.mjs', 'tests/numerics.test.mjs',
    'package.json', 'package-lock.json', 'dependencies.lock.json', 'SourceBindings.json', 'snapshot/time.ts', 'snapshot/time.mjs', 'snapshot/ids.ts', 'snapshot/manifest.json',
    'wasm/kernel.rs', 'wasm/bindings.json', 'fixtures/queries.json', 'fixtures/rng-kat.json', 'fixtures/smoothstep-goldens.json', 'wasm/scalar.wasm', 'wasm/simd.wasm']
    .map(path => ({ path, sha256: createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex') }));
  for (const browser of selected === 'both' ? ['chromium', 'firefox'] : selected === 'none' ? [] : [selected]) {
    if (!existsSync(browserPaths[browser])) { summary.browsers.push({ browser, status: 'NOT_RUN', reason: 'BINARY_UNAVAILABLE' }); continue; }
    for (const mode of ['none', 'require-corp', 'credentialless']) {
      const profile = resolve(root, '.runtime', runId, browser + '-' + mode);
      mkdirSync(profile, { recursive: true });
      let resolveReport;
      const reportPromise = new Promise(r => { resolveReport = r; });
      const server = await startProbeServer({ mode, onReport: resolveReport });
      const launch = browser === 'chromium' ? ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--user-data-dir=' + profile, '--window-size=960,540', server.url] :
        ['--headless', '--no-remote', '--new-instance', '--profile', profile, '--width', '960', '--height', '540', server.url];
      const child = spawn(browserPaths[browser], launch, { cwd: root, windowsHide: true, stdio: 'ignore' });
      let childExit;
      const exited = new Promise(resolve => child.once('exit', (exitCode, exitSignal) => { childExit = { exitCode, exitSignal }; resolve(childExit); }));
      let timer, rawReport, evidence;
      try {
        const report = await Promise.race([reportPromise, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('BROWSER_TIMEOUT_45s')), 45000);
          child.once('error', reject);
        })]);
        rawReport = report;
        validateBrowserReport(report, { browser, mode, profileDigest: summary.profileDigest, canonicalOutputs: expectedOutputs, wasm: wasmBindings });
        const data = { ...report, browser, mode, binaryDigest: createHash('sha256').update(readFileSync(browserPaths[browser])).digest('hex'),
          ownedProcessId: child.pid, browserExitCode: null, exitReason: 'OWN_PROCESS_CLEANUP_PENDING' };
        evidence = data;
        writeFileSync(resolve(out, browser + '-' + mode + '.json'), JSON.stringify(data, null, 2) + '\n');
        summary.browsers.push(data);
      } catch (error) {
        const data = { browser, mode, status: 'FAIL', error: String(error), rawReport };
        evidence = data;
        writeFileSync(resolve(out, browser + '-' + mode + '.json'), JSON.stringify(data, null, 2) + '\n'); summary.browsers.push(data);
      } finally {
        clearTimeout(timer);
        const terminationRequested = child.kill();
        let cleanupTimer;
        const observed = childExit || await Promise.race([exited, new Promise(resolve => { cleanupTimer = setTimeout(() => resolve(null), 5000); })]);
        clearTimeout(cleanupTimer);
        await server.close();
        Object.assign(evidence, { terminationRequested, browserExitCode: observed?.exitCode ?? null,
          browserExitSignal: observed?.exitSignal ?? null, serverCleanup: 'CLOSED',
          processCleanup: observed ? 'OWN_CHILD_EXIT_OBSERVED' : 'NOT_VERIFIED',
          exitReason: observed ? 'CONTROLLED_DIAGNOSTIC_CHILD_EXIT_OBSERVED' : 'OWN_PROCESS_TERMINATION_REQUESTED_EXIT_UNVERIFIED' });
        if (!observed) { evidence.status = 'FAIL'; evidence.cleanupError = 'OWN_CHILD_EXIT_NOT_OBSERVED_WITHIN_5s'; }
        writeFileSync(resolve(out, browser + '-' + mode + '.json'), JSON.stringify(evidence, null, 2) + '\n');
      }
    }
  }
  const ran = summary.browsers.filter(b => b.canonicalOutputs);
  summary.crossBrowser = ran.some(b => b.browser === 'chromium') && ran.some(b => b.browser === 'firefox') ?
    (ran.every(b => JSON.stringify(b.canonicalOutputs) === JSON.stringify(ran[0].canonicalOutputs)) ? 'PASS' : 'FAIL') : 'NOT_RUN';
  summary.status = summary.browsers.some(b => b.status === 'FAIL') || summary.crossBrowser === 'FAIL' ? 'FAIL' : 'PASS';
  if (summary.status === 'PASS' && summary.browsers.some(b => b.status === 'NOT_RUN')) summary.status = 'PARTIAL';
} catch (error) { summary.status = 'FAIL'; summary.error = String(error); }
writeFileSync(resolve(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ runId, status: summary.status, crossBrowser: summary.crossBrowser, out }));
process.exitCode = summary.status === 'PASS' ? 0 : summary.status === 'PARTIAL' ? 2 : 1;
