import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { controlManifest } from '../../src/contracts/controlFixture';
import { createFrameInput, mountExperiment, registeredMountCount, type LabExperimentHandle } from '../../src/contracts/experiment';
import { copyFixturePayload, getFixtureDigest, importFixture } from '../../src/contracts/fixture';
import { PINNED_INVENTORY_SHA256 } from '../../src/runner/assets';
import { getScenarioDigest, importScenario, sampleScenario } from '../../src/contracts/scenario';
import { createRendererProbeExperiment, readProbeReport } from '../../src/experiments/renderer-probe';

const sourceHash = createHash('sha256').update(readFileSync(new URL('../../src/contracts/controlFixture.ts', import.meta.url))).digest('hex');
async function fixture(seed = 0) { return importFixture(new TextEncoder().encode(JSON.stringify(controlManifest(sourceHash, sourceHash, seed)))); }
const writes: string[] = [];
const mounted: LabExperimentHandle[] = [];
afterEach(async () => {
  for (const handle of mounted.splice(0)) { await handle.dispose(); }
  vi.unstubAllGlobals(); writes.length = 0; expect(registeredMountCount()).toBe(0);
});
function guardedGlobals(gpu?: unknown) {
  vi.stubGlobal('navigator', { gpu });
  vi.stubGlobal('localStorage', { setItem: (key: string) => { writes.push(`storage:${key}`); } });
  vi.stubGlobal('indexedDB', { open: () => { writes.push('database'); throw new Error('Forbidden'); } });
  vi.stubGlobal('fetch', () => { writes.push('request'); throw new Error('Forbidden'); });
}
function canvas(gl: unknown = null, gpuContext: unknown = null) {
  const eventTarget = new EventTarget();
  return Object.assign(eventTarget, { width: 320, height: 180,
    getContext: vi.fn((kind: string) => kind === 'webgl2' ? gl : kind === 'webgpu' ? gpuContext : null) }) as unknown as HTMLCanvasElement;
}
function glDouble(identity?: string, timer = false, fault = false) {
  const lost = vi.fn(); const removeProgram = vi.fn(); const removeShader = vi.fn(); const removeArray = vi.fn();
  const gl = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, NO_ERROR: 0,
    COLOR_BUFFER_BIT: 5, TRIANGLES: 6, SAMPLES: 7, VERSION: 8,
    MAX_TEXTURE_SIZE: 9, MAX_3D_TEXTURE_SIZE: 10, MAX_ARRAY_TEXTURE_LAYERS: 11,
    MAX_UNIFORM_BLOCK_SIZE: 12, MAX_COLOR_ATTACHMENTS: 13, MAX_DRAW_BUFFERS: 14, MAX_SAMPLES: 15,
    createShader: () => ({}), shaderSource: vi.fn(), compileShader: vi.fn(), getShaderParameter: () => !fault,
    getShaderInfoLog: () => 'controlled compile failure', createProgram: () => ({}), attachShader: vi.fn(), linkProgram: vi.fn(),
    getProgramParameter: () => true, getProgramInfoLog: () => '', createVertexArray: () => ({}), bindVertexArray: vi.fn(),
    useProgram: vi.fn(), viewport: vi.fn(), clearColor: vi.fn(), clear: vi.fn(), drawArrays: vi.fn(), flush: vi.fn(),
    getError: () => 0, isContextLost: () => false, getContextAttributes: () => ({ antialias: true, alpha: false }),
    getParameter: (name: number) => name === 100 ? identity : name === 8 ? 'WebGL 2.0 double' : name === 7 ? 4 : 256,
    getExtension: (name: string) => name === 'WEBGL_debug_renderer_info' && identity ? { UNMASKED_RENDERER_WEBGL: 100, UNMASKED_VENDOR_WEBGL: 101 }
      : name === 'EXT_disjoint_timer_query_webgl2' && timer ? {} : name === 'WEBGL_lose_context' ? { loseContext: lost } : null,
    deleteProgram: removeProgram, deleteShader: removeShader, deleteVertexArray: removeArray };
  return { gl, lost, removeProgram, removeShader, removeArray };
}
function gpuDouble(requestDevice?: () => Promise<unknown>, identity = '') {
  const destroy = vi.fn(); const submit = vi.fn(); const unconfigure = vi.fn();
  const device = { destroy, features: new Set<string>(), limits: { maxTextureDimension2D: 4096, maxBufferSize: 1048576,
    maxColorAttachments: 4, maxStorageBuffersPerShaderStage: 8 }, lost: new Promise(() => {}),
    pushErrorScope: vi.fn(), popErrorScope: async () => null, createShaderModule: () => ({}),
    createRenderPipelineAsync: async () => ({}), queue: { submit, onSubmittedWorkDone: async () => {} },
    createCommandEncoder: () => ({ beginRenderPass: () => ({ setPipeline: vi.fn(), draw: vi.fn(), end: vi.fn() }), finish: () => ({}) }) };
  const requesting = vi.fn(requestDevice ?? (async () => device)); const features = new Set<string>();
  const gpu = { requestAdapter: async () => ({ info: { vendor: '', architecture: '', device: '', description: identity, isFallbackAdapter: false },
    features, requestDevice: requesting }), getPreferredCanvasFormat: () => 'bgra8unorm' };
  const context = { configure: vi.fn(), unconfigure, getCurrentTexture: () => ({ createView: () => ({}) }) };
  return { gpu, device, context, destroy, submit, unconfigure, requesting, features };
}
async function mount(target: HTMLCanvasElement, mode = 'webgpu', signal = new AbortController().signal) {
  const handle = await mountExperiment(createRendererProbeExperiment, { canvas: target, fixture: await fixture(),
    preset: { id: `native-${mode}`, parameters: { mode } }, signal, capabilities: {} });
  mounted.push(handle); return handle;
}

