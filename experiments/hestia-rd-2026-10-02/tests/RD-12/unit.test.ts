import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Material } from '@babylonjs/core/Materials/material.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { copyFixturePayload, fixtureRevision, getFixtureDigest, type LabFixtureV1 } from '../../src/contracts/fixture';
import { createFrameInput, mountExperiment, registeredMountCount } from '../../src/contracts/experiment';
import { sampleScenario } from '../../src/contracts/scenario';
import { loadInventory, loadReplay } from '../../src/runner/assets';
import { createScenarioRunner } from '../../src/runner/scenarioRunner';
import { createBabylonExperiment, liveBabylonHostCounts, parseSeekTick, type BabylonHost } from '../../src/experiments/babylon';
import { buildBabylonProjection, FLOAT32_TOLERANCE, UNSUPPORTED_FEATURES } from '../../src/experiments/babylon/projection';
import { compareSceneRoi, requireQualifiedParity, VISUAL_ORACLE_V1 } from '../../reports/RD-12/oracle';

// Real Babylon Scene/Mesh/VertexData/material/camera/math on NullEngine. Native
// engine, compilation, readiness and rendering are CONTROLLED CPU doubles only.
const control = vi.hoisted(() => ({ engines: [] as any[], initWait: undefined as Promise<void> | undefined,
  initError: '', compileWait: undefined as Promise<void> | undefined, compileError: '', renderError: '', webglVersion: 2 }));
vi.mock('@babylonjs/core/Engines/engine.js', async () => {
  const { NullEngine } = await import('@babylonjs/core/Engines/nullEngine.js');
  class ControlledEngine extends NullEngine {
    callback?: () => void; disposalCalls = 0; endFrames = 0;
    constructor(readonly canvasOrContext: unknown, readonly antialias: boolean, readonly requestedOptions: unknown) { super(); this.getCaps().maxTextureSize = 8192; control.engines.push(this); }
    get webGLVersion() { return control.webglVersion; }
    runRenderLoop(callback: () => void) { this.callback = callback; }
    stopRenderLoop() { this.callback = undefined; }
    endFrame() { this.endFrames += 1; super.endFrame(); }
    dispose() { this.disposalCalls += 1; super.dispose(); }
  }
  return { Engine: ControlledEngine };
});
vi.mock('@babylonjs/core/Engines/webgpuEngine.js', async () => {
  const { NullEngine } = await import('@babylonjs/core/Engines/nullEngine.js');
  class ControlledGpuEngine extends NullEngine {
    callback?: () => void; disposalCalls = 0; initCalls = 0; endFrames = 0;
    _device: any; initialized = false; translators: unknown[] = [];
    constructor(readonly ownedCanvas: unknown, readonly requestedOptions: unknown) { super(); this.getCaps().maxTextureSize = 8192; control.engines.push(this); }
    get isWebGPU() { return true; }
    async initAsync(...options: unknown[]) {
      this.initCalls += 1; this.translators = options; await control.initWait;
      if (control.initError) { throw new Error(control.initError); }
      let lose!: (info: unknown) => void; const lost = new Promise((resolve) => { lose = resolve; });
      this._device = Object.assign(new EventTarget(), { limits: { maxTextureDimension2D: 8192 }, lost, destroy: vi.fn(() => lose({ reason: 'destroyed', message: 'CONTROLLED owned loss' })) });
      this.initialized = true;
    }
    runRenderLoop(callback: () => void) { this.callback = callback; }
    stopRenderLoop() { this.callback = undefined; }
    endFrame() { this.endFrames += 1; super.endFrame(); }
    dispose() { if (!this.initialized) { throw new Error('ILLEGAL uninitialized WebGPU dispose'); } this.disposalCalls += 1; this._device.destroy(); super.dispose(); }
  }
  return { WebGPUEngine: ControlledGpuEngine };
});
const handles: BabylonHost[] = [];
beforeEach(() => {
  control.engines = []; control.initWait = control.compileWait = undefined; control.initError = control.compileError = control.renderError = ''; control.webglVersion = 2;
  vi.stubGlobal('navigator', { gpu: {} });
  vi.spyOn(StandardMaterial.prototype, 'forceCompilationAsync').mockImplementation(async () => { await control.compileWait; if (control.compileError) { throw new Error(control.compileError); } });
  vi.spyOn(Scene.prototype, 'isReady').mockReturnValue(true);
  vi.spyOn(Scene.prototype, 'render').mockImplementation(() => { if (control.renderError) { throw new Error(control.renderError); } });
});
afterEach(async () => {
  for (const handle of handles.splice(0)) { await handle.dispose(); }
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  expect(liveBabylonHostCounts()).toEqual({ engines: 0, renderloops: 0, listeners: 0, pendingNativeInitializations: 0 });
});
const fixtureRoot = new URL('../../fixtures/', import.meta.url); const publicRoot = new URL('http://127.0.0.1:5280/');
const localFetch: typeof fetch = async (input) => new Response(readFileSync(new URL(new URL(String(input)).pathname.slice(1), fixtureRoot)));
const replays = new Map<string, ReturnType<typeof loadReplay>>();
function replay(id: string) {
  if (!replays.has(id)) { replays.set(id, loadInventory(publicRoot, localFetch).then((inventory) => loadReplay(inventory, id, publicRoot, localFetch))); }
  return replays.get(id)!;
}
const frameAt = (fixture: LabFixtureV1, tick = 0, cameraId = fixture.cameras[0].id) => createFrameInput({ tick, seconds: tick / 60, paused: true,
  cameraId, sourceRevision: fixtureRevision(fixture), weather: { windMps: [0, 0, 0], rain01: 0, snow01: 0, cloud01: 0 } });
