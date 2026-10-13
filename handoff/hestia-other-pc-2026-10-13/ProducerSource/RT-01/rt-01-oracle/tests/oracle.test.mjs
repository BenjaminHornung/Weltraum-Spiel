import assert from 'node:assert/strict';
import test from 'node:test';
import { traceDda } from '../src/dda.mts';
import { traceBruteForce } from '../src/bruteForce.mts';
import { analyticalVolume, bindSource, cellIndex, makeSnapshots, deterministicRays, setCell } from '../fixtures.mjs';
import { assertCurrent, assertExclusiveOwners, validateVolume } from '../src/validate.mts';

const volume = () => { const v = analyticalVolume(0.125, [3, 3, 3], 'edge'); v.origin = [0, 0, 0]; return bindSource(v); };
const ray = (origin = [0, 0.0625, 0.0625], direction = [1, 0, 0], maxDistance = 1, maxSteps = 100) =>
  ({ id: 'edge-ray', origin, direction, maxDistance, maxSteps });
function compare(actual, expected) {
  const { distance: a, normal: an, ...ar } = actual;
  const { distance: b, normal: bn, ...br } = expected;
  assert.deepEqual(ar, br);
  assert.ok(Math.abs(a - b) <= 1e-9, `${a} != ${b}`);
  an.forEach((n, i) => assert.ok(Math.abs(n - bn[i]) <= 1e-9, `${an} != ${bn}`));
}
function edge(v, r, kind, distance, normal, cell = null, material = null) {
  for (const trace of [traceDda, traceBruteForce]) {
    const result = trace(v, r);
    assert.equal(result.kind, kind);
    assert.ok(Math.abs(result.distance - distance) < 1e-9);
    assert.deepEqual(result.normal.map(n => n || 0), normal);
    assert.deepEqual(result.cell, cell);
    assert.equal(result.materialId, material);
    if (kind === 'Hit') {
      assert.equal(result.owner, v.binding.owner);
      assert.equal(result.materialSource, v.materials.find(m => m.id === material).source);
      assert.equal(result.cellId, v.cellIds[cellIndex(v, cell)]);
    }
  }
}

test('separate explicit faces, start-inside, zero axes and exclusive distance end', () => {
  const v = volume(); setCell(v, [1, 0, 0], 2);
  edge(v, ray(), 'Hit', 0.125, [-1, 0, 0], [1, 0, 0], 2);
  edge(v, ray([0.1875, 0.0625, 0.0625]), 'Hit', 0, [0, 0, 0], [1, 0, 0], 2);
  edge(v, ray([0.25, 0.0625, 0.0625], [-1, 0, 0]), 'Hit', 0, [0, 0, 0], [1, 0, 0], 2);
  edge(v, ray([0, 0.0625, 0.0625], [1, 0, 0], 0.125), 'Miss', 0.125, [0, 0, 0]);
  edge(v, ray([0, 0.375, 0.0625]), 'Miss', 1, [0, 0, 0]);
  edge(v, ray([-0.25, 0.0625, 0.0625]), 'Hit', 0.375, [-1, 0, 0], [1, 0, 0], 2);
});

test('simultaneous 2/3-axis crossings ignore zero-length neighbor contacts, X then Y then Z normal', () => {
  const v = volume(); setCell(v, [1, 1, 1], 3); setCell(v, [1, 0, 0], 2);
  const s = 1 / Math.sqrt(3);
  edge(v, ray([0.0625, 0.0625, 0.0625], [s, s, s]), 'Hit', Math.sqrt(3) * 0.0625, [-1, 0, 0], [1, 1, 1], 3);
  edge(v, ray([-0.125, -0.125, -0.125], [s, s, s]), 'Hit', Math.sqrt(3) * 0.25, [-1, 0, 0], [1, 1, 1], 3);
  const two = volume(); setCell(two, [0, 1, 1], 1);
  edge(two, ray([0.0625, 0.0625, 0.0625], [0, 1 / Math.sqrt(2), 1 / Math.sqrt(2)]),
    'Hit', Math.sqrt(2) * 0.0625, [0, -1, 0], [0, 1, 1], 1);
});

test('Unknown and BudgetExceeded are independent outcomes, including final empty cell', () => {
  const v = volume(); setCell(v, [1, 0, 0], 2);
  edge(v, ray([0, 0.0625, 0.0625], [1, 0, 0], 1, 1), 'BudgetExceeded', 0.125, [-1, 0, 0], [1, 0, 0]);
  edge(v, ray([0, 0.0625, 0.0625], [1, 0, 0], 1, 0), 'BudgetExceeded', 0, [0, 0, 0], [0, 0, 0]);
  v.coverage = 'partial'; setCell(v, [1, 0, 0], -1);
  edge(v, ray(), 'Unknown', 0.125, [-1, 0, 0], [1, 0, 0]);
  const empty = volume();
  edge(empty, ray([0, 0.0625, 0.0625], [1, 0, 0], 1, 3), 'Miss', 1, [0, 0, 0]);
  empty.exteriorCoverage = 'Unknown'; bindSource(empty);
  edge(empty, ray([-0.125, 0.0625, 0.0625]), 'Unknown', 0, [0, 0, 0]);
  edge(empty, ray(), 'Unknown', 0.375, [0, 0, 0]);
});

test('frame rotation transforms distance and normal without changing source bytes', () => {
  const v = volume(); setCell(v, [1, 0, 0], 1);
  const digest = v.binding.sourceDigest;
  v.rotation = [0, 0, 1, 0, 1, 0, -1, 0, 0]; v.translation = [1, 2, 3]; v.binding.transformGeneration++;
  assert.equal(v.binding.sourceDigest, digest);
  edge(v, ray([1.0625, 2.0625, 3.125], [0, 0, -1]), 'Hit', 0.25, [0, 0, 1], [1, 0, 0], 1);
});

