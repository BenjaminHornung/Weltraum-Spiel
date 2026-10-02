import { afterAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { inspectBoundary, assertIsolation, assertPortFree } from '../../scripts/verify-boundary.mjs';
import { importFixture, copyFixturePayload, getFixtureDigest, fixtureRevision, readVoxel } from '../../src/contracts/fixture';
import { createRunResult, validateMetric } from '../../src/contracts/result';
import { createFrameInput, mountExperiment, registeredMountCount, type LabExperimentFactory } from '../../src/contracts/experiment';
import { createControlledClock, createScenario, getScenarioDigest, importScenario, sampleScenario } from '../../src/contracts/scenario';

const runRoot = 'C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-00';
const gitPath = 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/git/cmd/git.exe';
const labRelative = 'experiments/hestia-rd-2026-10-02';
mkdirSync(`${runRoot}/oracles`, { recursive: true });
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

function repo() {
  const root = mkdtempSync(`${runRoot}/oracles/boundary-`);
  const git = (...args: string[]) => execFileSync(gitPath,
    ['-c', 'user.name=RD00 oracle', '-c', 'user.email=rd00@invalid.local', ...args],
    { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-b', 'feature/rd00-oracle');
  writeFileSync(`${root}/README.md`, 'base\n');
  git('add', 'README.md');
  git('commit', '-m', 'oracle base');
  const base = git('rev-parse', 'HEAD');
  mkdirSync(`${root}/${labRelative}`, { recursive: true });
  return { root, git, base, options: { repoRoot: root, base, start: base, gitPath, verifyPinned: false } };
}

function manifest() {
  return { schema: 'hestia-rd-fixture-v1', id: 'F00-TEST', kind: 'synthetic',
    sourceRefs: [{ kind: 'synthetic', generatorPath: 'tests/RD-00/unit.test.ts',
      generatorCodeSha256: sha(readFileSync(new URL(import.meta.url))), generatorVersion: 'test-v1',
      seed: 1, testOnly: true, sourceDigest: sha(encode('seed=1')) }],
    sourceRevision: 0, units: 'meter', quantumMeters: 0.125,
    frame: { id: 'local', originMeters: [0, 0, 0], rotationXyzw: [0, 0, 0, 1], basis: 'right-handed-y-up' },
    materials: [], objects: [], payloads: [],
    cameras: [{ id: 'near', positionMeters: [0, 1, 2], targetMeters: [0, 0, 0], up: [0, 1, 0], verticalFovDegrees: 60 }] };
}

describe('RD-00 mandatory negative contracts', () => {
  it('BC00: committed, staged, unstaged and untracked outside-RD mutations are detected', async () => {
    const test = repo();
    writeFileSync(`${test.root}/README.md`, 'changed\n');
    writeFileSync(`${test.root}/outside.txt`, 'new\n');
    test.git('add', 'README.md', 'outside.txt');
    test.git('commit', '-m', 'oracle forbidden modifications');
    expect((await inspectBoundary(test.options)).ok).toBe(false);
    test.git('update-index', '--force-remove', 'README.md');
    test.git('commit', '-m', 'oracle committed deletion (original file retained)');
    const deleted = await inspectBoundary(test.options);
    expect(deleted.violations.join('\n')).toContain('README.md');
    writeFileSync(`${test.root}/untracked.txt`, 'not staged\n');
    writeFileSync(`${test.root}/outside.txt`, 'unstaged\n');
    test.git('add', 'untracked.txt');
    writeFileSync(`${test.root}/other.txt`, 'untracked\n');
    const result = await inspectBoundary(test.options);
    expect(result.violations.join('\n')).toMatch(/staged.*untracked.txt/);
    expect(result.violations.join('\n')).toMatch(/unstaged.*outside.txt/);
    expect(result.violations.join('\n')).toMatch(/untracked.*other.txt/);
    writeFileSync(`${test.root}/.git/info/exclude`, 'ignored.cache\n'); writeFileSync(`${test.root}/ignored.cache`, 'outside ignored file\n');
    expect(inspectBoundary(test.options).violations.join('\n')).toMatch(/untrackedIgnored.*ignored.cache/);
    const rename = repo(); const blob = rename.git('rev-parse', 'HEAD:README.md');
    rename.git('update-index', '--add', '--cacheinfo', `100644,${blob},${labRelative}/src/contracts/renamed.ts`);
    rename.git('update-index', '--force-remove', 'README.md'); rename.git('commit', '-m', 'oracle forbidden rename into lab');
    expect(inspectBoundary(rename.options).inventories.committed).toContain('README.md');
  });

  it('BC01: real junction escape, product origin/DB and occupied port are rejected', async () => {
    const test = repo();
    const outside = mkdtempSync(`${runRoot}/oracles/escape-`);
    symlinkSync(outside, `${test.root}/${labRelative}/escape`, 'junction');
    const result = await inspectBoundary(test.options);
    expect(result.ok).toBe(false);
    expect(result.violations.join('\n')).toMatch(/escape/);
    expect(() => assertIsolation({ origin: 'http://127.0.0.1:5173', databaseName: 'product-save' })).toThrow();
    expect(() => assertIsolation({ origin: 'http://127.0.0.1:5280', databaseName: 'product-save' })).toThrow();
    const server = createServer();
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(5280, '127.0.0.1', resolve); });
    try { await expect(assertPortFree(5280)).rejects.toThrow(); }
    finally { await new Promise<void>((resolve) => { server.close(() => { resolve(); }); }); }
  });

  it('C00: version, NaN, oversize and missing coverage never publish; unsupported is not zero', async () => {
    await expect(importFixture(encode({ ...manifest(), schema: 'v2' }))).rejects.toThrow();
    await expect(importFixture(encode({ ...manifest(), quantumMeters: NaN }))).rejects.toThrow();
    await expect(importFixture(new Uint8Array(1024 * 1024 + 1))).rejects.toThrow();
    const missingCoverage = { ...manifest(), voxelRegions: [{ id: 'r', ownerId: 'o',
      dimensions: [1, 1, 1], occupancyPayload: 'occupancy' }] };
    await expect(importFixture(encode(missingCoverage))).rejects.toThrow();
    const huge = { ...manifest(), payloads: [{ id: 'huge', path: 'huge.bin', elementType: 'uint8',
      byteOrder: 'little', length: 128 * 1024 * 1024 + 1, byteLength: 128 * 1024 * 1024 + 1, sha256: 'a'.repeat(64) }] };
    let payloadReads = 0;
    const payloads = new Map<string, Uint8Array>();
    payloads.get = () => { payloadReads += 1; throw new Error('must not read payload before budget'); };
    await expect(importFixture(encode(huge), payloads)).rejects.toThrow(/128 MiB/);
    expect(payloadReads).toBe(0);
    expect(() => validateMetric({ status: 'unsupported', value: 0, unit: 'byte', reason: 'unavailable' })).toThrow();
    expect(validateMetric({ status: 'unsupported', unit: 'byte', reason: 'unavailable' })).not.toHaveProperty('value');
  });

  it('C01: double mount, pre-init abort and repeated dispose leave no registered resources', async () => {
    const fixture = await importFixture(encode(manifest()));
    const canvas = {} as HTMLCanvasElement;
    const signal = new AbortController();
    const context = { canvas, fixture, preset: { id: 'test' }, signal: signal.signal, capabilities: {} };
    let live = 0;
    const factory: LabExperimentFactory = async () => { live += 1; return { setFrame() {}, async replaceFixture() {},
      readFacts() { return { experimentId: 'RD-00', variantId: 'test', backend: 'unit-no-renderer',
        fixtureDigest: getFixtureDigest(fixture), sourceRevision: 0, liveResources: {}, logicalCosts: {}, unsupportedFeatures: [], errors: [] }; },
      async dispose() { live -= 1; } }; };
    const handle = await mountExperiment(factory, context);
    try { await expect(mountExperiment(factory, context)).rejects.toThrow(/mount/); }
    finally { await handle.dispose(); await handle.dispose(); }
    expect(live).toBe(0);
    expect(registeredMountCount()).toBe(0);
    signal.abort();
    await expect(mountExperiment(factory, context)).rejects.toThrow(/abort/i);
    expect(live).toBe(0);
  });
});

describe('RD-00 frozen contracts and focused positive controls', () => {
  it('BC00/BC01 precise authorized untracked logs: third, staged, committed and junction-named logs fail', () => {
    const test = repo(); mkdirSync(`${test.root}/.opencode`);
    writeFileSync(`${test.root}/.opencode/throughput.jsonl`, 'synthetic automatic-log oracle\n');
    writeFileSync(`${test.root}/.opencode/throughput.md`, 'synthetic automatic-log oracle\n');
    const accepted = inspectBoundary(test.options);
    expect(accepted.ok).toBe(true); expect(accepted.platformArtifacts).toEqual(['.opencode/throughput.jsonl', '.opencode/throughput.md']);
    expect(accepted.originalAllFilesGate).toBe('FAIL_ACCEPTED_NARROW_EXCEPTION');
    writeFileSync(`${test.root}/.opencode/third.md`, 'must reject\n');
    expect(inspectBoundary(test.options).violations.join('\n')).toMatch(/untracked.*third.md/);
    test.git('add', '.opencode/throughput.jsonl');
    expect(inspectBoundary(test.options).violations.join('\n')).toMatch(/staged.*throughput.jsonl/);
    test.git('commit', '-m', 'oracle forbidden throughput log commit');
    expect(inspectBoundary(test.options).violations.join('\n')).toMatch(/committed.*throughput.jsonl/);
    const links = repo(); mkdirSync(`${links.root}/.opencode`);
    const outside = mkdtempSync(`${runRoot}/oracles/escape-log-`);
    for (const name of ['throughput.jsonl', 'throughput.md']) { symlinkSync(outside, `${links.root}/.opencode/${name}`, 'junction'); }
    const invalid = inspectBoundary(links.options); expect(invalid.ok).toBe(false);
    expect(invalid.violations.join('\n')).toMatch(/symlink\/junction\/escape.*throughput.jsonl/);
    expect(invalid.violations.join('\n')).toMatch(/symlink\/junction\/escape.*throughput.md/);
    const broken = repo(); mkdirSync(`${broken.root}/.opencode`);
    symlinkSync(`${runRoot}/oracles/missing-link-target`, `${broken.root}/.opencode/throughput.jsonl`, 'junction');
    expect(inspectBoundary(broken.options).violations.join('\n')).toMatch(/symlink\/junction\/escape.*throughput.jsonl/);
  });
  it('private import and export copies, SHA-256, typed big-endian and stable manifest digest', async () => {
    const bytes = new Uint8Array(8); const view = new DataView(bytes.buffer);
    view.setFloat32(0, 1.25, false); view.setFloat32(4, -2.5, false);
    const value = { ...manifest(), payloads: [{ id: 'numbers', path: 'numbers.bin', elementType: 'float32',
      byteOrder: 'big', length: 2, byteLength: 8, sha256: sha(bytes) }] };
    const original = bytes.slice(); const importing = importFixture(encode(value), new Map([['numbers', bytes]]));
    bytes.fill(0); const fixture = await importing;
    expect(copyFixturePayload(fixture, 'numbers')).toEqual(new Float32Array([1.25, -2.5]));
    const exported = copyFixturePayload(fixture, 'numbers'); exported[0] = 99;
    expect(copyFixturePayload(fixture, 'numbers')[0]).toBe(1.25);
    expect(Object.isFrozen(fixture.frame.originMeters)).toBe(true);
    const second = await importFixture(encode({ ...value, id: value.id }), new Map([['numbers', original]]));
    expect(getFixtureDigest(fixture)).toBe(getFixtureDigest(second));
    await expect(importFixture(encode(value), new Map([['numbers', bytes]]))).rejects.toThrow(/SHA-256/);
    const invalid = original.slice(); new DataView(invalid.buffer).setFloat32(0, NaN, false);
    await expect(importFixture(encode({ ...value, payloads: [{ ...value.payloads[0], sha256: sha(invalid) }] }),
      new Map([['numbers', invalid]]))).rejects.toThrow(/finite/);
    await expect(importFixture(encode(manifest()), new Map([['extraneous', original]]))).rejects.toThrow(/payload/);
    expect(() => getFixtureDigest(manifest() as never)).toThrow(/import/);
  });

  it('knownCoverage is independent: occupied, known air, unknown and unsupported are distinct', async () => {
    const occupancy = new Uint8Array([0, 1, 0]); const coverage = new Uint8Array([1, 1, 0]);
    const value = { ...manifest(), sourceRevision: 1, objects: [{ ownerId: 'owner', sourceRevision: 1, sourceNamespace: 'test-cell', sourceIds: ['cell:1'],
      frame: manifest().frame, materialRoles: [], meshes: [], bounds: { min: [0, 0, 0], max: [0, 0, 0] } }],
      voxelRegions: [{ id: 'region', ownerId: 'owner', originMeters: [0, 0, 0], dimensions: [3, 1, 1],
        occupancyPayload: 'occupancy', knownCoveragePayload: 'coverage' }],
      payloads: [['occupancy', occupancy], ['coverage', coverage]].map(([name, data]) => ({ id: name, path: `${name}.bin`,
        elementType: 'uint8', byteOrder: 'little', length: 3, byteLength: 3, sha256: sha(data as Uint8Array) })) };
    const inputs = new Map([['occupancy', occupancy], ['coverage', coverage]]);
    const fixture = await importFixture(encode(value), inputs);
    expect([0, 1, 2, 3].map((x) => readVoxel(fixture, 'region', x, 0, 0))).toEqual(['air', 'occupied', 'unknown', 'unknown']);
    await expect(importFixture(encode({ ...value, voxelRegions: [{ ...value.voxelRegions[0], knownCoveragePayload: 'occupancy' }] }), inputs)).rejects.toThrow(/separate/);
    await expect(importFixture(encode({ ...value, voxelRegions: [{ ...value.voxelRegions[0], knownCoveragePayload: 'missing' }] }), inputs)).rejects.toThrow(/knownCoverage/);
    await expect(importFixture(encode({ ...value, attachments: [{ id: 'attachment', ownerId: 'owner', sourceIds: ['invented'], supportOwnerId: 'owner', supportIds: ['cell:1'] }] }), inputs)).rejects.toThrow(/source/);
    expect(() => validateMetric({ status: 'not-run', value: null, unit: 'ms', reason: 'no lease' })).toThrow();
    expect(() => validateMetric({ status: 'measured', value: NaN, unit: 'ms' })).toThrow();
    expect(() => validateMetric({ status: 'estimated', value: 32, unit: 'byte' })).toThrow();
  });

  it('aggregate advertised budget and unpinned/unknown provenance reject before payload access', async () => {
    const value = { ...manifest(), payloads: [1, 2].map((number) => ({ id: `p${number}`, path: `p${number}.bin`,
      elementType: 'uint8', byteOrder: 'little', length: 70 * 1024 * 1024, byteLength: 70 * 1024 * 1024, sha256: 'a'.repeat(64) })) };
    let reads = 0; const inputs = new Map<string, Uint8Array>();
    inputs.get = () => { reads += 1; throw new Error('unexpected allocation'); };
    await expect(importFixture(encode(value), inputs)).rejects.toThrow(/128 MiB/); expect(reads).toBe(0);
    await expect(importFixture(encode({ ...manifest(), kind: 'product-derived' }))).rejects.toThrow(/test-only/);
    await expect(importFixture(encode({ ...manifest(), dynamicCode: 'not allowed' }))).rejects.toThrow(/Unknown/);
    expect(() => assertIsolation({ origin: 'http://127.0.0.1:5280', runRoot: `${runRoot}/../RD-01` })).toThrow();
    expect(() => assertIsolation()).not.toThrow();
  });

  it('product binding shape: semantic digest, bound presentation, normals/colors and cross-owner support namespaces', async () => {
    // Validator control only: these test geometry bytes are NOT a genuine product-derived F01 export.
    const data = new Map<string, Uint8Array>([
      ['positions', new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer)],
      ['normals', new Uint8Array(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]).buffer)],
      ['colors', new Uint8Array(new Float32Array([0.25, 0.5, 1, 0.25, 0.5, 1, 0.25, 0.5, 1]).buffer)],
      ['indices', new Uint8Array(new Uint16Array([0, 1, 2]).buffer)],
    ]);
    const lookPath = 'apps/weltraum-browser/src/hestia-prototype/presentation/look.ts';
    const object = { ownerId: 'plant', sourceRevision: 9, sourceNamespace: 'authored-wood-cell', sourceIds: ['cell:1'], frame: manifest().frame,
      materialRoles: ['test'], meshes: [{ positions: 'positions', normals: 'normals', colors: 'colors', colorSpace: 'linear-srgb',
        indices: 'indices', materialId: 'test', presentationOnly: true }], bounds: { min: [0, 0, 0], max: [1, 1, 0] } };
    const value = { ...manifest(), kind: 'product-derived', sourceRevision: 2,
      sourceRefs: [{ kind: 'product', repository: 'BenjaminHornung/Weltraum-Spiel', commit: 'b3c6523a94cd050f5a9a22dc27f4777fcc03363e',
        files: [{ path: lookPath, sha256: '1c058c73d4313b6da757b341f6dad66173d73332d169d7dbe04710b96c0219ea', blobSha: 'd4cd91baca674a027416e9cd8eab97532803080d' }],
        generatorVersion: 'unit-validator-shape-only', sourceDigest: 'deadbeef' }],
      materials: [{ id: 'test', role: 'test', colorLinearRgb: [1, 1, 1], opacity: 1, depthWrite: true, doubleSided: true }],
      objects: [object, { ...object, ownerId: 'terrain', sourceNamespace: 'coast-cell', sourceIds: ['terrain-cell:1'], meshes: [], bounds: { min: [0, 0, 0], max: [0, 0, 0] } }],
      payloads: [...data].map(([name, bytes]) => ({ id: name, path: `${name}.bin`, elementType: name === 'indices' ? 'uint16' : 'float32',
        byteOrder: 'little', length: bytes.length / (name === 'indices' ? 2 : 4), byteLength: bytes.length, sha256: sha(bytes) })),
      attachments: [{ id: 'reeds', ownerId: 'plant', sourceIds: ['cell:1'], supportOwnerId: 'terrain', supportIds: ['terrain-cell:1'] }],
      presentation: { id: 'unit-shape-only', sourcePaths: [lookPath], materialColorSpace: 'linear-srgb', outputColorSpace: 'srgb', toneMapping: 'aces-filmic', exposure: 1.05,
        lighting: { ambient: { colorSrgb24: 0xbfd9e8, groundColorSrgb24: 0x8c9376, intensity: 0.85, positionMeters: [0, 1, 0] },
          key: { colorSrgb24: 0xffe2b0, intensity: 2.3, positionMeters: [-28, 42, -18] },
          fill: { colorSrgb24: 0x6fa8d8, intensity: 0.9, positionMeters: [30, 18, 26] } },
        background: { colorSrgb24: 0x87b5d9, fogNearMeters: 48, fogFarMeters: 170 } } };
    const fixture = await importFixture(encode(value), data);
    expect(fixture.sourceRefs[0].sourceDigest).toBe('deadbeef'); expect(fixtureRevision(fixture)).toBe(2);
    expect(copyFixturePayload(fixture, 'colors')[0]).toBe(0.25);
    await expect(importFixture(encode({ ...value, presentation: undefined }), data)).rejects.toThrow(/bound presentation/);
    await expect(importFixture(encode({ ...value, presentation: { ...value.presentation, sourcePaths: ['invented.ts'] } }), data)).rejects.toThrow(/Unbound/);
    await expect(importFixture(encode({ ...value, attachments: [{ ...value.attachments[0], supportOwnerId: 'plant' }] }), data)).rejects.toThrow(/namespace/);
    await expect(importFixture(encode({ ...value, objects: [{ ...object, bounds: { min: [0, 0, 0], max: [2, 1, 0] } }, value.objects[1]] }), data)).rejects.toThrow(/actual geometry/);
    await expect(importFixture(encode({ ...value, objects: [{ ...object, meshes: [{ ...object.meshes[0], colorSpace: undefined }] }, value.objects[1]] }), data)).rejects.toThrow(/color/);
  });

  it('replacement and backward seek use exact snapshot revisions; stale late facts/frames cannot publish', async () => {
    const initial = await importFixture(encode(manifest()));
    const next = await importFixture(encode({ ...manifest(), id: 'next', sourceRevision: 3 }));
    let current = initial; let stale = false; let frames = 0;
    const handle = await mountExperiment(async () => ({ setFrame() { frames += 1; }, async replaceFixture(value) { current = value; },
      readFacts() { const source = stale ? initial : current; return { experimentId: 'RD-00', variantId: 'unit', backend: 'no-renderer',
        fixtureDigest: getFixtureDigest(source), sourceRevision: source.sourceRevision, liveResources: {}, logicalCosts: {}, unsupportedFeatures: [], errors: [] }; },
      async dispose() {} }), { canvas: {} as HTMLCanvasElement, fixture: initial, signal: new AbortController().signal, preset: { id: 'unit' }, capabilities: {} });
    const input = { tick: 0, seconds: 0, paused: true, cameraId: 'near', sourceRevision: 0,
      weather: { windMps: [0, 0, 0], rain01: 0, snow01: 0, cloud01: 0 } };
    try {
      await handle.replaceFixture(next); expect(handle.readFacts().sourceRevision).toBe(3);
      expect(() => handle.setFrame(input as never)).toThrow(/Stale/); expect(frames).toBe(0);
      stale = true; expect(() => handle.readFacts()).toThrow(/current fixture/); stale = false;
      await handle.replaceFixture(initial); handle.setFrame(input as never); expect(frames).toBe(1);
      expect(handle.readFacts().sourceRevision).toBe(0);
    } finally { await handle.dispose(); }
  });

  it('controlled pause/seek/reset and full source replacement reconstruct the same deterministic frame', async () => {
    const first = await importFixture(encode(manifest()));
    const next = await importFixture(encode({ ...manifest(), id: 'NEXT', sourceRevision: 2, objects: [{ ownerId: 'o', sourceRevision: 2,
      sourceNamespace: 'test-cell', sourceIds: [], frame: manifest().frame, materialRoles: [], meshes: [], bounds: { min: [0, 0, 0], max: [0, 0, 0] } }] }));
    const value = { schema: 'hestia-rd-scenario-v1', id: 'test', fixtureDigest: getFixtureDigest(first), ticksPerSecond: 60,
      durationTicks: 120, mode: 'presentation-replay', initialCameraId: 'near', initialWeatherPresetId: 'calm',
      weatherPresets: { calm: { windMps: [0, 0, 0], rain01: 0, snow01: 0, cloud01: 0 },
        wet: { windMps: [2, 0, -1], rain01: 0.8, snow01: 0, cloud01: 1 } },
      keyframes: [{ tick: 10, type: 'SetWeatherPreset', presetId: 'wet' }, { tick: 20, type: 'ResetLab' }],
      snapshots: [{ tick: 5, type: 'ReplaceSnapshot', fixtureDigest: getFixtureDigest(next), manifest: next }] };
    const scenario = createScenario(value, first); const clock = createControlledClock(120);
    clock.advance(15); clock.pause(true); expect(clock.advance(45)).toEqual({ tick: 15, seconds: 0.25, paused: true });
    const observed = sampleScenario(scenario, clock.read().tick, true);
    expect(observed.fixture).toBe(next); expect(observed.frame.sourceRevision).toBe(2); expect(observed.frame.weather.rain01).toBe(0.8);
    clock.seek(0); expect(sampleScenario(scenario, 0, true).fixture).toBe(first);
    clock.seek(15); expect(sampleScenario(scenario, 15, true)).toEqual(observed);
    expect(sampleScenario(scenario, 25, false).resetTick).toBe(20);
    expect(clock.reset()).toEqual({ tick: 0, seconds: 0, paused: false });
    const reimport = importScenario(encode(scenario), new Map([[getFixtureDigest(first), first], [getFixtureDigest(next), next]]));
    expect(await getScenarioDigest(reimport)).toBe(await getScenarioDigest(scenario));
    expect(() => createScenario({ ...value, snapshots: [{ ...value.snapshots[0], manifest: { ...next } }] }, first)).toThrow(/import/);
    expect(() => createScenario({ ...value, keyframes: [{ tick: 3, type: 'NativeCut' }] }, first)).toThrow(/forbidden/);
    expect(() => createFrameInput({ ...observed.frame, seconds: 99 })).toThrow(/controlled/);
    expect(() => createFrameInput({ ...observed.frame, weather: { ...observed.frame.weather, rain01: 2 } })).toThrow();
  });

  it('abort during async init and dispose during replacement are owned; failures release the mount slot', async () => {
    const fixture = await importFixture(encode(manifest())); const next = await importFixture(encode({ ...manifest(), id: 'next' }));
    const canvas = {} as HTMLCanvasElement; const controller = new AbortController();
    const context = { canvas, fixture, preset: { id: 'test' }, signal: controller.signal, capabilities: {} };
    let releaseInit!: () => void; let entered!: () => void; let live = 0;
    const enteredPromise = new Promise<void>((resolve) => { entered = resolve; });
    const initGate = new Promise<void>((resolve) => { releaseInit = resolve; });
    const factory: LabExperimentFactory = async () => {
      entered(); await initGate; live += 1;
      return { setFrame() {}, async replaceFixture() {}, readFacts() { throw new Error('unused'); }, async dispose() { live -= 1; } };
    };
    const pending = mountExperiment(factory, context); await enteredPromise; controller.abort(); releaseInit();
    await expect(pending).rejects.toThrow(/aborted/); expect(live).toBe(0); expect(registeredMountCount()).toBe(0);
    const secondContext = { ...context, signal: new AbortController().signal };
    await expect(mountExperiment(async () => { throw new Error('init failure'); }, secondContext)).rejects.toThrow(/init failure/);
    expect(registeredMountCount()).toBe(0);
    let current = fixture; let releaseReplace!: () => void;
    const replaceGate = new Promise<void>((resolve) => { releaseReplace = resolve; });
    const mounted = await mountExperiment(async () => {
      live += 1; return { setFrame() {}, async replaceFixture(replacement) { await replaceGate; current = replacement; },
        readFacts() { return { experimentId: 'RD-00', variantId: 'test', backend: 'unit-no-renderer', fixtureDigest: getFixtureDigest(current),
          sourceRevision: fixtureRevision(current), liveResources: {}, logicalCosts: {}, unsupportedFeatures: [], errors: [] }; },
        async dispose() { live -= 1; } };
    }, secondContext);
    const replacing = mounted.replaceFixture(next); const rejected = expect(replacing).rejects.toThrow(/aborted/);
    const disposing = mounted.dispose(); releaseReplace(); await rejected; await disposing; await mounted.dispose();
    expect(live).toBe(0); expect(registeredMountCount()).toBe(0); expect(() => mounted.setFrame({} as never)).toThrow(/disposed/);
  });

  it('results bind evidence without dropping failed/skipped denominator or inventing unavailable numbers', () => {
    const notRun = { status: 'not-run', unit: 'ms', reason: 'No GPU benchmark slot; diagnostic only' };
    const result = { schema: 'hestia-rd-result-v1', runId: 'rd00-diagnostic', scenarioId: 'control', variantId: 'control',
      scenarioDigest: 'a'.repeat(64), fixtureDigest: 'b'.repeat(64), sourceRefs: manifest().sourceRefs,
      buildDigest: 'c'.repeat(64), lockDigest: 'd'.repeat(64), sourceDigest: 'deadbeef', sourceBytesDigest: 'e'.repeat(64),
      browser: { executable: 'C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe', version: 'test-only' },
      device: { id: 'unavailable', description: 'No qualified device evidence', driver: { status: 'unsupported', unit: 'version', reason: 'No native adapter evidence' } },
      backend: 'unit-test', runClass: 'diagnostic', temperature: 'document-cold',
      samples: { planned: 3, observed: 2, skipped: 1, failed: 1, skippedReasons: ['test skipped'] },
      rawDataPaths: ['logs/test.log'], errors: ['test failed sample'],
      metrics: { cpuMs: notRun, gpuMs: notRun, frameMs: notRun,
        uploadBytes: { ...notRun, unit: 'byte' }, cpuBytes: { ...notRun, unit: 'byte' }, gpuBytes: { ...notRun, unit: 'byte' } },
      media: [], gates: [{ id: 'qualification', status: 'NOT_RUN', reason: 'diagnostic only' }], productIntegrated: false };
    const frozen = createRunResult(result); expect(frozen.samples.planned).toBe(3); expect(Object.isFrozen(frozen.metrics)).toBe(true);
    expect(() => createRunResult({ ...result, samples: { ...result.samples, planned: 2 } })).toThrow(/denominator/);
    expect(() => createRunResult({ ...result, metrics: { ...result.metrics, gpuMs: { status: 'unsupported', unit: 'ms', reason: 'no GPU', value: 0 } } })).toThrow();
  });
});

afterAll(() => { expect(registeredMountCount()).toBe(0); });
