import { createFrameInput, validateFacts, type LabExperimentFactory, type LabFrameInput } from '../../contracts/experiment';
import { fixtureRevision, getFixtureDigest } from '../../contracts/fixture';
import type { LabMetric } from '../../contracts/result';
import { canonicalJson, freezeJson, requireValue } from '../../contracts/validation';

type Mode = 'webgl2' | 'webgpu';
type Cap = { status: 'reported-cap'; value: number; unit: string };
export interface ProbeReport {
  readonly experimentId: 'RD-10'; readonly variantId: string; readonly mode: Mode;
  readonly status: 'initializing' | 'supported' | 'unsupported' | 'failed'; readonly backend: string;
  readonly reason: string; readonly fixtureDigest: string; readonly fixtureId: string; readonly sourceRevision: number;
  readonly frame: LabFrameInput; readonly geometry: 'diagnostic-triangle-not-fixture-scene';
  readonly identity: { status: 'reported' | 'unknown'; renderer?: string; vendor?: string; reason?: string };
  readonly software: 'reported-software' | 'not-reported' | 'unknown'; readonly targetQualified: false;
  readonly qualification: 'DIAGNOSTIC-NOT-TARGET-GPU'; readonly timerAvailable: boolean;
  readonly timerScope: 'WebGL2-extension' | 'WebGPU-adapter-feature'; readonly fallbackAdapter: boolean | 'unknown';
  readonly limits: Readonly<Record<string, Cap>>; readonly metrics: Readonly<Record<string, LabMetric>>;
  readonly resolution: { width: number; height: number };
  readonly outputFormat: string; readonly effectiveSamples: number | 'unknown';
  readonly submissions: number; readonly disposed: boolean;
  readonly liveOwned: { contexts: number; devices: number; programs: number; shaders: number; vertexArrays: number };
  readonly productIntegrated: false;
}
const reports = new WeakMap<HTMLCanvasElement, ProbeReport>();
const usedCanvases = new WeakSet<HTMLCanvasElement>();
const unavailable = (reason: string, unit: string, status: 'unsupported' | 'not-run' = 'unsupported'): LabMetric => ({ status, unit, reason });
const measured = (value: number, unit = 'count'): LabMetric => ({ status: 'measured', value, unit });
const identityText = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;
export function readProbeReport(canvas: HTMLCanvasElement): ProbeReport {
  const report = reports.get(canvas); requireValue(report, 'Probe has not initialized'); return report;
}

/** Wait without a blocking GPU readback. An uncancellable late device is destroyed, never published. */
function waitFor<T>(promise: Promise<T>, signal: AbortSignal, releaseLate?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const onAbort = () => { if (!finished) { finished = true; reject(signal.reason); } };
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) { onAbort(); }
    promise.then((value) => {
      signal.removeEventListener('abort', onAbort);
      if (finished) { releaseLate?.(value); }
      else { finished = true; resolve(value); }
    }, (error) => { signal.removeEventListener('abort', onAbort); if (!finished) { finished = true; reject(error); } });
  });
}

