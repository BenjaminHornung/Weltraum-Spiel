import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Group, Mesh, MeshLambertMaterial, Scene, PerspectiveCamera } from 'three';
import { importFixture, copyFixturePayload, fixtureRevision, getFixtureDigest, readVoxel } from '../../src/contracts/fixture';
import { createFrameInput, mountExperiment, registeredMountCount } from '../../src/contracts/experiment';
import { sampleScenario } from '../../src/contracts/scenario';
import { loadInventory, loadReplay, readBoundedResponse, PINNED_INVENTORY_SHA256 } from '../../src/runner/assets';
import { createScenarioRunner } from '../../src/runner/scenarioRunner';
import { createThreeControlExperiment, mountThreeEffect, projectFloat32 } from '../../src/experiments/three-control/index';
import { createThreeLabHost, ownerPose, type ThreeLabEffectContext } from '../../src/runner/threeHost';
import { parseRunArgs, sampleDenominator } from '../../scripts/run-lab.mjs';

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const root = new URL('../../fixtures/', import.meta.url);
const publicRoot = new URL('http://127.0.0.1:5280/');
const localFetch: typeof fetch = async (input) => {
  const url = new URL(String(input));
  return new Response(readFileSync(new URL(url.pathname.slice(1), root)));
};
const replay = async (id = 'F04-DETACH-REPLAY') => loadReplay(await loadInventory(publicRoot, localFetch), id, publicRoot, localFetch);
const frameAt = (fixture: Awaited<ReturnType<typeof importFixture>>, tick = 0) => createFrameInput({ tick, seconds: tick / 60,
  sourceRevision: fixtureRevision(fixture), cameraId: fixture.cameras[0].id, paused: true,
  weather: { windMps: [0, 0, 0], rain01: 0, snow01: 0, cloud01: 0 } });

it('RUN01 controlled ticks yield same CPU facts at 30/60/144; pause/seek emits no extra events', async () => {
  const data = await replay();
  const states = [];
  for (const rate of [30, 60, 144]) {
    let current = data.initialFixture; let frame = frameAt(current); let resetTick: number | null = null;
    const adoptions: string[] = [];
    const runner = createScenarioRunner(data.scenario, {
      async replaceFixture(next) { current = next; adoptions.push(getFixtureDigest(next)); },
      setFrame(next) { expect(next.sourceRevision).toBe(fixtureRevision(current)); frame = next; },
    }, (tick) => { resetTick = tick; });
    await runner.seek(1800);
    for (let update = 0; update < rate; update += 1) { await runner.render(); }
    await runner.pause(true); await runner.advance(60);
    expect(runner.read().tick).toBe(1800);
    await runner.seek(0); await runner.seek(1800);
    const effect = await mountThreeEffect(effectContext(current), { id: 'fixture-control' }); effect.setFrame(frame);
    states.push({ frame, resetTick, digest: getFixtureDigest(current), adoptions, cpuFacts: effect.readFacts() }); await effect.dispose();
  }
  expect(states[0]).toEqual(states[1]); expect(states[1]).toEqual(states[2]);
});

it('RUN02 throw/abort/late replace preserves old complete projection or visible error', async () => {
  const data = await replay(); const next = data.scenario.snapshots[0].manifest;
  const context = effectContext(data.initialFixture); const effect = await mountThreeEffect(context, { id: 'fixture-control' });
  const old = context.root.children[0];
  const copy = vi.spyOn(await import('../../src/contracts/fixture'), 'copyFixturePayload').mockImplementationOnce(() => { throw new Error('build-failure'); });
  await expect(effect.replaceFixture(next)).rejects.toThrow('build-failure'); copy.mockRestore();
  expect(context.root.children[0]).toBe(old); expect(effect.readFacts().fixtureDigest).toBe(getFixtureDigest(data.initialFixture));
  const pending = effect.replaceFixture(next); context.abort.abort();
  await expect(pending).rejects.toThrow(/abort/i); expect(context.root.children[0]).toBe(old);
  await effect.dispose(); await effect.dispose(); expect(context.root.children).toHaveLength(0);
});

it('RUN03 CPU projection binds exact source hashes, groups, linear colors and Float64 marker tolerance (real backend/image pending browser)', async () => {
  const data = await replay('F05-CUTOUT-REPLAY'); const fixture = data.initialFixture;
  const marker = fixture.objects.find((object) => object.ownerId === 'figure-marker')!;
  const canonical = copyFixturePayload(fixture, marker.meshes[0].positions);
  expect(canonical).toBeInstanceOf(Float64Array); expect(Math.max(...canonical)).toBe(1.8);
  const gpu = projectFloat32(canonical); expect(gpu).toBeInstanceOf(Float32Array);
  expect(Math.abs(Math.max(...gpu) - 1.8)).toBeLessThanOrEqual(1e-5);
  gpu[0] = 999; expect(copyFixturePayload(fixture, marker.meshes[0].positions)).toEqual(canonical);
  const context = effectContext(fixture); const effect = await mountThreeEffect(context, { id: 'fixture-control' });
  const meshes: Mesh[] = []; context.root.traverse((object) => { if (object instanceof Mesh) { meshes.push(object); } });
  expect(meshes.reduce((sum, mesh) => sum + mesh.geometry.groups.length, 0)).toBe(fixture.objects.reduce((sum, object) => sum + object.meshes.length, 0));
  const material = materialOf(meshes[0]);
  const declared = fixture.materials.find((entry) => entry.id === fixture.objects[0].meshes[0].materialId)!;
  expect(material.color.toArray()).toEqual(declared.colorLinearRgb);
  expect(effect.readFacts().fixtureDigest).toBe(getFixtureDigest(fixture)); await effect.dispose();
});

