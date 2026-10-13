import test from 'node:test';
import assert from 'node:assert/strict';
import { caveCounterexample, inspectCave } from '../dist/src/cave.js';

const stacked = (volumes = [1000, 0]) => ({
  chambers: [
    { id: 'lower', address: { x: 0, z: 0, yMin: 0, yMax: 1 }, volumeML: volumes[0], connections: [] },
    { id: 'upper', address: { x: 0, z: 0, yMin: 2, yMax: 3 }, volumeML: volumes[1], connections: [] }
  ],
  solidRoofs: [{ x: 0, z: 0, yMin: 1, yMax: 2 }]
});

test('same-column sealed chambers collide under heightfield projection with exact conserved totals', () => {
  const result = caveCounterexample();
  assert.equal(result.status, 'UNSUPPORTED');
  assert.equal(result.reason, 'HEIGHTFIELD_CANNOT_PRESERVE_STACKED_SEALED_CHAMBERS');
  assert.deepEqual(result.chamberVolumesA, [1000, 0]);
  assert.deepEqual(result.chamberVolumesB, [0, 1000]);
  assert.deepEqual(result.columnTotalsA, [1000]);
  assert.deepEqual(result.columnTotalsB, [1000]);
  assert.equal(result.exactTotalA, 1000);
  assert.equal(result.exactTotalB, 1000);
  assert.deepEqual(result.topology.chambers.map(chamber => chamber.address), [
    { x: 0, z: 0, yMin: 0, yMax: 1 }, { x: 0, z: 0, yMin: 2, yMax: 3 }
  ]);
  assert.deepEqual(result.topology.solidRoofs, [{ x: 0, z: 0, yMin: 1, yMax: 2 }]);
  assert.deepEqual(result.topology.chambers.map(chamber => chamber.connections), [[], []]);
  assert.equal(result.allocatedCells, 0);
});

test('cave inspection rejects unknown fields, invalid quantities and over-budget counts before field allocation', () => {
  assert.equal(inspectCave(stacked()).reason, 'HEIGHTFIELD_CANNOT_PRESERVE_STACKED_SEALED_CHAMBERS');
  assert.throws(() => inspectCave({ ...stacked(), mystery: true }), /INVALID_FIELDS/);
  assert.throws(() => inspectCave(stacked([NaN, 0])), /INVALID_INTEGER:chamber-volume/);
  assert.throws(() => inspectCave(stacked([-1, 0])), /INVALID_INTEGER:chamber-volume/);
  const overBudget = { chambers: Array.from({ length: 9 }, () => null), solidRoofs: [] };
  assert.throws(() => inspectCave(overBudget), /CHAMBER_BUDGET/);
});

test('counterexample and inspection snapshots are immutable', () => {
  const result = caveCounterexample();
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.chamberVolumesA));
  assert.ok(Object.isFrozen(result.topology));
  assert.ok(Object.isFrozen(result.topology.chambers[0].address));
  assert.throws(() => { result.chamberVolumesA[0] = 0; }, TypeError);
  const inspected = inspectCave(stacked([0, 1000]));
  assert.ok(Object.isFrozen(inspected));
  assert.equal(inspected.allocatedCells, 0);
});
