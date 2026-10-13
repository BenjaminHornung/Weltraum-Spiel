import assert from 'node:assert/strict';
import test from 'node:test';
import { traceBruteForce } from '../src/bruteForce.mts';

const binding = {
  domain: 'fixture', world: 'ray-test', session: 'session-1', epoch: 'epoch-1', owner: 'owner-7',
  sourceRevision: 13, sourceGeneration: 4, sourceDigest: 'a'.repeat(64), frame: 'world-1', originEpoch: 2,
  transformGeneration: 9, materialDigest: 'b'.repeat(64), algorithm: 'exhaustive-aabb-test',
};

function volume({ size = [1, 1, 1], cells = [0], origin = [0, 0, 0], rotation = [1, 0, 0, 0, 1, 0, 0, 0, 1], translation = [0, 0, 0],
  exteriorCoverage = 'KnownEmpty', coverage = 'complete' } = {}) {
  return {
    id: 'oracle-fixture', provenance: 'ANALYTICAL', binding, size, cellMeters: 0.25, origin, rotation, translation,
    authorityLeafEdge: 16, rayPageEdge: 8, coverage, exteriorCoverage, cells,
    cellIds: cells.map((_, index) => `cell-${index}`),
    materials: [{ id: 7, role: 'rock', source: 'fixture-material-source' }, { id: 8, role: 'ice', source: 'fixture-ice-source' }],
  };
}

function ray(origin, direction, { maxDistance = 4, maxSteps = 16 } = {}) {
  return { id: 'ray-1', origin, direction, maxDistance, maxSteps };
}

test('rotated AABB reports analytic entry distance, world normal, material source, and binding', () => {
  const quarterTurnZ = [0, -1, 0, 1, 0, 0, 0, 0, 1];
  const result = traceBruteForce(volume({ cells: [7], rotation: quarterTurnZ, translation: [10, 20, 30] }),
    ray([8.75, 20.125, 30.125], [1, 0, 0]));

  assert.deepEqual(result, {
    kind: 'Hit', distance: 1, normal: [-1, 0, 0], cell: [0, 0, 0], materialId: 7,
    materialSource: 'fixture-material-source', owner: 'owner-7', cellId: 'cell-0',
    sourceRevision: 13, sourceGeneration: 4, transformGeneration: 9, originEpoch: 2,
  });
});

test('direction owns an internal boundary and a zero-axis ray uses min-inclusive/max-exclusive cells', () => {
  const grid = volume({ size: [2, 2, 1], cells: [7, 8, 0, 0] });
  const positive = traceBruteForce(grid, ray([0.25, 0.125, 0.125], [1, 0, 0]));
  assert.deepEqual([positive.cell, positive.distance, positive.normal, positive.materialId], [[1, 0, 0], 0, [0, 0, 0], 8]);

  const alongBoundary = traceBruteForce(volume({ size: [1, 2, 1], cells: [7, 8] }), ray([0.125, 0.25, 0.125], [1, 0, 0]));
  assert.deepEqual([alongBoundary.cell, alongBoundary.materialId, alongBoundary.normal], [[0, 1, 0], 8, [0, 0, 0]]);
});

test('simultaneous corner entry chooses the X face normal', () => {
  const direction = [Math.SQRT1_2, Math.SQRT1_2, 0];
  const result = traceBruteForce(volume({ cells: [7] }), ray([-0.25, -0.25, 0.125], direction));
  assert.equal(result.kind, 'Hit');
  assert.ok(Math.abs(result.distance - 0.25 * Math.SQRT2) < 1e-12);
  assert.deepEqual(result.normal, [-1, 0, 0]);
});

test('point-only corner contacts and maxDistance endpoint entries are excluded', () => {
  const diagonal = traceBruteForce(volume({ size: [2, 2, 1], cells: [0, 0, 0, 7] }),
    ray([0.125, 0.125, 0.125], [Math.SQRT1_2, Math.SQRT1_2, 0]));
  assert.deepEqual([diagonal.kind, diagonal.cell, diagonal.normal], ['Hit', [1, 1, 0], [-1, 0, 0]]);

  const endpoint = traceBruteForce(volume({ cells: [7] }), ray([-0.25, 0.125, 0.125], [1, 0, 0], { maxDistance: 0.25 }));
  assert.deepEqual([endpoint.kind, endpoint.distance, endpoint.cell], ['Miss', 0.25, null]);

  const outsideStaticAxis = traceBruteForce(volume({ cells: [7] }), ray([-0.25, 0.375, 0.125], [1, 0, 0]));
  assert.deepEqual([outsideStaticAxis.kind, outsideStaticAxis.distance, outsideStaticAxis.cell], ['Miss', 4, null]);

  const distantLocalGrid = traceBruteForce(volume({ cells: [7], origin: [1e12, 1e12, 0] }), ray([1e12 - 0.25, 1e12 - 1, 0.125], [1, 0, 0]));
  assert.deepEqual([distantLocalGrid.kind, distantLocalGrid.distance, distantLocalGrid.cell], ['Miss', 4, null]);
});

test('budget counts positive empty cells and miss has null source fields', () => {
  const bounded = traceBruteForce(volume({ size: [3, 1, 1], cells: [0, 0, 7] }),
    ray([0.125, 0.125, 0.125], [1, 0, 0], { maxSteps: 1 }));
  assert.deepEqual([bounded.kind, bounded.distance, bounded.cell, bounded.cellId], ['BudgetExceeded', 0.125, [1, 0, 0], 'cell-1']);

  const miss = traceBruteForce(volume(), ray([0.125, 0.125, 0.125], [1, 0, 0], { maxSteps: 1 }));
  assert.deepEqual(miss, {
    kind: 'Miss', distance: 4, normal: [0, 0, 0], cell: null, materialId: null, materialSource: null,
    owner: null, cellId: null, sourceRevision: null, sourceGeneration: null, transformGeneration: null, originEpoch: null,
  });
});

test('unknown cells and unknown crop exterior stop without inventing a surface', () => {
  const unknownCell = traceBruteForce(volume({ cells: [-1], coverage: 'partial', exteriorCoverage: 'Unknown' }),
    ray([0.125, 0.125, 0.125], [1, 0, 0]));
  assert.deepEqual([unknownCell.kind, unknownCell.distance, unknownCell.cell, unknownCell.cellId], ['Unknown', 0, [0, 0, 0], 'cell-0']);

  const outside = traceBruteForce(volume({ coverage: 'partial', exteriorCoverage: 'Unknown' }), ray([-1, 0.125, 0.125], [1, 0, 0]));
  assert.deepEqual([outside.kind, outside.distance, outside.cell, outside.cellId, outside.owner], ['Unknown', 0, null, null, 'owner-7']);

  const exit = traceBruteForce(volume({ coverage: 'partial', exteriorCoverage: 'Unknown' }), ray([0.125, 0.125, 0.125], [1, 0, 0]));
  assert.deepEqual([exit.kind, exit.distance, exit.normal, exit.cell], ['Unknown', 0.125, [0, 0, 0], null]);

  const budget = traceBruteForce(volume({ size: [2, 1, 1], cells: [0, 0], coverage: 'partial', exteriorCoverage: 'Unknown' }),
    ray([0.125, 0.125, 0.125], [1, 0, 0], { maxSteps: 1 }));
  assert.deepEqual([budget.kind, budget.distance, budget.cell], ['BudgetExceeded', 0.125, [1, 0, 0]]);
});