it('RUN04 20 CPU effect mount/dispose cycles release geometry/material roots (real renderer/listeners pending browser)', async () => {
  const { initialFixture: fixture } = await replay('F00-CONTROL-REPLAY');
  for (let cycle = 0; cycle < 20; cycle += 1) {
    const context = effectContext(fixture); const effect = await mountThreeEffect(context, { id: 'fixture-control' });
    const disposed: string[] = [];
    context.root.traverse((object) => { if (object instanceof Mesh) {
      object.geometry.addEventListener('dispose', () => { disposed.push('geometry'); });
      materialOf(object).addEventListener('dispose', () => { disposed.push('material'); });
    } });
    await effect.dispose(); await effect.dispose();
    expect(context.root.children).toHaveLength(0); expect(disposed.filter((name) => name === 'geometry')).toHaveLength(6);
    expect(disposed.filter((name) => name === 'material')).toHaveLength(6);
  }
  expect(registeredMountCount()).toBe(0);
});

it('resetTick reconstructs on backward seek; owner rotation and namespace stay snapshot-owned', async () => {
  const data = await replay(); const resets: (number | null)[] = []; let adopted = data.initialFixture; let rebuilds = 0;
  const runner = createScenarioRunner(data.scenario, { async replaceFixture(next) { adopted = next; rebuilds += 1; }, setFrame() {} }, (tick) => { resets.push(tick); });
  await runner.seek(1559); const beforeReset = rebuilds; const beforeDigest = getFixtureDigest(adopted);
  await runner.seek(1560); expect(rebuilds).toBe(beforeReset + 1); expect(getFixtureDigest(adopted)).toBe(beforeDigest);
  await runner.seek(data.scenario.durationTicks); const end = sampleScenario(data.scenario, data.scenario.durationTicks, false);
  expect(resets.at(-1)).toBe(end.resetTick);
  await runner.seek(0); expect(resets.at(-1)).toBe(null); expect(adopted).toBe(data.initialFixture);
  for (const event of data.scenario.snapshots) {
    const object = event.manifest.objects[0]; const pose = ownerPose(event.manifest, object.ownerId)!;
    expect(pose.sourceRevision).toBe(object.sourceRevision); expect(pose.sourceNamespace).toBe(object.sourceNamespace);
    expect(pose.rotationXyzw).toEqual(object.frame.rotationXyzw);
    const context = effectContext(event.manifest); const effect = await mountThreeEffect(context, { id: 'fixture-control' });
    const projection = context.root.children[0];
    expect(projection.children.map((owner) => owner.name)).toEqual(event.manifest.objects.map((owner) => owner.ownerId));
    for (const source of event.manifest.objects) {
      const owner = projection.children.find((entry) => entry.name === source.ownerId)!;
      expect(owner.position.toArray()).toEqual(source.frame.originMeters); expect(owner.quaternion.toArray()).toEqual(source.frame.rotationXyzw);
      expect(owner.userData).toEqual({ ownerId: source.ownerId, sourceNamespace: source.sourceNamespace, sourceRevision: source.sourceRevision });
    }
    await effect.dispose();
  }
  expect(ownerPose(data.initialFixture, 'no-such-owner')).toBeUndefined();
});

it('pinned inventory resolves root URLs, all 16 snapshots/eight scenarios; F01 unknown outside and preserved AO', async () => {
  const inventory = await loadInventory(publicRoot, localFetch);
  expect(inventory.fixtures).toHaveLength(16); expect(inventory.scenarios).toHaveLength(8);
  expect(sha(readFileSync(new URL('inventory.json', root)))).toBe(PINNED_INVENTORY_SHA256);
  const { initialFixture: fixture } = await replay('F01-HVP-COAST-REPLAY');
  expect(fixture.kind).toBe('product-derived'); expect(fixture.quantumMeters).toBe(0.125);
  expect(readVoxel(fixture, fixture.voxelRegions![0].id, -1, 0, 0)).toBe('unknown');
  const context = effectContext(fixture); const effect = await mountThreeEffect(context, { id: 'fixture-control' });
  const water: Mesh[] = []; const colored: Mesh[] = [];
  context.root.traverse((object) => { if (object instanceof Mesh) {
    if (materialOf(object).transparent) { water.push(object); }
    if (object.geometry.getAttribute('color')) { colored.push(object); }
  } });
  expect(water[0].renderOrder).toBe(1); expect(materialOf(water[0]).depthWrite).toBe(false);
  expect(colored.length).toBeGreaterThan(0); expect(materialOf(colored[0]).vertexColors).toBe(true);
  const sourceColors = fixture.objects.flatMap((object) => object.meshes).find((mesh) => mesh.colors)!.colors!;
  expect(colored[0].geometry.getAttribute('color').array).toEqual(copyFixturePayload(fixture, sourceColors));
  expect(effect.readFacts().unsupportedFeatures).toContain('native-water-shader-parity'); await effect.dispose();
});

