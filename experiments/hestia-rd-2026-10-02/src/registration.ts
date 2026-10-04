import { controlManifest, createControlScenario } from './contracts/controlFixture';
import generatorSource from './contracts/controlFixture.ts?raw';
import { mountExperiment, registeredMountCount, type LabExperimentFactory,
  type LabExperimentHandle, type LabPreset } from './contracts/experiment';
import { fixtureRevision, getFixtureDigest, importFixture } from './contracts/fixture';
import { createControlledClock, getScenarioDigest, sampleScenario } from './contracts/scenario';
import { sha256 } from './contracts/validation';
import { createThreeControlExperiment } from './experiments/three-control';
import { createRendererProbeExperiment } from './experiments/renderer-probe';
import { createThreeWebGpuExperiment } from './experiments/three-webgpu';
import { createBabylonExperiment } from './experiments/babylon';

const createContractControl: LabExperimentFactory = async (context) => {
  if (context.signal.aborted) { throw new Error('Control init aborted'); }
  const drawing = context.canvas.getContext('2d');
  if (!drawing) { throw new Error('Canvas2D unavailable; no silent renderer fallback'); }
  let fixture = context.fixture; let disposed = false;
  return {
    setFrame(frame) {
      if (disposed) { throw new Error('Control disposed'); }
      drawing.clearRect(0, 0, context.canvas.width, context.canvas.height);
      drawing.fillStyle = '#71cbe8'; drawing.fillRect(16 + (frame.tick % 300), 24, 12, 12);
    },
    async replaceFixture(next) { if (disposed) { throw new Error('Control disposed'); } getFixtureDigest(next); fixture = next; },
    readFacts() { return { experimentId: 'RD-00', variantId: 'contract-control', backend: 'Canvas2D-contract-control',
      fixtureDigest: getFixtureDigest(fixture), sourceRevision: fixtureRevision(fixture),
      liveResources: { handles: { status: 'measured', value: disposed ? 0 : 1, unit: 'handle' } },
      logicalCosts: { gpuBytes: { status: 'unsupported', unit: 'byte', reason: 'Canvas2D native/GPU allocation is not measured' } },
      unsupportedFeatures: ['Three renderer/effect host: RD-03', 'GPU timings and selection benchmark: no lease'], errors: [] }; },
    async dispose() { if (!disposed) { disposed = true; drawing.clearRect(0, 0, context.canvas.width, context.canvas.height); } },
  };
};

export interface LabRegistration { readonly id: string; readonly variantId: string;
  readonly scenarioId: string; readonly preset: LabPreset; readonly create: LabExperimentFactory; }
// HEAD owns additions after the RD-00 terminal handoff. No dynamic import/plugin loader.
export const LAB_REGISTRATIONS: readonly LabRegistration[] = Object.freeze([
  Object.freeze({ id: 'RD-00', variantId: 'contract-control', scenarioId: 'RD00-CONTRACT-CONTROL', preset: Object.freeze({ id: 'diagnostic' }), create: createContractControl }),
  Object.freeze({ id: 'RD-03', variantId: 'fixture-control', scenarioId: 'F00-CONTROL-REPLAY', preset: Object.freeze({ id: 'fixture-control' }), create: createThreeControlExperiment }),
  Object.freeze({ id: 'RD-10', variantId: 'native-webgl2', scenarioId: 'F00-CONTROL-REPLAY', preset: Object.freeze({ id: 'native-webgl2', parameters: Object.freeze({ mode: 'webgl2' }) }), create: createRendererProbeExperiment }),
  Object.freeze({ id: 'RD-10', variantId: 'native-webgpu', scenarioId: 'F00-CONTROL-REPLAY', preset: Object.freeze({ id: 'native-webgpu', parameters: Object.freeze({ mode: 'webgpu' }) }), create: createRendererProbeExperiment }),
  Object.freeze({ id: 'RD-11', variantId: 'C1', scenarioId: 'F01-HVP-COAST-REPLAY', preset: Object.freeze({ id: 'C1' }), create: createThreeWebGpuExperiment }),
  Object.freeze({ id: 'RD-11', variantId: 'C2', scenarioId: 'F01-HVP-COAST-REPLAY', preset: Object.freeze({ id: 'C2' }), create: createThreeWebGpuExperiment }),
  Object.freeze({ id: 'RD-12', variantId: 'C3', scenarioId: 'F01-HVP-COAST-REPLAY', preset: Object.freeze({ id: 'C3' }), create: createBabylonExperiment }),
  Object.freeze({ id: 'RD-12', variantId: 'C4', scenarioId: 'F01-HVP-COAST-REPLAY', preset: Object.freeze({ id: 'C4' }), create: createBabylonExperiment }),
]);

