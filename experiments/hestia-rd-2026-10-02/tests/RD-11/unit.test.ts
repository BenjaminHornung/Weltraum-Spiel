import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Mesh, Scene, DoubleSide, FrontSide, ACESFilmicToneMapping, HalfFloatType, NoToneMapping, Vector2, type BufferGeometry } from 'three';
import { materialOpacity } from 'three/tsl';
import { NodeMaterial, type MeshLambertNodeMaterial } from 'three/webgpu';
import { copyFixturePayload, fixtureRevision, getFixtureDigest, type LabFixtureV1 } from '../../src/contracts/fixture';
import { createFrameInput, mountExperiment, registeredMountCount } from '../../src/contracts/experiment';
import { sampleScenario } from '../../src/contracts/scenario';
import { loadInventory, loadReplay } from '../../src/runner/assets';
import { createScenarioRunner } from '../../src/runner/scenarioRunner';
import { mountThreeEffect, projectFloat32 } from '../../src/experiments/three-control';
import { ownerPose } from '../../src/runner/threeHost';
import { createThreeWebGpuExperiment, liveWebGpuHostCounts, type ThreeWebGpuHost } from '../../src/experiments/three-webgpu';
import { buildLights, buildNodeProjection, configurePresentation, UNSUPPORTED_FEATURES } from '../../src/experiments/three-webgpu/projection';
import { compareRoi, requireNativeFeatures, ROIS, ROI_THRESHOLDS } from '../../reports/RD-11/oracle';

// All renderer operations below are controlled CPU doubles. No native backend/GPU claim.
const control = vi.hoisted(() => ({ actual: 'auto', initError: '', compileError: '', readyFlag: true,
  initWait: undefined as Promise<void> | undefined, renderers: [] as any[] }));
vi.mock('three/webgpu', async (original) => {
  const actual = await original<typeof import('three/webgpu')>();
  class ControlledRenderer {
    initialized = false; disposed = false; initCalls = 0; renderCalls = 0; cleanupCalls = 0;
    callback: (() => void) | null = null; width = 0; height = 0; dpr = 1;
    samples = 4; currentSamples = 0; shadowMap = { enabled: false };
    outputColorSpace = ''; toneMapping = 0; toneMappingExposure = 1;
    onDeviceLost: (info: { api: string; message: string }) => void = () => {};
    onError: (info: unknown) => void = () => {};
    _frameBufferTargets = new Map(); canvasTarget = { colorTexture: {} };
    backend: any;
    constructor(readonly options: any) {
      const kind = control.actual === 'auto' ? options.forceWebGL ? 'webgl2' : 'webgpu' : control.actual;
      this.backend = { isWebGLBackend: kind === 'webgl2', isWebGPUBackend: kind === 'webgpu', compatibilityMode: kind === 'webgpu' ? false : null,
        device: kind === 'webgpu' ? { limits: { maxTextureDimension2D: 8192 }, destroy: () => { this.cleanupCalls += 1; } } : undefined,
        gl: kind === 'webgl2' ? { MAX_TEXTURE_SIZE: 1, getParameter: () => 8192 } : undefined,
        extensions: kind === 'webgl2' ? {} : null, get: () => ({ format: 'CONTROLLED-NOT-NATIVE-rgba16float', texture: { sampleCount: 1 }, msaaTexture: { sampleCount: 4 } }),
        dispose: () => { this.cleanupCalls += 1; } };
      this._frameBufferTargets.set(this.canvasTarget, { texture: {}, samples: 4 }); control.renderers.push(this);
    }
    async init() { this.initCalls += 1; await control.initWait; if (control.initError) { throw new Error(control.initError); } this.initialized = control.readyFlag; return this; }
    hasInitialized() { return this.initialized; }
    async compileAsync() { if (control.compileError) { throw new Error(control.compileError); } }
    async setAnimationLoop(callback: (() => void) | null) { this.callback = callback; }
    render() { this.renderCalls += 1; }
    dispose() { this.disposed = true; this.callback = null; this.backend.dispose(); }
    setPixelRatio(value: number) { this.dpr = value; }
    getPixelRatio() { return this.dpr; }
    setSize(width: number, height: number) { this.width = width; this.height = height; }
    getSize(value: Vector2) { return value.set(this.width, this.height); }
    getDrawingBufferSize(value: Vector2) { return value.set(this.width * this.dpr, this.height * this.dpr); }
    getCanvasTarget() { return this.canvasTarget; }
    getOutputBufferType() { return HalfFloatType; }
  }
  return { ...actual, WebGPURenderer: ControlledRenderer };
});
const handles: ThreeWebGpuHost[] = [];
beforeEach(() => { control.actual = 'auto'; control.initError = ''; control.compileError = ''; control.readyFlag = true; control.initWait = undefined; control.renderers = []; });
afterEach(async () => { for (const handle of handles.splice(0)) { await handle.dispose(); } vi.restoreAllMocks(); expect(liveWebGpuHostCounts()).toEqual({ renderers: 0, renderloops: 0, abortListeners: 0 }); });
const root = new URL('../../fixtures/', import.meta.url); const publicRoot = new URL('http://127.0.0.1:5280/');
const localFetch: typeof fetch = async (input) => new Response(readFileSync(new URL(new URL(String(input)).pathname.slice(1), root)));
const replays = new Map<string, ReturnType<typeof loadReplay>>();
function replay(id: string) {
  if (!replays.has(id)) { replays.set(id, loadInventory(publicRoot, localFetch).then((inventory) => loadReplay(inventory, id, publicRoot, localFetch))); }
  return replays.get(id)!;
}
const frameAt = (fixture: LabFixtureV1, tick = 0) => createFrameInput({ tick, seconds: tick / 60, paused: true,
  cameraId: fixture.cameras[0].id, sourceRevision: fixtureRevision(fixture), weather: { windMps: [0, 0, 0], rain01: 0, snow01: 0, cloud01: 0 } });