it('all eight scenarios import every pinned snapshot and create disposable Three projections', async () => {
  const inventory = await loadInventory(publicRoot, localFetch); const seen = new Set<string>();
  for (const entry of inventory.scenarios) {
    const data = await loadReplay(inventory, entry.id, publicRoot, localFetch);
    for (const fixture of data.fixtures.values()) {
      seen.add(getFixtureDigest(fixture)); const effect = await mountThreeEffect(effectContext(fixture), { id: 'fixture-control' });
      expect(effect.readFacts().sourceRevision).toBe(fixtureRevision(fixture)); await effect.dispose();
    }
  }
  expect(seen.size).toBe(16);
});

it('CLI IDs/modes remain explicit and failed/skipped samples stay in planned denominators', () => {
  const args = ['bench', '--experiment', 'RD-03', '--variant', 'fixture-control', '--fixture', 'F00-CONTROL', '--scenario', 'F00-CONTROL-REPLAY', '--run', 'unit-01'];
  expect(parseRunArgs(args).samples).toBe(120);
  expect(() => parseRunArgs(['inspect'])).toThrow(/explicit/i);
  expect(() => parseRunArgs([...args, '--mode', 'evidence'])).toThrow(/unknown/i);
  expect(sampleDenominator(120, 5, 2, 'aborted')).toEqual({ planned: 120, observed: 5, skipped: 115, failed: 2, skippedReasons: ['aborted'] });
});

it('rejects bad/oversize imports before payload access and bounded response allocation', async () => {
  await expect(loadInventory(publicRoot, async () => new Response('{}'))).rejects.toThrow(/digest|hash/i);
  await expect(readBoundedResponse(new Response(new Uint8Array(20), { headers: { 'Content-Length': '20' } }), 10)).rejects.toThrow(/limit|size/i);
  await expect(importFixture(new Uint8Array(1024 * 1024 + 1))).rejects.toThrow(/1 MiB/);
  const raw = JSON.parse(readFileSync(new URL('F00-CONTROL/manifest.json', root), 'utf8'));
  raw.payloads[0].byteLength = 128 * 1024 * 1024 + 1; raw.payloads[0].length = raw.payloads[0].byteLength;
  await expect(importFixture(new TextEncoder().encode(JSON.stringify(raw)))).rejects.toThrow(/128 MiB/);
});

it('host init abort/late effect cannot publish and mount registry releases reservation', async () => {
  // No fake GPU evidence: verify the existing lifecycle wrapper separately from WebGL.
  const { initialFixture: fixture } = await replay('F00-CONTROL-REPLAY'); const abort = new AbortController();
  const dispose = vi.fn(async () => {}); let finish!: () => void;
  const ready = new Promise<void>((resolve) => { finish = resolve; });
  const pending = mountExperiment(async () => { await ready; return { dispose, setFrame() {}, async replaceFixture() {}, readFacts() { throw new Error('not adopted'); } }; },
    { canvas: {} as HTMLCanvasElement, fixture, preset: { id: 'fixture-control' }, signal: abort.signal, capabilities: {} });
  await Promise.resolve(); abort.abort(); finish(); await expect(pending).rejects.toThrow(/abort/i);
  expect(dispose).toHaveBeenCalledTimes(1); expect(registeredMountCount()).toBe(0);
  expect(typeof createThreeLabHost).toBe('function');
});

function effectContext(fixture: Awaited<ReturnType<typeof importFixture>>) {
  const abort = new AbortController();
  return { scene: new Scene(), camera: new PerspectiveCamera(), root: new Group(), fixture, frame: frameAt(fixture), resetTick: null,
    signal: abort.signal, capabilities: { webgl2: true, timerQuery: false }, ownerPose: (id: string) => ownerPose(fixture, id), abort } satisfies ThreeLabEffectContext & { abort: AbortController };
}

function materialOf(mesh: Mesh): MeshLambertMaterial { return (mesh.material as MeshLambertMaterial[])[0]; }

it('unsupported control quality parameters cannot select a hidden lower-quality path', async () => {
  const data = await replay('F00-CONTROL-REPLAY');
  await expect(createThreeControlExperiment({ canvas: {} as HTMLCanvasElement, fixture: data.initialFixture,
    preset: { id: 'fixture-control', parameters: { quality: 'low' } }, signal: new AbortController().signal, capabilities: {} })).rejects.toThrow(/unsupported control parameters/i);
});