function canvas() { return Object.assign(new EventTarget(), { width: 1280, height: 720, style: {}, getContext: () => ({ isContextLost: () => false }) }) as unknown as HTMLCanvasElement; }
async function mount(fixture: LabFixtureV1, mode = 'C3', abort = new AbortController()) {
  const host = await createBabylonExperiment({ canvas: canvas(), fixture, preset: { id: mode }, signal: abort.signal, capabilities: {} }); handles.push(host); return host;
}
function pump() { const engine = control.engines.at(-1)!; engine.beginFrame(); engine.callback?.(); engine.endFrame(); }
function checkProjection(fixture: LabFixtureV1, scene: Scene) {
  const active = scene.meshes.filter((mesh) => mesh.isEnabled()); expect(active).toHaveLength(fixture.objects.reduce((sum, owner) => sum + owner.meshes.length, 0));
  for (const owner of fixture.objects) {
    for (const [meshIndex, source] of owner.meshes.entries()) {
      const mesh = active.find((entry) => entry.metadata?.ownerId === owner.ownerId && entry.metadata?.meshIndex === meshIndex)!;
      expect(mesh).toBeDefined(); expect((mesh.parent as import('@babylonjs/core/Meshes/transformNode.js').TransformNode).position.asArray()).toEqual(owner.frame.originMeters);
      expect((mesh.parent as any).rotationQuaternion.asArray()).toEqual(owner.frame.rotationXyzw);
      expect((mesh.parent!.parent as any).position.asArray()).toEqual(fixture.frame.originMeters);
      expect((mesh.parent!.parent as any).rotationQuaternion.asArray()).toEqual(fixture.frame.rotationXyzw);
      expect(mesh.metadata).toMatchObject({ ownerId: owner.ownerId, sourceNamespace: owner.sourceNamespace, sourceRevision: owner.sourceRevision, materialId: source.materialId });
      expect(Array.from(mesh.getIndices()!)).toEqual(Array.from(copyFixturePayload(fixture, source.indices)));
      for (const [kind, payload] of [[VertexBuffer.PositionKind, source.positions], [VertexBuffer.NormalKind, source.normals]] as const) {
        if (!payload) { continue; } const original = copyFixturePayload(fixture, payload); const projected = mesh.getVerticesData(kind)!;
        expect(projected.length).toBe(original.length); for (let index = 0; index < original.length; index += 1) { expect(Math.abs(projected[index] - original[index])).toBeLessThanOrEqual(FLOAT32_TOLERANCE); }
      }
      if (source.colors) {
        const original = copyFixturePayload(fixture, source.colors); const rgba = mesh.getVerticesData(VertexBuffer.ColorKind)!; expect(rgba).toHaveLength(original.length / 3 * 4);
        for (let vertex = 0; vertex < original.length / 3; vertex += 1) {
          expect(Array.from(rgba.slice(vertex * 4, vertex * 4 + 3))).toEqual(Array.from(new Float32Array(original.slice(vertex * 3, vertex * 3 + 3)))); expect(rgba[vertex * 4 + 3]).toBe(1);
        }
      }
    }
  }
}

