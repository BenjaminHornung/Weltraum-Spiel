import { createHash } from 'node:crypto';
import { createReadStream, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertIsolation } from './verify-boundary.mjs';

const LAB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWN = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-03';
const ORIGIN = 'http://127.0.0.1:5280';
const NODE = 'C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe';
const BROWSER = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe';
const LOCK = '9dc112529df87daa8a3d92a913932d2b0bad131055d8d684d86736bd4409b60c';
const INVENTORY = '26bf86bba1cbd1955d069ab2eac8d491b6cade59d16a004f1d094cc117ebc9c6';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const contained = (root, file) => { const relative = path.relative(root, file); return relative === ''
  || (!relative.startsWith('..') && !path.isAbsolute(relative)); };

export function parseRunArgs(args) {
  const [mode, ...rest] = args;
  if (!['inspect', 'evidence', 'bench'].includes(mode) || rest.length % 2 !== 0) { throw new Error('Mode inspect/evidence/bench and explicit --name value pairs required'); }
  const options = {};
  const allowed = ['experiment', 'variant', 'fixture', 'scenario', 'run', 'tick', 'samples', 'warmup'];
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index].replace(/^--/, '');
    if (!rest[index].startsWith('--') || !allowed.includes(key) || Object.hasOwn(options, key)) { throw new Error('Unknown/duplicate run argument'); }
    options[key] = rest[index + 1];
  }
  for (const key of ['experiment', 'variant', 'fixture', 'scenario', 'run']) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$/.test(options[key] ?? '')) { throw new Error(`Explicit bounded ${key} ID required`); }
  }
  if (options.experiment !== 'RD-03' || options.variant !== 'fixture-control') { throw new Error('Unsupported experiment/variant; no silent fallback'); }
  const number = (key, fallback, min, max) => {
    const value = options[key] ?? String(fallback);
    if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) { throw new Error(`Invalid ${key}`); }
    return Number(value);
  };
  return { ...options, mode, tick: number('tick', 0, 0, 1000000), samples: number('samples', mode === 'bench' ? 120 : 1, 1, mode === 'evidence' ? 5 : 10000),
    warmup: number('warmup', mode === 'bench' ? 60 : 0, 0, 10000) };
}
export function sampleDenominator(planned, observed, failed, reason) {
  return { planned, observed, skipped: planned - observed, failed, skippedReasons: observed < planned ? [reason] : [] };
}
function bindings(directory, relative = '') {
  if (!existsSync(directory)) { return []; }
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(directory, entry.name); const name = `${relative}${entry.name}`;
    if (lstatSync(full).isSymbolicLink() || !contained(directory, realpathSync(full))) { throw new Error('Binding link/escape forbidden'); }
    if (entry.isDirectory()) { files.push(...bindings(full, `${name}/`)); }
    else if (entry.isFile()) { files.push({ path: name, sha256: hash(readFileSync(full)) }); }
    else { throw new Error('Non-file build/source binding'); }
  }
  return files;
}
function fixtureFetch(input) {
  const url = new URL(String(input));
  if (url.origin !== ORIGIN || url.search || url.hash || /%|\\/.test(url.pathname)) { throw new Error('Non-native asset URL'); }
  const root = path.join(LAB, 'fixtures'); const file = path.resolve(root, `.${url.pathname}`);
  if (!contained(root, file) || lstatSync(file).isSymbolicLink() || !contained(root, realpathSync(file))) { throw new Error('Fixture path escape'); }
  const size = lstatSync(file).size; const limit = file.endsWith('.json') ? 1024 * 1024 : 128 * 1024 * 1024;
  if (size > limit) { throw new Error('Asset import limit'); }
  return Promise.resolve(new Response(Readable.toWeb(createReadStream(file)), { headers: { 'content-length': String(size) } }));
}