async function mount(fixture: LabFixtureV1, mode = 'C2', abort = new AbortController()) {
  const handle = await createThreeWebGpuExperiment({ canvas: new EventTarget() as HTMLCanvasElement, fixture,
    preset: { id: mode }, signal: abort.signal, capabilities: {} }); handles.push(handle); return handle;
}
function pump() { control.renderers.at(-1)!.callback?.(); }
function checkProjection(fixture: LabFixtureV1, root: { children: any[] }) {
  expect(root.children.map((owner) => owner.name)).toEqual(fixture.objects.map((owner) => owner.ownerId));
  for (const [index, sourceOwner] of fixture.objects.entries()) {
    const owner = root.children[index]; expect(owner.position.toArray()).toEqual(sourceOwner.frame.originMeters);
    expect(owner.quaternion.toArray()).toEqual(sourceOwner.frame.rotationXyzw);
    expect(owner.userData).toEqual({ ownerId: sourceOwner.ownerId, sourceNamespace: sourceOwner.sourceNamespace, sourceRevision: sourceOwner.sourceRevision });
    for (const [meshIndex, source] of sourceOwner.meshes.entries()) {
      const mesh = owner.children[meshIndex] as Mesh<BufferGeometry, MeshLambertNodeMaterial[]>;
      expect(mesh.geometry.index!.array).toEqual(copyFixturePayload(fixture, source.indices));
      expect(mesh.geometry.getAttribute('position').array).toEqual(projectFloat32(copyFixturePayload(fixture, source.positions)));
      if (source.normals) { expect(mesh.geometry.getAttribute('normal').array).toEqual(projectFloat32(copyFixturePayload(fixture, source.normals))); }
      if (source.colors) { expect(mesh.geometry.getAttribute('color').array).toEqual(projectFloat32(copyFixturePayload(fixture, source.colors))); }
    }
  }
}