it('BAB01 exact F01/F04/F06 winding/index/frame/normal/linear-RGB material-slot/stable-owner projection; private SDK candidate is disabled', async () => {
  const engine = new NullEngine(); const scene = new Scene(engine); scene.useRightHandedSystem = true;
  try {
    for (const id of ['F01-HVP-COAST-REPLAY', 'F04-DETACH-REPLAY', 'F06-MATERIAL-REPLAY']) {
      const { initialFixture: fixture } = await replay(id); const before = getFixtureDigest(fixture); const projection = buildBabylonProjection(fixture, scene, new AbortController().signal);
      expect(projection.meshes.length).toBeGreaterThan(0); expect(projection.meshes.every((mesh: any) => !mesh.isEnabled())).toBe(true);
      projection.setEnabled(true); checkProjection(fixture, scene);
      for (const mesh of projection.meshes) { expect(mesh.sideOrientation).toBe(Material.CounterClockWiseSideOrientation); expect(mesh.getVerticesData(VertexBuffer.NormalKind)).not.toBeNull(); }
      expect(getFixtureDigest(fixture)).toBe(before); projection.dispose(); projection.dispose(); expect(scene.meshes).toHaveLength(0); expect(scene.materials).toHaveLength(0); expect(scene.lights).toHaveLength(0);
    }
  } finally { scene.dispose(); engine.dispose(); }
},120_000); // Reuse the documented RD12 v2 CPU execution budget; all assertions unchanged.

