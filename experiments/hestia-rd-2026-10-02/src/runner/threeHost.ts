import { ACESFilmicToneMapping, Color, DirectionalLight, Fog, Group, HemisphereLight, Matrix4,
  NoToneMapping, PerspectiveCamera, Quaternion, ReinhardToneMapping, Scene, SRGBColorSpace,
  Vector2, Vector3, WebGLRenderer } from 'three';
import { createFrameInput, validateFacts, type LabExperimentContext, type LabExperimentFacts,
  type LabExperimentHandle, type LabFrameInput, type LabPreset } from '../contracts/experiment';
import { fixtureRevision, getFixtureDigest, type LabFixtureV1, type LabFrame, type Vec3 } from '../contracts/fixture';
import type { LabMetric } from '../contracts/result';
import { finite, integer, requireValue } from '../contracts/validation';

export interface ThreeOwnerPose { readonly ownerId: string; readonly sourceNamespace: string; readonly sourceRevision: number;
  readonly originMeters: Vec3; readonly rotationXyzw: readonly [number, number, number, number]; }
export interface ThreeLabEffectContext {
  /** Borrowed: never mutate renderer/camera, add a loop, or attach outside the owned detached root. */
  readonly scene: Scene; readonly camera: PerspectiveCamera; readonly root: Group;
  readonly fixture: LabFixtureV1; readonly frame: LabFrameInput; readonly resetTick: number | null;
  readonly signal: AbortSignal; readonly capabilities: Readonly<Record<string, boolean>>;
  ownerPose(ownerId: string): ThreeOwnerPose | undefined;
}
export interface ThreeLabEffect extends LabExperimentHandle {}
export type ThreeLabEffectFactory = (context: ThreeLabEffectContext, preset: LabPreset) => Promise<ThreeLabEffect>;
export interface ThreeLabHost extends LabExperimentHandle {
  readonly scene: Scene; readonly camera: PerspectiveCamera;
  setResetTick(tick: number | null): void;
  resize(width: number, height: number, dpr: number): void;
  readDiagnostics(): ReturnType<typeof diagnostics>;
  readCleanup(): { disposed: boolean; geometries: number; textures: number; programs: number; liveHosts: ReturnType<typeof liveThreeHostCounts> };
}
const liveHosts = new Set<object>();
let loops = 0; let hostListeners = 0;
export function liveThreeHostCounts() { return { renderers: liveHosts.size, renderloops: loops, hostListeners }; }
const measured = (value: number, unit = 'count'): LabMetric => ({ status: 'measured', value, unit });
const unavailable = (reason: string, unit = 'byte'): LabMetric => ({ status: 'unsupported', unit, reason });
function frameMatrix(frame: LabFrame) {
  return new Matrix4().compose(new Vector3(...frame.originMeters), new Quaternion(...frame.rotationXyzw), new Vector3(1, 1, 1));
}
export function ownerPose(fixture: LabFixtureV1, ownerId: string): ThreeOwnerPose | undefined {
  getFixtureDigest(fixture); const object = fixture.objects.find((entry) => entry.ownerId === ownerId);
  if (!object) { return undefined; }
  const rootRotation = new Quaternion(...fixture.frame.rotationXyzw);
  const position = new Vector3(...object.frame.originMeters).applyQuaternion(rootRotation).add(new Vector3(...fixture.frame.originMeters));
  const rotation = rootRotation.multiply(new Quaternion(...object.frame.rotationXyzw));
  return Object.freeze({ ownerId, sourceNamespace: object.sourceNamespace, sourceRevision: object.sourceRevision,
    originMeters: Object.freeze(position.toArray()) as Vec3,
    rotationXyzw: Object.freeze(rotation.toArray()) as readonly [number, number, number, number] });
}

function diagnostics(renderer: WebGLRenderer, timerQuery: boolean, device: string, fixture: LabFixtureV1, frame: LabFrameInput,
  resetTick: number | null, submissions: number, rendered: { tick: number; fixtureDigest: string; sourceRevision: number; resetTick: number | null } | null) {
  const size = renderer.getSize(new Vector2()); const buffer = renderer.getDrawingBufferSize(new Vector2());
  return { backend: 'Three-WebGLRenderer-WebGL2', webgl2: renderer.capabilities.isWebGL2,
    fixtureId: fixture.id, fixtureDigest: getFixtureDigest(fixture), sourceRevision: fixtureRevision(fixture),
    payloadBindings: fixture.payloads.map(({ id, byteLength, sha256 }) => ({ id, byteLength, sha256 })),
    presentationProfile: fixture.presentation?.id ?? 'synthetic-lab-light-v1-no-shadows', frame, resetTick,
    resolution: { width: size.x, height: size.y, dpr: renderer.getPixelRatio(), bufferWidth: buffer.x, bufferHeight: buffer.y },
    colorSpace: renderer.outputColorSpace, toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure,
    timerQueryAvailable: timerQuery, gpuMs: timerQuery ? { status: 'not-run', unit: 'ms', reason: 'Timer available; no qualified timer-query sampling in diagnostic control' }
      : unavailable('EXT_disjoint_timer_query_webgl2 unavailable; rAF is not GPU time', 'ms'),
    nativeGpuBytes: unavailable('WebGL does not expose native/driver allocation bytes'), device,
    submittedFrames: submissions, rendered, rendererInfo: { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      programs: renderer.info.programs?.length ?? 0, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles },
    liveHosts: liveThreeHostCounts(), productIntegrated: false };
}

