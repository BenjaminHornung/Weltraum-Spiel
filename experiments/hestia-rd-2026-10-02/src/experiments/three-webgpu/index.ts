import { HalfFloatType, Matrix4, PerspectiveCamera, Quaternion, Scene, SRGBColorSpace, Vector2, Vector3, type RenderTarget } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { createFrameInput, validateFacts, type LabExperimentContext, type LabExperimentHandle, type LabFrameInput } from '../../contracts/experiment';
import { fixtureRevision, getFixtureDigest, type LabFixtureV1 } from '../../contracts/fixture';
import type { LabMetric } from '../../contracts/result';
import { finite, integer, requireValue } from '../../contracts/validation';
import { buildLights, buildNodeProjection, configurePresentation, projectionSnapshot, UNSUPPORTED_FEATURES } from './projection';

export type ComparisonMode = 'C1' | 'C2';
// Pinned r185 fields absent from @types/three; observation only, never an invented backend.
type NativeBackend = {
  isWebGLBackend?: boolean; isWebGPUBackend?: boolean; compatibilityMode?: boolean | null;
  gl?: WebGL2RenderingContext | null;
  device?: { limits: { maxTextureDimension2D: number }; destroy(): void; lost?: Promise<{ reason: string; message: string }> } | null;
  get(object: object): { format?: string; glInternalFormat?: number; texture?: { format: string; sampleCount: number }; msaaTexture?: { sampleCount: number }; msaaRenderbuffers?: WebGLRenderbuffer[] };
  dispose(): void; extensions?: object | null; _onContextLost?: EventListener;
};
const backendOf = (renderer: WebGPURenderer) => renderer.backend as unknown as NativeBackend;
const live = new Set<object>(); let loops = 0; let listeners = 0;
export function liveWebGpuHostCounts() { return { renderers: live.size, renderloops: loops, abortListeners: listeners }; }
const measured = (value: number, unit = 'count'): LabMetric => ({ status: 'measured', value, unit });
const notRun = (unit: string, reason: string): LabMetric => ({ status: 'not-run', unit, reason });
const unsupported = (unit: string, reason: string): LabMetric => ({ status: 'unsupported', unit, reason });

export function observeBackend(renderer: WebGPURenderer, requested: ComparisonMode) {
  requireValue(renderer.hasInitialized(), 'UNSUPPORTED: renderer asynchronous init not complete');
  const backend = backendOf(renderer);
  const actual = backend.isWebGPUBackend === true && backend.device ? 'webgpu'
    : backend.isWebGLBackend === true && backend.gl ? 'webgl2' : 'unknown';
  requireValue(actual === (requested === 'C1' ? 'webgl2' : 'webgpu'),
    `UNSUPPORTED: requested ${requested}, observed ${actual}${requested === 'C2' && actual === 'webgl2' ? ' fallback' : ''}; no substitute success`);
  return { requested, actual, initialized: true, fallbackObserved: requested === 'C2' && actual === 'webgl2',
    compatibilityMode: actual === 'webgpu' ? backend.compatibilityMode ?? null : null };
}

export interface ThreeWebGpuHost extends LabExperimentHandle {
  readonly scene: Scene; readonly camera: PerspectiveCamera;
  setResetTick(tick: number | null): void;
  resize(width: number, height: number, dpr: number): void;
  loseOwnedDeviceForTest(): void;
  readDiagnostics(): ReturnType<typeof diagnostics>;
  readCleanup(): { disposed: boolean; ownedGeometries: number; ownedMaterials: number; liveHosts: ReturnType<typeof liveWebGpuHostCounts>; errors: readonly string[] };
}
type Candidate = { fixture: LabFixtureV1; projection: ReturnType<typeof buildNodeProjection>; lights: ReturnType<typeof buildLights>; frame: LabFrameInput; resetTick: number | null; generation: number };
type Rendered = { tick: number; fixtureDigest: string; sourceRevision: number; resetTick: number | null; projectionGeneration: number; cameraId: string };

