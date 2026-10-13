import assert from 'node:assert/strict';
import test from 'node:test';
import { pickHvpCell } from '../../../apps/weltraum-browser/src/hestia-prototype/terrain/picking.ts';

test('unchanged fixed-base product picker: negative boundary and unknown', () => {
  const source = { sizeX: 4, sizeY: 1, sizeZ: 1, cellMeters: 0.125,
    originMeters: { x: -0.25, y: 0, z: 0 }, readSlot: x => x === 1 ? 3 : 0 };
  const hit = pickHvpCell(source, [0, 0.0625, 0.0625], [-1, 0, 0], 0.5);
  assert.equal(hit.kind, 'Hit');
  assert.deepEqual(hit.cell, [1, 0, 0]);
  assert.equal(hit.distance, 0);
  assert.equal(hit.slot, 3);
  assert.equal(pickHvpCell(source, [1, 0, 0], [1, 0, 0]).kind, 'Unknown');
});
