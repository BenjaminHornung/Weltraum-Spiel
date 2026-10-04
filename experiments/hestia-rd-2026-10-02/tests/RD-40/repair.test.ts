import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFixtureDigest } from '../../src/contracts/fixture';
import { sampleScenario } from '../../src/contracts/scenario';
import { createRunResult } from '../../src/contracts/result';
import { canonicalJson, sha256 } from '../../src/contracts/validation';
import * as assets from '../../src/runner/assets';
import * as sessions from '../../src/tools/variant-gallery/session';
import * as evidence from '../../src/tools/variant-gallery/evidence';
import { deriveReplay, type Replay, type Selection, type Submission } from '../../src/tools/variant-gallery/model';
import type { SourceBinding } from '../../src/tools/variant-gallery/source';

function deferred() { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; }
// CONTROLLED DOM/host doubles exercise the actual main.ts listeners, not a duplicate uploader or native UI/GPU.
class NodeDouble {
  value = ''; disabled = false; type = ''; textContent = ''; max = ''; open = false;
  files: readonly File[] | null = null; dataset: Record<string, string> = {}; style = {}; children: NodeDouble[] = [];
  listeners = new Map<string, ((event: unknown) => void)[]>();
  constructor(readonly tag = '', readonly id = '') {}
  get valueAsNumber() { return this.value.trim() ? Number(this.value) : NaN; }
  addEventListener(type: string, listener: (event: unknown) => void) { this.listeners.set(type, [...this.listeners.get(type) ?? [], listener]); }
  fire(type = 'click') { for (const listener of this.listeners.get(type) ?? []) { listener({ preventDefault() {} }); } }
  click() { if (!this.disabled) { this.fire(); } }
  replaceChildren(...children: NodeDouble[]) { this.children = children; if (this.tag === 'select') { this.value = children[0]?.value ?? ''; } }
  append(...children: NodeDouble[]) { this.children.push(...children); }
  querySelector() { return this.children.find((child) => child.value === 'RD-11') ?? null; }
  setAttribute() {}
  focus() {}
}
function controlledHosts(data: Replay) {
  const counts = { live: 0, peak: 0, frames: 0, disposed: 0 }; let hold: ReturnType<typeof deferred> | null = null;
  const mount = async (s: Selection, initial: Replay['initialFixture']): Promise<sessions.GalleryHost> => {
    counts.live++; counts.peak = Math.max(counts.peak, counts.live); await hold?.promise;
    let fixture = initial; let frame = sampleScenario(data.scenario, 0, true).frame; let resetTick: number | null = null;
    let submitted = 0; let generation = 0; let disposed = false;
    const read = (): Submission => ({ frame, fixtureDigest: getFixtureDigest(fixture), resetTick,
      backend: { requested: s.variant === 'C2' ? 'webgpu' : 'webgl2', actual: s.variant === 'C2' ? 'webgpu' : 'webgl2', label: 'CONTROLLED' },
      resolution: { width: s.width, height: s.height, dpr: s.dpr, bufferWidth: s.width, bufferHeight: s.height },
      sourceRefs: fixture.sourceRefs, presentationProfile: fixture.presentation?.id ?? 'synthetic-lab-light-v1-no-shadows',
      quality: { requested: 'CONTROLLED', observed: 'CONTROLLED' }, submittedFrames: submitted, projectionGeneration: s.variant === 'fixture-control' ? null : generation,
      rendered: { tick: frame.tick, fixtureDigest: getFixtureDigest(fixture), sourceRevision: frame.sourceRevision, resetTick,
        cameraId: s.variant === 'fixture-control' ? null : frame.cameraId, projectionGeneration: s.variant === 'fixture-control' ? null : generation },
      errors: [], unsupportedFeatures: ['CONTROLLED-NOT-NATIVE'], logicalCosts: {} });
    const host: sessions.GalleryHost = {
      handle: { setFrame(next) { counts.frames++; frame = next; }, async replaceFixture(next) { fixture = next; generation++; },
        readFacts() { throw new Error('Unused controlled seam'); }, dispose: async () => { await host.dispose(); } },
      setResetTick(tick) { resetTick = tick; }, readSubmission: read,
      async waitFor(_sample, _baseline, signal) { signal.throwIfAborted(); submitted++; return read(); },
      async dispose() { if (!disposed) { disposed = true; counts.live--; counts.disposed++; } return { disposed: true }; },
    }; return host;
  };
  return { counts, mount, hold(next: ReturnType<typeof deferred> | null) { hold = next; } };
}
type Page = Awaited<ReturnType<typeof page>>;
let current: Page | null = null;
async function page(delayed = false) {
  vi.resetModules();
  const root = new URL('../../fixtures/', import.meta.url);
  const localFetch: typeof fetch = async (input) => new Response(await readFile(fileURLToPath(String(input))));
  const inventory = await assets.loadInventory(root, localFetch); const data = await assets.loadReplay(inventory, 'F04-DETACH-REPLAY', root, localFetch);
  const control = controlledHosts(data); const entered = deferred(); const release = deferred();
  const html = await readFile(new URL('../../src/tools/variant-gallery/index.html', import.meta.url), 'utf8');
  const nodes = new Map<string, NodeDouble>();
  for (const match of html.matchAll(/<(\w+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    const node = new NodeDouble(match[1]!, match[3]!); node.disabled = /\bdisabled\b/.test(match[2]!);
    node.value = /\bvalue="([^"]*)"/.exec(match[2]!)?.[1] ?? ''; node.dataset.command = /\bdata-command="([^"]+)"/.exec(match[2]!)?.[1] ?? '';
    nodes.set(node.id, node);
  }
  nodes.get('viewport')!.value = '1,1,1'; nodes.get('evidence-slot')!.value = 'A';
  const document = { getElementById: (id: string) => nodes.get(id), activeElement: null,
    createElement: (tag: string) => new NodeDouble(tag), querySelectorAll: () => [...nodes.values()].filter((node) => node.dataset.command), addEventListener() {} };
  vi.stubGlobal('document', document); vi.stubGlobal('window', { addEventListener() {} });
  vi.stubGlobal('location', { href: 'http://CONTROLLED.invalid/src/tools/variant-gallery/index.html' });
  vi.stubGlobal('Option', class extends NodeDouble { constructor(label: string, value: string) { super('option'); this.textContent = label; this.value = value; } });
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1, height: 1, close() {} })));
  const registration = vi.fn((variant: string) => {
    if (!['fixture-control', 'C1', 'C2'].includes(variant)) { throw new Error(`Invalid registration ${JSON.stringify(variant)}`); }
    return { preset: { id: variant } };
  });
  let session!: ReturnType<typeof sessions.createGallerySession>;
  vi.doMock('../../src/tools/variant-gallery/hosts', () => ({ registration, knownHostMount: () => control.mount }));
  vi.doMock('../../src/tools/variant-gallery/session', () => ({ ...sessions, createGallerySession(options: Parameters<typeof sessions.createGallerySession>[0]) {
    session = sessions.createGallerySession(options); vi.spyOn(session, 'command'); return session;
  } }));
  vi.doMock('../../src/runner/assets', () => ({ ...assets, async loadInventory() { entered.resolve(); await release.promise; return { ...inventory, scenarios: inventory.scenarios.filter((s) => s.id === data.scenario.id) }; }, async loadReplay() { return data; } }));
  const bind = vi.fn(evidence.bindEvidence); vi.doMock('../../src/tools/variant-gallery/evidence', () => ({ ...evidence, bindEvidence: bind }));
  const mounted = import('../../src/tools/variant-gallery/main'); await entered.promise;
  const result = { nodes, control, data, registration, bind, session, release, mounted };
  current = result;
  if (!delayed) { release.resolve(); await mounted; expect(session.read().status).toBe('READY'); }
  return result;
}
afterEach(async () => {
  if (current) { current.release.resolve(); await current.mounted; await current.session.dispose(); expect(current.control.counts.live).toBe(0); current = null; }
  for (const module of ['hosts', 'session', 'evidence']) { vi.doUnmock(`../../src/tools/variant-gallery/${module}`); }
  vi.doUnmock('../../src/runner/assets'); vi.unstubAllGlobals(); vi.restoreAllMocks();
});
async function upload(p: Page) {
  const state = p.session.read(); const source = JSON.parse(p.nodes.get('facts')!.value).source as SourceBinding;
  const prepared = await deriveReplay(p.data, state.selection!); const bytes = (value: unknown) => new TextEncoder().encode(canonicalJson(value));
  const image = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=', 'base64'));
  const buildDigest = await sha256(bytes('CONTROLLED-NOT-NATIVE-BUILD')); const missing = { status: 'not-run', unit: 'ms', reason: 'CONTROLLED CPU; no GPU' } as const;
  const run = createRunResult({ schema: 'hestia-rd-result-v1', runId: 'RD40-REPAIR-CONTROLLED', scenarioId: state.selection!.scenarioId,
    scenarioDigest: state.comparison!.effectiveScenarioDigest, variantId: state.selection!.variant, fixtureDigest: state.comparison!.fixtureDigest, sourceRefs: state.comparison!.sourceRefs,
    sourceDigest: source.sourceDigest, sourceBytesDigest: source.sourceBytesDigest, lockDigest: source.lockDigest, buildDigest,
    browser: { executable: 'C:/IFI_SourceCode/CONTROLLED/no-browser.exe', version: 'CONTROLLED-NOT-RUN' }, device: { id: 'CONTROLLED', description: 'No native GPU', driver: missing },
    backend: 'CONTROLLED', runClass: 'image-motion', temperature: 'warm', samples: { planned: 1, observed: 1, failed: 0, skipped: 0, skippedReasons: [] }, rawDataPaths: [], errors: [],
    metrics: { cpuMs: missing, gpuMs: missing, frameMs: missing, uploadBytes: missing, cpuBytes: missing, gpuBytes: missing }, media: [{ path: 'CONTROLLED/image.png', sha256: await sha256(image), kind: 'image' }],
    gates: [{ id: 'NATIVE-UI', status: 'NOT_RUN', reason: 'CONTROLLED only' }], productIntegrated: false });
  const contents = { run: bytes(run), image, original: bytes(prepared.scenario), effective: bytes(prepared.effective), fixture: bytes(prepared.fixtures.get(state.comparison!.fixtureDigest)) };
  const files = Object.fromEntries(await Promise.all(Object.entries(contents).map(async ([key, value]) => [key, { path: `CONTROLLED/${key}.${key === 'image' ? 'png' : 'json'}`, sha256: await sha256(value) }])));
  const sidecar = { ...evidence.bindingTemplate(state, source), provenance: { sourceCommit: 'fb6e9678e312b7716025ab358b14a550ae56e12e', sourceTree: '939e61f1dca900975d8408c891f6e589637b3ab1', buildDigest }, files };
  const local = [{ name: 'capture.binding.json', bytes: bytes(sidecar) }, ...Object.entries(contents).map(([key, value]) => ({ name: `${key}.${key === 'image' ? 'png' : 'json'}`, bytes: value }))];
  return local.map((file) => ({ name: file.name, type: file.name.endsWith('.png') ? 'image/png' : 'application/json', size: file.bytes.length,
    arrayBuffer: vi.fn(async () => new Uint8Array(file.bytes).buffer) }));
}
function setFiles(p: Page, files: Awaited<ReturnType<typeof upload>>) { p.nodes.get('evidence-files')!.files = files as unknown as File[]; }
async function bound(p: Page) { await vi.waitFor(() => { expect(p.nodes.get('evidence-status')!.value).toContain('bound'); }); }