function quality(renderer: WebGPURenderer, submissions: number) {
  const backend = backendOf(renderer); const canvas = renderer.getCanvasTarget();
  const target = (renderer as unknown as { _frameBufferTargets: Map<object, RenderTarget> })._frameBufferTargets?.get(canvas);
  const data = target ? backend.get(target.texture) : undefined;
  let nativeSamples = data?.msaaTexture?.sampleCount ?? (data?.texture?.sampleCount === 1 && target?.samples === 0 ? 1 : undefined);
  let sampleObservation = nativeSamples === undefined ? 'UNSUPPORTED' : 'GPUTexture.sampleCount';
  const gl = backend.gl; const renderbuffer = target && backend.isWebGLBackend ? backend.get(target).msaaRenderbuffers?.[0] : undefined;
  if (submissions > 0 && gl && renderbuffer) {
    const previous = gl.getParameter(gl.RENDERBUFFER_BINDING); gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
    try {
      const value = gl.getRenderbufferParameter(gl.RENDERBUFFER, gl.RENDERBUFFER_SAMPLES);
      if (typeof value === 'number' && Number.isInteger(value) && value >= 0) { nativeSamples = value; sampleObservation = 'WebGL.RENDERBUFFER_SAMPLES (0 means no MSAA)'; }
    } finally { gl.bindRenderbuffer(gl.RENDERBUFFER, previous); }
  }
  return { requested: { samples: 4, outputBufferType: 'HalfFloatType' },
    rendererSamples: renderer.samples, finalOutputSamples: renderer.currentSamples,
    sceneBufferRequestedSamples: target?.samples ?? null,
    effectiveSceneSamples: nativeSamples === undefined ? unsupported('sample', 'Native scene-buffer sample count not exposed by inspected backend') : measured(nativeSamples, 'sample'),
    sampleObservation,
    sceneBufferFormat: submissions > 0 ? data?.format ?? (data?.glInternalFormat === undefined ? 'UNSUPPORTED' : `GL-internal-format-${data.glInternalFormat}`) : 'NOT_RUN',
    outputBufferType: renderer.getOutputBufferType(),
    canvasFormat: submissions > 0 && backend.isWebGPUBackend ? backend.get(canvas.colorTexture).format ?? 'UNSUPPORTED' : 'UNSUPPORTED',
    reason: 'Requested samples are not effective samples; scene conversion buffer and final canvas are separate axes' };
}
function diagnostics(renderer: WebGPURenderer, mode: ComparisonMode, current: Candidate, rendered: Rendered | null,
  generation: number, submissions: number, terminal: string | null, disposed: boolean, pending: boolean, errors: readonly string[]) {
  const size = renderer.getSize(new Vector2()); const buffer = renderer.getDrawingBufferSize(new Vector2());
  return { backend: observeBackend(renderer, mode), fixtureId: current.fixture.id, fixtureDigest: getFixtureDigest(current.fixture),
    sourceRevision: fixtureRevision(current.fixture), sourceRefs: current.fixture.sourceRefs,
    payloadBindings: current.fixture.payloads.map(({ id, byteLength, sha256 }) => ({ id, byteLength, sha256 })),
    presentationProfile: current.fixture.presentation?.id ?? 'synthetic-lab-light-v1-no-shadows', frame: current.frame, resetTick: current.resetTick,
    resolution: { width: size.x, height: size.y, dpr: renderer.getPixelRatio(), bufferWidth: buffer.x, bufferHeight: buffer.y },
    colorSpace: renderer.outputColorSpace, toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure,
    quality: quality(renderer, submissions), projectionGeneration: generation, owners: projectionSnapshot(current.projection),
    submittedFrames: submissions, rendered, terminal, disposed, pending, errors: [...errors], liveHosts: liveWebGpuHostCounts(),
    gpuMs: notRun('ms', 'No GPU measurement lease; functional renderer only'),
    nativeGpuBytes: unsupported('byte', 'Native/driver allocation bytes not exposed; typed bytes are not native allocation'), productIntegrated: false };
}

