import { getFixtureDigest, type LabFixtureV1 } from './fixture';
import { createScenario } from './scenario';

// RD-00 diagnostic generator only. F00 geometry/provenance is RD-02's work.
export function controlManifest(generatorCodeSha256: string, sourceDigest: string, seed = 0) {
  return { schema: 'hestia-rd-fixture-v1', id: `RD00-CONTRACT-${seed}`, kind: 'synthetic',
    sourceRefs: [{ kind: 'synthetic', generatorPath: 'src/contracts/controlFixture.ts', generatorCodeSha256,
      generatorVersion: 'rd00-control-v1', seed, testOnly: true, sourceDigest }],
    sourceRevision: seed, units: 'meter', quantumMeters: 0.125,
    frame: { id: 'diagnostic-local', originMeters: [0, 0, 0], rotationXyzw: [0, 0, 0, 1], basis: 'right-handed-y-up' },
    materials: [], objects: [], payloads: [],
    cameras: [{ id: 'diagnostic', positionMeters: [0, 1, 2], targetMeters: [0, 0, 0], up: [0, 1, 0], verticalFovDegrees: 60 }] };
}

export function createControlScenario(fixture: LabFixtureV1) {
  return createScenario({ schema: 'hestia-rd-scenario-v1', id: 'RD00-CONTRACT-CONTROL', fixtureDigest: getFixtureDigest(fixture),
    ticksPerSecond: 60, durationTicks: 3600, mode: 'presentation-replay', initialCameraId: 'diagnostic', initialWeatherPresetId: 'calm',
    weatherPresets: { calm: { windMps: [0, 0, 0], rain01: 0, snow01: 0, cloud01: 0 } }, keyframes: [], snapshots: [] }, fixture);
}