describe('RD40 repair CONTROLLED owning-flow regressions (not native browser proof)', () => {
  it('rejects blank/fraction/out-of-range DOM seeks before dispatch without changing the submitted snapshot/reset owner', async () => {
    const p = await page(); const tick = Math.max(17, ...p.data.scenario.snapshots.map((s) => s.tick), ...p.data.scenario.keyframes.filter((e) => e.type === 'ResetLab').map((e) => e.tick));
    await p.session.command('seek', tick); const before = p.session.read(); const calls = vi.mocked(p.session.command).mock.calls.length; const frames = p.control.counts.frames;
    for (const input of ['', ' ', '2.5', '-1', String(before.durationTicks + 1), 'NaN']) {
      p.nodes.get('seek')!.value = input; p.nodes.get('seek-go')!.fire(); await Promise.resolve();
      expect(vi.mocked(p.session.command).mock.calls).toHaveLength(calls); expect(p.session.read()).toEqual(before);
      expect(p.nodes.get('input-error')?.value).toMatch(/integer|tick/i); expect(p.control.counts).toMatchObject({ live: 1, frames, disposed: 0 });
    }
    p.nodes.get('seek')!.value = '7'; p.nodes.get('seek-go')!.fire(); await vi.waitFor(() => { expect(p.session.read().comparison?.frame.tick).toBe(7); });
    expect(p.session.read().comparison?.fixtureDigest).toBe(p.data.scenario.fixtureDigest); expect(p.session.read().comparison?.resetTick).toBe(sampleScenario(p.data.scenario, 7, true).resetTick);
  });
  it('guards the owning session boundary for every invalid direct seek and retains valid/backward semantics', async () => {
    const p = await page(); const tick = Math.max(17, ...p.data.scenario.snapshots.map((s) => s.tick), ...p.data.scenario.keyframes.filter((e) => e.type === 'ResetLab').map((e) => e.tick));
    const results = [];
    for (const bad of [NaN, undefined, 2.5, -1, p.data.scenario.durationTicks + 1, Infinity, '' as unknown as number]) {
      await p.session.select({ scenarioId: p.data.scenario.id, variant: 'fixture-control', cameraId: p.data.scenario.initialCameraId, width: 1, height: 1, dpr: 1 });
      await p.session.command('seek', tick); const before = p.session.read(); const counts = { ...p.control.counts };
      await p.session.command('seek', bad); const after = p.session.read();
      results.push({ status: after.status, busy: after.busy, generation: after.generation === before.generation, comparison: canonicalJson(after.comparison) === canonicalJson(before.comparison),
        submission: canonicalJson(after.submission) === canonicalJson(before.submission), counts: canonicalJson(p.control.counts) === canonicalJson(counts) });
    }
    expect(results).toEqual(Array.from({ length: 7 }, () => ({ status: 'READY', busy: false, generation: true, comparison: true, submission: true, counts: true })));
    await p.session.command('seek', 7); expect(p.session.read().comparison?.frame).toMatchObject({ tick: 7, paused: true });
  });
  it('preflights the whole selection including a later oversized JSON before any arrayBuffer call', async () => {
    const p = await page(); const files = await upload(p); files[4]!.size = 1024 * 1024 + 1; setFiles(p, files);
    p.nodes.get('bind')!.fire(); await vi.waitFor(() => { expect(p.nodes.get('evidence-status')!.value).toContain('Blocked'); });
    expect(files.map((file) => file.arrayBuffer.mock.calls.length)).toEqual([0, 0, 0, 0, 0, 0]); expect(p.bind).not.toHaveBeenCalled();
    expect(p.nodes.get('bind')!.disabled).toBe(false);
  });
  it('preflights count, unique names, exact binding JSON, PNG role and MIME before any copy', async () => {
    const p = await page(); const results = [];
    for (const mutation of ['count', 'duplicate', 'binding', 'png', 'mime', 'png-size', 'empty']) {
      const files = await upload(p);
      if (mutation === 'count') { files.pop(); }
      if (mutation === 'duplicate') { files[5]!.name = files[4]!.name; }
      if (mutation === 'binding') { files[5]!.name = 'other.binding.json'; }
      if (mutation === 'png') { files[2]!.name = 'image.json'; files[2]!.type = 'application/json'; }
      if (mutation === 'mime') { files[5]!.type = 'text/javascript'; }
      if (mutation === 'png-size') { files[2]!.size = 32 * 1024 * 1024 + 1; }
      if (mutation === 'empty') { files[5]!.size = 0; }
      setFiles(p, files); p.nodes.get('evidence-status')!.value = ''; p.nodes.get('bind')!.fire();
      await vi.waitFor(() => { expect(p.nodes.get('evidence-status')!.value).toContain('Blocked'); }); results.push(files.reduce((sum, file) => sum + file.arrayBuffer.mock.calls.length, 0));
    }
    expect(results).toEqual([0, 0, 0, 0, 0, 0, 0]); expect(p.bind).not.toHaveBeenCalled();
  });
  it('serializes repeated Bind synchronously, imports once, and keeps valid stable source/runtime/export bindings', async () => {
    const p = await page(); const files = await upload(p); const held = deferred(); const read = files[0]!.arrayBuffer.getMockImplementation()!;
    files[0]!.arrayBuffer.mockImplementation(async () => { await held.promise; return read(); }); setFiles(p, files);
    p.nodes.get('bind')!.fire(); p.nodes.get('bind')!.fire();
    const pending = { copies: files[0]!.arrayBuffer.mock.calls.length, disabled: p.nodes.get('bind')!.disabled };
    held.resolve(); await bound(p); expect(pending).toEqual({ copies: 1, disabled: true });
    expect(files.map((file) => file.arrayBuffer.mock.calls.length)).toEqual([1, 1, 1, 1, 1, 1]); expect(p.bind).toHaveBeenCalledTimes(1);
    const first = await p.bind.mock.results[0]!.value; p.nodes.get('bind')!.fire(); await vi.waitFor(() => { expect(p.bind).toHaveBeenCalledTimes(2); });
    await bound(p); const second = await p.bind.mock.results[1]!.value; expect(first.cardHash).toBe(second.cardHash);
    p.nodes.get('b-variant')!.value = 'fixture-control'; p.nodes.get('evidence-slot')!.value = 'B'; p.nodes.get('bind')!.fire();
    await vi.waitFor(() => { expect(p.nodes.get('evidence-status')!.value).toContain('B bound'); }); expect(p.nodes.get('export-pair')!.disabled).toBe(false);
  });
  it('clears failed Bind and never reenables it when an old bind finishes during PREPARING or disposal', async () => {
    const p = await page(); let files = await upload(p); files[0]!.arrayBuffer.mockRejectedValueOnce(new Error('CONTROLLED failed read')); setFiles(p, files);
    p.nodes.get('bind')!.fire(); await vi.waitFor(() => { expect(p.nodes.get('evidence-status')!.value).toContain('Blocked'); }); expect(p.nodes.get('bind')!.disabled).toBe(false);
    files = await upload(p); const held = deferred(); const read = files[0]!.arrayBuffer.getMockImplementation()!; files[0]!.arrayBuffer.mockImplementation(async () => { await held.promise; return read(); }); setFiles(p, files);
    p.nodes.get('bind')!.fire(); const mounting = deferred(); p.control.hold(mounting); p.nodes.get('switch-b')!.fire(); expect(p.session.read().status).toBe('PREPARING');
    held.resolve(); p.nodes.get('evidence-status')!.value = ''; await vi.waitFor(() => { expect(p.nodes.get('evidence-status')!.value).toContain('Blocked'); }); expect(p.nodes.get('bind')!.disabled).toBe(true);
    mounting.resolve(); p.control.hold(null); await vi.waitFor(() => { expect(p.session.read().status).toBe('READY'); });
    p.nodes.get('evidence-slot')!.value = 'B'; files = await upload(p); const disposedRead = deferred(); const readAgain = files[0]!.arrayBuffer.getMockImplementation()!;
    files[0]!.arrayBuffer.mockImplementation(async () => { await disposedRead.promise; return readAgain(); }); setFiles(p, files);
    p.nodes.get('bind')!.fire(); p.nodes.get('dispose')!.fire(); await p.session.dispose(); disposedRead.resolve(); p.nodes.get('evidence-status')!.value = '';
    await vi.waitFor(() => { expect(p.nodes.get('evidence-status')!.value).toContain('Blocked'); }); expect(p.nodes.get('bind')!.disabled).toBe(true);
  });
  it('guards both switches while inventory is delayed, then permits rapid PREPARING coalescing after initial READY', async () => {
    const p = await page(true); const errors = [];
    for (const slot of ['a', 'b']) { try { p.nodes.get(`switch-${slot}`)!.fire(); } catch (error) { errors.push(String(error)); } }
    const initialDisabled = ['a', 'b'].map((slot) => p.nodes.get(`switch-${slot}`)!.disabled);
    p.release.resolve(); await p.mounted;
    expect(errors).toEqual([]); expect(p.registration.mock.calls.every(([variant]) => variant !== '')).toBe(true); expect(initialDisabled).toEqual([true, true]);
    expect(p.nodes.get('switch-a')!.disabled).toBe(false); expect(p.nodes.get('switch-b')!.disabled).toBe(false);
    const held = deferred(); p.control.hold(held); p.nodes.get('switch-b')!.fire();
    expect(p.session.read().status).toBe('PREPARING'); expect(p.nodes.get('switch-a')!.disabled).toBe(false); p.nodes.get('switch-a')!.fire();
    held.resolve(); p.control.hold(null); await vi.waitFor(() => { expect(p.session.read().status).toBe('READY'); });
    expect(p.session.read().selection?.variant).toBe('fixture-control'); expect(p.control.counts.peak).toBe(1);
  });
});
