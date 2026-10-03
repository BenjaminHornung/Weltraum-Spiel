import { mountExperiment, registeredMountCount, type LabExperimentHandle } from '../contracts/experiment';
import { createThreeControlExperiment } from '../experiments/three-control';
import { loadInventory, loadReplay, publicAssetRoot, type LabInventory } from './assets';
import { createScenarioRunner } from './scenarioRunner';
import { liveThreeHostCounts, type ThreeLabHost } from './threeHost';
import { requireValue } from '../contracts/validation';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id)! as T;
const canvas = element<HTMLCanvasElement>('view'); const status = element('status'); const facts = element('facts');
const scenarioSelect = element<HTMLSelectElement>('scenario'); const pause = element<HTMLInputElement>('pause'); const tick = element<HTMLInputElement>('tick');
const params = new URLSearchParams(location.search);
const variant = params.get('variant') ?? 'fixture-control';
const root = publicAssetRoot(import.meta.env.BASE_URL, location.href);
let inventory: LabInventory; let handle: LabExperimentHandle | undefined; let host: ThreeLabHost | undefined;
let runner: ReturnType<typeof createScenarioRunner> | undefined; let replay: Awaited<ReturnType<typeof loadReplay>> | undefined;
let abort: AbortController | undefined; let mounting: Promise<void> | undefined; let version = 0; let busy = false; let timer: number | undefined;
function controls(enabled: boolean) {
  for (const id of ['play', 'pause', 'advance', 'tick', 'seek', 'reset']) { (element(id) as HTMLButtonElement | HTMLInputElement).disabled = !enabled; }
  scenarioSelect.disabled = Boolean(handle || mounting); element<HTMLButtonElement>('mount').disabled = !inventory || Boolean(handle || mounting);
}
function publish(cleanup?: ReturnType<ThreeLabHost['readCleanup']>) {
  let currentFacts; let diagnostics; let error;
  try { currentFacts = handle?.readFacts(); diagnostics = host?.readDiagnostics(); } catch (failure) { error = String(failure); }
  const state = { scenarioId: replay?.scenario.id, scenarioDigest: replay?.scenarioDigest,
    facts: currentFacts, diagnostics, error, cleanup, mounts: registeredMountCount(), liveHosts: liveThreeHostCounts(),
    execution: import.meta.env.DEV ? 'DEV-DIAGNOSTIC-NOT-OPTIMIZED' : 'OPTIMIZED-DIAGNOSTIC-NOT-BENCHMARK', productIntegrated: false };
  facts.textContent = JSON.stringify(state, null, 2); facts.dataset.mounts = String(state.mounts);
  facts.dataset.tick = String(runner?.read().tick ?? 0); if (runner) { tick.value = String(runner.read().tick); pause.checked = runner.read().paused; }
}
function stopPlayback() { if (timer !== undefined) { clearInterval(timer); timer = undefined; } }
async function perform(action: () => Promise<unknown>, label: string) {
  if (busy) { return; }
  const ownVersion = version; busy = true;
  try { await action(); if (ownVersion === version) { publish(); status.textContent = label; } }
  catch (error) { if (ownVersion === version) { stopPlayback(); status.textContent = `Error: ${String(error)}`; } }
  finally { busy = false; }
}
async function mount() {
  requireValue(!handle && !mounting, 'Already mounted/reserved'); const ownVersion = ++version; abort = new AbortController();
  mounting = (async () => {
    status.textContent = 'Importing bounded pinned replay…'; replay = await loadReplay(inventory, scenarioSelect.value, root, fetch, abort!.signal);
    requireValue(!params.get('fixture') || params.get('fixture') === replay.initialFixture.id, 'Explicit fixture/scenario mismatch');
    let candidateHost: ThreeLabHost | undefined;
    const mounted = await mountExperiment(async (context) => { candidateHost = await createThreeControlExperiment(context); return candidateHost; },
      { canvas, fixture: replay.initialFixture, preset: { id: variant, parameters: { width: 1280, height: 720, dpr: 1 } }, signal: abort!.signal, capabilities: {} });
    if (ownVersion !== version) { await mounted.dispose(); return; }
    handle = mounted; host = candidateHost!; runner = createScenarioRunner(replay.scenario, handle, (resetTick) => host!.setResetTick(resetTick));
    await runner.render(); tick.max = String(replay.scenario.durationTicks); controls(true); publish(); status.textContent = 'Mounted — controlled replay; projection only';
  })();
  controls(false);
  try { await mounting; }
  finally { mounting = undefined; controls(Boolean(handle)); }
}
async function dispose() {
  ++version; stopPlayback(); abort?.abort(); await mounting?.catch(() => {}); await runner?.settled();
  const oldHost = host;
  try { await handle?.dispose(); }
  finally { handle = undefined; host = undefined; runner = undefined; abort = undefined; controls(false); publish(oldHost?.readCleanup()); status.textContent = 'Disposed — no host/loop'; }
}
element('mount').addEventListener('click', () => { void mount().catch((error) => { status.textContent = `Error: ${String(error)}`; publish(); }); });
element('dispose').addEventListener('click', () => { void dispose().catch((error) => { status.textContent = `Dispose error: ${String(error)}`; }); });
element('advance').addEventListener('click', () => { void perform(() => runner!.advance(60), 'Advanced controlled ticks'); });
pause.addEventListener('change', () => { stopPlayback(); void perform(() => runner!.pause(pause.checked), 'Pause state applied'); });
element('seek').addEventListener('click', () => { void perform(() => runner!.seek(Number(tick.value)), 'Seek applied — selected immutable snapshot adopted'); });
element('reset').addEventListener('click', () => { stopPlayback(); void perform(() => runner!.reset(), 'Reset to initial presentation — no native source actions'); });
element('play').addEventListener('click', () => {
  stopPlayback(); void perform(() => runner!.pause(false), 'Playing explicit controlled ticks (not a benchmark)');
  // Timer schedules commands only; no elapsed-time value becomes a frame input or source identity.
  timer = window.setInterval(() => { if (runner!.read().tick >= replay!.scenario.durationTicks) { stopPlayback(); return; }
    void perform(() => runner!.advance(1), 'Playing explicit controlled ticks (not a benchmark)'); }, 1000 / 60);
});
canvas.addEventListener('three-lab-error', (event) => { stopPlayback(); status.textContent = `Renderer error: ${(event as CustomEvent<string>).detail}`; });
canvas.addEventListener('three-lab-rendered', () => { if (handle && !busy) { publish(); } });
window.addEventListener('pagehide', () => { void dispose(); }, { once: true });
try {
  requireValue(variant === 'fixture-control' && (!params.get('experiment') || params.get('experiment') === 'RD-03'), 'Unknown experiment/variant');
  inventory = await loadInventory(root);
  for (const scenario of inventory.scenarios) { const option = document.createElement('option'); option.value = scenario.id; option.textContent = scenario.id; scenarioSelect.add(option); }
  scenarioSelect.value = params.get('scenario') ?? 'F00-CONTROL-REPLAY'; requireValue(Boolean(scenarioSelect.value), 'Unknown scenario');
  controls(false); status.textContent = 'Ready — real WebGL2 control, no host yet';
} catch (error) { status.textContent = `Error: ${String(error)}`; }
