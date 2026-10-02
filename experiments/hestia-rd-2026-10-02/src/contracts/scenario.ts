import { createFrameInput, validateWeather, type LabFrameInput, type LabWeatherSample } from './experiment';
import { fixtureRevision, getFixtureDigest, type LabFixtureV1 } from './fixture';
import { array, canonicalJson, digest, freezeJson, id, integer, keys, parseBoundedJson,
  record, requireValue, sha256 } from './validation';

export type LabKeyframe = { readonly tick: number; readonly type: 'SetWeatherPreset'; readonly presetId: string }
  | { readonly tick: number; readonly type: 'SelectCamera'; readonly cameraId: string }
  | { readonly tick: number; readonly type: 'ResetLab' };
export interface LabScenarioV1 { readonly schema: 'hestia-rd-scenario-v1'; readonly id: string;
  readonly fixtureDigest: string; readonly ticksPerSecond: 60; readonly durationTicks: number;
  readonly mode: 'presentation-replay'; readonly initialCameraId: string; readonly initialWeatherPresetId: string;
  readonly weatherPresets: Readonly<Record<string, LabWeatherSample>>; readonly keyframes: readonly LabKeyframe[];
  readonly snapshots: readonly { readonly tick: number; readonly type: 'ReplaceSnapshot';
    readonly fixtureDigest: string; readonly manifest: LabFixtureV1 }[]; }

const scenarios = new WeakMap<LabScenarioV1, LabFixtureV1>();
export function createScenario(value: unknown, initialFixture: LabFixtureV1): LabScenarioV1 {
  const scenario = value as LabScenarioV1;
  keys(scenario, ['schema', 'id', 'fixtureDigest', 'ticksPerSecond', 'durationTicks', 'mode', 'initialCameraId',
    'initialWeatherPresetId', 'weatherPresets', 'keyframes', 'snapshots']);
  requireValue(scenario.schema === 'hestia-rd-scenario-v1' && scenario.ticksPerSecond === 60
    && scenario.mode === 'presentation-replay', 'Only V1 presentation replay at 60 Hz is allowed');
  id(scenario.id); digest(scenario.fixtureDigest); integer(scenario.durationTicks);
  requireValue(scenario.fixtureDigest === getFixtureDigest(initialFixture), 'Scenario initial fixture mismatch');
  record(scenario.weatherPresets);
  for (const [presetId, weather] of Object.entries(scenario.weatherPresets)) { id(presetId); validateWeather(weather); }
  requireValue(Object.hasOwn(scenario.weatherPresets, scenario.initialWeatherPresetId), 'Missing initial weather');
  requireValue(initialFixture.cameras.some((camera) => camera.id === scenario.initialCameraId), 'Missing initial camera');
  array(scenario.keyframes); let previous = -1; const seen = new Set<string>();
  for (const event of scenario.keyframes) {
    integer(event.tick); requireValue(event.tick >= previous && event.tick <= scenario.durationTicks, 'Keyframes must be sorted/in range');
    previous = event.tick; const identity = `${event.tick}:${event.type}`; requireValue(!seen.has(identity), 'Ambiguous same-tick keyframe'); seen.add(identity);
    if (event.type === 'SetWeatherPreset') {
      keys(event, ['tick', 'type', 'presetId']); requireValue(Object.hasOwn(scenario.weatherPresets, event.presetId), 'Unknown weather preset');
    } else if (event.type === 'SelectCamera') { keys(event, ['tick', 'type', 'cameraId']); id(event.cameraId); }
    else { keys(event, ['tick', 'type']); requireValue(event.type === 'ResetLab', 'Commands/scripts/native cuts are forbidden'); }
  }
  array(scenario.snapshots); previous = -1;
  for (const event of scenario.snapshots) {
    keys(event, ['tick', 'type', 'fixtureDigest', 'manifest']); integer(event.tick);
    requireValue(event.type === 'ReplaceSnapshot' && event.tick > previous && event.tick <= scenario.durationTicks, 'Snapshots must be strictly sorted/in range');
    previous = event.tick; requireValue(event.fixtureDigest === getFixtureDigest(event.manifest), 'Snapshot must contain the full imported next fixture');
  }
  // Copy only JSON inputs; retain the already-private imported snapshot identities.
  const copy = JSON.parse(canonicalJson({ ...scenario, snapshots: [] })) as LabScenarioV1;
  const frozen = freezeJson({ ...copy, snapshots: scenario.snapshots.map((event) => ({ ...event })) });
  scenarios.set(frozen, initialFixture);
  const changeTicks = new Set([0, ...scenario.keyframes.map((event) => event.tick), ...scenario.snapshots.map((event) => event.tick)]);
  try { for (const tick of changeTicks) { sampleScenario(frozen, tick, false); } }
  catch (error) { scenarios.delete(frozen); throw error; }
  return frozen;
}