it('BAB02 declared blend/depth/shadow/emission and lighting/fog/tone profiles do not import F01 defaults into synthetic replay', async () => {
  for (const id of ['F01-HVP-COAST-REPLAY', 'F04-DETACH-REPLAY', 'F06-MATERIAL-REPLAY']) {
    const { initialFixture: fixture } = await replay(id); const host = await mount(fixture); checkProjection(fixture, host.scene);
    expect(host.scene.shadowsEnabled).toBe(false); expect(host.scene.useRightHandedSystem).toBe(true);
    for (const mesh of host.scene.meshes) {
      const declared = fixture.materials.find((entry) => entry.id === mesh.metadata.materialId)!; const material = mesh.material as StandardMaterial;
      expect(material.diffuseColor.asArray()).toEqual(declared.colorLinearRgb); expect(material.specularColor.asArray()).toEqual([0, 0, 0]);
      expect(material.alpha).toBe(declared.opacity ?? 1); expect(material.disableDepthWrite).toBe(!(declared.depthWrite ?? true)); expect(material.backFaceCulling).toBe(!declared.doubleSided);
      expect(mesh.hasVertexAlpha).toBe(false); expect(mesh.useVertexColors).toBe(Boolean(fixture.objects.find((owner) => owner.ownerId === mesh.metadata.ownerId)!.meshes[mesh.metadata.meshIndex].colors));
      expect(material.emissiveColor.asArray()).toEqual(declared.role === 'emission' ? declared.colorLinearRgb : [0, 0, 0]);
      if (declared.role === 'water-presentation') { expect(mesh.alphaIndex).toBeGreaterThan(0); expect(material.transparencyMode).toBe(Material.MATERIAL_ALPHABLEND); }
    }
    const diagnostic = host.readDiagnostics(); expect(diagnostic.presentation.exposure).toBe(fixture.presentation?.exposure ?? 1);
    expect(diagnostic.presentation.toneMapping).toBe(fixture.presentation?.toneMapping ?? 'none');
    expect(host.scene.fogMode).toBe(id.startsWith('F01') ? Scene.FOGMODE_LINEAR : Scene.FOGMODE_NONE);
    if (id.startsWith('F01')) { expect([host.scene.fogStart, host.scene.fogEnd]).toEqual([48, 170]); }
    expect(diagnostic.presentation.lights.map((light: any) => light.intensity)).toEqual(fixture.presentation ? ['ambient', 'key', 'fill'].map((role) => (fixture.presentation!.lighting as any)[role].intensity) : [0.85, 2, 0.5]);
    expect(host.readFacts().unsupportedFeatures).toEqual(expect.arrayContaining(UNSUPPORTED_FEATURES)); await host.dispose();
  }
},120_000); // Millions of source projection assertions, not a native benchmark deadline.

it('BAB02 private compile rejection retains previous complete generation/source/rendered identity and removes all rejected autojoined resources', async () => {
  const data = await replay('F06-MATERIAL-REPLAY'); const host = await mount(data.initialFixture); pump(); const previous = host.readDiagnostics(); const old = [...host.scene.meshes];
  let finish!: () => void; control.compileWait = new Promise<void>((resolve) => { finish = resolve; }); control.compileError = 'CONTROLLED compile reject';
  const pending = host.replaceFixture(data.scenario.snapshots[0].manifest); await Promise.resolve();
  expect(old.every((mesh) => mesh.isEnabled() && !mesh.isDisposed())).toBe(true); expect(host.scene.meshes.filter((mesh) => !old.includes(mesh)).every((mesh) => !mesh.isEnabled())).toBe(true);
  const submissions = host.readDiagnostics().submittedFrames; pump(); expect(host.readDiagnostics().submittedFrames).toBe(submissions);
  expect(() => host.setFrame(frameAt(data.initialFixture))).toThrow(/pending/i); finish(); await expect(pending).rejects.toThrow('CONTROLLED compile reject');
  expect(host.scene.meshes).toEqual(old); expect(host.readFacts().fixtureDigest).toBe(getFixtureDigest(data.initialFixture)); expect(host.readDiagnostics().rendered).toEqual(previous.rendered);
  control.compileWait = undefined; control.compileError = ''; await host.replaceFixture(data.scenario.snapshots[0].manifest);
  expect(old.every((mesh) => mesh.isDisposed())).toBe(true); expect(host.readDiagnostics().rendered).toBeNull(); checkProjection(data.scenario.snapshots[0].manifest, host.scene);
});

