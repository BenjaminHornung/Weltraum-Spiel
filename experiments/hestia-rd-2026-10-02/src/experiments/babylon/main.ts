import { mountExperiment, registeredMountCount, type LabExperimentHandle } from '../../contracts/experiment';
import { loadInventory, loadReplay, publicAssetRoot } from '../../runner/assets';
import { createScenarioRunner } from '../../runner/scenarioRunner';
import { requireValue } from '../../contracts/validation';
import { createBabylonExperiment, liveBabylonHostCounts, parseSeekTick, type BabylonHost, type VisualFault } from './index';
import { bounded } from './readiness';

const element = <T extends HTMLElement>(id: string) => { const found = document.getElementById(id); requireValue(found, `Missing ${id}`); return found as T; };
const scenario = element<HTMLSelectElement>('scenario'); const preset = element<HTMLSelectElement>('preset'); const cameraSelect = element<HTMLSelectElement>('camera');
const tick = element<HTMLInputElement>('tick'); const status = element('status'); const validation = element('validation'); const facts = element('facts');
let host: BabylonHost | undefined; let handle: LabExperimentHandle | undefined; let runner: ReturnType<typeof createScenarioRunner> | undefined;
let loaded: Awaited<ReturnType<typeof loadReplay>> | undefined; let abort: AbortController | undefined; let mounting = false; let busy = false; let initialError: string | null = null;
let commandQueue = Promise.resolve(); let manualCamera: string | null = null;
function paint() {
  const diagnostic = host?.readDiagnostics(); const active = Boolean(diagnostic && !diagnostic.disposed && !diagnostic.terminal && !mounting && !busy);
  for (const id of ['camera', 'tick', 'seek', 'advance', 'reset', 'resize']) { (element(id) as HTMLButtonElement).disabled = !active; }
  for (const id of ['scenario', 'preset', 'viewport', 'dpr']) { element<HTMLSelectElement>(id).disabled = mounting || busy; }
  (element('mount') as HTMLButtonElement).disabled = mounting || busy || liveBabylonHostCounts().pendingNativeInitializations > 0;
  if (mounting) { status.textContent = 'INITIALIZING — awaiting owned backend and compiled fixture; not READY.'; }
  else if (initialError) { status.textContent = `FAILED / UNSUPPORTED — ${initialError}`; }
  else if (diagnostic?.terminal && !diagnostic.disposed) { status.textContent = `TERMINAL — ${diagnostic.terminal}`; }
  else if (!diagnostic || diagnostic.disposed) { status.textContent = diagnostic?.terminal ? `TERMINAL — ${diagnostic.terminal}` : 'DISPOSED — no owned presentation loop.'; }
  else {
    const captured = diagnostic.rendered; const submitted = captured && captured.tick === diagnostic.frame.tick && captured.cameraId === diagnostic.frame.cameraId && captured.projectionGeneration === diagnostic.projectionGeneration && captured.presentationGeneration === diagnostic.presentationGeneration;
    status.textContent = `${diagnostic.backend.actual} · tick ${diagnostic.frame.tick} · ${submitted ? 'SUBMITTED' : 'awaiting matching submission'} · generation ${diagnostic.projectionGeneration} · ${diagnostic.camera.id}`;
  }
  facts.textContent = JSON.stringify({ scenario: loaded?.scenario.id ?? null, scenarioDigest: loaded?.scenarioDigest ?? null,
    status: initialError ? 'FAILED' : mounting ? 'INITIALIZING' : diagnostic?.terminal ? 'TERMINAL' : !diagnostic || diagnostic.disposed ? 'DISPOSED' : diagnostic.rendered ? 'SUBMITTED' : 'AWAITING_SUBMISSION',
    diagnostic: diagnostic ?? null, cleanup: host?.readCleanup() ?? null, facts: diagnostic ? host?.readFacts() : null,
    mounts: registeredMountCount(), owned: liveBabylonHostCounts(), productIntegrated: false }, null, 2);
}
function enqueue(work: () => Promise<void> | void) {
  const next = commandQueue.then(async () => {
    busy = true; validation.textContent = ''; paint();
    try { await work(); }
    catch (error) { validation.textContent = error instanceof Error ? error.message : String(error); }
    finally { busy = false; paint(); }
  }); commandQueue = next.catch(() => {}); return next;
}
async function dispose() {
  const ownedDisposal = host?.dispose(); abort?.abort(); await ownedDisposal; await handle?.dispose(); handle = undefined; runner = undefined;
}
function overrideCamera() { if (manualCamera && host) { host.setFrame({ ...host.readDiagnostics().frame, cameraId: manualCamera }); } }
async function mount() {
  const requestedScenario = scenario.value; const requestedMode = preset.value;
  const [width, height] = element<HTMLSelectElement>('viewport').value.split('x').map(Number); const dpr = Number(element<HTMLSelectElement>('dpr').value);
  await dispose(); host = undefined; loaded = undefined; initialError = null; manualCamera = null; mounting = true; paint(); abort = new AbortController();
  try {
    const root = publicAssetRoot(import.meta.env.BASE_URL, location.href); const signal = abort.signal;
    const inventory = await bounded(loadInventory(root, fetch, signal), signal, 'Inventory load');
    loaded = await bounded(loadReplay(inventory, requestedScenario, root, fetch, signal), signal, 'Replay load');
    const oldCanvas = element<HTMLCanvasElement>('view'); const canvas = oldCanvas.cloneNode(false) as HTMLCanvasElement; oldCanvas.replaceWith(canvas);
    handle = await mountExperiment(async (context) => { const created = await createBabylonExperiment(context); host = created; return created; },
      { canvas, fixture: loaded.initialFixture, preset: { id: requestedMode, parameters: { width, height, dpr } }, signal, capabilities: {} });
    runner = createScenarioRunner(loaded.scenario, handle, host!.setResetTick); await runner.pause(true);
    cameraSelect.replaceChildren(...loaded.initialFixture.cameras.map((camera) => { const option = document.createElement('option'); option.value = camera.id; option.textContent = camera.id; return option; }));
    cameraSelect.value = host!.readDiagnostics().frame.cameraId; tick.value = '0';
  } catch (error) { initialError = error instanceof Error ? error.message : String(error); await dispose().catch(() => {}); }
  finally { mounting = false; paint(); }
}
element('mount').addEventListener('click', () => { void enqueue(mount); });
element('dispose').addEventListener('click', () => { if (mounting) { abort?.abort(); } void enqueue(dispose); });
element('seek').addEventListener('click', () => {
  // Validate the original typed string BEFORE queuing or mutating any state.
  try { requireValue(loaded && runner, 'Mount first'); const value = parseSeekTick(tick.value, loaded.scenario.durationTicks);
    void enqueue(async () => { await runner!.seek(value); overrideCamera(); cameraSelect.value = host!.readDiagnostics().frame.cameraId; });
  } catch (error) { validation.textContent = error instanceof Error ? error.message : String(error); }
});
element('advance').addEventListener('click', () => { void enqueue(async () => { requireValue(loaded && runner, 'Mount first'); const value = Math.min(loaded.scenario.durationTicks, runner.read().tick + 1); await runner.seek(value); overrideCamera(); tick.value = String(value); }); });
element('reset').addEventListener('click', () => { void enqueue(async () => { requireValue(runner, 'Mount first'); manualCamera = null; await runner.reset(); await runner.pause(true); tick.value = '0'; cameraSelect.value = host!.readDiagnostics().frame.cameraId; }); });
cameraSelect.addEventListener('change', () => { const id = cameraSelect.value; void enqueue(() => { requireValue(host, 'Mount first'); host.setFrame({ ...host.readDiagnostics().frame, cameraId: id }); manualCamera = id; }); });
element('resize').addEventListener('click', () => { void enqueue(() => { requireValue(host, 'Mount first'); const [width, height] = element<HTMLSelectElement>('viewport').value.split('x').map(Number); host.resize(width, height, Number(element<HTMLSelectElement>('dpr').value)); }); });

