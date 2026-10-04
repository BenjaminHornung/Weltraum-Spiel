import { expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { importFixture, getFixtureDigest, fixtureRevision, type LabFixtureV1 } from '../../src/contracts/fixture';
import { canonicalJson } from '../../src/contracts/validation';
import { createFrameInput } from '../../src/contracts/experiment';
import { createBabylonExperiment, liveBabylonHostCounts } from '../../src/experiments/babylon';
import { buildBabylonProjection } from '../../src/experiments/babylon/projection';
import { compareSceneRoi, requireQualifiedParity, VISUAL_ORACLE_V1 } from '../../reports/RD-12/oracle';
import { requireQualifiedParityV2, QUALIFICATION_GATE_V2 } from '../../reports/RD-12/qualification-v2';

// Real SDK math/scene/camera/mesh/light, controlled C3 acquisition and compile.
vi.mock('@babylonjs/core/Engines/engine.js', async () => {
  const { NullEngine } = await import('@babylonjs/core/Engines/nullEngine.js');
  return { Engine: class extends NullEngine {
    constructor() { super(); this.getCaps().maxTextureSize = 8192; }
    override get webGLVersion() { return 2; }
    override runRenderLoop() {} override stopRenderLoop() {}
  } };
});
const reference = Array.from({ length: 4096 * 4 }, (_, index) => index % 4 === 3 ? 255 : Math.floor(index / 4) % 2 ? 220 : 35);
const shifted = (offset: number) => reference.map((value, index) => index % 4 === 3 ? value : value + offset);

it('REPAIR P2 qualification v2 rejects identical faulted/restored +5 RGB despite historical v1 acceptance overlap', () => {
  const fault = shifted(5); const measured = compareSceneRoi(reference, fault).meanRgbError;
  expect(measured).toBeCloseTo(5 / 255, 12); expect(measured).toBeGreaterThanOrEqual(VISUAL_ORACLE_V1.minimumFaultMeanRgbError);
  expect(measured).toBeLessThanOrEqual(VISUAL_ORACLE_V1.maximumMeanRgbError);
  expect(requireQualifiedParity(reference, fault, fault).positive.meanRgbError).toBe(measured); // Preserved historical bug, not relabelled v1.
  expect(() => requireQualifiedParityV2(reference, fault, fault)).toThrow(/FALSE-GREEN/);
});
it('REPAIR P2 qualification v2 defers insensitive/positively accepted faults and accepts meaningful real restoration only', () => {
  expect(() => requireQualifiedParityV2(reference, reference, reference)).toThrow(/FALSE-GREEN/);
  expect(() => requireQualifiedParityV2(reference, reference, shifted(5))).toThrow(/FALSE-GREEN/);
  expect(() => requireQualifiedParityV2(reference, shifted(10), shifted(10))).toThrow(/parity rejected/);
  const result = requireQualifiedParityV2(reference, shifted(1), shifted(10));
  expect(result.version).toBe(QUALIFICATION_GATE_V2); expect(result.positive.meanRgbError).toBeCloseTo(1 / 255, 12);
  expect(result.negative.meanRgbError).toBeGreaterThan(VISUAL_ORACLE_V1.maximumMeanRgbError);
  expect(() => requireQualifiedParityV2(Array(4096 * 4).fill(128), Array(4096 * 4).fill(128), Array(4096 * 4).fill(160))).toThrow(/scene signal/);
  expect(() => requireQualifiedParityV2(reference.slice(0, 32 * 32 * 4), reference.slice(0, 32 * 32 * 4), shifted(10).slice(0, 32 * 32 * 4))).toThrow(/insufficient/);
  expect(VISUAL_ORACLE_V1.maximumMeanRgbError).toBe(0.035); expect(VISUAL_ORACLE_V1.minimumFaultMeanRgbError).toBe(0.01);
});

async function fixture(rotated: boolean) {
  const root = new URL('../../fixtures/F04-DETACH/', import.meta.url); const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
  if (rotated) { manifest.frame.originMeters = [7, -3, 11]; manifest.frame.rotationXyzw = [0, 0, Math.SQRT1_2, Math.SQRT1_2]; }
  return importFixture(new TextEncoder().encode(JSON.stringify(manifest)), new Map(manifest.payloads.map((payload: { id: string; path: string }) => [payload.id, new Uint8Array(readFileSync(new URL(payload.path, root)))])));
}
const close = (actual: readonly number[], expected: readonly number[]) => { expect(actual).toHaveLength(expected.length); actual.forEach((value, axis) => expect(value).toBeCloseTo(expected[axis], 5)); };
const frame = (value: LabFixtureV1, cameraId = value.cameras[0].id) => createFrameInput({ tick: 0, seconds: 0, paused: true, sourceRevision: fixtureRevision(value), cameraId, weather: { windMps: [0, 0, 0], rain01: 0, snow01: 0, cloud01: 0 } });
function checkAligned(value: LabFixtureV1, scene: Scene, rotated: boolean) {
  const direction = ([x, y, z]: readonly number[] | Float32Array) => rotated ? [-y, x, z] : [x, y, z];
  const point = (vector: readonly number[] | Float32Array) => direction(vector).map((channel, axis) => channel + value.frame.originMeters[axis]);
  const mesh = scene.meshes.find((entry) => entry.isEnabled())!; const vertex = mesh.getVerticesData(VertexBuffer.PositionKind)!.slice(0, 3);
  close(Vector3.TransformCoordinates(Vector3.FromArray(vertex), mesh.computeWorldMatrix(true)).asArray(), point(vertex));
  const camera = scene.activeCamera!; camera.getViewMatrix(true); const source = value.cameras.find((entry) => entry.id === camera.metadata)!;
  close(camera.position.asArray(), point(source.positionMeters)); close(camera.upVector.asArray(), direction(source.up));
  close((camera as import('@babylonjs/core/Cameras/freeCamera.js').FreeCamera).getTarget().asArray(), point(source.targetMeters));
  const ambient = scene.lights.find((light) => light instanceof HemisphericLight) as HemisphericLight;
  close(ambient.direction.asArray(), direction([0, 1, 0]));
  for (const [role, local] of [['key', [-10, 20, -10]], ['fill', [10, 8, 10]]] as const) {
    const light = scene.lights.find((entry) => entry.name === `RD12:${role}`) as DirectionalLight;
    close(light.position.asArray(), point(local)); close(light.direction.asArray(), direction(local.map((channel) => -channel)));
  }
  expect(createHash('sha256').update(canonicalJson(value)).digest('hex')).toBe(getFixtureDigest(value));
}
it('REPAIR P2 translated AND rotated root aligns geometry/camera points and camera/light directions; replacement rollback/reset preserve digests', async () => {
  const identity = await fixture(false); const rotated = await fixture(true); const before = [getFixtureDigest(identity), getFixtureDigest(rotated)];
  const engine = new NullEngine(); const scene = new Scene(engine); const candidate = buildBabylonProjection(rotated, scene, new AbortController().signal);
  try { expect(candidate.meshes.every((mesh) => !mesh.isEnabled())).toBe(true); expect(candidate.lights.every((light) => !light.isEnabled())).toBe(true); }
  finally { candidate.dispose(); scene.dispose(); engine.dispose(); }
  let wait: Promise<void> | undefined; let reject = false;
  vi.spyOn(StandardMaterial.prototype, 'forceCompilationAsync').mockImplementation(async () => { await wait; if (reject) { throw new Error('CONTROLLED root repair compile rejection'); } });
  vi.spyOn(Scene.prototype, 'isReady').mockReturnValue(true);
  const canvas = Object.assign(new EventTarget(), { width: 1280, height: 720, style: {}, getContext: () => ({}) }) as unknown as HTMLCanvasElement;
  const host = await createBabylonExperiment({ canvas, fixture: identity, preset: { id: 'C3' }, signal: new AbortController().signal, capabilities: {} });
  try {
    host.camera.metadata = identity.cameras[0].id; checkAligned(identity, host.scene, false);
    const old = [...host.scene.meshes]; const oldLights = [...host.scene.lights]; const oldCamera = host.camera.position.asArray();
    let finish!: () => void; wait = new Promise<void>((resolve) => { finish = resolve; }); reject = true;
    const pending = host.replaceFixture(rotated); await Promise.resolve();
    expect(host.scene.meshes.filter((mesh) => !old.includes(mesh)).every((mesh) => !mesh.isEnabled())).toBe(true);
    expect(oldLights.every((light) => !light.isEnabled())).toBe(true); expect(host.camera.position.asArray()).toEqual(oldCamera);
    finish(); await expect(pending).rejects.toThrow(/CONTROLLED root repair/); wait = undefined; reject = false;
    expect(host.scene.meshes).toEqual(old); expect(host.scene.lights).toEqual(oldLights); expect(oldLights.every((light) => light.isEnabled())).toBe(true);
    checkAligned(identity, host.scene, false);
    await host.replaceFixture(rotated); host.camera.metadata = rotated.cameras[0].id; checkAligned(rotated, host.scene, true);
    host.setFrame(frame(rotated, rotated.cameras.at(-1)!.id)); host.camera.metadata = rotated.cameras.at(-1)!.id; checkAligned(rotated, host.scene, true);
    await host.replaceFixture(identity); host.setResetTick(0); host.setFrame(frame(identity)); host.camera.metadata = identity.cameras[0].id; checkAligned(identity, host.scene, false);
    expect([getFixtureDigest(identity), getFixtureDigest(rotated)]).toEqual(before); expect(host.readDiagnostics().productIntegrated).toBe(false);
  } finally { await host.dispose(); vi.restoreAllMocks(); }
  expect(liveBabylonHostCounts()).toEqual({ engines: 0, renderloops: 0, listeners: 0, pendingNativeInitializations: 0 });
});