export function sampleScenario(scenario: LabScenarioV1, tick: number, paused: boolean): {
  readonly frame: LabFrameInput; readonly fixture: LabFixtureV1; readonly resetTick: number | null;
} {
  let fixture = scenarios.get(scenario); requireValue(fixture, 'Scenario must pass validation'); integer(tick);
  requireValue(tick <= scenario.durationTicks, 'Tick outside scenario');
  let cameraId = scenario.initialCameraId; let weather = scenario.weatherPresets[scenario.initialWeatherPresetId]; let resetTick: number | null = null;
  for (const event of scenario.snapshots) { if (event.tick <= tick) { fixture = event.manifest; } }
  for (const event of scenario.keyframes) {
    if (event.tick > tick) { break; }
    if (event.type === 'SelectCamera') { cameraId = event.cameraId; }
    else if (event.type === 'SetWeatherPreset') { weather = scenario.weatherPresets[event.presetId]; }
    else { resetTick = event.tick; }
  }
  requireValue(fixture.cameras.some((camera) => camera.id === cameraId), 'Scenario camera missing from selected snapshot');
  return freezeJson({ frame: createFrameInput({ tick, seconds: tick / 60, paused, cameraId, sourceRevision: fixtureRevision(fixture), weather }), fixture, resetTick });
}

export async function getScenarioDigest(scenario: LabScenarioV1): Promise<string> {
  requireValue(scenarios.has(scenario), 'Scenario must pass validation');
  return sha256(new TextEncoder().encode(canonicalJson(scenario)));
}

export function importScenario(bytes: Uint8Array, fixtures: ReadonlyMap<string, LabFixtureV1>): LabScenarioV1 {
  const value = parseBoundedJson(bytes) as LabScenarioV1; const initial = fixtures.get(value.fixtureDigest);
  requireValue(initial, 'Initial snapshot is not imported'); array(value.snapshots);
  const snapshots = value.snapshots.map((event) => {
    const fixture = fixtures.get(event.fixtureDigest); requireValue(fixture, 'Next snapshot is not imported');
    requireValue(canonicalJson(event.manifest) === canonicalJson(fixture), 'Full snapshot manifest differs from imported data');
    return { ...event, manifest: fixture };
  });
  return createScenario({ ...value, snapshots }, initial);
}

export function createControlledClock(durationTicks: number) {
  integer(durationTicks); let tick = 0; let paused = false;
  const read = () => Object.freeze({ tick, seconds: tick / 60, paused });
  return {
    read,
    advance(count = 1) { integer(count); if (!paused) { tick = Math.min(durationTicks, tick + count); } return read(); },
    pause(value: boolean) { requireValue(typeof value === 'boolean', 'Invalid pause'); paused = value; return read(); },
    seek(next: number) { integer(next); requireValue(next <= durationTicks, 'Seek outside scenario'); tick = next; return read(); },
    reset() { tick = 0; paused = false; return read(); },
  };
}
