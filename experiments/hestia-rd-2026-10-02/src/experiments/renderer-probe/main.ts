import { mountExperiment, registeredMountCount, type LabExperimentHandle } from '../../contracts/experiment';
import { sampleScenario } from '../../contracts/scenario';
import { loadInventory, loadReplay, publicAssetRoot } from '../../runner/assets';
import { createRendererProbeExperiment, readProbeReport } from './index';

const status = document.querySelector<HTMLOutputElement>('#status')!;
const output = document.querySelector<HTMLOutputElement>('#capability')!;
const surface = document.querySelector<HTMLDivElement>('#surface')!;
const lifetime = new AbortController();
let canvas: HTMLCanvasElement | undefined; let handle: LabExperimentHandle | undefined;
let controller: AbortController | undefined; let busy = false;
function show() {
  output.textContent = canvas ? JSON.stringify(readProbeReport(canvas), null, 2) : output.textContent;
  output.dataset.mounts = String(registeredMountCount());
}
async function close() {
  controller?.abort(); await handle?.dispose(); handle = undefined;
  if (canvas) { show(); canvas.remove(); canvas = undefined; }
  output.dataset.mounts = String(registeredMountCount());
}
async function start() {
  if (location.origin !== 'http://127.0.0.1:5280') { throw new Error('Only task-owned strict loopback origin is allowed'); }
  const root = publicAssetRoot(import.meta.env.BASE_URL, location.href);
  const inventory = await loadInventory(root, fetch, lifetime.signal);
  const replay = await loadReplay(inventory, 'F00-CONTROL-REPLAY', root, fetch, lifetime.signal);
  document.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      if (busy) { return; } busy = true;
      void (async () => {
        try {
          await close(); lifetime.signal.throwIfAborted();
          const mode = button.dataset.mode!; controller = new AbortController();
          canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
          canvas.addEventListener('rd10-probe-report', () => {
            if (canvas) {
              const report = readProbeReport(canvas); show();
              status.textContent = `${report.status.toUpperCase()} ${report.backend} — ${report.reason} — DIAGNOSTIC, not target-qualified`;
            }
          });
          canvas.setAttribute('aria-label', `${mode} diagnostic triangle`); surface.append(canvas);
          status.textContent = `INITIALIZING ${mode} — awaiting real context/device and submission`;
          handle = await mountExperiment(createRendererProbeExperiment, { canvas, fixture: replay.initialFixture,
            preset: { id: `native-${mode}`, parameters: { mode } },
            signal: AbortSignal.any([lifetime.signal, controller.signal]), capabilities: {} });
          handle.setFrame(sampleScenario(replay.scenario, 0, true).frame);
          const report = readProbeReport(canvas);
          status.textContent = `${report.status.toUpperCase()} ${report.backend} — ${report.reason} — DIAGNOSTIC, not target-qualified`;
          show();
        } catch (error) { status.textContent = `FAILED: ${String(error)}`; await close(); }
        finally { busy = false; }
      })();
    });
  });
  document.querySelector<HTMLButtonElement>('#close')!.addEventListener('click', () => {
    // Closing during awaited init aborts it; late devices are released by the factory.
    controller?.abort();
    if (!busy) { busy = true; void close().then(() => { status.textContent = 'Closed — no mounted probe'; }).finally(() => { busy = false; }); }
  });
  status.textContent = 'Ready — choose a native backend; each attempt uses a fresh canvas';
}
window.addEventListener('pagehide', () => { lifetime.abort(); controller?.abort(); void close(); }, { once: true });
void start().catch((error) => { status.textContent = `FAILED: ${String(error)}`; });