it('REN11 async admission waits; controlled C1/C2 use exact same requested quality and never infer from class flag', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); let finish!: () => void;
  control.initWait = new Promise<void>((resolve) => { finish = resolve; }); let resolved = false;
  const pending = mount(initialFixture, 'C1').then((handle) => { resolved = true; return handle; }); await Promise.resolve();
  expect(resolved).toBe(false); expect(liveWebGpuHostCounts().renderloops).toBe(0); finish(); const c1 = await pending;
  expect(c1.readDiagnostics().backend).toMatchObject({ requested: 'C1', actual: 'webgl2', initialized: true, fallbackObserved: false });
  expect(control.renderers[0].options).toMatchObject({ forceWebGL: true, outputBufferType: HalfFloatType, samples: 4, antialias: true, trackTimestamp: false });
  expect(c1.readDiagnostics().submittedFrames).toBe(0); pump(); expect(c1.readDiagnostics().submittedFrames).toBe(1);
  await c1.dispose(); control.initWait = undefined; const c2 = await mount(initialFixture);
  expect(c2.readDiagnostics().backend.actual).toBe('webgpu'); expect(control.renderers.at(-1)!.options).toMatchObject({ forceWebGL: false, samples: 4, outputBufferType: HalfFloatType });
  expect(c2.readFacts().logicalCosts.gpuMs).not.toHaveProperty('value'); expect(c2.readFacts().logicalCosts.gpuBytes).not.toHaveProperty('value');
});

it('REN11 NEGATIVE observed WebGL fallback cannot pass requested C2 and must clean initialized renderer', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); control.actual = 'webgl2';
  await expect(mount(initialFixture, 'C2')).rejects.toThrow(/UNSUPPORTED.*C2.*webgl2.*fallback/i);
  expect(control.renderers[0].cleanupCalls).toBe(1); expect(control.renderers[0].callback).toBeNull();
});

it('REN11 NEGATIVE unavailable/unknown backend and unresolved init cannot be called initialized success', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); control.actual = 'unknown';
  await expect(mount(initialFixture, 'C1')).rejects.toThrow(/UNSUPPORTED.*C1.*unknown/i);
  control.actual = 'auto'; control.readyFlag = false;
  await expect(mount(initialFixture, 'C2')).rejects.toThrow(/async.*init not complete/i);
});

it('REN12 PARITY exact F01 node/TSL material flags, AO/color/normal/index bytes and C0 descriptor parity', async () => {
  const { initialFixture: fixture } = await replay('F01-HVP-COAST-REPLAY'); const abort = new AbortController();
  const node = buildNodeProjection(fixture, abort.signal); const controlRoot = new (await import('three')).Group();
  const effect = await mountThreeEffect({ root: controlRoot, scene: new Scene(), camera: new (await import('three')).PerspectiveCamera(), fixture,
    frame: frameAt(fixture), resetTick: null, signal: abort.signal, capabilities: {}, ownerPose: (id) => ownerPose(fixture, id) }, { id: 'fixture-control' });
  try {
    checkProjection(fixture, node.root); let colored = 0; let water = 0;
    for (const [ownerIndex, owner] of fixture.objects.entries()) {
      for (const [meshIndex, source] of owner.meshes.entries()) {
        const mesh = node.root.children[ownerIndex].children[meshIndex] as Mesh<BufferGeometry, MeshLambertNodeMaterial[]>;
        const c0 = controlRoot.children[0].children[ownerIndex].children[meshIndex] as Mesh; const c0Material = (c0.material as any[])[0];
        const declared = fixture.materials.find((entry) => entry.id === source.materialId)!; const material = mesh.material[0];
        expect(material.type).toBe('MeshLambertNodeMaterial'); expect(material.colorNode).toBeNull(); expect(material.opacityNode).toBe(materialOpacity);
        expect(material.color.toArray()).toEqual(declared.colorLinearRgb); expect(material.vertexColors).toBe(Boolean(source.colors));
        for (const key of ['opacity', 'transparent', 'depthWrite', 'side', 'vertexColors', 'fog'] as const) { expect(material[key]).toBe(c0Material[key]); }
        expect(material.depthTest).toBe(true); expect(material.side).toBe(declared.doubleSided ? DoubleSide : FrontSide);
        if (source.colors) { colored += 1; }
        if (declared.role === 'water-presentation') { water += 1; expect(material.opacity).toBe(0.55); expect(material.depthWrite).toBe(false); expect(mesh.renderOrder).toBe(1); }
      }
    }
    expect(colored).toBeGreaterThan(0); expect(water).toBeGreaterThan(0);
    expect(getFixtureDigest(fixture)).toBe('688fda7d61d4d4a68a9917841ba8b7cb2722e04ddd6c4d9ce53039314d0b5b08');
  } finally { node.dispose(); await effect.dispose(); }
});