it('BAB02 frozen F04/F06 opening/moving owner sourceRevision, complete old-generation removal, reset/backseek and same-tick camera/resize submission', async () => {
  for (const id of ['F04-DETACH-REPLAY', 'F06-MATERIAL-REPLAY']) {
    const data = await replay(id); const host = await mount(data.initialFixture); const runner = createScenarioRunner(data.scenario, host, host.setResetTick); await runner.pause(true);
    for (const tick of [0, ...data.scenario.snapshots.flatMap((snapshot) => [snapshot.tick - 1, snapshot.tick]), 1559, 1560, 1559, 0]) {
      const old = [...host.scene.meshes]; const generation = host.readDiagnostics().projectionGeneration;
      await runner.seek(tick); const sample = sampleScenario(data.scenario, tick, true); checkProjection(sample.fixture, host.scene);
      const diagnostic = host.readDiagnostics(); expect(diagnostic.fixtureDigest).toBe(getFixtureDigest(sample.fixture)); expect(diagnostic.frame).toEqual(sample.frame); expect(diagnostic.resetTick).toBe(sample.resetTick);
      if (diagnostic.projectionGeneration !== generation) { expect(old.every((mesh) => mesh.isDisposed())).toBe(true); }
      pump(); expect(host.readDiagnostics().rendered).toMatchObject({ tick, fixtureDigest: getFixtureDigest(sample.fixture), sourceRevision: fixtureRevision(sample.fixture), resetTick: sample.resetTick, projectionGeneration: diagnostic.projectionGeneration });
    }
    const generation = host.readDiagnostics().projectionGeneration; const camera = data.initialFixture.cameras.at(-1)!.id; host.setFrame(frameAt(data.initialFixture, 0, camera)); expect(host.readDiagnostics().rendered).toBeNull();
    pump(); expect(host.readDiagnostics().rendered!.cameraId).toBe(camera); host.resize(640, 360, 2); expect(host.readDiagnostics().rendered).toBeNull(); pump();
    expect(host.readDiagnostics().rendered!.presentationGeneration).toBe(host.readDiagnostics().presentationGeneration); expect(host.readDiagnostics().projectionGeneration).toBe(generation);
    expect(host.readDiagnostics().resolution).toEqual({ width: 640, height: 360, dpr: 2, bufferWidth: 1280, bufferHeight: 720 });
    await runner.reset(); expect(host.readDiagnostics().frame).toEqual(sampleScenario(data.scenario, 0, false).frame); await host.dispose();
  }
});

it('BAB03 20 owned mount/dispose cycles PER C3/C4; no product input/save/storage and no native-memory claim', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); const storage = { setItem: vi.fn(() => { throw new Error('FORBIDDEN storage'); }) }; vi.stubGlobal('localStorage', storage);
  for (const mode of ['C3', 'C4']) {
    for (let cycle = 0; cycle < 20; cycle += 1) {
      let host!: BabylonHost; const handle = await mountExperiment(async (context) => { host = await createBabylonExperiment(context); return host; },
        { canvas: canvas(), fixture: initialFixture, preset: { id: mode }, signal: new AbortController().signal, capabilities: {} });
      expect(registeredMountCount()).toBe(1); expect(host.scene.activeCamera).toBe(host.camera); expect(host.camera.inputs.attachedToElement).toBe(false);
      handle.setFrame(frameAt(initialFixture)); pump(); expect(handle.readFacts().logicalCosts.gpuMs).not.toHaveProperty('value'); expect(handle.readFacts().logicalCosts.gpuBytes).not.toHaveProperty('value');
      await handle.dispose(); await handle.dispose(); expect(registeredMountCount()).toBe(0); expect(host.readCleanup()).toMatchObject({ disposed: true, ownedMeshes: 0, ownedMaterials: 0, ownedLights: 0 });
      expect(liveBabylonHostCounts()).toEqual({ engines: 0, renderloops: 0, listeners: 0, pendingNativeInitializations: 0 });
    }
  }
  expect(storage.setItem).not.toHaveBeenCalled();
});

it('BAB04 separate explicit C3 WebGL2 / C4 WebGPU admission rejects GL1/missing GPU/unknown profile without fallback', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); control.webglVersion = 1; await expect(mount(initialFixture)).rejects.toThrow(/UNSUPPORTED.*C3.*WebGL2/i);
  control.webglVersion = 2; vi.stubGlobal('navigator', {}); await expect(mount(initialFixture, 'C4')).rejects.toThrow(/UNSUPPORTED.*C4.*WebGPU/i);
  await expect(mount(initialFixture, 'C2')).rejects.toThrow(/explicit.*C3.*C4/i); const host = await mount(initialFixture, 'C3'); expect(host.readDiagnostics().backend.actual).toBe('webgl2');
});

