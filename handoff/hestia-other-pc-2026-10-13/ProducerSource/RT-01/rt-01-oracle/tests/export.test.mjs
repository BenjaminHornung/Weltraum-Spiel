import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, cp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExports, frozenRoot, verifyFrozen } from '../export.mjs';
import { sha256 } from '../fixtures.mjs';
import { loadFrozenVolume } from '../load.mjs';

test('1000 mixed immutable rays, source bindings, binary and existing mesh/camera exports reproduce', async () => {
  const { files, manifest } = await buildExports();
  assert.equal(manifest.rayCount, 1000);
  const rays = JSON.parse(files.get('rays/golden-1000.json'));
  assert.equal(rays.filter(r => r.volumeId === 'F00-CONTROL').length, 111);
  assert.ok(new Set(rays.map(r => r.expected.kind)).size === 4);
  for (const file of manifest.files.filter(f => /voxels\/.*\.json$/.test(f.path))) {
    const v = JSON.parse(files.get(file.path));
    const bin = files.get(file.path.replace(/\.json$/, '.bin'));
    assert.deepEqual([...bin].map(slot => slot === 255 ? -1 : slot), v.cells);
  }
  assert.equal(JSON.parse(files.get('cameras/presets.json')).rdCameras.length, 3);
  assert.equal(JSON.parse(files.get('meshes/F00-CONTROL/manifest.json')).payloads.length, 18);
});

test('frozen consumer rejects tampered bytes, stale binding and exposes no writable arrays', async () => {
  const result = await verifyFrozen();
  const initial = JSON.parse(await readFile(path.join(frozenRoot, 'voxels/grid-0.125.json')));
  const v = await loadFrozenVolume(initial.id, result.manifestSha256, initial.binding);
  assert.ok(Object.isFrozen(v.cells)); assert.ok(Object.isFrozen(v.binding));
  assert.throws(() => { v.cells[0] = 3; }, TypeError);
  await assert.rejects(() => loadFrozenVolume(initial.id, '0'.repeat(64), initial.binding), /Trusted manifest/);
  await assert.rejects(() => loadFrozenVolume(initial.id, result.manifestSha256,
    { ...initial.binding, originEpoch: 99 }), /Stale/);
  await assert.rejects(() => loadFrozenVolume('../other', result.manifestSha256, initial.binding), /Invalid/);
  // Test copies stay in owned spike scope. Frozen v1 is only read.
  const temporary = await mkdtemp(fileURLToPath(new URL('../tamper-negative-', import.meta.url)));
  await cp(frozenRoot, temporary, { recursive: true });
  const name = path.join(temporary, 'voxels/grid-0.125.bin');
  const bytes = await readFile(name); bytes[0] ^= 1; await writeFile(name, bytes);
  await assert.rejects(() => verifyFrozen(temporary));
  assert.equal(sha256(await readFile(path.join(frozenRoot, 'manifest.json'))), result.manifestSha256);
});