it('REN12 F01 frozen coast tone/fog/lights; F04/F06 actual synthetic noToneMapping/noFog and emission', async () => {
  for (const id of ['F01-HVP-COAST-REPLAY', 'F04-DETACH-REPLAY', 'F06-MATERIAL-REPLAY']) {
    const { initialFixture: fixture } = await replay(id); const scene = new Scene(); const renderer = { toneMapping: 0, toneMappingExposure: 0 };
    configurePresentation(fixture, scene, renderer); const lights = buildLights(fixture); const actualLights = lights.children.filter((child) => 'intensity' in child) as any[];
    expect(actualLights).toHaveLength(3);
    if (id.startsWith('F01')) {
      expect(renderer).toEqual({ toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05 }); expect(scene.fog).toMatchObject({ near: 48, far: 170 });
      expect(actualLights.map((light) => light.intensity)).toEqual(['ambient', 'key', 'fill'].map((key) => (fixture.presentation!.lighting as any)[key].intensity));
    } else {
      expect(renderer).toEqual({ toneMapping: NoToneMapping, toneMappingExposure: 1 }); expect(scene.fog).toBeNull(); expect(actualLights.map((light) => light.intensity)).toEqual([0.85, 2, 0.5]);
    }
    const projection = buildNodeProjection(fixture, new AbortController().signal);
    try { projection.root.traverse((object) => { if (object instanceof Mesh && object.userData.role === 'emission') {
      const material = (object.material as MeshLambertNodeMaterial[])[0]; expect(material.emissive.toArray()).toEqual(material.color.toArray()); expect(material).not.toHaveProperty('emissiveNode');
    } }); } finally { projection.dispose(); }
  }
});

it('REN12 frozen ROI oracle rejects full-color/missing-shader and cannot grant missing native shadow/AO success', () => {
  const pixels = [0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255];
  expect(compareRoi(pixels, pixels, 'C1-C2').meanRgbError).toBe(0);
  expect(() => compareRoi(pixels, [128, 128, 128, 255, 128, 128, 128, 255, 128, 128, 128, 255], 'C1-C2')).toThrow(/parity rejected.*full-color/i);
  expect(() => compareRoi(Array(12).fill(128), Array(12).fill(128), 'C0-C1')).toThrow(/lacks reference signal/i);
  expect(() => requireNativeFeatures(UNSUPPORTED_FEATURES, ['native-pcf-shadow-parity', 'native-ao-recompute-parity'])).toThrow(/UNSUPPORTED.*full color/i);
  expect(ROI_THRESHOLDS).toEqual({ c0c1MeanRgbError: 0.06, c1c2MeanRgbError: 0.035, minimumReferenceSignal: 0.015, minimumContrastRatio: 0.70 }); expect(ROIS).toHaveLength(3);
});