/** Static Three-only mounts, not a plugin registry. Every source candidate stays detached until all mounts succeed. */
export async function createThreeLabHost(context: LabExperimentContext,
  mounts: readonly { readonly mount: ThreeLabEffectFactory; readonly preset: LabPreset }[]): Promise<ThreeLabHost> {
  context.signal.throwIfAborted(); getFixtureDigest(context.fixture);
  requireValue(mounts.length > 0, 'At least one explicitly selected Three effect required');
  const gl = context.canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  requireValue(gl, 'UNSUPPORTED: WebGL2 required; no backend fallback');
  requireValue(!gl.isContextLost(), 'UNSUPPORTED: WebGL2 canvas context is lost; no hidden restore/fallback');
  const renderer = new WebGLRenderer({ canvas: context.canvas, context: gl, antialias: true, alpha: false });
  requireValue(renderer.capabilities.isWebGL2, 'UNSUPPORTED: renderer is not WebGL2');
  renderer.outputColorSpace = SRGBColorSpace;
  // Native PCF/shader/sky profiles are absent from V1; never invent their fidelity.
  renderer.shadowMap.enabled = false;
  const scene = new Scene(); const camera = new PerspectiveCamera(60, 16 / 9, 0.01, 2000);
  const token = {}; liveHosts.add(token);
  const abort = new AbortController(); const signal = AbortSignal.any([context.signal, abort.signal]);
  const timerQuery = Boolean(gl.getExtension('EXT_disjoint_timer_query_webgl2'));
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const device = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'GPU renderer identity unavailable';
  const capabilities = Object.freeze({ ...context.capabilities, webgl2: true, timerQuery });
  type Candidate = { fixture: LabFixtureV1; root: Group; lights: Group; effects: ThreeLabEffect[]; frame: LabFrameInput; resetTick: number | null };
  let current: Candidate | undefined; let generation = 0; let pending: Promise<void> | undefined;
  let disposing: Promise<void> | undefined; let disposed = false; let raf: number | undefined; let submissions = 0; let fatal: string | undefined;
  let rendered: { tick: number; fixtureDigest: string; sourceRevision: number; resetTick: number | null } | null = null;
  let announced = '';
  const errors: string[] = [];
  function active() { signal.throwIfAborted(); requireValue(!disposing && !fatal, fatal ?? 'Host disposed'); }
  function initialFrame(fixture: LabFixtureV1) { return createFrameInput({ tick: 0, seconds: 0, paused: true,
    cameraId: fixture.cameras[0].id, sourceRevision: fixtureRevision(fixture),
    weather: { windMps: [0, 0, 0], rain01: 0, snow01: 0, cloud01: 0 } }); }
  async function disposeCandidate(candidate: Candidate) {
    const failures: unknown[] = [];
    for (const effect of [...candidate.effects].reverse()) { try { await effect.dispose(); } catch (error) { failures.push(error); } }
    candidate.root.removeFromParent(); candidate.lights.removeFromParent(); candidate.root.clear(); candidate.lights.clear();
    if (failures.length > 0) { throw new AggregateError(failures, 'Effect cleanup failed'); }
  }
  function lighting(fixture: LabFixtureV1) {
    const lights = new Group(); lights.matrix.copy(frameMatrix(fixture.frame)); lights.matrixAutoUpdate = false;
    const profile = fixture.presentation;
    const ambient = profile?.lighting.ambient;
    const hemisphere = new HemisphereLight(ambient?.colorSrgb24 ?? 0xffffff, ambient?.groundColorSrgb24 ?? 0x444444, ambient?.intensity ?? 0.85);
    hemisphere.position.set(...(ambient?.positionMeters ?? [0, 1, 0])); lights.add(hemisphere);
    for (const role of ['key', 'fill'] as const) {
      const source = profile?.lighting[role]; const light = new DirectionalLight(source?.colorSrgb24 ?? 0xffffff, source?.intensity ?? (role === 'key' ? 2 : 0.5));
      light.position.set(...(source?.positionMeters ?? (role === 'key' ? [-10, 20, -10] : [10, 8, 10])));
      lights.add(light, light.target);
    }
    return lights;
  }
  async function build(fixture: LabFixtureV1, version: number): Promise<Candidate> {
    getFixtureDigest(fixture);
    const candidate: Candidate = { fixture, root: new Group(), lights: lighting(fixture), effects: [], frame: initialFrame(fixture), resetTick: null };
    try {
      for (const entry of mounts) {
        active(); requireValue(version === generation, 'Stale source build');
        const root = new Group(); candidate.root.add(root);
        const effectContext: ThreeLabEffectContext = { scene, camera, root, signal, capabilities,
          get fixture() { return candidate.fixture; }, get frame() { return candidate.frame; }, get resetTick() { return candidate.resetTick; },
          ownerPose: (id) => ownerPose(candidate.fixture, id) };
        const effect = await entry.mount(effectContext, entry.preset); candidate.effects.push(effect);
        active(); requireValue(version === generation, 'Stale source build');
        effect.setFrame(candidate.frame);
        const facts = validateFacts(effect.readFacts()); requireValue(facts.fixtureDigest === getFixtureDigest(fixture)
          && facts.sourceRevision === fixtureRevision(fixture), 'Effect candidate source mismatch');
      }
      return candidate;
    } catch (error) { await disposeCandidate(candidate).catch((cleanup) => { errors.push(String(cleanup)); }); throw error; }
  }
  function configure(candidate: Candidate) {
    const profile = candidate.fixture.presentation;
    renderer.toneMapping = profile?.toneMapping === 'aces-filmic' ? ACESFilmicToneMapping
      : profile?.toneMapping === 'reinhard' ? ReinhardToneMapping : NoToneMapping;
    renderer.toneMappingExposure = profile?.exposure ?? 1;
    scene.background = new Color(profile?.background.colorSrgb24 ?? 0x192430);
    scene.fog = profile ? new Fog(profile.background.colorSrgb24, profile.background.fogNearMeters, profile.background.fogFarMeters) : null;
    updateCamera(candidate);
  }
  function updateCamera(candidate: Candidate) {
    const source = candidate.fixture.cameras.find((entry) => entry.id === candidate.frame.cameraId); requireValue(source, 'Unknown camera');
    const transform = frameMatrix(candidate.fixture.frame);
    camera.position.set(...source.positionMeters).applyMatrix4(transform);
    camera.up.set(...source.up).transformDirection(transform); camera.fov = source.verticalFovDegrees;
    camera.lookAt(new Vector3(...source.targetMeters).applyMatrix4(transform)); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  function stopLoop() { if (raf !== undefined) { cancelAnimationFrame(raf); raf = undefined; loops -= 1; } }
  function render() {
    if (disposing || signal.aborted || fatal) { stopLoop(); return; }
    try {
      renderer.render(scene, camera); submissions += 1;
      rendered = { tick: current!.frame.tick, fixtureDigest: getFixtureDigest(current!.fixture), sourceRevision: fixtureRevision(current!.fixture), resetTick: current!.resetTick };
      const identity = JSON.stringify(rendered);
      if (!pending && identity !== announced) { announced = identity; context.canvas.dispatchEvent(new CustomEvent('three-lab-rendered')); }
    }
    catch (error) { fatal = String(error); errors.push(fatal); stopLoop(); context.canvas.dispatchEvent(new CustomEvent('three-lab-error', { detail: fatal })); return; }
    raf = requestAnimationFrame(render);
  }
  const contextLost = (event: Event) => { event.preventDefault(); fatal = 'WebGL context lost; no hidden restore/fallback'; errors.push(fatal); stopLoop(); context.canvas.dispatchEvent(new CustomEvent('three-lab-error', { detail: fatal })); };
  const onAbort = () => { void dispose().catch(() => {}); };
  context.canvas.addEventListener('webglcontextlost', contextLost); signal.addEventListener('abort', onAbort, { once: true }); hostListeners += 2;
  async function dispose(): Promise<void> {
    disposing ??= Promise.resolve().then(async () => {
      generation += 1; stopLoop(); abort.abort();
      try { if (pending) { await pending.catch(() => {}); } if (current) { await disposeCandidate(current); } }
      finally {
        current = undefined; scene.clear(); context.canvas.removeEventListener('webglcontextlost', contextLost);
        signal.removeEventListener('abort', onAbort); hostListeners -= 2;
        // The single canvas retains a reusable context. Losing it makes normal remount fail;
        // native context/driver allocations remain unsupported, not a claimed zero-byte result.
        renderer.dispose(); liveHosts.delete(token); disposed = true;
      }
    });
    return disposing;
  }
  const host: ThreeLabHost = {
    scene, camera,
    setResetTick(tick) { active(); requireValue(!pending, 'Replacement pending'); if (tick !== null) { integer(tick); } current!.resetTick = tick; },
    setFrame(input) {
      active(); requireValue(!pending, 'Replacement pending'); const frame = createFrameInput(input);
      requireValue(frame.sourceRevision === fixtureRevision(current!.fixture) && (current!.resetTick === null || current!.resetTick <= frame.tick), 'Stale source/reset frame');
      requireValue(current!.fixture.cameras.some((entry) => entry.id === frame.cameraId), 'Unknown camera');
      current!.frame = frame; updateCamera(current!);
      try { for (const effect of current!.effects) { effect.setFrame(frame); } }
      catch (error) { fatal = `Frame projection failed: ${String(error)}`; errors.push(fatal); stopLoop(); throw error; }
    },
    async replaceFixture(next) {
      active(); requireValue(!pending, 'Replacement pending'); const version = ++generation;
      pending = (async () => {
        const candidate = await build(next, version);
        try { active(); requireValue(version === generation, 'Stale/aborted source candidate'); }
        catch (error) { await disposeCandidate(candidate); throw error; }
        const old = current!;
        // Synchronous publication: no render can see only part of a candidate.
        scene.remove(old.root, old.lights); scene.add(candidate.root, candidate.lights); current = candidate; configure(candidate);
        await disposeCandidate(old).catch((error) => { errors.push(String(error)); });
      })();
      try { await pending; }
      catch (error) { errors.push(`Replacement failed; previous complete snapshot retained: ${String(error)}`); throw error; }
      finally { pending = undefined; }
    },
    resize(width, height, dpr) {
      active(); integer(width, 1); integer(height, 1); finite(dpr, 1, 4);
      requireValue(width * dpr <= renderer.capabilities.maxTextureSize && height * dpr <= renderer.capabilities.maxTextureSize, 'Resolution exceeds device capability; no downgrade');
      renderer.setPixelRatio(dpr); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    },
    readFacts() {
      active(); requireValue(!pending, 'Replacement pending'); const facts = current!.effects.map((effect) => validateFacts(effect.readFacts()));
      const logicalCosts: Record<string, LabMetric> = { gpuBytes: unavailable('Native GPU memory unavailable'),
        gpuMs: timerQuery ? { status: 'not-run', unit: 'ms', reason: 'Timer available; diagnostic loop does not sample GPU timing' }
          : unavailable('EXT_disjoint_timer_query_webgl2 unavailable', 'ms'),
        renderCalls: measured(renderer.info.render.calls), triangles: measured(renderer.info.render.triangles) };
      facts.forEach((fact, index) => { Object.entries(fact.logicalCosts).forEach(([key, metric]) => { logicalCosts[`effect-${index}-${key}`] = metric; }); });
      return validateFacts({ experimentId: 'RD-03', variantId: context.preset.id, backend: 'Three-WebGLRenderer-WebGL2',
        fixtureDigest: getFixtureDigest(current!.fixture), sourceRevision: fixtureRevision(current!.fixture),
        liveResources: { renderers: measured(1), renderloops: measured(1), geometries: measured(renderer.info.memory.geometries),
          textures: measured(renderer.info.memory.textures), hostListeners: measured(2) }, logicalCosts,
        unsupportedFeatures: [...new Set(['native-pcf-shadow-parity', 'native-sky-shader-parity', ...facts.flatMap((fact) => fact.unsupportedFeatures)])], errors });
    },
    readDiagnostics() { active(); requireValue(!pending, 'Replacement pending'); return diagnostics(renderer, timerQuery, device, current!.fixture, current!.frame, current!.resetTick, submissions, rendered); },
    readCleanup() { return { disposed, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      programs: renderer.info.programs?.length ?? 0, liveHosts: liveThreeHostCounts() }; },
    dispose,
  };
  try {
    current = await build(context.fixture, generation); active(); scene.add(current.root, current.lights); configure(current);
    const width = context.preset.parameters?.width ?? 1280; const height = context.preset.parameters?.height ?? 720; const dpr = context.preset.parameters?.dpr ?? 1;
    integer(width, 1); integer(height, 1); finite(dpr, 1, 4); host.resize(width, height, dpr);
    loops += 1; raf = requestAnimationFrame(render); return host;
  } catch (error) { await dispose().catch(() => {}); throw error; }
}