// Explicit synthetic bridge only; normal player route receives no bridge.
if (new URLSearchParams(location.search).get('testBridge') === '1') {
  Object.defineProperty(window, 'TestBridge', { configurable: true, value: Object.freeze({
    read: () => ({ diagnostic: host?.readDiagnostics(), cleanup: host?.readCleanup(), owned: liveBabylonHostCounts(), mounts: registeredMountCount() }),
    visualFault: (fault: VisualFault) => { requireValue(host, 'Mount first'); host.setDiagnosticFault(fault); paint(); },
    loseOwnedDevice: () => { requireValue(host, 'Mount first'); host.loseOwnedDeviceForTest(); },
    nativeBufferInspection: () => {
      requireValue(host, 'Mount first'); const device = host.scene.getEngine();
      return { backend: host.readDiagnostics().backend.actual, status: 'UNSUPPORTED',
        reason: device.isWebGPU ? 'Stock 9.29.0 vertex/index buffers have no COPY_SRC; retained CPU attributes are not mapped GPU evidence' : 'Native WebGL buffer readback not yet qualified',
        retained: host.readDiagnostics().buffers };
    },
  }) });
}
const observationTimer = setInterval(paint, 200); paint();
window.addEventListener('pagehide', () => { clearInterval(observationTimer); abort?.abort(); void dispose(); }, { once: true });