it('REN13 F04/F06 exact opening/moving owner buffers, stable IDs, atomic adoption, reset/backseek no stale history', async () => {
  for (const id of ['F04-DETACH-REPLAY', 'F06-MATERIAL-REPLAY']) {
    const data = await replay(id); const host = await mount(data.initialFixture); const runner = createScenarioRunner(data.scenario, host, host.setResetTick);
    await runner.pause(true);
    let changes = 0;
    for (const tick of [0, ...data.scenario.snapshots.flatMap((snapshot) => [snapshot.tick - 1, snapshot.tick]), 1559, 1560, 1559, 0]) {
      const before = host.readDiagnostics().projectionGeneration; await runner.seek(tick); const sample = sampleScenario(data.scenario, tick, true);
      const diagnostic = host.readDiagnostics(); expect(diagnostic.fixtureDigest).toBe(getFixtureDigest(sample.fixture)); expect(diagnostic.frame).toEqual(sample.frame); expect(diagnostic.resetTick).toBe(sample.resetTick);
      checkProjection(sample.fixture, host.scene.children[0]);
      if (diagnostic.projectionGeneration !== before) { changes += 1; expect(diagnostic.rendered).toBeNull(); }
      pump(); expect(host.readDiagnostics().rendered).toMatchObject({ tick, fixtureDigest: getFixtureDigest(sample.fixture), sourceRevision: fixtureRevision(sample.fixture), projectionGeneration: diagnostic.projectionGeneration });
    }
    expect(changes).toBeGreaterThan(2); await runner.reset(); expect(host.readDiagnostics().frame).toEqual(sampleScenario(data.scenario, 0, false).frame); await host.dispose();
  }
});

it('REN13 NEGATIVE failed/aborted private build retains previous complete projection; pending commands cannot mutate it', async () => {
  const data = await replay('F06-MATERIAL-REPLAY'); const abort = new AbortController(); const host = await mount(data.initialFixture, 'C2', abort); const old = host.scene.children[0];
  const payload = vi.spyOn(await import('../../src/contracts/fixture'), 'copyFixturePayload').mockImplementationOnce(() => { throw new Error('controlled-build-failure'); });
  await expect(host.replaceFixture(data.scenario.snapshots[0].manifest)).rejects.toThrow('controlled-build-failure'); payload.mockRestore();
  expect(host.scene.children[0]).toBe(old); expect(host.readFacts().fixtureDigest).toBe(getFixtureDigest(data.initialFixture));
  const work = host.replaceFixture(data.scenario.snapshots[0].manifest); expect(host.scene.children[0]).toBe(old);
  expect(() => host.setFrame(frameAt(data.initialFixture))).toThrow(/pending/i); abort.abort(); await expect(work).rejects.toThrow(/abort/i); await host.dispose();
  expect(host.readCleanup().ownedGeometries).toBe(0);
});

it('REN13 controlled Q0 100 frozen source replacements and 20 disposable owners; not native memory/performance', async () => {
  const data = await replay('F06-MATERIAL-REPLAY'); const host = await mount(data.initialFixture);
  for (let change = 0; change < 100; change += 1) {
    const next = change % 2 === 0 ? data.scenario.snapshots[0].manifest : data.initialFixture; await host.replaceFixture(next); host.setFrame(frameAt(next));
    checkProjection(next, host.scene.children[0]); expect(host.readFacts().liveResources.geometries.value).toBe(next.objects.reduce((sum, owner) => sum + owner.meshes.length, 0));
  }
  await host.dispose();
  for (let cycle = 0; cycle < 20; cycle += 1) { const next = await mount(data.initialFixture, cycle % 2 ? 'C1' : 'C2'); await next.dispose(); expect(next.readCleanup()).toMatchObject({ disposed: true, ownedGeometries: 0, ownedMaterials: 0 }); }
});