describe('RD10 native capability behavior', () => {
  it.each(['missing', 'null-adapter', 'rejected-device'])('CAP01 %s cannot claim initialized WebGPU', async (fault) => {
    guardedGlobals(fault === 'missing' ? undefined : fault === 'null-adapter' ? { requestAdapter: async () => null }
      : gpuDouble(async () => { throw new Error('device init rejected'); }).gpu);
    const target = canvas(); const handle = await mount(target);
    const report = readProbeReport(target);
    expect(report.status).toBe(fault === 'rejected-device' ? 'failed' : 'unsupported');
    expect(report.backend).not.toBe('Native-WebGPU'); expect(report.submissions).toBe(0);
    expect(report.reason).toMatch(/unavailable|null|rejected/i);
    expect(handle.readFacts().experimentId).toBe('RD-10'); await handle.dispose();
  });
  it('CAP01 actual device, pipeline and submission are awaited, with a WebGPU-only canvas', async () => {
    const gpu = gpuDouble(); guardedGlobals(gpu.gpu); const target = canvas(null, gpu.context);
    const handle = await mount(target); const report = readProbeReport(target);
    expect(report.status).toBe('supported'); expect(report.backend).toBe('Native-WebGPU');
    expect(report.submissions).toBe(1); expect(gpu.submit).toHaveBeenCalledTimes(1);
    expect(target.getContext).toHaveBeenCalledExactlyOnceWith('webgpu');
    expect(report.targetQualified).toBe(false); await handle.dispose();
    expect(gpu.destroy).toHaveBeenCalledTimes(1); expect(gpu.unconfigure).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, 'Google SwiftShader'])('CAP02 unknown/software identity %s and absent timer are not measurements', async (identity) => {
    guardedGlobals(); const gl = glDouble(identity); const target = canvas(gl.gl);
    const handle = await mount(target, 'webgl2'); const report = readProbeReport(target);
    expect(report.identity.status).toBe(identity ? 'reported' : 'unknown');
    expect(report.targetQualified).toBe(false); expect(report.software).toBe(identity ? 'reported-software' : 'unknown');
    expect(report.metrics.gpuMs.status).toBe('unsupported'); expect(report.metrics.gpuMs).not.toHaveProperty('value');
    expect(report.metrics.nativeGpuBytes).not.toHaveProperty('value');
    expect(report.limits.maxTextureSize).toEqual({ status: 'reported-cap', value: 256, unit: 'texel' });
    await handle.dispose(); expect(gl.lost).toHaveBeenCalledTimes(1);
  });
  it('CAP02 available timer is NOT_RUN, not GPU duration or memory use', async () => {
    guardedGlobals(); const gl = glDouble('masked diagnostic adapter', true); const target = canvas(gl.gl);
    const handle = await mount(target, 'webgl2'); const report = readProbeReport(target);
    expect(report.timerAvailable).toBe(true); expect(report.metrics.gpuMs.status).toBe('not-run');
    expect(report.metrics.gpuMs).not.toHaveProperty('value'); expect(report.targetQualified).toBe(false); await handle.dispose();
  });
  it('CAP02 WebGPU adapter timer availability is separate from enabled device features and sampling', async () => {
    const gpu = gpuDouble(); gpu.features.add('timestamp-query'); guardedGlobals(gpu.gpu); const target = canvas(null, gpu.context);
    const handle = await mount(target); expect(gpu.device.features.has('timestamp-query')).toBe(false);
    expect(readProbeReport(target).timerAvailable).toBe(true); expect(readProbeReport(target).timerScope).toBe('WebGPU-adapter-feature');
    expect(readProbeReport(target).metrics.gpuMs).not.toHaveProperty('value'); await handle.dispose();
  });
  it('CAP03 opening/closing touches no guarded storage, database, request or product configuration', async () => {
    guardedGlobals(); const gl = glDouble(); const target = canvas(gl.gl); const handle = await mount(target, 'webgl2');
    await handle.dispose(); await handle.dispose(); expect(writes).toEqual([]);
    expect(gl.removeProgram).toHaveBeenCalledTimes(1); expect(gl.removeShader).toHaveBeenCalledTimes(2);
    expect(gl.removeArray).toHaveBeenCalledTimes(1); expect(readProbeReport(target).disposed).toBe(true);
  });
  it('CAP01 failed compile deletes partial candidates before publication', async () => {
    guardedGlobals(); const gl = glDouble(undefined, false, true); const target = canvas(gl.gl);
    const handle = await mount(target, 'webgl2'); expect(readProbeReport(target).status).toBe('failed');
    expect(gl.gl.drawArrays).not.toHaveBeenCalled(); expect(gl.removeShader).toHaveBeenCalledTimes(1);
    expect(gl.lost).toHaveBeenCalledTimes(1); await handle.dispose(); expect(gl.lost).toHaveBeenCalledTimes(1);
  });
  it('CAP03 double mount is rejected and backend reuse requires a fresh canvas', async () => {
    guardedGlobals(); const target = canvas(glDouble().gl); const handle = await mount(target, 'webgl2');
    await expect(mount(target, 'webgpu')).rejects.toThrow(/already mounted/); await handle.dispose();
    await expect(mount(target, 'webgpu')).rejects.toThrow(/fresh canvas/);
  });
  it('CAP03 aborted late device is destroyed, never submitted/published as supported', async () => {
    let resolveDevice!: (value: unknown) => void;
    const late = new Promise((resolve) => { resolveDevice = resolve; }); const gpu = gpuDouble(() => late);
    guardedGlobals(gpu.gpu); const target = canvas(null, gpu.context); const abort = new AbortController();
    const mounting = mount(target, 'webgpu', abort.signal); const rejected = expect(mounting).rejects.toThrow();
    await vi.waitFor(() => { expect(registeredMountCount()).toBe(1); });
    await vi.waitFor(() => { expect(gpu.requesting).toHaveBeenCalledTimes(1); });
    abort.abort(); resolveDevice(gpu.device); await rejected;
    await vi.waitFor(() => { expect(gpu.destroy).toHaveBeenCalledTimes(1); });
    expect(gpu.submit).not.toHaveBeenCalled(); expect(readProbeReport(target).status).not.toBe('supported');
  });
  it('CAP03 fixture/frame metadata validates controlled 60 Hz and source revision without mutating inputs', async () => {
    guardedGlobals(); const target = canvas(glDouble().gl); const handle = await mount(target, 'webgl2');
    const next = await fixture(1); await handle.replaceFixture(next);
    const frame = createFrameInput({ tick: 60, seconds: 1, paused: true, cameraId: 'diagnostic', sourceRevision: 1,
      weather: { windMps: [0, 0, 0], rain01: 0, snow01: 0, cloud01: 0 } });
    handle.setFrame(frame); expect(handle.readFacts().fixtureDigest).toBe(getFixtureDigest(next));
    expect(handle.readFacts().sourceRevision).toBe(1); expect(readProbeReport(target).frame).toEqual(frame);
    expect(() => handle.setFrame({ ...frame, seconds: 2 })).toThrow(/60 Hz/);
    expect(() => handle.setFrame({ ...frame, sourceRevision: 0 })).toThrow(/Stale/); await handle.dispose();
  });
  it('CAP03 real F01/F04/F06 scenario imports bind canonical digests and private payloads, no fabricated geometry', async () => {
    const root = new URL('../../fixtures/', import.meta.url); const bytes = readFileSync(new URL('inventory.json', root));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(PINNED_INVENTORY_SHA256);
    const inventory = JSON.parse(bytes.toString());
    for (const group of ['F01-HVP-COAST', 'F04-DETACH', 'F06-MATERIAL']) {
      const sources = inventory.fixtures.filter((entry: { group: string }) => entry.group === group);
      const imported = new Map();
      for (const source of sources) {
        const manifestUrl = new URL(source.manifestPath, root); const manifest = readFileSync(manifestUrl); const raw = JSON.parse(manifest.toString());
        const payloads = new Map<string, Uint8Array>(raw.payloads.map((descriptor: { id: string; path: string }) => [descriptor.id, readFileSync(new URL(descriptor.path, manifestUrl))]));
        const value = await importFixture(manifest, payloads); expect(getFixtureDigest(value)).toBe(source.fixtureDigest);
        if (raw.payloads.length) {
          const id = raw.payloads[0].id; const prior = copyFixturePayload(value, id); payloads.get(id)!.fill(0); manifest.fill(0);
          expect(copyFixturePayload(value, id)).toEqual(prior);
        }
        imported.set(getFixtureDigest(value), value);
      }
      const scenarioSource = inventory.scenarios.find((entry: { id: string }) => entry.id === `${group}-REPLAY`);
      const scenario = importScenario(readFileSync(new URL(scenarioSource.path, root)), imported);
      expect(await getScenarioDigest(scenario)).toBe(scenarioSource.scenarioDigest);
      const sample = sampleScenario(scenario, 0, true); guardedGlobals(); const target = canvas(glDouble().gl);
      const handle = await mountExperiment(createRendererProbeExperiment, { canvas: target, fixture: sample.fixture,
        preset: { id: 'native-webgl2', parameters: { mode: 'webgl2' } }, signal: new AbortController().signal, capabilities: {} });
      mounted.push(handle); handle.setFrame(sample.frame);
      expect(handle.readFacts().fixtureDigest).toBe(getFixtureDigest(sample.fixture));
      expect(readProbeReport(target).geometry).toBe('diagnostic-triangle-not-fixture-scene'); await handle.dispose();
    }
  });
});
