import { fixtureRevision, getFixtureDigest, type LabFixtureV1, type Vec3 } from './fixture';
import { validateMetric, type LabMetric } from './result';
import { array, canonicalJson, finite, freezeJson, id, integer, keys, record, requireValue, text, vector } from './validation';

export interface LabWeatherSample { readonly windMps: Vec3; readonly rain01: number; readonly snow01: number; readonly cloud01: number; }
export interface LabFrameInput { readonly tick: number; readonly seconds: number; readonly paused: boolean;
  readonly cameraId: string; readonly sourceRevision: number; readonly weather: LabWeatherSample; }
export interface LabExperimentFacts { readonly experimentId: string; readonly variantId: string; readonly backend: string;
  readonly fixtureDigest: string; readonly sourceRevision: number; readonly liveResources: Readonly<Record<string, LabMetric>>;
  readonly logicalCosts: Readonly<Record<string, LabMetric>>; readonly unsupportedFeatures: readonly string[]; readonly errors: readonly string[]; }
export interface LabExperimentHandle { setFrame(input: LabFrameInput): void; replaceFixture(next: LabFixtureV1): Promise<void>;
  readFacts(): LabExperimentFacts; dispose(): Promise<void>; }
export interface LabPreset { readonly id: string; readonly parameters?: Readonly<Record<string, string | number | boolean>>; }
export interface LabExperimentContext { readonly canvas: HTMLCanvasElement; readonly fixture: LabFixtureV1;
  readonly preset: LabPreset; readonly signal: AbortSignal; readonly capabilities: Readonly<Record<string, boolean>>; }
export type LabExperimentFactory = (context: LabExperimentContext) => Promise<LabExperimentHandle>;

export function validateWeather(value: unknown): asserts value is LabWeatherSample {
  keys(value, ['windMps', 'rain01', 'snow01', 'cloud01']); const weather = value as LabWeatherSample;
  vector(weather.windMps); [weather.rain01, weather.snow01, weather.cloud01].forEach((component) => { finite(component, 0, 1); });
}

export function createFrameInput(value: unknown): LabFrameInput {
  keys(value, ['tick', 'seconds', 'paused', 'cameraId', 'sourceRevision', 'weather']); const frame = value as LabFrameInput;
  integer(frame.tick); integer(frame.sourceRevision); finite(frame.seconds, 0);
  requireValue(frame.seconds === frame.tick / 60 && typeof frame.paused === 'boolean', 'Time must come from controlled 60 Hz scenario ticks');
  id(frame.cameraId); validateWeather(frame.weather);
  return freezeJson(JSON.parse(canonicalJson(frame)) as LabFrameInput);
}

export function validateFacts(value: unknown): LabExperimentFacts {
  keys(value, ['experimentId', 'variantId', 'backend', 'fixtureDigest', 'sourceRevision', 'liveResources', 'logicalCosts', 'unsupportedFeatures', 'errors']);
  const facts = value as LabExperimentFacts; id(facts.experimentId); id(facts.variantId); text(facts.backend);
  requireValue(/^[0-9a-f]{64}$/.test(facts.fixtureDigest), 'Invalid fixture digest'); integer(facts.sourceRevision);
  for (const metrics of [facts.liveResources, facts.logicalCosts]) { Object.values(record(metrics)).forEach(validateMetric); }
  for (const messages of [facts.unsupportedFeatures, facts.errors]) { array(messages); messages.forEach(text); }
  return freezeJson(JSON.parse(canonicalJson(facts)) as LabExperimentFacts);
}

const mounts = new Map<HTMLCanvasElement, object>();
export function registeredMountCount(): number { return mounts.size; }

export async function mountExperiment(factory: LabExperimentFactory, context: LabExperimentContext): Promise<LabExperimentHandle> {
  requireValue(!context.signal.aborted, 'Mount aborted before init');
  requireValue(!mounts.has(context.canvas), 'Canvas already mounted');
  getFixtureDigest(context.fixture); id(context.preset.id);
  const lifecycle = new AbortController(); const signal = AbortSignal.any([context.signal, lifecycle.signal]);
  const slot = {}; mounts.set(context.canvas, slot);
  let fixture = context.fixture; let disposing: Promise<void> | undefined; let replacing: Promise<void> | undefined;
  const initialized = Promise.resolve().then(() => {
    requireValue(!signal.aborted, 'Mount aborted before init');
    return factory({ ...context, signal,
      preset: freezeJson(JSON.parse(canonicalJson(context.preset)) as LabPreset),
      capabilities: freezeJson({ ...context.capabilities }) });
  });
  async function dispose(): Promise<void> {
    if (!disposing) {
      // Assign before dispatching abort: abort listeners can synchronously reenter.
      disposing = Promise.resolve().then(async () => {
        lifecycle.abort();
        try {
          const handle = await initialized;
          if (replacing) { await replacing.catch(() => {}); }
          await handle.dispose();
        } finally { signal.removeEventListener('abort', onAbort); if (mounts.get(context.canvas) === slot) { mounts.delete(context.canvas); } }
      });
    }
    return disposing;
  }
  const onAbort = () => { void dispose().catch(() => {}); };
  signal.addEventListener('abort', onAbort, { once: true });
  let handle: LabExperimentHandle;
  try {
    handle = await initialized;
    if (signal.aborted || disposing) { await dispose(); throw new Error('Mount aborted during init'); }
  } catch (error) { await dispose().catch(() => {}); throw error; }
  function active(): void { requireValue(!signal.aborted && !disposing && !replacing, 'Experiment aborted/disposed or replacement pending'); }
  return {
    setFrame(input) {
      active(); const frame = createFrameInput(input);
      requireValue(frame.sourceRevision === fixtureRevision(fixture)
        && fixture.cameras.some((camera) => camera.id === frame.cameraId), 'Stale source/camera frame');
      handle.setFrame(frame);
    },
    async replaceFixture(next) {
      active(); getFixtureDigest(next);
      replacing = Promise.resolve().then(() => handle.replaceFixture(next));
      try { await replacing; requireValue(!signal.aborted && !disposing, 'Replacement aborted'); fixture = next; }
      finally { replacing = undefined; }
    },
    readFacts() {
      active(); const facts = validateFacts(handle.readFacts());
      requireValue(facts.fixtureDigest === getFixtureDigest(fixture) && facts.sourceRevision === fixtureRevision(fixture), 'Facts are not bound to the current fixture');
      return facts;
    },
    dispose,
  };
}