it('BAB04 awaits actual init, blocks translator paths, init/compile failure cleanup is stage-aware and retains first terminal reason', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); let finish!: () => void; control.initWait = new Promise<void>((resolve) => { finish = resolve; }); let returned = false;
  const work = mount(initialFixture, 'C4').then((host) => { returned = true; return host; }); await Promise.resolve(); expect(returned).toBe(false); expect(liveBabylonHostCounts().renderloops).toBe(0);
  finish(); const host = await work; const engine = control.engines.at(-1)!; expect(engine.initCalls).toBe(1); expect(engine.translators).toEqual([{ jsPath: '', wasmPath: '' }, { jsPath: '', wasmPath: '' }]);
  expect(host.readDiagnostics().rendered).toBeNull(); await host.dispose(); control.initWait = undefined; control.initError = 'CONTROLLED init reject';
  await expect(mount(initialFixture, 'C4')).rejects.toThrow('CONTROLLED init reject'); control.initError = ''; control.compileError = 'CONTROLLED initial resource reject';
  await expect(mount(initialFixture, 'C3')).rejects.toThrow('CONTROLLED initial resource reject'); expect(control.engines.at(-1)!.disposalCalls).toBe(1);
});

it('BAB04 abort during late init releases late device and mount reservation; no success/loop resurrection', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); let finish!: () => void; control.initWait = new Promise<void>((resolve) => { finish = resolve; }); const abort = new AbortController();
  const work = mountExperiment(createBabylonExperiment, { canvas: canvas(), fixture: initialFixture, preset: { id: 'C4' }, signal: abort.signal, capabilities: {} });
  const rejected = expect(work).rejects.toThrow(/abort/i); await Promise.resolve(); await Promise.resolve(); abort.abort(); finish(); await rejected;
  await Promise.resolve(); expect(registeredMountCount()).toBe(0); expect(control.engines[0].disposalCalls).toBe(1); expect(control.engines[0].callback).toBeUndefined();
});

it('BAB04 bounded init/compile deadlines reject never-ready work, preserve old candidate and clean late asynchronous results', async () => {
  const data = await replay('F06-MATERIAL-REPLAY'); const host = await mount(data.initialFixture); const old = [...host.scene.meshes]; vi.useFakeTimers();
  control.compileWait = new Promise<void>(() => {}); const work = host.replaceFixture(data.scenario.snapshots[0].manifest); const rejected = expect(work).rejects.toThrow(/deadline/i);
  await vi.advanceTimersByTimeAsync(30_001); await rejected; expect(host.scene.meshes).toEqual(old); control.compileWait = undefined; await host.dispose();
  let finish!: () => void; control.initWait = new Promise<void>((resolve) => { finish = resolve; }); const init = mount(data.initialFixture, 'C4'); const rejectedInit = expect(init).rejects.toThrow(/deadline/i);
  await vi.advanceTimersByTimeAsync(30_001); await rejectedInit; expect(liveBabylonHostCounts().renderloops).toBe(0); finish(); await vi.advanceTimersByTimeAsync(1);
  expect(control.engines.at(-1)!.disposalCalls).toBe(1);
});

