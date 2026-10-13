import assert from "node:assert/strict";
import test from "node:test";
import { fixture, fixtures, splitFixture, type Axis, type Cell, type Fixture } from "../src/fixtures.js";
import {worldPoint} from "../src/geometry.js";

const CELL_SIZES = [0.125, 0.25] as const;
const EXPECTED: Readonly<Record<string, { bounds: Cell; count: number }>> = {
  box: { bounds: [4, 4, 4], count: 64 },
  "perforated-wall": { bounds: [5, 5, 1], count: 23 },
  "cave-overhang": { bounds: [5, 4, 4], count: 64 },
  "fine-stair": { bounds: [6, 4, 2], count: 30 },
  "one-voxel-bridge": { bounds: [5, 2, 2], count: 17 },
  "rotated-body": { bounds: [3, 2, 1], count: 6 },
};

const cellKey = ([x, y, z]: Cell): string => `${x},${y},${z}`;
const hasCell = (source: Fixture, cell: Cell): boolean => source.cells.some((candidate) => cellKey(candidate) === cellKey(cell));

function worldCenter(source: Fixture, cell: Cell): Cell {
  const p=worldPoint(source,{x:(cell[0]+.5)*source.cellSize,y:(cell[1]+.5)*source.cellSize,z:(cell[2]+.5)*source.cellSize});
  return [p.x,p.y,p.z].map(n=>Number(n.toFixed(12))) as unknown as Cell;
}

test("canonical fixtures have analytic occupancy and bounds at both voxel sizes", () => {
  const all = fixtures();
  assert.equal(all.length, Object.keys(EXPECTED).length * CELL_SIZES.length);
  assert.deepEqual([...new Set(all.map(({ id }) => id))].sort(), Object.keys(EXPECTED).sort());

  for (const cellSize of CELL_SIZES) {
    for (const [id, expected] of Object.entries(EXPECTED)) {
      const source = fixture(id, cellSize);
      assert.equal(source.cellSize, cellSize);
      assert.deepEqual(source.bounds, expected.bounds, `${id} bounds at ${cellSize} m`);
      assert.equal(source.cells.length, expected.count, `${id} occupancy at ${cellSize} m`);
      assert.equal(new Set(source.cells.map(cellKey)).size, source.cells.length, `${id} has unique cells`);
      assert.equal(source.density, 2_400);
      for (const [x, y, z] of source.cells) {
        assert.ok(Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z));
        assert.ok(x >= 0 && x < source.bounds[0]);
        assert.ok(y >= 0 && y < source.bounds[1]);
        assert.ok(z >= 0 && z < source.bounds[2]);
      }
    }
  }
  for (const id of Object.keys(EXPECTED)) {
    assert.deepEqual(fixture(id, 0.125).cells, fixture(id, 0.25).cells, `${id} occupancy is profile-independent`);
  }
});

test("wall openings and cave voids are air inside known bounds", () => {
  for (const cellSize of CELL_SIZES) {
    const wall = fixture("perforated-wall", cellSize);
    assert.equal(hasCell(wall, [1, 2, 0]), false);
    assert.equal(hasCell(wall, [3, 2, 0]), false);
    assert.equal(hasCell(wall, [2, 2, 0]), true);

    const cave = fixture("cave-overhang", cellSize);
    assert.equal(hasCell(cave, [0, 1, 1]), false, "cave entrance is open at the boundary");
    assert.equal(hasCell(cave, [2, 2, 2]), false, "cave interior is empty");
    assert.equal(hasCell(cave, [2, 3, 2]), true, "the overhang roof remains solid");
    assert.equal(hasCell(cave, [2, 0, 2]), true, "the floor remains solid");
  }
});

test("one voxel is the sole face-connected bridge between two blocks", () => {
  for (const cellSize of CELL_SIZES) {
    const source = fixture("one-voxel-bridge", cellSize);
    assert.equal(hasCell(source, [2, 0, 0]), true);
    assert.equal(source.cells.filter(([x]) => x === 2).length, 1);
    assert.equal(faceConnected(source.cells), true);
    assert.equal(faceConnected(source.cells.filter((cell) => cellKey(cell) !== "2,0,0")), false);
  }
});