export async function runLab(options) {
  if (path.resolve(process.execPath).toLowerCase() !== path.resolve(NODE).toLowerCase()
    || !contained('C:/IFI_SourceCode', LAB) || !contained('C:/IFI_SourceCode', process.cwd())) { throw new Error('Pinned C: execution/workdir required'); }
  const directory = `${OWN}/${options.mode}/${options.run}`;
  for (const name of [directory, `${directory}/media`, `${directory}/profiles`, `${directory}/temp`]) { assertIsolation({ task: 'RD-03', runRoot: name }); }
  // Fail reuse, never overwrite old evidence. All outputs are inside this checked unique directory.
  mkdirSync(path.dirname(directory), { recursive: true }); mkdirSync(directory);
  mkdirSync(`${directory}/temp`);
  process.env.PATH = `${path.dirname(NODE)};C:/IFI_SourceCode/Utils/PowerShell;C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd`;
  process.env.TEMP = `${directory}/temp`; process.env.TMP = `${directory}/temp`;
  process.env.npm_config_script_shell = 'C:/IFI_SourceCode/Utils/PowerShell/pwsh.exe';
  const save = (name, value) => writeFileSync(`${directory}/${name}`, JSON.stringify(value, null, 2), { flag: 'wx' });
  save('manifest.json', { schema: 'rd03-run-plan-v1', status: 'PLANNED', ...options, origin: ORIGIN, html: '/src/runner/index.html',
    node: NODE, browser: BROWSER, inventorySha256: INVENTORY, lockSha256: LOCK, runClass: options.mode === 'bench' ? 'selection-benchmark' : 'diagnostic',
    temperature: 'process-cold', profile: { clock: 'tick/60', startTick: options.tick, tickStep: 1, width: 1280, height: 720, dpr: 1,
      fixtureCameraWeatherSeed: 'Bound to the exact pinned scenario sample; no command-script, weather or seed overrides',
      plannedSamples: options.samples, warmupTicks: options.warmup },
    runnerOverhead: { empty: 'NOT_RUN: predeclared separate empty-host workload', active: 'NOT_RUN: predeclared separate active-host workload',
      method: 'Same fixture/camera/weather/seed/ticks/resolution; no capture, inspector or synchronous GPU readback in selection runs' },
    exclusiveGpuSlot: 'NOT_GRANTED', qualification: 'NO_TARGET_HARDWARE_ACCEPTANCE', productIntegrated: false });
  let loader; let browser; let abortClose; let observed = 0; let failed = 0; let terminal = 'FAILED'; let reason = '';
  const controller = new AbortController();
  const abortRun = () => {
    if (controller.signal.aborted) { return; }
    controller.abort(new Error('ABORTED: run interrupted'));
    if (browser) { abortClose = browser.close(); void abortClose.catch(() => {}); }
  };
  // Keep our handler registered during cleanup: signal-exit sees a once-handler disappear and re-raises the signal.
  process.on('SIGINT', abortRun); process.on('SIGTERM', abortRun);
  const errors = []; const media = []; const imageProperties = []; const states = []; let result; let resultFactory;
  try {
    if (hash(readFileSync(path.join(LAB, 'package-lock.json'))) !== LOCK) { throw new Error('Lock bytes differ'); }
    // Installed Vite loads the existing TS contracts for CPU inspection; never a Node exporter in a browser bundle.
    const { createServer } = await import('vite');
    loader = await createServer({ root: LAB, configFile: false, cacheDir: `${directory}/temp/vite`,
      server: { middlewareMode: true, watch: null }, publicDir: false, appType: 'custom', optimizeDeps: { noDiscovery: true } });
    const assets = await loader.ssrLoadModule('/src/runner/assets.ts');
    const scenarioApi = await loader.ssrLoadModule('/src/contracts/scenario.ts');
    const fixtureApi = await loader.ssrLoadModule('/src/contracts/fixture.ts');
    const resultApi = await loader.ssrLoadModule('/src/contracts/result.ts');
    resultFactory = resultApi.createRunResult;
    const inventory = await assets.loadInventory(new URL(`${ORIGIN}/`), fixtureFetch, controller.signal);
    const replay = await assets.loadReplay(inventory, options.scenario, new URL(`${ORIGIN}/`), fixtureFetch, controller.signal);
    if (replay.initialFixture.id !== options.fixture || options.tick + options.samples - 1 > replay.scenario.durationTicks) { throw new Error('Fixture/scenario/sample-range mismatch'); }
    const sample = scenarioApi.sampleScenario(replay.scenario, options.tick, true);
    save('profile.json', { fixtureId: sample.fixture.id, fixtureDigest: fixtureApi.getFixtureDigest(sample.fixture), scenarioDigest: replay.scenarioDigest,
      cameraId: sample.frame.cameraId, frame: sample.frame, resetTick: sample.resetTick, sourceRefs: sample.fixture.sourceRefs,
      seed: sample.fixture.sourceRefs.map((ref) => ref.kind === 'synthetic' ? ref.seed : ref.generatorVersion), productIntegrated: false });
    const sourceBindings = [...bindings(path.join(LAB, 'src'), 'src/'),
      ...['package.json', 'vite.config.ts', 'tsconfig.json', 'scripts/run-lab.mjs'].map((file) => ({ path: file, sha256: hash(readFileSync(path.join(LAB, file))) }))].sort((a, b) => a.path.localeCompare(b.path));
    const buildBindings = bindings(path.join(LAB, 'dist')); save('byte-bindings.json', { sourceBindings, buildBindings, productIntegrated: false });
    let version = 'NOT_RUN'; let backend = 'Three-WebGLRenderer-WebGL2-NOT_RUN';
    await loader.close(); loader = undefined;
    controller.signal.throwIfAborted();
    if (options.mode === 'inspect') {
      const samples = [];
      for (let index = 0; index < options.samples; index += 1) { samples.push(scenarioApi.sampleScenario(replay.scenario, options.tick + index, true)); observed += 1; }
      save('inspection.json', { inventory, scenarioId: replay.scenario.id, scenarioDigest: replay.scenarioDigest,
        initialFixtureDigest: fixtureApi.getFixtureDigest(replay.initialFixture), snapshots: [...replay.fixtures.values()].map((fixture) => ({ id: fixture.id,
          digest: fixtureApi.getFixtureDigest(fixture), revision: fixtureApi.fixtureRevision(fixture), payloads: fixture.payloads })), samples, productIntegrated: false });
      terminal = 'PASS'; reason = 'Bounded CPU inventory/fixture/scenario imports; no rendering or measurements executed';
    } else if (options.mode === 'bench') {
      terminal = 'NOT_RUN'; reason = 'No actual exclusive target-GPU slot/lease. Capture/diagnostics cannot be selection benchmarks';
    } else if (!existsSync(path.join(LAB, 'dist/src/runner/index.html'))) {
      terminal = 'NOT_RUN'; reason = 'READY_FOR_HEAD_WIRING: actual optimized runner entry absent; root Canvas2D build is not RD03 evidence';
    } else {
      // Evidence never starts/stops an unowned server. Caller must use a strict-port managed preview and own its cleanup.
      const { chromium } = await import('@playwright/test'); mkdirSync(`${directory}/profiles`); mkdirSync(`${directory}/media`);
      browser = await chromium.launchPersistentContext(`${directory}/profiles`, { executablePath: BROWSER, headless: true,
        viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false });
      const page = await browser.newPage(); page.on('pageerror', (error) => { errors.push(error.message); });
      version = browser.browser()?.version() ?? 'Persistent Chromium version unavailable';
      const query = new URLSearchParams({ experiment: options.experiment, variant: options.variant, fixture: options.fixture, scenario: options.scenario });
      const response = await page.goto(`${ORIGIN}/src/runner/index.html?${query}`, { timeout: 15000 });
      if (!response?.ok() || hash(await response.body()) !== hash(readFileSync(path.join(LAB, 'dist/src/runner/index.html')))) { throw new Error('Served HTML is not exact native optimized output'); }
      const servedBuildBindings = [];
      for (const entry of buildBindings.filter((entry) => /\.(js|css)$/.test(entry.path))) {
        const served = await page.request.get(`${ORIGIN}/${entry.path}`);
        if (!served.ok() || hash(await served.body()) !== entry.sha256) { throw new Error(`Served optimized code differs: ${entry.path}`); }
        servedBuildBindings.push(entry);
      }
      save('served-build-bindings.json', { servedBuildBindings, runnerHtmlSha256: hash(await response.body()), productIntegrated: false });
      await page.waitForFunction(() => /^(Ready|Error:)/.test(document.getElementById('status').textContent), null, { timeout: 15000 });
      const readyStatus = await page.locator('#status').textContent();
      if (readyStatus.startsWith('Error:')) { throw new Error(readyStatus); }
      await page.getByRole('button', { name: 'Mount', exact: true }).click();
      await page.waitForFunction(() => /^(Mounted|Error:)/.test(document.getElementById('status').textContent), null, { timeout: 15000 });
      const mountStatus = await page.locator('#status').textContent();
      if (mountStatus.startsWith('Error:')) { throw new Error(mountStatus); }
      await page.locator('#facts[data-mounts="1"]').waitFor({ timeout: 15000 });
      for (let index = 0; index < options.samples; index += 1) {
        controller.signal.throwIfAborted();
        const tick = options.tick + index; observed += 1;
        try {
          await page.getByLabel('Seek tick', { exact: true }).fill(String(tick)); await page.getByRole('button', { name: 'Seek', exact: true }).click();
          await page.waitForFunction((value) => { const state = JSON.parse(document.getElementById('facts').textContent);
            return state.diagnostics?.rendered?.tick === value && state.diagnostics?.rendered?.fixtureDigest === state.diagnostics?.fixtureDigest; }, tick, { timeout: 15000 });
          const state = JSON.parse(await page.locator('#facts').textContent());
          const selected = scenarioApi.sampleScenario(replay.scenario, tick, false);
          if (!state.diagnostics.webgl2 || state.diagnostics.fixtureDigest !== fixtureApi.getFixtureDigest(selected.fixture)
            || state.scenarioDigest !== replay.scenarioDigest || state.diagnostics.resolution.bufferWidth !== 1280
            || state.diagnostics.resolution.bufferHeight !== 720 || state.diagnostics.resolution.dpr !== 1) { throw new Error('Actual backend/source/resolution mismatch'); }
          const file = `media/tick-${tick}.png`; await page.locator('canvas').screenshot({ path: `${directory}/${file}` });
          const png = readFileSync(`${directory}/${file}`); const bounds = await page.locator('canvas').boundingBox();
          media.push({ path: file, sha256: hash(png), kind: 'image' });
          imageProperties.push({ path: file, width: png.readUInt32BE(16), height: png.readUInt32BE(20), cssBounds: bounds,
            drawingBuffer: state.diagnostics.resolution, captureScale: 'CSS-pixels-at-DPR-1' });
          states.push(state); backend = state.diagnostics.backend;
        } catch (error) { failed += 1; errors.push(String(error)); }
      }
      await page.getByRole('button', { name: 'Dispose', exact: true }).click(); await page.locator('#facts[data-mounts="0"]').waitFor();
      const cleanup = JSON.parse(await page.locator('#facts').textContent()).cleanup;
      if (!cleanup?.disposed || Object.values(cleanup.liveHosts).some((count) => count !== 0) || cleanup.geometries || cleanup.textures || cleanup.programs) { throw new Error('Host cleanup not empty'); }
      save('diagnostic.json', { states, imageProperties, cleanup, qualification: 'HEADLESS-DIAGNOSTIC-UNQUALIFIED-FOR-TARGET-GPU-OR-PERFORMANCE', errors, productIntegrated: false });
      terminal = failed || errors.length ? 'FAILED' : 'PASS'; reason = 'Exact native optimized WebGL2 image/source diagnostic, not target hardware or performance acceptance';
    }
    const notRun = (unit) => ({ status: 'not-run', unit, reason: 'No qualified measurement slot; CPU inspection/image capture is separate from selection timing' });
    result = resultApi.createRunResult({ schema: 'hestia-rd-result-v1', runId: options.run, scenarioId: options.scenario, scenarioDigest: replay.scenarioDigest,
      variantId: options.variant, fixtureDigest: fixtureApi.getFixtureDigest(sample.fixture), sourceRefs: sample.fixture.sourceRefs,
      sourceDigest: sample.fixture.sourceRefs[0].sourceDigest, sourceBytesDigest: hash(JSON.stringify(sourceBindings)), buildDigest: hash(JSON.stringify(buildBindings)), lockDigest: LOCK,
      browser: { executable: BROWSER, version }, device: { id: 'rd03-local-diagnostic-unqualified', description: states[0]?.diagnostics?.device ?? 'GPU identity not queried; NOT_RUN',
        driver: { status: 'unsupported', unit: 'version', reason: 'No native driver measurement' } }, backend,
      runClass: options.mode === 'bench' ? 'selection-benchmark' : 'diagnostic', temperature: 'process-cold',
      samples: sampleDenominator(options.samples, observed, failed, reason), rawDataPaths: ['manifest.json', 'profile.json', 'byte-bindings.json', options.mode === 'inspect' ? 'inspection.json' : 'terminal.json'], errors,
      metrics: { cpuMs: notRun('ms'), gpuMs: states[0]?.diagnostics?.gpuMs ?? notRun('ms'), frameMs: notRun('ms'),
        uploadBytes: notRun('byte'), cpuBytes: notRun('byte'), gpuBytes: { status: 'unsupported', unit: 'byte', reason: 'WebGL does not expose native GPU allocations' } },
      media, gates: [{ id: `RD03-${options.mode}`, status: terminal === 'PASS' ? 'PASS' : terminal === 'NOT_RUN' ? 'NOT_RUN' : 'FAIL', reason },
        { id: 'target-hardware-performance-art', status: 'NOT_RUN', reason: 'No exclusive GPU slot, target hardware or viewed reference acceptance' }], productIntegrated: false });
  } catch (error) {
    reason = controller.signal.aborted ? 'ABORTED: run interrupted' : String(error); errors.push(reason); terminal = /abort/i.test(reason) ? 'ABORTED' : /unsupported/i.test(reason) ? 'UNSUPPORTED' : 'FAILED';
  } finally {
    const cleanupErrors = [];
    if (browser) { try { if (abortClose) { await abortClose; } else { await browser.close(); } } catch (error) { cleanupErrors.push(String(error)); } }
    if (loader) { try { await loader.close(); } catch (error) { cleanupErrors.push(String(error)); } }
    if (cleanupErrors.length) { terminal = 'FAILED'; errors.push(...cleanupErrors); }
    if (controller.signal.aborted && terminal !== 'ABORTED') { terminal = 'ABORTED'; reason = 'ABORTED: run interrupted'; errors.push(reason); }
    if (result) {
      try {
        result = resultFactory({ ...result, errors, gates: cleanupErrors.length || terminal === 'ABORTED'
          ? [{ ...result.gates[0], status: 'FAIL', reason: reason || 'Owned browser/native loader cleanup failed' }, ...result.gates.slice(1)] : result.gates });
        save('result.json', result);
      } catch (error) { result = undefined; terminal = 'FAILED'; reason = `Result validation/write failed: ${String(error)}`; errors.push(reason); }
    }
    save('terminal.json', { status: terminal, reason, samples: sampleDenominator(options.samples, observed, failed, reason || 'Run interrupted'),
      errors, resultWritten: Boolean(result), cleanup: { ownedBrowserClosed: !browser || cleanupErrors.length === 0, nativeViteLoaderClosed: !loader || cleanupErrors.length === 0,
        service: 'NOT_OWNED: caller must stop only its managed preview; no foreign cleanup', profiles: 'Owned additive profile retained; no destructive file deletion' }, productIntegrated: false });
    process.removeListener('SIGINT', abortRun); process.removeListener('SIGTERM', abortRun);
  }
  console.log(JSON.stringify({ status: terminal, reason, directory, productIntegrated: false }));
  return terminal === 'PASS' || terminal === 'NOT_RUN' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await runLab(parseRunArgs(process.argv.slice(2))); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