export async function startControlPage(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#control-canvas')!;
  const output = document.querySelector<HTMLOutputElement>('#facts')!;
  const status = document.querySelector<HTMLOutputElement>('#status')!;
  const pause = document.querySelector<HTMLInputElement>('#pause')!;
  const seek = document.querySelector<HTMLInputElement>('#seek')!;
  const clock = createControlledClock(3600); const controller = new AbortController();
  const codeHash = await sha256(new TextEncoder().encode(generatorSource));
  let seed = 0; let fixture = await importFixture(new TextEncoder().encode(JSON.stringify(controlManifest(codeHash, codeHash))));
  let scenario = createControlScenario(fixture); let scenarioDigest = await getScenarioDigest(scenario);
  let handle: LabExperimentHandle | undefined; let busy = false;
  const registration = LAB_REGISTRATIONS[0];
  function show(): void {
    const time = clock.read();
    if (handle) { handle.setFrame(sampleScenario(scenario, time.tick, time.paused).frame); }
    output.value = JSON.stringify({ mode: 'presentation-replay diagnostic', ...time,
      scenarioId: scenario.id, scenarioDigest,
      fixtureDigest: getFixtureDigest(fixture), registeredMounts: registeredMountCount(),
      facts: handle?.readFacts() ?? null, productIntegrated: false }, null, 2);
    output.dataset.tick = String(time.tick); output.dataset.mounts = String(registeredMountCount());
    output.dataset.digest = getFixtureDigest(fixture); pause.checked = time.paused; seek.value = String(time.tick);
  }
  async function command(action: string): Promise<void> {
    if (busy) { return; } busy = true; output.setAttribute('aria-busy', 'true');
    try {
      switch (action) {
        case 'mount': handle = await mountExperiment(registration.create,
          { canvas, fixture, preset: registration.preset, signal: controller.signal, capabilities: { canvas2d: true } }); break;
        case 'advance': clock.advance(60); break;
        case 'pause': clock.pause(pause.checked); break;
        case 'seek': clock.seek(Number(seek.value)); break;
        case 'reset': clock.reset(); break;
        case 'replace': {
          const nextSeed = seed + 1;
          const next = await importFixture(new TextEncoder().encode(JSON.stringify(controlManifest(codeHash, codeHash, nextSeed))));
          const nextScenario = createControlScenario(next); const nextScenarioDigest = await getScenarioDigest(nextScenario);
          if (handle) { await handle.replaceFixture(next); }
          fixture = next; seed = nextSeed; scenario = nextScenario; scenarioDigest = nextScenarioDigest; break;
        }
        case 'dispose': await handle?.dispose(); handle = undefined; break;
      }
      status.value = handle ? 'Mounted — diagnostic only' : 'Ready — no renderer host';
    } catch (error) { status.value = `Rejected: ${error instanceof Error ? error.message : String(error)}`; }
    finally { show(); busy = false; output.setAttribute('aria-busy', 'false'); }
  }
  document.querySelectorAll<HTMLButtonElement>('button[data-command]').forEach((button) => {
    button.addEventListener('click', () => { void command(button.dataset.command!); });
  });
  pause.addEventListener('change', () => { void command('pause'); });
  window.addEventListener('pagehide', () => { controller.abort(); }, { once: true });
  status.value = 'Ready — no renderer host'; show();
}