it('REN14 controlled init and shader compilation failures preserve first error and release partial/complete owned resources', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); control.initError = 'controlled-adapter-init-failure';
  await expect(mount(initialFixture)).rejects.toThrow('controlled-adapter-init-failure'); expect(control.renderers[0].cleanupCalls).toBe(1); expect(control.renderers[0].initCalls).toBe(1);
  control.initError = ''; control.compileError = 'controlled-node-compile-failure';
  await expect(mount(initialFixture)).rejects.toThrow('controlled-node-compile-failure'); expect(control.renderers[1].cleanupCalls).toBe(1); expect(control.renderers[1].callback).toBeNull();
});

it('REN14 controlled late async init abort cleans renderer and mount reservation without publishing success', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); let finish!: () => void; control.initWait = new Promise<void>((resolve) => { finish = resolve; }); const abort = new AbortController();
  const pending = mountExperiment(createThreeWebGpuExperiment, { canvas: new EventTarget() as HTMLCanvasElement, fixture: initialFixture, preset: { id: 'C2' }, signal: abort.signal, capabilities: {} });
  await Promise.resolve(); await Promise.resolve(); abort.abort(); finish(); await expect(pending).rejects.toThrow(/abort/i);
  expect(registeredMountCount()).toBe(0); expect(control.renderers[0].cleanupCalls).toBe(1); expect(control.renderers[0].callback).toBeNull();
});

it('REN14 controlled terminal loss/uncaptured error stops the single loop, rejects commands, keeps first reason and tears down once', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); const host = await mount(initialFixture); const renderer = control.renderers[0]; pump(); const submitted = host.readDiagnostics().submittedFrames;
  renderer.onDeviceLost({ api: 'WebGPU', message: 'controlled-loss' }); await host.dispose(); renderer.onError({ message: 'late-secondary-error' }); pump();
  expect(host.readDiagnostics().terminal).toContain('controlled-loss'); expect(host.readDiagnostics().terminal).not.toContain('secondary'); expect(host.readDiagnostics().submittedFrames).toBe(submitted);
  expect(() => host.setFrame(frameAt(initialFixture))).toThrow(); expect(renderer.cleanupCalls).toBe(1); expect(renderer.initCalls).toBe(1); expect(renderer.callback).toBeNull();
});

it('REN14 controlled resize preserves DPR/projection aspect, rejects missing/over-limit quality; teardown releases geometry/material events exactly once', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); const host = await mount(initialFixture, 'C1'); const events: string[] = [];
  host.scene.traverse((object) => { if (object instanceof Mesh) { object.geometry.addEventListener('dispose', () => { events.push('geometry'); });
    (object.material as MeshLambertNodeMaterial[])[0].addEventListener('dispose', () => { events.push('material'); }); } });
  const count = initialFixture.objects.reduce((sum, owner) => sum + owner.meshes.length, 0); host.resize(640, 360, 2);
  expect(host.readDiagnostics().resolution).toEqual({ width: 640, height: 360, dpr: 2, bufferWidth: 1280, bufferHeight: 720 }); expect(host.camera.aspect).toBe(16 / 9);
  expect(() => host.resize(9000, 720, 1)).toThrow(/capability/i); expect(() => host.resize(640, 360, 0)).toThrow();
  await host.dispose(); await host.dispose(); expect(events.filter((event) => event === 'geometry')).toHaveLength(count); expect(events.filter((event) => event === 'material')).toHaveLength(count);
  expect(host.readCleanup()).toMatchObject({ disposed: true, ownedGeometries: 0, ownedMaterials: 0 });
});

it('REN14 NEGATIVE stale camera/source/reset and hidden quality settings fail closed', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); const host = await mount(initialFixture);
  expect(() => host.setFrame({ ...frameAt(initialFixture), sourceRevision: 999 })).toThrow(/stale/i);
  expect(() => host.setFrame({ ...frameAt(initialFixture), cameraId: 'missing-camera' })).toThrow(/camera/i);
  host.setResetTick(60); expect(() => host.setFrame(frameAt(initialFixture))).toThrow(/reset/i);
  await expect(createThreeWebGpuExperiment({ canvas: new EventTarget() as HTMLCanvasElement, fixture: initialFixture, preset: { id: 'C2', parameters: { quality: 'low' } }, signal: new AbortController().signal, capabilities: {} })).rejects.toThrow(/Unsupported quality/i);
});