it('BAB04 native-shaped first loss/uncaptured-error/render failure is terminal, stops one loop and disposes once; never getError zero proof', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); const host = await mount(initialFixture, 'C4'); pump(); const engine = control.engines.at(-1)!; const submissions = host.readDiagnostics().submittedFrames;
  const error = new Event('uncapturederror'); Object.assign(error, { error: { message: 'CONTROLLED first native validation error' } }); engine._device.dispatchEvent(error); await host.dispose(); pump();
  expect(host.readDiagnostics().terminal).toContain('CONTROLLED first native validation error'); expect(host.readDiagnostics().terminal).not.toContain('destroyed'); expect(host.readDiagnostics().submittedFrames).toBe(submissions);
  expect(() => host.setFrame(frameAt(initialFixture))).toThrow(); expect(engine.disposalCalls).toBe(1);
  const second = await mount(initialFixture, 'C3'); control.renderError = 'CONTROLLED render failure'; pump(); await second.dispose(); expect(second.readDiagnostics().terminal).toContain('CONTROLLED render failure');
  control.renderError = ''; const ownedCanvas = canvas(); const third = await createBabylonExperiment({ canvas: ownedCanvas, fixture: initialFixture, preset: { id: 'C3' }, signal: new AbortController().signal, capabilities: {} }); handles.push(third);
  ownedCanvas.dispatchEvent(new Event('webglcontextlost')); await third.dispose(); expect(third.readDiagnostics().terminal).toContain('WebGL context lost');
});

it('BAB01 no bootstrap/loop-only READY: submission identity is captured by actual Scene.render and published only after endFrame', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); const host = await mount(initialFixture); const engine = control.engines.at(-1)!;
  engine.endFrame(); expect(host.readDiagnostics().submittedFrames).toBe(0); engine.beginFrame(); engine.callback();
  expect(host.readDiagnostics().rendered).toBeNull(); engine.endFrame(); expect(host.readDiagnostics().rendered!.tick).toBe(0);
  host.setFrame(frameAt(initialFixture, 1)); engine.beginFrame(); engine.callback(); host.setFrame(frameAt(initialFixture, 2)); engine.endFrame();
  expect(host.readDiagnostics().rendered).toBeNull(); pump(); expect(host.readDiagnostics().rendered!.tick).toBe(2);
});

it('BAB04 NEGATIVE stale source/camera/reset/invalid resize/empty typed seek fail before changing admitted state', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); const host = await mount(initialFixture); const before = host.readDiagnostics();
  expect(() => host.setFrame({ ...frameAt(initialFixture), sourceRevision: 999 })).toThrow(/stale/i); expect(() => host.setFrame({ ...frameAt(initialFixture), cameraId: 'unknown' })).toThrow(/camera/i);
  expect(() => host.resize(99999, 720, 1)).toThrow(/capability/i); expect(host.readDiagnostics().resolution).toEqual(before.resolution);
  for (const value of ['', ' ', '1.5', '-1', 'NaN', '1e2', '99999']) { expect(() => parseSeekTick(value, 1800)).toThrow(/tick/i); }
  expect(parseSeekTick('1560', 1800)).toBe(1560); expect(host.readDiagnostics().frame).toEqual(before.frame);
  host.setResetTick(60); expect(() => host.setFrame(frameAt(initialFixture))).toThrow(/reset/i);
});

it('BAB02 RD12 v1 visual oracle rejects background/32px/insensitive fault FALSE-GREEN before granting positive parity', () => {
  const reference = Array.from({ length: 4096 * 4 }, (_, index) => index % 4 === 3 ? 255 : Math.floor(index / 4) % 2 ? 220 : 35); const fault = reference.map((value, index) => index % 4 === 3 ? value : 128);
  expect(requireQualifiedParity(reference, reference, fault).positive.meanRgbError).toBe(0);
  expect(() => requireQualifiedParity(reference, reference, reference)).toThrow(/FALSE-GREEN/); expect(() => compareSceneRoi(Array(4096 * 4).fill(128), Array(4096 * 4).fill(128))).toThrow(/scene signal/);
  expect(() => compareSceneRoi(reference.slice(0, 32 * 32 * 4), reference.slice(0, 32 * 32 * 4))).toThrow(/insufficient/);
  expect(VISUAL_ORACLE_V1.minimumFaultMeanRgbError).toBe(0.01); expect(VISUAL_ORACLE_V1.maximumMeanRgbError).toBe(0.035);
});