test('1000 unique deterministic rays agree with independent exhaustive AABB oracle', () => {
  const { snapshots } = makeSnapshots();
  const entries = deterministicRays(snapshots);
  assert.equal(entries.length, 1000);
  assert.deepEqual(entries, deterministicRays(snapshots));
  assert.equal(new Set(entries.map(({ ray: r }) => JSON.stringify([r.origin, r.direction, r.maxDistance, r.maxSteps]))).size, 1000);
  for (const { volumeId, ray: r } of entries) {
    const v = snapshots.find(s => s.id === volumeId);
    compare(traceDda(v, r), traceBruteForce(v, r));
  }
});

test('cut, exclusive transfer, rotation, missing neighbor and origin/stale generation negatives', () => {
  const { snapshots } = makeSnapshots();
  const [before, cut, terrain, fragment, rotated, shifted, coarse, missing] = snapshots;
  assertExclusiveOwners([terrain, fragment]);
  assert.throws(() => assertExclusiveOwners([cut, fragment]), /duplicate/);
  assert.equal(before.cells[cellIndex(before, [5, 1, 1])], 2);
  assert.equal(cut.cells[cellIndex(cut, [5, 1, 1])], 0);
  assert.equal(terrain.cells[cellIndex(terrain, [16, 1, 1])], 0);
  assert.equal(fragment.cellIds[0], before.cellIds[cellIndex(before, [16, 1, 1])]);
  assert.equal(rotated.binding.sourceDigest, fragment.binding.sourceDigest);
  assert.notEqual(rotated.binding.transformGeneration, fragment.binding.transformGeneration);
  assert.throws(() => assertCurrent(before.binding, cut.binding), /Stale/);
  assert.throws(() => assertCurrent(fragment.binding, rotated.binding), /Stale/);
  assert.throws(() => assertCurrent(before.binding, shifted.binding), /Stale/);
  for (const key of Object.keys(before.binding)) {
    const changed = structuredClone(before.binding);
    changed[key] = typeof changed[key] === 'number' ? changed[key] + 1 : `${changed[key]}-changed`;
    assert.throws(() => assertCurrent(before.binding, changed), /Stale/, key);
  }
  const r = ray([-2, -0.3125, -0.3125], [1, 0, 0]);
  const initial = traceDda(before, r);
  const moved = traceDda(shifted, { ...r, origin: r.origin.map((n, a) => n + shifted.translation[a]) });
  assert.equal(moved.kind, initial.kind); assert.equal(moved.cellId, initial.cellId); assert.equal(moved.distance, initial.distance);
  const seam = ray([-0.0625, -0.3125, -0.3125], [1, 0, 0]);
  assert.equal(traceDda(before, seam).kind, 'Hit');
  assert.equal(traceDda(missing, seam).kind, 'Unknown');
  assert.equal(coarse.cellMeters, 0.25);
});

test('invalid contracts fail closed without authority mutation', () => {
  const v = volume(); const initial = JSON.stringify(v);
  for (const r of [ray([NaN, 0, 0]), ray([0, 0, 0], [0, 0, 0]), ray([0, 0, 0], [1, 0, 0], 0), ray([0, 0, 0], [1, 0, 0], 1, -1)]) {
    assert.throws(() => traceDda(v, r)); assert.throws(() => traceBruteForce(v, r));
  }
  const bad = structuredClone(v); bad.cells[0] = 255;
  assert.throws(() => validateVolume(bad), /material/);
  const badFrame = structuredClone(v); badFrame.rotation[0] = 2;
  assert.throws(() => validateVolume(badFrame), /orthonormal/);
  traceDda(v, ray()); traceBruteForce(v, ray());
  assert.equal(JSON.stringify(v), initial);
});

test('review regressions: sub-tolerance face slivers and unknown exterior distance end', () => {
  const v = volume(); setCell(v, [1, 0, 0], 2);
  edge(v, ray([0.125 - 1e-12, 0.0625, 0.0625]), 'Hit', 1e-12, [-1, 0, 0], [1, 0, 0], 2);
  // A representational roundoff face is direction-owned, rather than a real geometric sliver.
  edge(v, ray([0.125 - 1e-16, 0.0625, 0.0625]), 'Hit', 0, [0, 0, 0], [1, 0, 0], 2);
  const empty = volume(); empty.exteriorCoverage = 'Unknown'; bindSource(empty);
  edge(empty, ray([0, 0.0625, 0.0625], [1, 0, 0], 0.375 + 1e-12), 'Miss', 0.375 + 1e-12, [0, 0, 0]);
  edge(empty, ray([0, 0.0625, 0.0625], [1, 0, 0], 0.375 + 1e-8), 'Unknown', 0.375, [0, 0, 0]);
  const exterior = volume(); exterior.exteriorCoverage = 'Unknown'; setCell(exterior, [0, 0, 0], 1);
  edge(exterior, ray([-1e-16, 0.0625, 0.0625]), 'Hit', 0, [0, 0, 0], [0, 0, 0], 1);
  edge(exterior, ray([-1e-16, 0.0625, 0.0625], [0, 1, 0]), 'Hit', 0, [0, 0, 0], [0, 0, 0], 1);
  edge(exterior, ray([0.375 - 1e-16, 0.0625, 0.0625], [0, 1, 0]), 'Unknown', 0, [0, 0, 0]);
});
