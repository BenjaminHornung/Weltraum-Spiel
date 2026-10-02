import { describe, expect, it } from 'vitest';
import * as fixtureContract from '../../src/contracts/fixture';
import * as scenarioContract from '../../src/contracts/scenario';
import * as validation from '../../src/contracts/validation';
import { exportFixture, exportImportedFixture } from '../../exporters/fixture-export.mjs';
import { makeSyntheticFixtures } from '../../exporters/synthetic.mjs';
import { nativeMeshes, extractVegetationPalettes } from '../../exporters/product-crop.mjs';
import { readFixtureDirectory } from '../../exporters/fixture-files.mjs';
import { readPinned, ownedPath, BASE, LAB, RUN } from '../../exporters/stage-source.mjs';
import { sha } from '../../exporters/fixture-export.mjs';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs';
import path from 'node:path';

const contracts = { ...fixtureContract, ...scenarioContract, ...validation };
const hash = 'a'.repeat(64);
const frame = (id: string) => ({ id, originMeters: [0, 0, 0], rotationXyzw: [0, 0, 0, 1], basis: 'right-handed-y-up' });
const ref = { kind: 'synthetic', generatorPath: 'exporters/synthetic.mjs', generatorCodeSha256: hash,
  generatorVersion: 'rd02-fixtures-v1', seed: 20261002, testOnly: true, sourceDigest: hash };
const materials = [{ id: 'stone', role: 'limestone-dry', colorLinearRgb: [0.7, 0.6, 0.5] },
  { id: 'leaf', role: 'foliage', colorLinearRgb: [0.1, 0.5, 0.1] }];
