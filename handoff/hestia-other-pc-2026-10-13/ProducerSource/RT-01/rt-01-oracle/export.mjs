import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { traceDda } from './src/dda.mts';
import { traceBruteForce } from './src/bruteForce.mts';
import { makeSnapshots, deterministicRays, canonical, sha256 } from './fixtures.mjs';
import { loadRdVolume, loadRdManifest } from './import-rd.mjs';

export const frozenRoot = fileURLToPath(new URL('../_shared/rt-2026-10-09/v1/', import.meta.url));
const jsonBytes = value => Buffer.from(`${canonical(value)}\n`);

function assertParity(a, b) {
  assert.ok(Math.abs(a.distance - b.distance) <= 1e-9);
  a.normal.forEach((n, i) => assert.ok(Math.abs(n - b.normal[i]) <= 1e-9));
  assert.deepEqual({ ...a, distance: 0, normal: [] }, { ...b, distance: 0, normal: [] });
}

/** Primitive export only: one explicit AABB per occupied fixture cell, no terrain authority/LOD/AO. */
export function exportVoxelBoxes(v) {
  return v.cells.flatMap((slot, i) => {
    if (slot <= 0) return [];
    const cell = [i % v.size[0], Math.floor(i / v.size[0]) % v.size[1], Math.floor(i / (v.size[0] * v.size[1]))];
    const min = cell.map((n, a) => v.origin[a] + n * v.cellMeters);
    return [{ min, max: min.map(n => n + v.cellMeters), materialId: slot, cellId: v.cellIds[i], owner: v.binding.owner }];
  });
}

export async function buildExports() {
  const { snapshots, commands } = makeSnapshots();
  const rd = await loadRdVolume();
  snapshots.push(rd);
  const rdManifest = await loadRdManifest();
  const entries = deterministicRays(snapshots, 1000);
  assert.equal(new Set(entries.map(({ ray }) => canonical([ray.origin, ray.direction, ray.maxDistance, ray.maxSteps]))).size, 1000);
  const goldenRays = entries.map(({ volumeId, ray }) => {
    const v = snapshots.find(s => s.id === volumeId);
    const expected = traceBruteForce(v, ray);
    assertParity(traceDda(v, ray), expected);
    return { volumeId, ray, expected, sourceBinding: v.binding };
  });
  const files = new Map();
  const add = (name, value) => files.set(name, jsonBytes(value));
  for (const v of snapshots) {
    add(`voxels/${v.id}.json`, v);
    // LE unsigned byte payload: 255 Unknown; 0 KnownEmpty; 1..254 canonical material ID.
    files.set(`voxels/${v.id}.bin`, Buffer.from(v.cells.map(slot => slot === -1 ? 255 : slot)));
    if (v.provenance === 'ANALYTICAL') add(`colliders/${v.id}.json`, { kind: 'multi-cuboid', provenance: v.provenance,
      sourceBinding: v.binding, rotation: v.rotation, translation: v.translation, boxes: exportVoxelBoxes(v) });
  }
  add('rays/golden-1000.json', goldenRays);
  add('replay/commands.json', commands);
  add('cameras/presets.json', { source: 'F00-CONTROL original cameras; analytical presets use same coordinate convention',
    frame: rdManifest.frame, rdCameras: rdManifest.cameras, analyticalCamera: { id: 'negative-seam',
      positionMeters: [-2.5, 0.5, -1.5], targetMeters: [-1, -0.25, -0.25], up: [0, 1, 0], verticalFovDegrees: 55 } });
  const importedRoot = new URL('./imported/F00-CONTROL/', import.meta.url);
  for (const payload of rdManifest.payloads.filter(p => /positions|normals|indices/.test(p.id))) {
    files.set(`meshes/F00-CONTROL/${payload.path}`, await readFile(new URL(payload.path, importedRoot)));
  }
  add('meshes/F00-CONTROL/manifest.json', { provenance: 'RD_SYNTHETIC', sourceBinding: rd.binding,
    objects: rdManifest.objects, materials: rdManifest.materials,
    payloads: rdManifest.payloads.filter(p => /positions|normals|indices/.test(p.id)) });
  add('telemetry/schema.json', { schema: 'hestia.rt-telemetry.v1', units: 'monotonic milliseconds',
    timestampFields: ['t_authority_commit', 't_mesh_visible', 't_ray_projection_accepted', 't_lighting_current_visible'],
    unavailable: null, rules: 'Missing samples remain null/NOT_RUN. No derived zero latency. All timestamps bind the same source and transform generations.' });
  const manifest = { schema: 'hestia.rt-fixtures.v1', frozen: true, version: 'rt-2026-10-09/v1',
    baseCommit: '17b1db4201a28e7b607c30707bdc2b75e3484a10', algorithm: 'rt01-direction-owned-positive-interval-v1',
    binaryEncoding: 'x-fastest uint8, KnownEmpty=0 Unknown=255, little endian (1-byte)',
    rayCount: goldenRays.length, uniqueNumericRayCount: 1000, provenance: { ANALYTICAL: 8, RD_SYNTHETIC: 1, PRODUCT_EXPORT: 0 },
    files: [...files].map(([name, bytes]) => ({ path: name, byteLength: bytes.length, sha256: sha256(bytes) })) };
  files.set('manifest.json', jsonBytes(manifest));
  return { files, manifest };
}