/** Standalone native capability probe, NOT a Three effect or an implementation of C0/C1/C2. */
export const createRendererProbeExperiment: LabExperimentFactory = async (context) => {
  context.signal.throwIfAborted(); getFixtureDigest(context.fixture);
  const mode = context.preset.parameters?.mode;
  requireValue(mode === 'webgl2' || mode === 'webgpu', 'Explicit webgl2/webgpu mode required');
  requireValue(context.preset.id === `native-${mode}`, 'Variant must identify the requested native mode');
  requireValue(!usedCanvases.has(context.canvas), 'A fresh canvas is required for each backend probe');
  usedCanvases.add(context.canvas);
  let fixture = context.fixture;
  function initialFrame() { return createFrameInput({ tick: 0, seconds: 0, paused: true,
    cameraId: fixture.cameras[0].id, sourceRevision: fixtureRevision(fixture),
    weather: { windMps: [0, 0, 0], rain01: 0, snow01: 0, cloud01: 0 } }); }
  let frame = initialFrame();
  let status: ProbeReport['status'] = 'initializing'; let backend = `unsupported-native-${mode}`;
  let reason = 'Initialization pending; no fallback'; let disposed = false; let disposing: Promise<void> | undefined;
  let gl: WebGL2RenderingContext | null = null; let device: GPUDevice | undefined; let gpuCanvas: GPUCanvasContext | null = null;
  let program: WebGLProgram | null = null; const shaders: WebGLShader[] = []; let vertexArray: WebGLVertexArrayObject | null = null;
  let contextOwned = false; let timerAvailable = false; let submissions = 0; let outputFormat = 'unknown';
  let effectiveSamples: number | 'unknown' = 'unknown';
  let fallbackAdapter: boolean | 'unknown' = 'unknown';
  let identity: ProbeReport['identity'] = { status: 'unknown', reason: 'Adapter/renderer identity not exposed' };
  let software: ProbeReport['software'] = 'unknown'; const limits: Record<string, Cap> = {};
  const deadline = new AbortController(); const signal = AbortSignal.any([context.signal, deadline.signal]);
  const timeout = setTimeout(() => { deadline.abort(new Error('Probe initialization/submission exceeded 8000 ms')); }, 8000);
  function publish() {
    reports.set(context.canvas, freezeJson(JSON.parse(canonicalJson({ experimentId: 'RD-10', variantId: context.preset.id,
      mode, status, backend, reason, fixtureDigest: getFixtureDigest(fixture), fixtureId: fixture.id, sourceRevision: fixtureRevision(fixture), frame,
      geometry: 'diagnostic-triangle-not-fixture-scene', identity, software, targetQualified: false,
      qualification: 'DIAGNOSTIC-NOT-TARGET-GPU', timerAvailable, timerScope: mode === 'webgl2' ? 'WebGL2-extension' : 'WebGPU-adapter-feature', fallbackAdapter, limits,
      metrics: { gpuMs: unavailable(timerAvailable ? 'Timer available; no qualified sampling or benchmark lease' : 'GPU timer unavailable', 'ms', timerAvailable ? 'not-run' : 'unsupported'),
        nativeGpuBytes: unavailable('Native/driver GPU allocation bytes are not exposed', 'byte'),
        cpuMs: unavailable('No timing workload measured in capability smoke', 'ms', 'not-run'),
        frameMs: unavailable('No rAF loop; frame interval is not GPU duration', 'ms', 'not-run') },
      resolution: { width: context.canvas.width, height: context.canvas.height }, outputFormat, effectiveSamples,
      submissions, disposed, liveOwned: { contexts: contextOwned ? 1 : 0, devices: device ? 1 : 0,
        programs: program ? 1 : 0, shaders: shaders.length, vertexArrays: vertexArray ? 1 : 0 }, productIntegrated: false })) as ProbeReport));
    context.canvas.dispatchEvent(new Event('rd10-probe-report'));
  }
  function reportIdentity(renderer: unknown, vendor: unknown, fallback = false) {
    const description = identityText(renderer); const maker = identityText(vendor);
    identity = { status: description ? 'reported' : 'unknown', ...(description ? { renderer: description } : { reason: 'Renderer identity not exposed' }),
      ...(maker ? { vendor: maker } : {}) };
    software = fallback || /swiftshader|llvmpipe|software|lavapipe|basic render|warp/i.test(`${description ?? ''} ${maker ?? ''}`)
      ? 'reported-software' : identity.status === 'unknown' ? 'unknown' : 'not-reported';
  }
  function cap(name: string, value: unknown, unit: string) {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) { limits[name] = { status: 'reported-cap', value, unit }; }
  }
  function release() {
    if (gl) {
      if (vertexArray) { gl.deleteVertexArray(vertexArray); vertexArray = null; }
      if (program) { gl.deleteProgram(program); program = null; }
      shaders.splice(0).forEach((shader) => { gl!.deleteShader(shader); });
      if (contextOwned) { gl.getExtension('WEBGL_lose_context')?.loseContext(); }
      contextOwned = false; gl = null;
    }
    gpuCanvas?.unconfigure(); gpuCanvas = null; contextOwned = false;
    if (device) { device.onuncapturederror = null; device.destroy(); device = undefined; }
  }
  function fail(message: string) { if (!disposed && !disposing && status !== 'failed') { status = 'failed'; backend = `failed-native-${mode}`; reason = message; release(); publish(); } }
  const lost = () => { fail('WebGL2 context lost; no hidden restore or fallback'); };
  const onAbort = () => { void dispose(); };
  async function dispose(): Promise<void> {
    disposing ??= Promise.resolve().then(() => {
      clearTimeout(timeout); release(); disposed = true;
      context.canvas.removeEventListener('webglcontextlost', lost); context.signal.removeEventListener('abort', onAbort);
      publish();
    });
    return disposing;
  }
  publish(); context.signal.addEventListener('abort', onAbort, { once: true });
  try {
    if (mode === 'webgl2') {
      gl = context.canvas.getContext('webgl2', { antialias: true, alpha: false });
      if (!gl) { status = 'unsupported'; reason = 'WebGL2 context unavailable; no fallback'; }
      else {
        contextOwned = true; requireValue(!gl.isContextLost(), 'WebGL2 context already lost');
        context.canvas.addEventListener('webglcontextlost', lost);
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        reportIdentity(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : undefined, debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : undefined);
        timerAvailable = Boolean(gl.getExtension('EXT_disjoint_timer_query_webgl2'));
        for (const [name, parameter, unit] of [
          ['maxTextureSize', gl.MAX_TEXTURE_SIZE, 'texel'], ['max3DTextureSize', gl.MAX_3D_TEXTURE_SIZE, 'texel'],
          ['maxArrayTextureLayers', gl.MAX_ARRAY_TEXTURE_LAYERS, 'layer'], ['maxUniformBlockSize', gl.MAX_UNIFORM_BLOCK_SIZE, 'byte'],
          ['maxColorAttachments', gl.MAX_COLOR_ATTACHMENTS, 'attachment'], ['maxDrawBuffers', gl.MAX_DRAW_BUFFERS, 'buffer'],
          ['maxSamples', gl.MAX_SAMPLES, 'sample'],
        ] as const) { cap(name, gl.getParameter(parameter), unit); }
        const compile = (type: number, source: string) => {
          const shader = gl!.createShader(type); requireValue(shader, 'Shader allocation failed'); shaders.push(shader);
          gl!.shaderSource(shader, source); gl!.compileShader(shader);
          requireValue(gl!.getShaderParameter(shader, gl!.COMPILE_STATUS), `Shader compile failed: ${gl!.getShaderInfoLog(shader)}`); return shader;
        };
        const vertex = compile(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){vec2 p[3]=vec2[3](vec2(-.7,-.6),vec2(.7,-.6),vec2(0.,.7));gl_Position=vec4(p[gl_VertexID],0.,1.);}');
        const fragment = compile(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(.18,.72,.85,1.);}');
        program = gl.createProgram(); requireValue(program, 'Program allocation failed');
        gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
        requireValue(gl.getProgramParameter(program, gl.LINK_STATUS), `Program link failed: ${gl.getProgramInfoLog(program)}`);
        vertexArray = gl.createVertexArray(); requireValue(vertexArray, 'Vertex array allocation failed');
        gl.bindVertexArray(vertexArray); gl.useProgram(program); gl.viewport(0, 0, context.canvas.width, context.canvas.height);
        gl.clearColor(.04, .06, .09, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.flush();
        requireValue(gl.getError() === gl.NO_ERROR && !gl.isContextLost(), 'WebGL2 render submission failed');
        const samples = gl.getParameter(gl.SAMPLES); effectiveSamples = typeof samples === 'number' ? samples : 'unknown';
        // Drawing-buffer format is not inferable from RGBA shader output or attributes alone.
        outputFormat = 'WebGL2-default-framebuffer-format-not-exposed';
        submissions = 1; status = 'supported'; backend = 'Native-WebGL2'; reason = 'Compiled/linked triangle draw submitted and flushed; no GPU duration measurement';
      }
    } else {
      const gpu = navigator.gpu;
      if (!gpu) { status = 'unsupported'; reason = 'navigator.gpu unavailable; no fallback'; }
      else {
        const adapter = await waitFor(gpu.requestAdapter(), signal);
        if (!adapter) { status = 'unsupported'; reason = 'WebGPU requestAdapter returned null; no fallback'; }
        else {
          const info = adapter.info;
          reportIdentity(info?.description || info?.device, info?.vendor, info?.isFallbackAdapter);
          fallbackAdapter = typeof info?.isFallbackAdapter === 'boolean' ? info.isFallbackAdapter : 'unknown';
          // Probe adapter capability without requesting optional features or running GPU timestamps.
          timerAvailable = adapter.features.has('timestamp-query');
          device = await waitFor(adapter.requestDevice(), signal, (late) => { late.destroy(); });
          signal.throwIfAborted();
          device.lost.then((info) => { if (info.reason !== 'destroyed') { fail(`WebGPU device lost: ${info.message || info.reason}`); } });
          device.onuncapturederror = (event) => { fail(`WebGPU uncaptured error: ${event.error.message}`); };
          for (const [name, unit] of [['maxTextureDimension2D', 'texel'], ['maxTextureDimension3D', 'texel'], ['maxTextureArrayLayers', 'layer'],
            ['maxBufferSize', 'byte'], ['maxStorageBufferBindingSize', 'byte'], ['maxUniformBufferBindingSize', 'byte'],
            ['maxColorAttachments', 'attachment'], ['maxStorageBuffersPerShaderStage', 'buffer']] as const) { cap(name, device.limits[name], unit); }
          gpuCanvas = context.canvas.getContext('webgpu') as GPUCanvasContext | null; requireValue(gpuCanvas, 'WebGPU canvas context unavailable');
          outputFormat = gpu.getPreferredCanvasFormat(); effectiveSamples = 1;
          device.pushErrorScope('validation'); device.pushErrorScope('out-of-memory'); device.pushErrorScope('internal');
          gpuCanvas.configure({ device, format: outputFormat as GPUTextureFormat, alphaMode: 'opaque' }); contextOwned = true;
          const module = device.createShaderModule({ code: `
            @vertex fn vertex(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
              let points = array<vec2f, 3>(vec2f(-.7,-.6),vec2f(.7,-.6),vec2f(0.,.7));
              return vec4f(points[index],0.,1.);
            }
            @fragment fn fragment() -> @location(0) vec4f { return vec4f(.18,.72,.85,1.); }
          ` });
          const pipeline = await waitFor(device.createRenderPipelineAsync({ layout: 'auto', vertex: { module, entryPoint: 'vertex' },
            fragment: { module, entryPoint: 'fragment', targets: [{ format: outputFormat as GPUTextureFormat }] }, primitive: { topology: 'triangle-list' } }), signal);
          signal.throwIfAborted();
          const encoder = device.createCommandEncoder(); const pass = encoder.beginRenderPass({ colorAttachments: [{
            view: gpuCanvas.getCurrentTexture().createView(), clearValue: { r: .04, g: .06, b: .09, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
          pass.setPipeline(pipeline); pass.draw(3); pass.end(); device.queue.submit([encoder.finish()]); submissions = 1;
          await waitFor(device.queue.onSubmittedWorkDone(), signal);
          for (let scope = 0; scope < 3; scope += 1) {
            const error = await waitFor(device.popErrorScope(), signal); requireValue(!error, `WebGPU render error: ${error?.message}`);
          }
          signal.throwIfAborted(); requireValue(readProbeReport(context.canvas).status !== 'failed' && !disposed, 'Device lost during initialization');
          status = 'supported'; backend = 'Native-WebGPU'; reason = 'Device/pipeline initialized; triangle queue submission completed without scoped errors';
        }
      }
    }
    context.signal.throwIfAborted();
  } catch (error) {
    // Async device callbacks can have failed before this catch; preserve their first reason.
    if ((status as ProbeReport['status']) !== 'failed') { status = 'failed'; backend = `failed-native-${mode}`; reason = String(error); }
    release();
    if (context.signal.aborted) { await dispose(); throw error; }
  } finally { clearTimeout(timeout); publish(); }
  function active() { context.signal.throwIfAborted(); requireValue(!disposed && !disposing, 'Probe disposed'); }
  return {
    setFrame(input) {
      active(); const next = createFrameInput(input);
      requireValue(next.sourceRevision === fixtureRevision(fixture) && fixture.cameras.some((camera) => camera.id === next.cameraId), 'Stale source/camera frame');
      frame = next; publish();
    },
    async replaceFixture(next) { active(); getFixtureDigest(next); fixture = next; frame = initialFrame(); publish(); },
    readFacts() {
      active(); const report = readProbeReport(context.canvas);
      return validateFacts({ experimentId: 'RD-10', variantId: context.preset.id, backend,
        fixtureDigest: getFixtureDigest(fixture), sourceRevision: fixtureRevision(fixture),
        liveResources: { ...Object.fromEntries(Object.entries(report.liveOwned).map(([key, value]) => [key, measured(value)])), renderloops: measured(0) },
        logicalCosts: { ...report.metrics, submissions: measured(submissions) },
        unsupportedFeatures: ['canonical-fixture-scene-rendering', 'Three-C0-C1-C2-profiles-not-implemented', 'target-GPU-performance-art-qualification',
          ...(status === 'unsupported' ? [reason] : [])], errors: status === 'failed' ? [reason] : [] });
    }, dispose,
  };
};