function object(ownerId = 'terrain') {
  return { ownerId, sourceRevision: 0, sourceNamespace: 'test-cells', sourceIds: ['cell-0', 'cell-1'], frame: frame(ownerId),
    volumes: [{ id: `${ownerId}-cells`, dimensions: [3, 2, 2], originMeters: [0, 0, 0],
      slots: new Uint8Array([1, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
      coverage: new Uint8Array(12).fill(1), materialIds: ['stone', 'leaf'] }] };
}
function spec(objects = [object()]) {
  return { id: 'FX-CONTROL', kind: 'synthetic', sourceRevision: 0, sourceRefs: [ref],
    quantumMeters: 0.125, frame: frame('lab'), materials, objects,
    cameras: [{ id: 'near', positionMeters: [2, 2, 2], targetMeters: [0, 0, 0], up: [0, 1, 0], verticalFovDegrees: 60 }] };
}
const signature = (bundle: any) => [new TextDecoder().decode(bundle.manifestBytes),
  [...bundle.payloads].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([id, bytes]) => [id, Array.from(bytes as Uint8Array)])];

describe('RD-02 bounded fixture export', () => {
  it('FX10 owned paths reject dangling and live links while normal paths and foreign rejection remain intact', () => {
    const root = mkdtempSync(`${RUN}/fx10-owned-path-`);
    const danglingTarget = path.join(root, 'absent-target');
    const danglingLink = path.join(root, 'dangling-link');
    const liveTarget = path.join(root, 'live-target');
    const liveLink = path.join(root, 'live-link');
    mkdirSync(liveTarget);
    symlinkSync(danglingTarget, danglingLink, 'junction');
    symlinkSync(liveTarget, liveLink, 'junction');
    expect(lstatSync(danglingLink).isSymbolicLink()).toBe(true);
    expect(existsSync(danglingLink)).toBe(false);
    expect(ownedPath(path.join(root, 'normal', 'output.bin'))).toBe(path.join(root, 'normal', 'output.bin'));
    expect(ownedPath(path.join(liveTarget, 'output.bin'))).toBe(path.join(liveTarget, 'output.bin'));
    expect(() => ownedPath(`${RUN}-foreign/output.bin`)).toThrow(/outside own/);
    expect(() => ownedPath(path.join(liveLink, 'output.bin'))).toThrow(/Linked\/escaping/);
    expect(() => ownedPath(path.join(danglingLink, 'output.bin'))).toThrow(/Linked\/escaping/);
    expect(() => ownedPath(danglingLink)).toThrow(/Linked\/escaping/);
    expect(existsSync(danglingTarget)).toBe(false);
    expect(existsSync(path.join(liveTarget, 'output.bin'))).toBe(false);
    // Retain additive task-owned directories/links as evidence; no follow-write,
    // cleanup of foreign probes, or delete/recreate of a link.
  });

  it('FX01 same export twice and reverse query/order payload determinism', async () => {
    const objects = [object('terrain'), object('branch')];
    const a = await exportFixture(spec(objects), contracts);
    const b = await exportFixture(spec([...objects].reverse()), contracts);
    expect(signature(a)).toEqual(signature(b));
    const imported = await contracts.importFixture(a.manifestBytes, new Map([...a.payloads].reverse()));
    expect(signature(exportImportedFixture(imported, contracts))).toEqual(signature(a));
  });

  it('FX02 zero mutation/sourcebuffer not detached', async () => {
    const source = object();
    const slots = source.volumes[0].slots;
    const coverage = source.volumes[0].coverage;
    const before = { slots: slots.slice(), coverage: coverage.slice() };
    const bundle = await exportFixture(spec([source]), contracts);
    expect(slots).toEqual(before.slots);
    expect(coverage).toEqual(before.coverage);
    expect(slots.buffer.byteLength).toBe(12);
    expect(coverage.buffer.byteLength).toBe(12);
    const imported = bundle.fixture;
    slots.fill(0);
    for (const bytes of bundle.payloads.values()) { bytes.fill(0); }
    const copy = contracts.copyFixturePayload(imported, 'terrain-cells-occupancy');
    copy.fill(0);
    expect(contracts.readVoxel(imported, 'terrain-cells', 0, 0, 0)).toBe('occupied');
  });

  it('FX03 known air vs unknown/halo crop edge', async () => {
    const source = object();
    source.volumes[0].coverage[2] = 0;
    const bundle = await exportFixture(spec([source]), contracts);
    expect(contracts.readVoxel(bundle.fixture, 'terrain-cells', 2, 0, 0)).toBe('unknown');
    expect(contracts.readVoxel(bundle.fixture, 'terrain-cells', 2, 1, 0)).toBe('air');
    expect(contracts.readVoxel(bundle.fixture, 'terrain-cells', -1, 0, 0)).toBe('unknown');
    expect(contracts.readVoxel(bundle.fixture, 'terrain-cells', 3, 0, 0)).toBe('unknown');
    expect(bundle.fixture.voxelRegions).toHaveLength(1);
    const occupiedUnknown = object(); occupiedUnknown.volumes[0].coverage[0] = 0;
    await expect(exportFixture(spec([occupiedUnknown]), contracts)).rejects.toThrow(/occupancy\/coverage/);
    await expect(exportFixture({ ...spec(), objects: [{ ...object(),
      volumes: [{ ...object().volumes[0], coverage: undefined }] }] }, contracts)).rejects.toThrow(/Volume size/);
  });

  it('FX04 independent exposedFace count/positions/normals/materials/owners/supportrefs', async () => {
    const terrain = object();
    const branch = object('branch');
    const input = { ...spec([terrain, branch]), attachments: [{ id: 'leaf-support', ownerId: 'branch',
      sourceIds: ['cell-1'], supportOwnerId: 'terrain', supportIds: ['cell-0'] }] };
    const { fixture } = await exportFixture(input, contracts);
    // Independent cell-neighbor oracle; does not call any production/lab mesher.
    const expected: string[] = [];
    const volume = terrain.volumes[0];
    const at = (x: number, y: number, z: number) => x < 0 || y < 0 || z < 0 || x >= 3 || y >= 2 || z >= 2
      ? 0 : volume.slots[x + 3 * (y + 2 * z)];
    for (let z = 0; z < 2; z += 1) {
      for (let y = 0; y < 2; y += 1) {
        for (let x = 0; x < 3; x += 1) {
          const slot = at(x, y, z);
          if (slot === 0) { continue; }
          for (let axis = 0; axis < 3; axis += 1) {
            for (const sign of [-1, 1]) {
              const neighbor = [x, y, z]; neighbor[axis] += sign;
              if (at(neighbor[0], neighbor[1], neighbor[2]) !== 0) { continue; }
              const center = [x + 0.5, y + 0.5, z + 0.5]; center[axis] += sign * 0.5;
              const normal = [0, 0, 0]; normal[axis] = sign;
              expected.push(JSON.stringify([center.map(v => v * 0.125), normal, materials[slot - 1].id]));
            }
          }
        }
      }
    }
    for (const owner of fixture.objects) {
      const faces: string[] = [];
      for (const mesh of owner.meshes) {
        const p = contracts.copyFixturePayload(fixture, mesh.positions);
        const n = contracts.copyFixturePayload(fixture, mesh.normals!);
        const indices = contracts.copyFixturePayload(fixture, mesh.indices);
        for (let start = 0; start < p.length; start += 12) {
          const center = [0, 1, 2].map(axis => (p[start + axis] + p[start + axis + 3] + p[start + axis + 6] + p[start + axis + 9]) / 4);
          const normal = Array.from(n.slice(start, start + 3));
          const corners = new Set(Array.from({ length: 4 }, (_, v) => Array.from(p.slice(start + v * 3, start + v * 3 + 3)).join(',')));
          expect(corners.size).toBe(4);
          for (let i = start; i < start + 12; i += 3) {
            expect(Array.from(n.slice(i, i + 3))).toEqual(normal);
            expect([0, 1, 2].every(axis => Math.abs(p[i + axis] - center[axis]) === (normal[axis] === 0 ? 0.0625 : 0))).toBe(true);
          }
          faces.push(JSON.stringify([center, normal, mesh.materialId]));
        }
        for (let i = 0; i < indices.length; i += 3) {
          const [a, b, c] = Array.from(indices.slice(i, i + 3)).map(v => Array.from(p.slice(v * 3, v * 3 + 3)));
          const u = b.map((v, j) => v - a[j]); const v = c.map((value, j) => value - a[j]);
          const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
          expect(cross.reduce((sum, value, axis) => sum + value * n[indices[i] * 3 + axis], 0)).toBeGreaterThan(0);
        }
      }
      expect(faces.sort()).toEqual([...expected].sort());
      expect(owner.sourceNamespace).toBe('test-cells');
    }
    expect(fixture.attachments).toEqual(input.attachments);
    const wrong = { ...input, attachments: [{ ...input.attachments[0], supportIds: ['wrong-owner-cell'] }] };
    await expect(exportFixture(wrong, contracts)).rejects.toThrow(/source\/support/);
  });

  it('FX05 before/after is clearly snapshotreplay not nativeCutReceipt', async () => {
    const { bundles, scenarios } = await makeSyntheticFixtures(contracts, hash);
    const replay = scenarios.find((entry: any) => entry.group === 'F04-DETACH')!.scenario;
    expect(replay.mode).toBe('presentation-replay');
    expect(replay.snapshots.map((event: any) => event.manifest.sourceRevision)).toEqual([1, 2, 3, 4]);
    expect(replay.snapshots.every((event: any) => event.type === 'ReplaceSnapshot')).toBe(true);
    const states = [0, 360, 720, 1080, 1440].map(tick => contracts.sampleScenario(replay, tick, false).fixture);
    expect(states[0].objects.some((o: any) => o.ownerId === 'tree-main')).toBe(true);
    expect(states[1].objects.some((o: any) => o.ownerId === 'fragment-branch')).toBe(true);
    expect(states[1].attachments!.find((a: any) => a.id === 'branch-leaf')!.supportOwnerId).toBe('fragment-branch');
    expect(states[2].objects.find((o: any) => o.ownerId === 'fragment-branch')!.frame.rotationXyzw[2]).not.toBe(0);
    expect(states[3].attachments!.some((a: any) => a.id === 'branch-leaf')).toBe(false);
    expect(states[4].attachments).toEqual(states[3].attachments);
    const removed = bundles.filter((b: any) => b.group === 'F04-DETACH' && b.fixture.sourceRevision >= 3);
    expect(signature(removed[0])[1]).toEqual(signature(removed[1])[1]);
    expect(JSON.stringify(replay)).not.toMatch(/nativeCutReceipt|CutApplied|Applied|Receipt/);
    expect(contracts.sampleScenario(replay, 0, true).fixture).toBe(states[0]);
  });

  it('FX06 invalid or oversized input is atomic; no payload access before limits', async () => {
    const bundle = await exportFixture(spec(), contracts);
    const originalDigest = contracts.getFixtureDigest(bundle.fixture);
    const manifest = JSON.parse(new TextDecoder().decode(bundle.manifestBytes));
    const oversized = { ...manifest, payloads: [{ ...manifest.payloads[0], length: 134217729, byteLength: 134217729, elementType: 'uint8' }] };
    let reads = 0;
    const trap = new Map<string, Uint8Array>(); trap.get = () => { reads += 1; throw new Error('access before cap'); };
    await expect(contracts.importFixture(new TextEncoder().encode(JSON.stringify(oversized)), trap)).rejects.toThrow(/128 MiB/);
    expect(reads).toBe(0);
    await expect(contracts.importFixture(new Uint8Array(1048577), trap)).rejects.toThrow(/1 MiB/);
    const corrupt = new Map(bundle.payloads); const first = [...corrupt.keys()][0];
    corrupt.set(first, new Uint8Array(corrupt.get(first)!)); corrupt.get(first)![0] ^= 1;
    await expect(contracts.importFixture(bundle.manifestBytes, corrupt)).rejects.toThrow(/SHA-256/);
    const wrongSource = { ...manifest, kind: 'product-derived', sourceRefs: [{ kind: 'product',
      repository: 'BenjaminHornung/Weltraum-Spiel', commit: 'main',
      files: [{ path: 'apps/weltraum-browser/src/hvp/hvpCoastSource.ts', sha256: hash }], generatorVersion: 'bad-ref-v1', sourceDigest: '12345678' }] };
    await expect(contracts.importFixture(new TextEncoder().encode(JSON.stringify(wrongSource)), trap)).rejects.toThrow(/Unpinned/);
    expect(reads).toBe(0);
    expect(contracts.getFixtureDigest(bundle.fixture)).toBe(originalDigest);
    const huge = object(); huge.volumes[0].dimensions = [134217729, 1, 1];
    await expect(exportFixture(spec([huge]), contracts)).rejects.toThrow(/128 MiB/);
  });

  it('FX07 native material ranges share exact vertex payloads without inflating allocation', async () => {
    const p = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const n = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const owner = { ...object(), volumes: [], meshes: [
      { id: 'a', materialId: 'stone', positions: p, normals: n, indices: new Uint16Array([0, 1, 2]) },
      { id: 'b', materialId: 'leaf', positions: p, normals: n, indices: new Uint16Array([0, 1, 2]) },
    ] };
    const result = await exportFixture(spec([owner]), contracts);
    expect(result.fixture.objects[0].meshes[0].positions).toBe(result.fixture.objects[0].meshes[1].positions);
    expect(result.payloadBytes).toBe(p.byteLength + n.byteLength + 12);
    expect(p.buffer.byteLength).toBe(36);
    expect(Array.from(p)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const indices = new Uint16Array([0, 1, 2, 0, 1, 2, 0, 2, 1]);
    const grouped = nativeMeshes('native', { positions: p, normals: n, colors: null, indices,
      materialRanges: [{ slot: 1, startIndex: 0, indexCount: 3 }, { slot: 2, startIndex: 3, indexCount: 3 },
        { slot: 1, startIndex: 6, indexCount: 3 }] }, ['stone', 'leaf']);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].positions).toBe(p);
    expect(Array.from(grouped[0].indices)).toEqual([0, 1, 2, 0, 2, 1]);
    expect(Array.from(grouped[1].indices)).toEqual([0, 1, 2]);
    expect(Array.from(indices)).toEqual([0, 1, 2, 0, 1, 2, 0, 2, 1]);
  });

  it('FX08 actual F00-F07 files import, re-export and scenario replay; required cases are occupied/air facts', async () => {
    const root = path.join(LAB, 'fixtures');
    const inventory = JSON.parse(readFileSync(path.join(root, 'inventory.json'), 'utf8'));
    expect(inventory.groups).toEqual(['F00-CONTROL', 'F01-HVP-COAST', 'F02-ROOT-GROVE', 'F03-SHELTER',
      'F04-DETACH', 'F05-CUTOUT', 'F06-MATERIAL', 'F07-SCALE']);
    expect(inventory.fixtures).toHaveLength(16);
    expect(inventory.productIntegrated).toBe(false);
    const byId = new Map<string, fixtureContract.LabFixtureV1>();
    const imported = new Map<string, fixtureContract.LabFixtureV1>();
    for (const row of inventory.fixtures) {
      const bundle = await readFixtureDirectory(path.dirname(path.join(root, row.manifestPath)), contracts);
      expect(contracts.getFixtureDigest(bundle.fixture)).toBe(row.fixtureDigest);
      expect(sha(bundle.manifestBytes)).toBe(row.manifestSha256);
      expect(sha(readFileSync(path.join(root, row.recipePath)))).toBe(row.recipeSha256);
      expect(bundle.fixture.payloads.reduce((n, p) => n + p.byteLength, 0)).toBe(row.payloadBytes);
      for (const payload of row.payloads) { expect(sha(readFileSync(path.join(root, payload.path)))).toBe(payload.sha256); }
      byId.set(row.id, bundle.fixture); imported.set(row.fixtureDigest, bundle.fixture);
    }
    for (const row of inventory.scenarios) {
      const bytes = readFileSync(path.join(root, row.path));
      const scenario = contracts.importScenario(bytes, imported);
      expect(await contracts.getScenarioDigest(scenario)).toBe(row.scenarioDigest);
      expect(sha(bytes)).toBe(row.sha256);
      expect(contracts.sampleScenario(scenario, 1560, true).resetTick).toBe(1560);
      expect(contracts.sampleScenario(scenario, 0, true).fixture).toBe(imported.get(row.initialFixtureDigest));
    }
    const get = (id: string) => byId.get(id)!;
    expect(get('F00-CONTROL').quantumMeters).toBe(0.125);
    expect(contracts.readVoxel(get('F02-ROOT-GROVE'), 'grove-wood', 18, 5, 19)).toBe('air');
    expect(contracts.readVoxel(get('F02-ROOT-GROVE'), 'grove-wood', 18, 10, 19)).toBe('occupied');
    const wood = contracts.copyFixturePayload(get('F02-ROOT-GROVE'), 'grove-wood-material-slots');
    const decor = contracts.copyFixturePayload(get('F02-ROOT-GROVE'), 'grove-decor-material-slots');
    expect(wood.every((slot, i) => slot === 0 || decor[i] === 0)).toBe(true);
    for (const id of ['F03-SHELTER', 'F03-SHELTER-R1']) {
      expect(contracts.readVoxel(get(id), 'shelter-shell', 38, 28, 30)).toBe('air');
      expect(contracts.readVoxel(get(id), 'shelter-shell', 39, 28, 30)).toBe('unknown');
    }
    expect(get('F03-SHELTER').objects.some(o => o.ownerId === 'removable-roof')).toBe(true);
    expect(get('F03-SHELTER-R1').objects.some(o => o.ownerId === 'removable-roof')).toBe(false);
    const marker = get('F05-CUTOUT').objects.find(o => o.ownerId === 'figure-marker')!;
    expect(marker.bounds.max[1] - marker.bounds.min[1]).toBe(1.8);
    expect(marker.meshes.every(m => m.presentationOnly)).toBe(true);
    expect(contracts.readVoxel(get('F05-CUTOUT'), 'cutout-obstacles', 17, 9, 7)).toBe('occupied');
    expect(contracts.readVoxel(get('F06-MATERIAL'), 'material-room', 15, 20, 12)).toBe('occupied');
    expect(contracts.readVoxel(get('F06-MATERIAL-R1'), 'material-room', 15, 20, 12)).toBe('air');
    for (const count of [1, 2, 4]) {
      expect(get(`F07-SCALE-${count}x`).objects).toHaveLength(count * 2);
      expect(sha(contracts.copyFixturePayload(get(`F07-SCALE-${count}x`), 'copy-0-grove-ground-material-slots')))
        .toBe(sha(contracts.copyFixturePayload(get('F02-ROOT-GROVE'), 'grove-ground-material-slots')));
    }
    for (const id of ['F04-DETACH', 'F04-DETACH-R1', 'F04-DETACH-R2', 'F04-DETACH-R3', 'F04-DETACH-R4']) {
      const row = inventory.fixtures.find((r: any) => r.id === id);
      const recipe = JSON.parse(readFileSync(path.join(root, row.recipePath), 'utf8'));
      for (const attachment of get(id).attachments!) {
        for (const sourceId of [...attachment.sourceIds, ...attachment.supportIds]) {
          const binding = recipe.cases.sourceIdMeaning[sourceId];
          expect(contracts.readVoxel(get(id), binding.region, ...binding.cell as [number, number, number])).toBe('occupied');
        }
      }
    }
  });

  it('FX09 F01 binds actual b3 blobs/crop/native arrays and does not call empty plant slots global air', async () => {
    const root = path.join(LAB, 'fixtures/F01-HVP-COAST');
    const { fixture } = await readFixtureDirectory(root, contracts);
    const recipe = JSON.parse(readFileSync(path.join(root, 'recipe.json'), 'utf8'));
    expect(fixture.kind).toBe('product-derived');
    const ref = fixture.sourceRefs[0]; expect(ref.kind).toBe('product');
    if (ref.kind !== 'product') { throw new Error('Product source required'); }
    for (const file of ref.files) {
      const source = readPinned(file.path, BASE);
      expect(source.sha256).toBe(file.sha256); expect(source.blobSha).toBe(file.blobSha);
    }
    const vegetationBytes = readPinned(ref.files.find(f => f.path.endsWith('/vegetation.ts'))!.path).bytes;
    expect(recipe.cases.nativeVegetationPalettesLinearRgb).toEqual(extractVegetationPalettes(vegetationBytes.toString('utf8')));
    expect(() => readPinned(ref.files[0].path, 'main')).toThrow(/Unpinned/);
    const full = readFileSync(`${RUN}/stage-v1/proof/native-coast-slots.bin`);
    expect(full.byteLength).toBe(8388608); expect(sha(full)).toBe(recipe.cases.nativeSourceSlotSha256);
    const crop = contracts.copyFixturePayload(fixture, 'coast-crop-material-slots');
    expect(sha(crop)).toBe(recipe.cases.cropMaterialSlotSha256);
    for (let i = 0; i < crop.length; i += 1) {
      const x = i % 192; const y = Math.floor(i / 192) % 80; const z = Math.floor(i / (192 * 80));
      if (crop[i] !== full[x + 64 + 256 * (y + 48 + 128 * (z + 64))]) { throw new Error(`Native crop mismatch at ${i}`); }
    }
    expect(recipe.cases.plants.map((p: any) => p.kind).sort()).toEqual(['amber', 'broadleaf', 'reed', 'tree', 'violet']);
    expect(fixture.presentation?.exposure).toBe(1.05);
    expect(contracts.readVoxel(fixture, 'coast-crop', -1, 0, 0)).toBe('unknown');
    for (const region of fixture.voxelRegions!.filter(r => r.id.startsWith('plant-'))) {
      const occupancy = contracts.copyFixturePayload(fixture, region.occupancyPayload);
      const coverage = contracts.copyFixturePayload(fixture, region.knownCoveragePayload);
      expect(coverage).toEqual(occupancy);
    }
    for (const plant of recipe.cases.plants) {
      expect(plant.sourceBuffersAfter).toEqual(plant.sourceBuffersBefore);
      const owner = fixture.objects.find(o => o.ownerId === plant.id)!;
      const meshes = owner.meshes;
      for (const proof of plant.meshes) {
        expect(proof.nativeArtifactSourceRevision).toBe(1); expect(proof.nativeArtifactRevision).toBe(0);
        const mesh = meshes.find(m => fixture.payloads.find(p => p.id === m.positions)!.sha256 === proof.positionsSha256)!;
        expect(fixture.payloads.find(p => p.id === mesh.normals)!.sha256).toBe(proof.normalsSha256);
        expect(fixture.payloads.find(p => p.id === mesh.colors)!.sha256).toBe(proof.colorsSha256);
      }
    }
    for (const binding of recipe.cases.nativePlantBindings) {
      expect(contracts.readVoxel(fixture, binding.region, ...binding.cell as [number, number, number])).toBe('occupied');
      expect(fixture.objects.find(o => o.ownerId === binding.ownerId)!.sourceIds).toContain(binding.sourceId);
    }
  });
});