function faceConnected(cells: readonly Cell[]): boolean {
  const remaining = new Set(cells.map(cellKey));
  const first = cells[0];
  if (!first) return false;
  const visited = new Set<string>([cellKey(first)]);
  const pending: Cell[] = [first];
  while (pending.length > 0) {
    const [x, y, z] = pending.pop()!;
    for (const neighbor of [[x - 1, y, z], [x + 1, y, z], [x, y - 1, z], [x, y + 1, z], [x, y, z - 1], [x, y, z + 1]] as const) {
      const key = cellKey(neighbor);
      if (remaining.has(key) && !visited.has(key)) {
        visited.add(key);
        pending.push(neighbor);
      }
    }
  }
  return visited.size === cells.length;
}

test("X, Y, and Z box splits are touching, bounded neighbors in the same coordinate frame", () => {
  for (const cellSize of CELL_SIZES) {
    const source = fixture("box", cellSize);
    for (const axis of ["x", "y", "z"] as const satisfies readonly Axis[]) {
      const index = axis === "x" ? 0 : axis === "y" ? 1 : 2;
      const [left, right] = splitFixture(source, axis);
      assert.equal(left.cells.length + right.cells.length, source.cells.length);
      assert.equal(left.cells.length, 32);
      assert.equal(right.cells.length, 32);
      assert.equal(left.bounds[index], 2);
      assert.equal(right.bounds[index], 2);
      assert.equal(right.origin[index], source.origin[index] + 2 * cellSize);

      const leftSeamCell = [0, 0, 0] as [number, number, number];
      const rightSeamCell = [0, 0, 0] as [number, number, number];
      leftSeamCell[index] = left.bounds[index]! - 1;
      assert.equal(hasCell(left, leftSeamCell), true);
      assert.equal(hasCell(right, rightSeamCell), true);
      const leftCenter = worldCenter(left, leftSeamCell);
      const rightCenter = worldCenter(right, rightSeamCell);
      assert.equal(rightCenter[index]! - leftCenter[index]!, cellSize);
      for (let other = 0; other < 3; other += 1) {
        if (other !== index) assert.equal(rightCenter[other], leftCenter[other]);
      }
    }
  }
});

test("splitting preserves every fixture's occupied centers and rejects unsupported inputs", () => {
  for (const source of fixtures()) {
    for (const axis of ["x", "y", "z"] as const) {
      const index = axis === "x" ? 0 : axis === "y" ? 1 : 2;
      if (source.bounds[index] < 2) {
        assert.throws(() => splitFixture(source, axis), RangeError);
        continue;
      }
      const pieces = splitFixture(source, axis);
      assert.equal(pieces[0].bounds[index]! + pieces[1].bounds[index]!, source.bounds[index]);
      const originalCenters = source.cells.map((cell) => cellKey(worldCenter(source, cell))).sort();
      const splitCenters = pieces.flatMap((piece) => piece.cells.map((cell) => cellKey(worldCenter(piece, cell)))).sort();
      assert.deepEqual(splitCenters, originalCenters, `${source.id} ${axis} split at ${source.cellSize} m`);
    }
  }

  assert.throws(() => splitFixture(fixture("box", 0.125), "invalid" as Axis), RangeError);
});

test("rotated-body profile carries a normalized non-identity quaternion and translated origin", () => {
  for (const cellSize of CELL_SIZES) {
    const source = fixture("rotated-body", cellSize);
    const { x, y, z, w } = source.rotation;
    assert.notDeepEqual(source.rotation, { x: 0, y: 0, z: 0, w: 1 });
    assert.ok(Math.abs(x * x + y * y + z * z + w * w - 1) < 1e-12);
    assert.deepEqual(worldCenter(source, [0, 0, 0]), [-1 + cellSize / 2, cellSize / 2, 2 - cellSize / 2]);
  }
});

test("fixture lookup and impossible seam splits fail clearly", () => {
  assert.throws(() => fixture("not-a-fixture", 0.125), RangeError);
  assert.throws(() => fixture("box", 0.2), RangeError);
  assert.throws(() => splitFixture(fixture("perforated-wall", 0.125), "z"), RangeError);
});
