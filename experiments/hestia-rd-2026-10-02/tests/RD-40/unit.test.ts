import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getFixtureDigest } from '../../src/contracts/fixture';
import { canonicalJson, sha256 } from '../../src/contracts/validation';
import { createRunResult } from '../../src/contracts/result';
import { sampleScenario } from '../../src/contracts/scenario';
import { loadInventory, loadReplay } from '../../src/runner/assets';
import { createGallerySession, type GalleryHost } from '../../src/tools/variant-gallery/session';
import { deriveReplay, GalleryDisposalError, matchesSubmission, type Selection, type Submission } from '../../src/tools/variant-gallery/model';
import { bindEvidence, bindingTemplate, canExportPair, runtimeBinding, type EvidenceFiles } from '../../src/tools/variant-gallery/evidence';
import { sourceBinding } from '../../src/tools/variant-gallery/source';

const root = new URL('../../fixtures/', import.meta.url);
const localFetch: typeof fetch = async (input) => new Response(await readFile(fileURLToPath(String(input))));
async function replay(id = 'F04-DETACH-REPLAY') {
  return loadReplay(await loadInventory(root, localFetch), id, root, localFetch);
}
function selection(cameraId: string, variant: Selection['variant'] = 'fixture-control'): Selection {
  return { scenarioId: 'F04-DETACH-REPLAY', cameraId, variant, width: 1280, height: 720, dpr: 1 };
}
function deferred() {
  let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve };
}
// CONTROLLED ownership/submission doubles: no WebGL/WebGPU/native UI proof.
function doubles() {
  let live = 0; let peak = 0; const events: string[] = []; const holds = new Map<string, ReturnType<typeof deferred>>();
  let failDispose = false; let failVariant = ''; let failReplace = false;
  let disposeHold: ReturnType<typeof deferred> | null = null;
  let submissionHold: ReturnType<typeof deferred> | null = null;
  let signalError: (error: unknown) => void = () => {};
  const mount = async (s: Selection, initial: Awaited<ReturnType<typeof replay>>['initialFixture'], signal: AbortSignal, onError: (error: unknown) => void = () => {}): Promise<GalleryHost> => {
    signalError = onError;
    live++; peak = Math.max(peak, live); events.push(`mount:${s.variant}`);
    await holds.get(s.variant)?.promise;
    let fixture = initial; let frame = sampleScenario((await replay()).scenario, 0, true).frame;
    let resetTick: number | null = null; let count = 0; let generation = 0; let disposed = false;
    const read = (): Submission => ({ frame, fixtureDigest: getFixtureDigest(fixture), resetTick,
      backend: { requested: s.variant === 'C2' ? 'webgpu' : 'webgl2', actual: s.variant === 'C2' ? 'webgpu' : 'webgl2', label: 'CONTROLLED' },
      resolution: { width: s.width, height: s.height, dpr: s.dpr, bufferWidth: s.width, bufferHeight: s.height },
      presentationProfile: fixture.presentation?.id ?? 'synthetic-lab-light-v1-no-shadows', sourceRefs: fixture.sourceRefs, quality: { requested: 'CONTROLLED', observed: 'CONTROLLED' },
      submittedFrames: count, projectionGeneration: s.variant === 'fixture-control' ? null : generation,
      rendered: { tick: frame.tick, fixtureDigest: getFixtureDigest(fixture), sourceRevision: frame.sourceRevision, resetTick,
        cameraId: s.variant === 'fixture-control' ? null : frame.cameraId, projectionGeneration: s.variant === 'fixture-control' ? null : generation },
      errors: [], unsupportedFeatures: ['CONTROLLED-NOT-NATIVE'], logicalCosts: {} });
    const host: GalleryHost = {
      handle: { setFrame(next) { frame = next; }, async replaceFixture(next) { if (failReplace) { throw new Error('replacement failed'); } fixture = next; generation++; },
        readFacts() { throw new Error('Not used by controlled adapter'); }, dispose: async () => { await host.dispose(); } },
      setResetTick(tick) { resetTick = tick; }, readSubmission: read,
      async waitFor(sample, baseline, abort) {
        await submissionHold?.promise; abort.throwIfAborted(); if (failVariant === s.variant) { throw new Error('UNSUPPORTED C2 actual backend'); }
        count++; expect(matchesSubmission(read(), sample, s, baseline)).toBe(true); return read();
      },
      async dispose() { await disposeHold?.promise; if (!disposed) { disposed = true; live--; events.push(`dispose:${s.variant}`); } if (failDispose) { throw new Error('disposal failed'); } return { disposed: true, liveHosts: { renderers: live, renderloops: live } }; },
    };
    // Deliberately complete late even when aborted: the session must dispose it.
    void signal; return host;
  };
  return { mount, holds, events, get live() { return live; }, get peak() { return peak; },
    failDispose() { failDispose = true; }, holdDispose(hold: ReturnType<typeof deferred>) { disposeHold = hold; },
    holdSubmission(hold: ReturnType<typeof deferred>) { submissionHold = hold; },
    failVariant(v: string) { failVariant = v; }, failReplace() { failReplace = true; }, signalError(error: unknown) { signalError(error); } };
}