/** One renderer-owned animation loop; RD03 WebGL host is deliberately not borrowed. */
export async function createThreeWebGpuExperiment(context: LabExperimentContext): Promise<ThreeWebGpuHost> {
  context.signal.throwIfAborted(); getFixtureDigest(context.fixture);
  const mode = context.preset.id;
  requireValue(mode === 'C1' || mode === 'C2', 'Unknown RD11 comparison mode; explicitly choose C1 or C2');
  requireValue(Object.keys(context.preset.parameters ?? {}).every((key) => ['width', 'height', 'dpr'].includes(key)), 'Unsupported quality parameters; no downgrade');
  const width = context.preset.parameters?.width ?? 1280; const height = context.preset.parameters?.height ?? 720; const dpr = context.preset.parameters?.dpr ?? 1;
  integer(width, 1); integer(height, 1); finite(dpr, 1, 4);
  const renderer = new WebGPURenderer({ canvas: context.canvas, forceWebGL: mode === 'C1', antialias: true, samples: 4,
    alpha: false, outputBufferType: HalfFloatType, powerPreference: 'high-performance', trackTimestamp: false });
  const originalBackend = backendOf(renderer); const scene = new Scene(); const camera = new PerspectiveCamera(60, 16 / 9, 0.01, 2000);
  renderer.outputColorSpace = SRGBColorSpace; renderer.shadowMap.enabled = false;
  const token = {}; live.add(token); const abort = new AbortController(); const signal = AbortSignal.any([context.signal, abort.signal]);
  const errors: string[] = []; let current: Candidate | undefined; let generation = 0; let submissions = 0;
  let rendered: Rendered | null = null; let fatal: string | null = null; let disposed = false; let ready = false; let loop = false;
  let pending: Promise<void> | undefined; let disposing: Promise<void> | undefined; let announced = '';
  function active() { signal.throwIfAborted(); requireValue(!disposing && !fatal, fatal ?? 'Host disposed'); }
  function fail(message: string) {
    if (disposing || disposed || fatal) { return; } fatal = message; errors.push(message);
    context.canvas.dispatchEvent(new CustomEvent('rd11-error', { detail: message }));
    if (ready) { void dispose().catch((error) => { errors.push(`Terminal cleanup: ${String(error)}`); }); }
  }
  renderer.onDeviceLost = (info) => { fail(`${info.api} device/context lost: ${info.message}; no hidden restore/fallback`); };
  renderer.onError = (info) => { fail(`Renderer error: ${typeof info === 'string' ? info : JSON.stringify(info)}`); };
  function initialFrame(fixture: LabFixtureV1) { return createFrameInput({ tick: 0, seconds: 0, paused: true, cameraId: fixture.cameras[0].id,
    sourceRevision: fixtureRevision(fixture), weather: { windMps: [0, 0, 0], rain01: 0, snow01: 0, cloud01: 0 } }); }
  function release(candidate: Candidate) { candidate.projection.dispose(); candidate.lights.removeFromParent(); candidate.lights.clear(); }
  async function build(fixture: LabFixtureV1, version: number): Promise<Candidate> {
    active(); const candidate = { fixture, projection: buildNodeProjection(fixture, signal), lights: buildLights(fixture), frame: initialFrame(fixture), resetTick: null, generation: version };
    try {
      await Promise.resolve(); active(); requireValue(version === generation, 'Stale/aborted private source candidate'); return candidate;
    } catch (error) { release(candidate); throw error; }
  }
  function cameraFor(candidate: Candidate) {
    const source = candidate.fixture.cameras.find((entry) => entry.id === candidate.frame.cameraId)!;
    const transform = new Matrix4().compose(new Vector3(...candidate.fixture.frame.originMeters), new Quaternion(...candidate.fixture.frame.rotationXyzw), new Vector3(1, 1, 1));
    camera.position.set(...source.positionMeters).applyMatrix4(transform); camera.up.set(...source.up).transformDirection(transform);
    camera.fov = source.verticalFovDegrees; camera.lookAt(new Vector3(...source.targetMeters).applyMatrix4(transform)); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  function configure(candidate: Candidate) { configurePresentation(candidate.fixture, scene, renderer); cameraFor(candidate); }
  const onAbort = () => { if (ready) { void dispose().catch(() => {}); } };
  context.signal.addEventListener('abort', onAbort, { once: true }); listeners += 1;
  async function cleanupNative(backend: NativeBackend) {
    // Native dispose cannot safely be invoked on an uninitialized Renderer (r185).
    if (backend.isWebGPUBackend && backend.device) { backend.dispose(); }
    else if (backend.isWebGLBackend && backend.extensions) { backend.dispose(); }
    else if (backend._onContextLost) { context.canvas.removeEventListener('webglcontextlost', backend._onContextLost); }
  }
  async function dispose(): Promise<void> {
    disposing ??= Promise.resolve().then(async () => {
      generation += 1; abort.abort();
      try { if (pending) { await pending.catch(() => {}); } if (current) { release(current); } }
      finally {
        scene.clear(); context.signal.removeEventListener('abort', onAbort); listeners -= 1;
        try {
          if (renderer.hasInitialized()) { await renderer.setAnimationLoop(null); renderer.dispose(); }
          else { await cleanupNative(backendOf(renderer)); }
          if (originalBackend !== backendOf(renderer)) { await cleanupNative(originalBackend); }
        } finally { if (loop) { loops -= 1; loop = false; } live.delete(token); disposed = true; }
      }
    });
    return disposing;
  }
  function render() {
    if (disposing || signal.aborted || fatal || pending) { return; }
    try {
      renderer.render(scene, camera); if (fatal || disposing) { return; } submissions += 1;
      rendered = { tick: current!.frame.tick, fixtureDigest: getFixtureDigest(current!.fixture), sourceRevision: fixtureRevision(current!.fixture),
        resetTick: current!.resetTick, projectionGeneration: current!.generation, cameraId: current!.frame.cameraId };
      const identity = JSON.stringify(rendered);
      if (identity !== announced) { announced = identity; context.canvas.dispatchEvent(new CustomEvent('rd11-rendered')); }
    } catch (error) { fail(`Render failed: ${String(error)}; no hidden restore/fallback`); }
  }
  const host: ThreeWebGpuHost = {
    scene, camera,
    setResetTick(tick) { active(); requireValue(!pending, 'Replacement pending'); if (tick !== null) { integer(tick); } current!.resetTick = tick; },
    setFrame(input) {
      active(); requireValue(!pending, 'Replacement pending'); const frame = createFrameInput(input);
      requireValue(frame.sourceRevision === fixtureRevision(current!.fixture) && (current!.resetTick === null || current!.resetTick <= frame.tick), 'Stale source/reset frame');
      requireValue(current!.fixture.cameras.some((entry) => entry.id === frame.cameraId), 'Unknown camera'); current!.frame = frame; cameraFor(current!);
    },
    async replaceFixture(next) {
      active(); requireValue(!pending, 'Replacement pending'); const version = ++generation;
      pending = (async () => {
        const candidate = await build(next, version); const old = current!;
        try {
          // Compile detached geometry against candidate lighting/profile on the single owned
          // scene. The loop skips pending work; no candidate geometry is attached yet.
          scene.remove(old.lights); scene.add(candidate.lights); configure(candidate);
          await renderer.compileAsync(candidate.projection.root, camera, scene);
          active(); requireValue(version === generation, 'Stale/aborted compiled source candidate');
        } catch (error) { release(candidate); throw error; }
        finally { scene.remove(candidate.lights); scene.add(old.lights); configure(old); }
        // Publish only the fully imported, built AND asynchronously compiled candidate.
        scene.remove(old.projection.root, old.lights); scene.add(candidate.projection.root, candidate.lights); current = candidate;
        configure(candidate); rendered = null; release(old);
      })();
      try { await pending; }
      catch (error) { errors.push(`Replacement failed; private candidate not adopted: ${String(error)}`); throw error; }
      finally { pending = undefined; }
    },
    resize(w, h, pixelRatio) {
      active(); integer(w, 1); integer(h, 1); finite(pixelRatio, 1, 4); const backend = backendOf(renderer);
      const maximum = backend.isWebGPUBackend ? backend.device?.limits.maxTextureDimension2D : backend.gl?.getParameter(backend.gl.MAX_TEXTURE_SIZE);
      requireValue(typeof maximum === 'number' && w * pixelRatio <= maximum && h * pixelRatio <= maximum, 'Resolution exceeds/unavailable device capability; no downgrade');
      renderer.setPixelRatio(pixelRatio); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); rendered = null; announced = '';
    },
    readFacts() {
      active(); requireValue(!pending, 'Replacement pending'); const projection = current!.projection; const backend = observeBackend(renderer, mode);
      return validateFacts({ experimentId: 'RD-11', variantId: mode, backend: `Three-WebGPURenderer-${backend.actual}`,
        fixtureDigest: getFixtureDigest(current!.fixture), sourceRevision: fixtureRevision(current!.fixture),
        liveResources: { renderers: measured(1), renderloops: measured(loop ? 1 : 0), geometries: measured(projection.geometries.length), materials: measured(projection.materials.length), abortListeners: measured(1) },
        logicalCosts: { projectionBufferBytes: { status: 'estimated', value: projection.bufferBytes, unit: 'byte', reason: 'CPU typed attribute/index bytes; excludes output targets, allocator, driver and shaders' },
          triangles: measured(projection.triangles), gpuMs: notRun('ms', 'No GPU measurement lease'), gpuBytes: unsupported('byte', 'Native/driver memory not exposed') },
        unsupportedFeatures: [...UNSUPPORTED_FEATURES], errors });
    },
    loseOwnedDeviceForTest() {
      active(); requireValue(mode === 'C2' && !pending, 'Device loss test requires active owned C2');
      const device = backendOf(renderer).device; requireValue(device, 'Owned native device unavailable'); device.destroy();
    },
    readDiagnostics() { return diagnostics(renderer, mode, current!, rendered, current!.generation, submissions, fatal, disposed, Boolean(pending), errors); },
    readCleanup() { return { disposed, ownedGeometries: current?.projection.disposed ? 0 : current?.projection.geometries.length ?? 0,
      ownedMaterials: current?.projection.disposed ? 0 : current?.projection.materials.length ?? 0, liveHosts: liveWebGpuHostCounts(), errors: [...errors] }; },
    dispose,
  };
  try {
    await renderer.init(); active(); observeBackend(renderer, mode);
    // r185 ignores reason=destroyed in its own callback. Observe the actual owned
    // device promise too, so unexpected destruction is terminal, not silent.
    void backendOf(renderer).device?.lost?.then((info) => { fail(`WebGPU device lost: ${info.reason}: ${info.message}; no hidden restore/fallback`); });
    current = await build(context.fixture, generation); active(); scene.add(current.projection.root, current.lights); configure(current);
    host.resize(width, height, dpr); await renderer.compileAsync(scene, camera); active();
    await renderer.setAnimationLoop(render); active(); loop = true; loops += 1; ready = true; return host;
  } catch (error) { await dispose().catch((cleanup) => { errors.push(`Init cleanup: ${String(cleanup)}`); }); throw error; }
}