export async function verifyFrozen(root = frozenRoot) {
  const bytes = await readFile(path.join(root, 'manifest.json'));
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.schema, 'hestia.rt-fixtures.v1');
  assert.equal(manifest.frozen, true);
  const names = new Set(['manifest.json']);
  for (const entry of manifest.files) {
    if (!entry.path || entry.path.includes('\\') || entry.path.startsWith('/') || entry.path.split('/').some(p => p === '..' || !p)
      || names.has(entry.path)) throw new Error('Invalid frozen manifest path');
    names.add(entry.path);
    const payload = await readFile(path.join(root, entry.path));
    assert.equal(payload.length, entry.byteLength, entry.path);
    assert.equal(sha256(payload), entry.sha256, entry.path);
  }
  async function actualFiles(dir, prefix = '') {
    const entries = await readdir(dir, { withFileTypes: true });
    const out = [];
    for (const e of entries) {
      assert.ok(!e.isSymbolicLink(), 'No symlinks in frozen set');
      const name = prefix + e.name;
      if (e.isDirectory()) out.push(...await actualFiles(path.join(dir, e.name), `${name}/`));
      else out.push(name);
    }
    return out;
  }
  assert.deepEqual((await actualFiles(root)).sort(), [...names].sort(), 'Frozen file inventory');
  const built = await buildExports();
  for (const [name, regenerated] of built.files) assert.deepEqual(await readFile(path.join(root, name)), regenerated, `Non-reproducible ${name}`);
  return { status: 'PASS', manifestSha256: sha256(bytes), files: manifest.files.length, rays: manifest.rayCount };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--freeze-v1') {
    const { files } = await buildExports();
    // mkdir without recursive is an atomic no-overwrite gate; parent creation owns only RT-01 shared scope.
    await mkdir(path.dirname(frozenRoot.replace(/[\\/]$/, '')), { recursive: true });
    await mkdir(frozenRoot);
    for (const [name, bytes] of files) {
      await mkdir(path.dirname(path.join(frozenRoot, name)), { recursive: true });
      await writeFile(path.join(frozenRoot, name), bytes, { flag: 'wx' });
    }
    console.log(JSON.stringify(await verifyFrozen()));
  } else if (process.argv[2] === '--verify') console.log(JSON.stringify(await verifyFrozen()));
  else throw new Error('Use --freeze-v1 once, then --verify. New bytes require a new version.');
}
