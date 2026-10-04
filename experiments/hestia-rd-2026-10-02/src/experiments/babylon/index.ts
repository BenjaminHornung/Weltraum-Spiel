import { Engine } from '@babylonjs/core/Engines/engine.js';
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine.js';
import { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine.js';
import { _CommonDispose } from '@babylonjs/core/Engines/engine.common.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';
import { ShaderLanguage } from '@babylonjs/core/Materials/shaderLanguage.js';
import { createFrameInput, validateFacts, type LabExperimentContext, type LabExperimentHandle, type LabFrameInput } from '../../contracts/experiment';
import { fixtureRevision, getFixtureDigest, type LabFixtureV1 } from '../../contracts/fixture';
import { integer, requireValue } from '../../contracts/validation';
import { applyPresentation, buildBabylonProjection, retainedBufferFacts, UNSUPPORTED_FEATURES, type BabylonProjection } from './projection';
import { bounded } from './readiness';

const live = { engines: 0, renderloops: 0, listeners: 0, pendingNativeInitializations: 0 };
type Submission = { tick: number; cameraId: string; sourceRevision: number; fixtureDigest: string; resetTick: number | null; projectionGeneration: number; presentationGeneration: number };
type Resolution = { width: number; height: number; dpr: number; bufferWidth: number; bufferHeight: number };
export type VisualFault = 'none' | 'omit-vertex-colors' | 'disable-depth-test';
export interface BabylonDiagnostics {
  backend: { requested: 'C3' | 'C4'; actual: 'webgl2' | 'webgpu'; sdk: '9.29.0'; initialization: 'awaited'; shaderLanguage: string; compilerPaths: 'blocked'; restoration: 'disabled' };
  disposed: boolean; terminal: string | null; cleanupErrors: string[]; replacing: boolean;
  fixtureDigest: string; sourceRevision: number; frame: LabFrameInput; resetTick: number | null;
  projectionGeneration: number; presentationGeneration: number; submittedFrames: number; rendered: Submission | null;
  resolution: Resolution; presentation: BabylonProjection['presentation']; buffers: ReturnType<typeof retainedBufferFacts>;
  camera: { id: string; position: number[]; target: number[]; up: number[]; fovDegrees: number; near: number; far: number; controlsAttached: boolean };
  visualFault: VisualFault; nativeReadback: 'NOT_RUN'; productIntegrated: false;
}
export interface BabylonHost extends LabExperimentHandle {
  readonly scene: Scene; readonly camera: FreeCamera;
  setResetTick(tick: number | null): void;
  resize(width: number, height: number, dpr: number): void;
  readDiagnostics(): BabylonDiagnostics;
  readCleanup(): { disposed: boolean; ownedMeshes: number; ownedMaterials: number; ownedLights: number; pendingNativeInitializations: number; errors: string[] };
  setDiagnosticFault(fault: VisualFault): void;
  loseOwnedDeviceForTest(): void;
}
export function liveBabylonHostCounts() { return { ...live }; }
export function parseSeekTick(value: string, maximum: number): number {
  requireValue(/^\d+$/.test(value), 'Tick must be nonempty decimal integer'); const tick = Number(value);
  requireValue(Number.isSafeInteger(tick) && tick >= 0 && tick <= maximum, 'Tick outside scenario range'); return tick;
}
const message = (error: unknown) => {
  // Native GPUError is not an ECMAScript Error; preserve its actual message.
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') { return error.message; }
  return String(error);
};

export async function createBabylonExperiment(context: LabExperimentContext): Promise<BabylonHost> {
  getFixtureDigest(context.fixture); requireValue(context.preset.id === 'C3' || context.preset.id === 'C4', 'Explicit C3 or C4 preset required; no fallback');
  requireValue(Object.keys(context.preset.parameters ?? {}).every((key) => ['width', 'height', 'dpr'].includes(key)), 'Unsupported parameters; no quality fallback');
  context.signal.throwIfAborted(); const mode = context.preset.id; const lifetime = new AbortController(); const signal = AbortSignal.any([context.signal, lifetime.signal]);
  let engine: Engine | WebGPUEngine | undefined; let scene: Scene | undefined; let camera: FreeCamera | undefined; let projection: BabylonProjection | undefined; let candidate: BabylonProjection | undefined;
  let fixture = context.fixture; let frame = createFrameInput({ tick: 0, seconds: 0, paused: true, cameraId: fixture.cameras[0].id, sourceRevision: fixtureRevision(fixture), weather: { windMps: [0, 0, 0], rain01: 0, snow01: 0, cloud01: 0 } });
  let disposed = false; let terminal: string | null = null; let replacing = false; let loop = false; let initSettled = true; let initSucceeded = false;
  let engineReleased = false; let pendingCounted = false; let projectionGeneration = 0; let presentationGeneration = 0; let submittedFrames = 0;
  let rendered: Submission | null = null; let awaitingEndFrame: Submission | null = null; let resetTick: number | null = null; let visualFault: VisualFault = 'none';
  let resolution: Resolution = { width: 1280, height: 720, dpr: 1, bufferWidth: 1280, bufferHeight: 720 };
  const cleanupErrors: string[] = []; const unlisten: (() => void)[] = [];
  function listen(target: EventTarget, event: string, listener: EventListener) {
    target.addEventListener(event, listener); live.listeners += 1;
    unlisten.push(() => { target.removeEventListener(event, listener); live.listeners -= 1; });
  }
  function releaseEngine() {
    if (!engine || engineReleased || !initSettled) { return; }
    engineReleased = true;
    try {
      if (engine instanceof WebGPUEngine && !initSucceeded) {
        // Exact 9.29.0 field interop; NEVER call GPU dispose before helpers exist.
        engine._device?.destroy(); _CommonDispose(engine, context.canvas); AbstractEngine.prototype.dispose.call(engine);
      } else { engine.dispose(); }
    } catch (error) {
      cleanupErrors.push(`engine disposal: ${message(error)}`);
      // One failed helper must not strand the owned device or EngineStore slot.
      if (engine instanceof WebGPUEngine) { try { engine._device?.destroy(); } catch (late) { cleanupErrors.push(`device fallback: ${message(late)}`); } }
      try { _CommonDispose(engine, context.canvas); } catch (late) { cleanupErrors.push(`event fallback: ${message(late)}`); }
      try { AbstractEngine.prototype.dispose.call(engine); } catch (late) { cleanupErrors.push(`base fallback: ${message(late)}`); }
    }
    finally { live.engines -= 1; if (pendingCounted) { pendingCounted = false; live.pendingNativeInitializations -= 1; } }
  }
  function close() {
    if (!disposed) {
      disposed = true; lifetime.abort(); awaitingEndFrame = null;
      if (loop) { loop = false; engine?.stopRenderLoop(); live.renderloops -= 1; }
      for (const remove of unlisten.splice(0)) { remove(); }
      for (const [stage, owned] of [['candidate', candidate], ['projection', projection], ['scene', scene]] as const) {
        try { owned?.dispose(); } catch (error) { cleanupErrors.push(`${stage} disposal: ${message(error)}`); }
      }
      candidate = undefined;
      if (!initSettled && !pendingCounted) { pendingCounted = true; live.pendingNativeInitializations += 1; }
    }
    releaseEngine();
  }
  function fail(error: unknown) { if (terminal === null && !disposed) { terminal = message(error); } close(); }
  function firstFailure(error: unknown) { return terminal !== null && terminal !== message(error) ? new Error(terminal, { cause: error }) : error; }
  function active() { requireValue(!disposed && !terminal && !signal.aborted, terminal ?? 'Babylon host aborted/disposed'); }
  function invalidatePresentation() { presentationGeneration += 1; rendered = null; awaitingEndFrame = null; }
  function identity(): Submission { return { tick: frame.tick, cameraId: frame.cameraId, sourceRevision: frame.sourceRevision, fixtureDigest: getFixtureDigest(fixture), resetTick, projectionGeneration, presentationGeneration }; }
  function current(submission: Submission) { return !disposed && !replacing && JSON.stringify(submission) === JSON.stringify(identity()); }
  function applyCamera() {
    const declared = fixture.cameras.find((entry) => entry.id === frame.cameraId)!; camera!.position.copyFromFloats(...declared.positionMeters); camera!.upVector = new Vector3(...declared.up);
    camera!.setTarget(new Vector3(...declared.targetMeters)); camera!.fov = declared.verticalFovDegrees * Math.PI / 180; camera!.minZ = 0.01; camera!.maxZ = 2000;
  }
  function resize(width: number, height: number, dpr: number) {
    active(); requireValue(!replacing, 'Replacement pending'); requireValue(Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0 && Number.isFinite(dpr) && dpr > 0, 'Invalid resize dimensions');
    const bufferWidth = Math.round(width * dpr); const bufferHeight = Math.round(height * dpr);
    const maximum = engine instanceof WebGPUEngine ? engine._device.limits.maxTextureDimension2D : engine!.getCaps().maxTextureSize;
    requireValue(Number.isSafeInteger(bufferWidth) && Number.isSafeInteger(bufferHeight) && bufferWidth > 0 && bufferHeight > 0 && bufferWidth <= maximum && bufferHeight <= maximum, 'Resize exceeds observed backend capability');
    engine!.setSize(bufferWidth, bufferHeight, true); context.canvas.width = bufferWidth; context.canvas.height = bufferHeight; context.canvas.style.width = `${width}px`; context.canvas.style.height = `${height}px`;
    resolution = { width, height, dpr, bufferWidth, bufferHeight }; invalidatePresentation();
  }
  async function compile(next: BabylonProjection) {
    signal.throwIfAborted(); next.setLightsEnabled(true);
    requireValue(next.materials.every((material) => material.shaderLanguage === (mode === 'C4' ? ShaderLanguage.WGSL : ShaderLanguage.GLSL)), 'Stock shader language mismatch; translator fallback prohibited');
    await bounded(Promise.all(next.meshes.map((mesh) => (mesh.material as import('@babylonjs/core/Materials/standardMaterial.js').StandardMaterial).forceCompilationAsync(mesh))), signal, 'Babylon material compile');
    const polling = new AbortController(); const readinessSignal = AbortSignal.any([signal, polling.signal]);
    try { await bounded(new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stop = () => { if (timer) { clearTimeout(timer); } readinessSignal.removeEventListener('abort', abort); };
      const abort = () => { stop(); reject(new Error('Babylon readiness aborted')); };
      const check = () => {
        try {
          if (readinessSignal.aborted || disposed) { abort(); return; }
          if (scene!.isReady(true)) { stop(); resolve(); return; }
          timer = setTimeout(check, 16);
        } catch (error) { stop(); reject(error); }
      };
      readinessSignal.addEventListener('abort', abort, { once: true }); check();
    }), readinessSignal, 'Babylon scene readiness'); } finally { polling.abort(); }
    active();
  }
  listen(context.signal, 'abort', () => fail(new Error('Babylon host aborted')));
  listen(context.canvas, 'webglcontextlost', (event) => { event.preventDefault(); fail(new Error('WebGL context lost; terminal, restoration disabled')); });
  try {
    if (mode === 'C3') {
      const gl = context.canvas.getContext('webgl2', { alpha: false, antialias: true, depth: true, stencil: true, preserveDrawingBuffer: true });
      requireValue(gl, 'UNSUPPORTED C3 requires actual WebGL2 context');
      engine = new Engine(gl, true, { doNotHandleContextLost: true, disableWebGL2Support: false, adaptToDeviceRatio: false }); live.engines += 1;
      requireValue(engine.webGLVersion === 2, 'UNSUPPORTED C3 requires observed WebGL2, never GL1'); initSucceeded = true;
    } else {
      requireValue(typeof navigator !== 'undefined' && navigator.gpu, 'UNSUPPORTED C4 requires WebGPU; no C3 fallback');
      const gpu = new WebGPUEngine(context.canvas, { antialias: true, adaptToDeviceRatio: false, doNotHandleContextLost: true, enableAllFeatures: false }); engine = gpu; live.engines += 1;
      initSettled = false;
      const initialization = Promise.resolve().then(() => { signal.throwIfAborted(); return gpu.initAsync({ jsPath: '', wasmPath: '' }, { jsPath: '', wasmPath: '' }); });
      const settled = initialization.then(() => { initSucceeded = true; initSettled = true; if (disposed) { releaseEngine(); } }, (error) => { initSettled = true; if (disposed) { releaseEngine(); } throw error; });
      await bounded(settled, signal, 'C4 WebGPU init'); active(); requireValue(gpu._device, 'UNSUPPORTED C4 missing initialized native device');
      // 9.29.0 _device is declared non-private; version-scoped monitoring only.
      listen(gpu._device, 'uncapturederror', (event) => fail(new Error(`WebGPU uncaptured error: ${message((event as GPUUncapturedErrorEvent).error)}`)));
      void gpu._device.lost.then((info) => { if (!disposed) { fail(new Error(`WebGPU device lost: ${info.reason}: ${info.message}`)); } }, (error) => { if (!disposed) { fail(error); } });
    }
    active(); scene = new Scene(engine); scene.detachControl(); scene.useRightHandedSystem = true; scene.shadowsEnabled = false;
    camera = new FreeCamera('RD12:camera', Vector3.Zero(), scene); camera.detachControl(); scene.activeCamera = camera; applyCamera();
    candidate = buildBabylonProjection(fixture, scene, signal); applyPresentation(scene, candidate.presentation); await compile(candidate);
    projection = candidate; candidate = undefined; projection.setEnabled(true); projectionGeneration = 1;
    const parameters = context.preset.parameters ?? {}; resize(Number(parameters.width ?? context.canvas.width ?? 1280), Number(parameters.height ?? context.canvas.height ?? 720), Number(parameters.dpr ?? 1));
    // Exactly one SDK loop. SDK owns begin/endFrame; do not nest another frame.
    // Wrap only this owned engine's endFrame to catch synchronous submission
    // failures and publish AFTER native WebGPU queue submission / GL endFrame.
    const nativeEndFrame = engine.endFrame.bind(engine);
    engine.endFrame = () => {
      if (disposed) { awaitingEndFrame = null; return; } // A render failure may dispose mid-SDK frame; never submit to the dead device.
      try {
        nativeEndFrame(); const captured = awaitingEndFrame; awaitingEndFrame = null;
        if (captured && current(captured)) { rendered = captured; submittedFrames += 1; }
      } catch (error) { awaitingEndFrame = null; fail(new Error(`Babylon submission failure: ${message(error)}`)); }
    };
    engine.runRenderLoop(() => {
      if (disposed || replacing || signal.aborted || (resetTick !== null && resetTick > frame.tick)) { return; }
      const captured = identity();
      try { scene!.render(false); if (current(captured)) { awaitingEndFrame = captured; } }
      catch (error) { fail(new Error(`Babylon render failure: ${message(error)}`)); }
    }); loop = true; live.renderloops += 1;
    const host: BabylonHost = {
      scene, camera,
      setFrame(input) {
        active(); requireValue(!replacing, 'Replacement pending'); const next = createFrameInput(input);
        requireValue(next.sourceRevision === fixtureRevision(fixture), 'Stale sourceRevision'); requireValue(fixture.cameras.some((entry) => entry.id === next.cameraId), 'Unknown camera');
        requireValue(resetTick === null || resetTick <= next.tick, 'Reset tick is after frame'); frame = next; applyCamera(); invalidatePresentation();
      },
      setResetTick(tick) { active(); requireValue(!replacing, 'Replacement pending'); if (tick !== null) { integer(tick); } resetTick = tick; invalidatePresentation(); },
      resize,
      async replaceFixture(next) {
        active(); requireValue(!replacing, 'Replacement pending'); getFixtureDigest(next); replacing = true; awaitingEndFrame = null;
        const previous = projection!;
        try {
          candidate = buildBabylonProjection(next, scene!, signal); previous.setLightsEnabled(false); applyPresentation(scene!, candidate.presentation); await compile(candidate); active();
          const adopted = candidate; candidate = undefined; projection = adopted; fixture = next; projectionGeneration += 1;
          frame = createFrameInput({ ...frame, sourceRevision: fixtureRevision(fixture), cameraId: fixture.cameras.some((entry) => entry.id === frame.cameraId) ? frame.cameraId : fixture.cameras[0].id });
          adopted.setEnabled(true); previous.dispose(); applyCamera(); visualFault = 'none'; invalidatePresentation();
        } catch (error) {
          candidate?.dispose(); candidate = undefined;
          if (!disposed) { previous.setLightsEnabled(true); applyPresentation(scene!, previous.presentation); }
          throw firstFailure(error);
        } finally { replacing = false; }
      },
      readFacts() {
        const count = (value: number) => ({ status: 'measured' as const, value, unit: 'count', reason: 'Owned logical SDK objects, NOT native allocation/VRAM' });
        return validateFacts({ experimentId: 'RD-12', variantId: mode, backend: mode === 'C3' ? 'Babylon-WebGL2' : 'Babylon-WebGPU', fixtureDigest: getFixtureDigest(fixture), sourceRevision: fixtureRevision(fixture),
          liveResources: { meshes: count(scene!.meshes.length), materials: count(scene!.materials.length), lights: count(scene!.lights.length), engines: count(engineReleased ? 0 : 1) },
          logicalCosts: { projectionBufferBytes: { status: 'estimated', value: disposed ? 0 : projection!.bufferBytes, unit: 'byte', reason: 'Private CPU attributes/index bytes, excludes native buffers/driver/shaders' }, triangles: count(projection!.triangles),
            gpuBytes: { status: 'unsupported', unit: 'byte', reason: 'Native driver/VRAM allocations unavailable' }, gpuMs: { status: 'not-run', unit: 'ms', reason: 'No qualified timestamp workload' },
            cpuMs: { status: 'not-run', unit: 'ms', reason: 'Not a selection benchmark' }, uploadBytes: { status: 'not-run', unit: 'byte', reason: 'No native upload instrumentation; retained buffers are not upload proof' } },
          unsupportedFeatures: [...UNSUPPORTED_FEATURES, ...(projection!.presentation.toneMapping === 'reinhard' ? ['reinhard-tone-parity'] : [])], errors: terminal ? [terminal] : [] });
      },
      readDiagnostics() { return { backend: { requested: mode, actual: mode === 'C3' ? 'webgl2' : 'webgpu', sdk: '9.29.0', initialization: 'awaited', shaderLanguage: projection!.materials.every((material) => material.shaderLanguage === ShaderLanguage.WGSL) ? 'packaged-native-WGSL' : 'packaged-GLSL', compilerPaths: 'blocked', restoration: 'disabled' },
        disposed, terminal, cleanupErrors: [...cleanupErrors], replacing, fixtureDigest: getFixtureDigest(fixture), sourceRevision: fixtureRevision(fixture), frame, resetTick,
        projectionGeneration, presentationGeneration, submittedFrames, rendered: rendered ? { ...rendered } : null, resolution: { ...resolution }, presentation: projection!.presentation,
        buffers: disposed ? [] : retainedBufferFacts(projection!), camera: { id: frame.cameraId, position: camera!.position.asArray(), target: camera!.getTarget().asArray(), up: camera!.upVector.asArray(), fovDegrees: camera!.fov * 180 / Math.PI, near: camera!.minZ, far: camera!.maxZ, controlsAttached: camera!.inputs.attachedToElement },
        visualFault, nativeReadback: 'NOT_RUN', productIntegrated: false }; },
      readCleanup() { return { disposed, ownedMeshes: scene!.meshes.length, ownedMaterials: scene!.materials.length, ownedLights: scene!.lights.length, pendingNativeInitializations: pendingCounted ? 1 : 0, errors: [...cleanupErrors] }; },
      setDiagnosticFault(fault) {
        active(); requireValue(!replacing, 'Replacement pending'); requireValue(['none', 'omit-vertex-colors', 'disable-depth-test'].includes(fault), 'Unknown visual fault');
        for (const mesh of projection!.meshes) { mesh.useVertexColors = fault !== 'omit-vertex-colors' && mesh.metadata.sourceColors; }
        for (const material of projection!.materials) { material.depthFunction = fault === 'disable-depth-test' ? Constants.ALWAYS : 0; }
        visualFault = fault; invalidatePresentation();
      },
      loseOwnedDeviceForTest() {
        active(); if (engine instanceof WebGPUEngine) { engine._device.destroy(); }
        else { const extension = context.canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context'); requireValue(extension, 'UNSUPPORTED owned context-loss extension'); extension.loseContext(); }
      },
      async dispose() { close(); },
    };
    return host;
  } catch (error) { fail(error); throw firstFailure(error); }
}