it('REN13/14 NEGATIVE replacement shader compilation rejects before adopting or disposing the old complete source', async () => {
  const data = await replay('F06-MATERIAL-REPLAY'); const host = await mount(data.initialFixture);
  const old = host.scene.children[0]; const released = vi.fn(); old.addEventListener('removed', released);
  pump(); const priorRendered = host.readDiagnostics().rendered;
  control.compileError = 'controlled-replacement-node-compile-failure';
  await expect(host.replaceFixture(data.scenario.snapshots[0].manifest)).rejects.toThrow('controlled-replacement-node-compile-failure');
  expect(host.scene.children[0]).toBe(old); expect(released).not.toHaveBeenCalled();
  expect(host.readFacts().fixtureDigest).toBe(getFixtureDigest(data.initialFixture));
  expect(host.readDiagnostics().rendered).toEqual(priorRendered);
  control.compileError = ''; await host.replaceFixture(data.scenario.snapshots[0].manifest);
  expect(host.readFacts().fixtureDigest).toBe(getFixtureDigest(data.scenario.snapshots[0].manifest));
});

it('REN11 controlled native-API-shape MSAA observation reads C1 scene renderbuffer and restores its prior binding even on query failure', async () => {
  const { initialFixture } = await replay('F04-DETACH-REPLAY'); const host = await mount(initialFixture, 'C1'); const renderer = control.renderers[0];
  const target = renderer._frameBufferTargets.get(renderer.canvasTarget); const msaa = {}; const previous = {};
  const bind = vi.fn(); const gl = renderer.backend.gl;
  Object.assign(gl, { RENDERBUFFER: 2, RENDERBUFFER_BINDING: 3, RENDERBUFFER_SAMPLES: 4,
    getParameter: (key: number) => key === 3 ? previous : 8192, bindRenderbuffer: bind, getRenderbufferParameter: () => 4 });
  renderer.backend.get = (object: object) => object === target ? { msaaRenderbuffers: [msaa] } : { glInternalFormat: 0x881a };
  pump(); expect(host.readDiagnostics().quality.effectiveSceneSamples).toMatchObject({ status: 'measured', value: 4, unit: 'sample' });
  expect(bind.mock.calls.slice(-2)).toEqual([[2, msaa], [2, previous]]);
  gl.getRenderbufferParameter = () => { throw new Error('controlled-quality-query-failure'); };
  expect(() => host.readDiagnostics()).toThrow('controlled-quality-query-failure'); expect(bind.mock.calls.at(-1)).toEqual([2, previous]);
});

it('REN12 pinned real NodeMaterial defaults retain material color, one vertex-color multiplication, opacity and Color emission', () => {
  // Inspect the actual imported implementation, not a substitute shader or renderer double.
  const diffuse = NodeMaterial.prototype.setupDiffuseColor.toString();
  expect(diffuse).toContain('let colorNode = this.colorNode ? vec4( this.colorNode ) : materialColor;');
  expect(diffuse).toContain("if ( this.vertexColors === true && geometry.hasAttribute( 'color' ) )");
  expect(diffuse.match(/colorNode = colorNode\.mul\( vertexColor\(\) \);/g)).toHaveLength(1);
  expect(diffuse).toContain('const opacityNode = this.opacityNode ? float( this.opacityNode ) : materialOpacity;');
  const lighting = NodeMaterial.prototype.setupLighting.toString();
  expect(lighting).toContain('material.emissive && material.emissive.isColor === true');
  expect(lighting).toContain('emissive.assign( vec3( emissiveNode ? emissiveNode : materialEmissive ) );');
  expect(lighting).toContain('outgoingLightNode = outgoingLightNode.add( emissive );');
});