describe('RD40 CONTROLLED CPU gallery ownership (not native renderer/UI proof)', () => {
  it('UI40 preserves paused nonzero A/B/A state across actual snapshot and reset, then backward seek', async () => {
    const data = await replay(); const d = doubles(); const session = createGallerySession({ load: async () => data, mount: d.mount });
    const s = selection(data.scenario.initialCameraId); await session.select(s);
    const tick = Math.max(17, data.scenario.snapshots[0]?.tick ?? 0, data.scenario.keyframes.find((e) => e.type === 'ResetLab')?.tick ?? 0);
    await session.command('seek', tick); const before = session.read().comparison;
    expect(before?.frame.paused).toBe(true); expect(before?.frame.tick).toBe(tick);
    for (const variant of ['C1', 'fixture-control'] as const) { await session.select({ ...s, variant }); expect(session.read().comparison).toEqual(before); }
    await session.command('seek', 7); expect(session.read().comparison?.fixtureDigest).toBe(data.scenario.fixtureDigest);
    expect(session.read().comparison?.resetTick).toBe(sampleScenario(data.scenario, 7, true).resetTick);
    expect(d.peak).toBe(1); await session.dispose(); expect(d.live).toBe(0);
  });
  it('UI40 advance while paused advances exactly one tick; explicit reset pauses at zero', async () => {
    const data = await replay(); const d = doubles(); const session = createGallerySession({ load: async () => data, mount: d.mount });
    await session.select(selection(data.scenario.initialCameraId)); await session.command('step');
    expect(session.read().comparison?.frame).toMatchObject({ tick: 1, paused: true });
    await session.command('reset'); expect(session.read().comparison?.frame).toMatchObject({ tick: 0, paused: true });
    await session.command('play'); const held = deferred(); d.holdSubmission(held);
    const step = session.command('step'); const pause = session.command('pause'); expect(session.read().busy).toBe(true); held.resolve();
    await Promise.all([step, pause]); expect(session.read().comparison?.frame).toMatchObject({ tick: 1, paused: true }); await session.dispose();
  });
  it('UI41 coalesces latest async selection, disposes late hosts, never overlaps mounts', async () => {
    const data = await replay(); const d = doubles(); const held = deferred(); d.holds.set('C1', held);
    const session = createGallerySession({ load: async () => data, mount: d.mount }); const s = selection(data.scenario.initialCameraId);
    await session.select(s); await session.command('seek', 23);
    const first = session.select({ ...s, variant: 'C1' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const middle = session.select({ ...s, variant: 'C2' }); const latest = session.select(s); held.resolve();
    await Promise.all([first, middle, latest]);
    expect(d.events).not.toContain('mount:C2'); expect(d.events.at(-2)).toBe('dispose:C1');
    expect(session.read().selection?.variant).toBe('fixture-control'); expect(session.read().comparison?.frame.tick).toBe(23);
    expect(d.peak).toBe(1); await session.dispose(); expect(d.live).toBe(0);
  });
  it('UI40 restores Play only after matching mount readiness, ends at paused duration', async () => {
    const data = await replay(); const d = doubles(); const session = createGallerySession({ load: async () => data, mount: d.mount });
    const s = selection(data.scenario.initialCameraId); await session.select(s); await session.command('seek', 17); await session.command('play');
    const before = session.read().comparison; await session.select({ ...s, variant: 'C1' }); expect(session.read().comparison).toEqual(before);
    await session.command('pause'); await session.command('seek', data.scenario.durationTicks - 1); await session.command('play');
    await new Promise((resolve) => setTimeout(resolve, 75)); expect(session.read().comparison?.frame).toMatchObject({ tick: data.scenario.durationTicks, paused: true }); await session.dispose();
  });
  it('UI41 paused terminal errors retire owners, and failed-init cleanup permanently blocks another mount', async () => {
    const data = await replay(); const d = doubles(); const s = selection(data.scenario.initialCameraId);
    const session = createGallerySession({ load: async () => data, mount: d.mount }); await session.select(s);
    d.signalError(new Error('CONTROLLED context lost while paused')); await new Promise((resolve) => setTimeout(resolve, 5));
    expect(session.read().status).toBe('ERROR'); expect(d.live).toBe(0); await session.dispose();
    let mounts = 0;
    const failed = createGallerySession({ load: async () => data, mount: async () => { mounts++; throw new GalleryDisposalError('CONTROLLED failed-init retained owner'); } });
    await failed.select(s); await failed.select({ ...s, variant: 'C1' }); expect(failed.read().status).toBe('ERROR'); expect(mounts).toBe(1); await failed.dispose();
  });
  it('UI41 selection during failed-command disposal awaits the same retirement before mounting', async () => {
    const data = await replay(); const d = doubles(); const session = createGallerySession({ load: async () => data, mount: d.mount });
    const s = selection(data.scenario.initialCameraId); await session.select(s); const held = deferred(); d.holdDispose(held); d.failReplace();
    const failed = session.command('seek', data.scenario.snapshots[0]!.tick); await new Promise((resolve) => setTimeout(resolve, 5));
    expect(session.read().status).toBe('ERROR'); const latest = session.select({ ...s, variant: 'C1' });
    await new Promise((resolve) => setTimeout(resolve, 5)); expect(d.events).not.toContain('mount:C1'); held.resolve();
    await Promise.all([failed, latest]); expect(session.read().status).toBe('READY'); expect(d.peak).toBe(1); await session.dispose(); expect(d.live).toBe(0);
  });
  it('UI41 refuses failed disposal, replacement and unsupported C2 without fake success', async () => {
    const data = await replay(); const s = selection(data.scenario.initialCameraId);
    for (const failure of ['dispose', 'replace', 'C2'] as const) {
      const d = doubles(); const session = createGallerySession({ load: async () => data, mount: d.mount }); await session.select(s);
      if (failure === 'dispose') { d.failDispose(); await session.select({ ...s, variant: 'C1' }); expect(d.events).not.toContain('mount:C1'); }
      if (failure === 'replace') { d.failReplace(); await session.command('seek', data.scenario.snapshots[0]!.tick); }
      if (failure === 'C2') { d.failVariant('C2'); await session.select({ ...s, variant: 'C2' }); }
      expect(session.read().status).toBe('ERROR'); expect(session.read().comparison).toBeNull(); await session.dispose(); expect(d.live).toBe(0);
    }
  });
  it('UI41 20 mounts / 100 source-preset commands retain one owner and clear it', async () => {
    const data = await replay(); const d = doubles(); const session = createGallerySession({ load: async () => data, mount: d.mount });
    const s = selection(data.scenario.initialCameraId);
    for (let index = 0; index < 20; index++) {
      await session.select({ ...s, variant: index % 2 === 0 ? 'fixture-control' : 'C1' });
      for (let command = 0; command < 5; command++) { await session.command('seek', command % 2 === 0 ? data.scenario.durationTicks : 7); }
      expect(session.read().status).toBe('READY'); expect(d.live).toBe(1);
    }
    expect(d.peak).toBe(1); await session.dispose(); expect(d.live).toBe(0);
  });
  it('UI40 validates fixed camera in every frozen snapshot and keeps original/effective identities separate', async () => {
    const data = await replay(); const prepared = await deriveReplay(data, selection(data.scenario.initialCameraId));
    expect(prepared.originalDigest).toBe(data.scenarioDigest); expect(prepared.effective.initialCameraId).toBe(data.scenario.initialCameraId);
    expect(prepared.effective.keyframes.some((e) => e.type === 'SelectCamera')).toBe(false);
    await expect(deriveReplay(data, selection('not-a-frozen-camera'))).rejects.toThrow(/camera/);
    await expect(deriveReplay(await replay('F00-CONTROL-REPLAY'), { ...selection(data.scenario.initialCameraId, 'C1'), scenarioId: 'F00-CONTROL-REPLAY' })).rejects.toThrow(/F01.*F04.*F06/);
  });
  it('UI40 same-tick readiness rejects stale C0 submissions and mismatched RD11 generations/cameras/backend', async () => {
    const data = await replay(); const d = doubles(); const s = selection(data.scenario.initialCameraId);
    const host = await d.mount(s, data.initialFixture, new AbortController().signal); const sample = sampleScenario(data.scenario, 0, true);
    host.handle.setFrame(sample.frame); const valid = await host.waitFor(sample, 0, new AbortController().signal);
    expect(matchesSubmission(valid, sample, s, valid.submittedFrames)).toBe(false);
    expect(matchesSubmission({ ...valid, frame: { ...valid.frame, cameraId: 'old-camera' } }, sample, s, 0)).toBe(false);
    expect(matchesSubmission({ ...valid, resolution: { ...valid.resolution, width: 9 } }, sample, s, 0)).toBe(false);
    expect(matchesSubmission({ ...valid, resolution: { ...valid.resolution, bufferWidth: 9 } }, sample, s, 0)).toBe(false);
    const native = { ...valid, backend: { requested: 'webgpu', actual: 'webgpu', label: 'CONTROLLED' }, projectionGeneration: 4,
      rendered: { ...valid.rendered!, cameraId: s.cameraId, projectionGeneration: 3 } };
    expect(matchesSubmission(native, sample, { ...s, variant: 'C2' }, 0)).toBe(false);
    expect(matchesSubmission({ ...native, rendered: { ...native.rendered, projectionGeneration: 4 }, backend: { requested: 'webgpu', actual: 'webgl2', label: 'CONTROLLED' } }, sample, { ...s, variant: 'C2' }, 0)).toBe(false);
    expect(canonicalJson(sampleScenario(data.scenario, 0, true).frame)).toBe(canonicalJson(sample.frame)); await host.dispose();
  });
});

describe('RD40 UI43 CONTROLLED evidence byte bindings (not a native screenshot)', () => {
  async function bundle() {
    const data = await replay(); const d = doubles(); const s = { ...selection(data.scenario.initialCameraId), width: 1, height: 1 };
    const session = createGallerySession({ load: async () => data, mount: d.mount }); await session.select(s); await session.command('seek', 17);
    const state = session.read(); const source = await sourceBinding(); const prepared = await deriveReplay(data, s);
    const bytes = (value: unknown) => new TextEncoder().encode(canonicalJson(value));
    const image = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=', 'base64'));
    const imageHash = await sha256(image); const buildDigest = await sha256(new TextEncoder().encode('CONTROLLED-NOT-NATIVE-BUILD'));
    const missing = { status: 'not-run', unit: 'ms', reason: 'CONTROLLED CPU check; no native renderer' } as const;
    const run = createRunResult({ schema: 'hestia-rd-result-v1', runId: 'RD40-CONTROLLED', scenarioId: s.scenarioId,
      scenarioDigest: state.comparison!.effectiveScenarioDigest, variantId: s.variant, fixtureDigest: state.comparison!.fixtureDigest,
      sourceRefs: state.comparison!.sourceRefs, sourceDigest: source.sourceDigest, sourceBytesDigest: source.sourceBytesDigest, lockDigest: source.lockDigest, buildDigest,
      browser: { executable: 'C:/IFI_SourceCode/CONTROLLED/no-browser.exe', version: 'CONTROLLED-NOT-RUN' },
      device: { id: 'CONTROLLED', description: 'CPU ownership double; no GPU', driver: missing }, backend: 'CONTROLLED', runClass: 'image-motion', temperature: 'warm',
      samples: { planned: 1, observed: 1, failed: 0, skipped: 0, skippedReasons: [] }, rawDataPaths: [], errors: [],
      metrics: { cpuMs: missing, gpuMs: missing, frameMs: missing, uploadBytes: missing, cpuBytes: missing, gpuBytes: missing },
      media: [{ path: 'CONTROLLED/image.png', sha256: imageHash, kind: 'image' }], gates: [{ id: 'NATIVE-UI', status: 'NOT_RUN', reason: 'CONTROLLED CPU only' }], productIntegrated: false });
    const files: EvidenceFiles = { run: { name: 'run.json', bytes: bytes(run) }, image: { name: 'image.png', bytes: image },
      original: { name: 'original.json', bytes: bytes(prepared.scenario) }, effective: { name: 'effective.json', bytes: bytes(prepared.effective) },
      fixture: { name: 'fixture.json', bytes: bytes(prepared.fixtures.get(state.comparison!.fixtureDigest)) } };
    const receipts = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, file]) => [key, { path: `CONTROLLED/${file.name}`, sha256: await sha256(file.bytes) }])));
    const sidecar = { ...bindingTemplate(state, source), provenance: { sourceCommit: 'c531783536cc0fc617e928781633101b43cd2bfa', sourceTree: '49c4dccc756ff8916227db371296ff858de35f88', buildDigest }, files: receipts };
    await session.dispose(); return { state, source, files, sidecar, bytes };
  }
  it('UI43 exports a stable hash only with complete original/effective/fixture/run/image/source/profile/quality identities', async () => {
    const b = await bundle(); const first = await bindEvidence(b.state, b.source, b.bytes(b.sidecar), b.files);
    const second = await bindEvidence(b.state, b.source, b.bytes(b.sidecar), b.files);
    expect(first.cardHash).toBe(second.cardHash); expect(first.cardHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.card.files).toHaveLength(5); expect(first.card.run.schema).toBe('hestia-rd-result-v1');
    expect(canExportPair(b.state, b.source, { A: first.card, B: second.card }, { A: 'fixture-control', B: 'fixture-control' })).toBe(true);
    expect(canExportPair(b.state, b.source, { A: first.card }, { A: 'fixture-control', B: 'fixture-control' })).toBe(false);
    expect(canExportPair({ ...b.state, busy: true }, b.source, { A: first.card, B: second.card }, { A: 'fixture-control', B: 'fixture-control' })).toBe(false);
    expect(canExportPair({ ...b.state, submission: { ...b.state.submission!, quality: { requested: 'CONTROLLED', observed: 'changed same-tick quality' } } }, b.source,
      { A: first.card, B: second.card }, { A: 'fixture-control', B: 'fixture-control' })).toBe(false);
    expect(first.card.provenanceStatus).toBe('EXTERNAL_RECEIPT_GIT_AND_BUILD_VERIFICATION_REQUIRED');
    expect(b.source.sourceDigest).not.toBe(b.sidecar.provenance.sourceCommit);
    expect(b.source.files.some((file) => file.path === 'src/tools/variant-gallery/main.ts')).toBe(true);
    const evidenceRoot = process.env.RD40_CPU_EVIDENCE_ROOT;
    if (evidenceRoot) {
      expect(evidenceRoot).toMatch(/^C:[/\\]IFI_SourceCode[/\\]Temp[/\\]Hestia-RD-2026-10-02-runs[/\\]RD-40[/\\]c5317835-phase1-[a-z0-9-]+$/);
      for (const file of b.source.files) { expect(file.sha256).toBe(await sha256(new Uint8Array(await readFile(new URL(`../../${file.path}`, import.meta.url))))); }
      await writeFile(path.join(evidenceRoot, 'runtime-source-binding.json'), canonicalJson(b.source), { flag: 'wx' });
    }
  });
  it('UI43 rejects every missing/mismatched/pending binding, including same-tick source revision, reset and viewport', async () => {
    const b = await bundle();
    for (const status of ['PREPARING', 'ERROR', 'IDLE'] as const) {
      await expect(bindEvidence({ ...b.state, status }, b.source, b.bytes(b.sidecar), b.files)).rejects.toThrow(/READY/);
    }
    await expect(bindEvidence({ ...b.state, busy: true }, b.source, b.bytes(b.sidecar), b.files)).rejects.toThrow(/READY/);
    await expect(bindEvidence(b.state, b.source, b.bytes(bindingTemplate(b.state, b.source)), b.files)).rejects.toThrow(/sourceCommit/);
    const current = runtimeBinding(b.state, b.source);
    const mutations = [
      { ...current, source: { ...current.source, sourceBytesDigest: '0'.repeat(64) } },
      { ...current, comparison: { ...current.comparison, effectiveScenarioDigest: '0'.repeat(64) } },
      { ...current, comparison: { ...current.comparison, fixtureDigest: '0'.repeat(64) } },
      { ...current, comparison: { ...current.comparison, presentationProfile: 'not-current' } },
      { ...current, comparison: { ...current.comparison, frame: { ...current.comparison.frame, cameraId: 'wrong' } } },
      { ...current, comparison: { ...current.comparison, frame: { ...current.comparison.frame, sourceRevision: 900 } } },
      { ...current, comparison: { ...current.comparison, frame: { ...current.comparison.frame, weather: { ...current.comparison.frame.weather, rain01: 0.999 } } } },
      { ...current, comparison: { ...current.comparison, resetTick: 900 } },
      { ...current, comparison: { ...current.comparison, viewport: { ...current.comparison.viewport, width: 900 } } },
      { ...current, quality: { ...current.quality, observed: 'fake requested-quality success' } },
    ];
    for (const runtime of mutations) { await expect(bindEvidence(b.state, b.source, b.bytes({ ...b.sidecar, runtime }), b.files)).rejects.toThrow(/mismatch/); }
    for (const key of ['run', 'image', 'original', 'effective', 'fixture'] as const) {
      const corrupt = { ...b.files, [key]: { ...b.files[key], bytes: new Uint8Array([9]) } };
      await expect(bindEvidence(b.state, b.source, b.bytes(b.sidecar), corrupt)).rejects.toThrow(/hash mismatch/);
    }
    const wrongRun = { ...JSON.parse(new TextDecoder().decode(b.files.run.bytes)), scenarioDigest: '0'.repeat(64) };
    const runBytes = b.bytes(wrongRun); const sidecar = { ...b.sidecar, files: { ...b.sidecar.files, run: { path: 'CONTROLLED/run.json', sha256: await sha256(runBytes) } } };
    await expect(bindEvidence(b.state, b.source, b.bytes(sidecar), { ...b.files, run: { name: 'run.json', bytes: runBytes } })).rejects.toThrow(/Strict run/);
  });
  it('UI41 reference source inventory cannot masquerade as acquired images', async () => {
    const references = JSON.parse(await readFile(new URL('../../reference-cards/index.json', import.meta.url), 'utf8'));
    const concepts = JSON.parse(await readFile(new URL('../../reference-cards/concepts.json', import.meta.url), 'utf8'));
    expect(references.references).toHaveLength(7);
    expect(references.references.every((ref: { accessStatus: { media: string } }) => ref.accessStatus.media === 'NOT_VIEWED')).toBe(true);
    expect(concepts.assets.filter((asset: { availability: string }) => asset.availability === 'MISSING_AT_PIN')).toHaveLength(6);
    expect(concepts.assets.filter((asset: { availability: string }) => asset.availability === 'LFS_POINTER_ONLY')).toHaveLength(5);
    const html = await readFile(new URL('../../src/tools/variant-gallery/index.html', import.meta.url), 'utf8');
    expect(html).not.toMatch(/<iframe|<img|TestBridge/); expect(html).toContain('REN12');
  });
});
