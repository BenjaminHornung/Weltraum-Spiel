import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { frozenRoot } from './export.mjs';
import { sha256, canonical, bindSource } from './fixtures.mjs';
import { assertCurrent, validateVolume } from './src/validate.mts';

const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Consumer supplies a trusted version digest and its current binding. Never exposes live Authority arrays. */
export async function loadFrozenVolume(id, manifestSha256, expectedBinding, root = frozenRoot) {
  if (!/^[a-zA-Z0-9._-]+$/.test(id) || !/^[a-f0-9]{64}$/.test(manifestSha256)) throw new Error('Invalid frozen fixture reference');
  const manifestBytes = await readFile(path.join(root, 'manifest.json'));
  assert.equal(sha256(manifestBytes), manifestSha256, 'Trusted manifest digest');
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.frozen, true);
  assert.equal(manifest.schema, 'hestia.rt-fixtures.v1');
  const ref = manifest.files.find(file => file.path === `voxels/${id}.json`);
  assert.ok(ref, 'Frozen volume is not listed');
  const payload = await readFile(path.join(root, ref.path));
  assert.equal(payload.length, ref.byteLength);
  assert.equal(sha256(payload), ref.sha256, 'Frozen volume digest');
  const v = JSON.parse(payload);
  validateVolume(v);
  assert.equal(v.binding.materialDigest, sha256(canonical(v.materials)), 'Material profile digest');
  const recomputed = bindSource(structuredClone(v));
  assert.equal(v.binding.sourceDigest, recomputed.binding.sourceDigest, 'Source payload digest');
  assertCurrent(v.binding, expectedBinding);
  return freeze(v);
}
