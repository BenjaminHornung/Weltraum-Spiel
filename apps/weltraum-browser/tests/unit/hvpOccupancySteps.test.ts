import { describe, expect, it } from "vitest";
import {
  meshHvpOccupancy,
  meshHvpOccupancySteps,
  type HvpMeshBudgets,
  type HvpMeshOccupancy
} from "../../src/hvp/hvpCoastMesher";

type SolidCell = readonly [x: number, y: number, z: number, slot: number];

const budgets: HvpMeshBudgets = {
  maxVisitedCells: 100_000,
  maxQuads: 100_000,
  maxVertices: 400_000,
  maxIndices: 600_000
};

const makeOccupancy = (
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  cells: readonly SolidCell[] = [],
  originMeters = { x: 0, y: 0, z: 0 },
  neighbors: Pick<HvpMeshOccupancy, "ghostSlotAt" | "silentSolidAt"> = {}
): HvpMeshOccupancy => {
  const slots = new Map(cells.map(([x, y, z, slot]) => [`${x},${y},${z}`, slot] as const));
  return {
    sizeX,
    sizeY,
    sizeZ,
    cellMeters: 1,
    originMeters,
    slotAt: (x, y, z) => slots.get(`${x},${y},${z}`) ?? 0,
    ...neighbors
  };
};

const drainSteps = (
  occupancy: HvpMeshOccupancy,
  limits: HvpMeshBudgets = budgets,
  ao = false
) => {
  const cursor = meshHvpOccupancySteps(occupancy, limits, "step-source", "step-v1", { ao });
  const labels: string[] = [];
  let step = cursor.next();
  while (!step.done) {
    expect(typeof step.value).toBe("string");
    expect(step.value.length).toBeLessThanOrEqual(32);
    labels.push(step.value);
    step = cursor.next();
  }
  return { mesh: step.value, labels };
};

const expectParity = (
  occupancy: HvpMeshOccupancy,
  limits: HvpMeshBudgets = budgets,
  ao = false
) => {
  const synchronous = meshHvpOccupancy(occupancy, limits, "step-source", "step-v1", { ao });
  const bounded = drainSteps(occupancy, limits, ao);
  expect(bounded.mesh).toEqual(synchronous);
  return { synchronous, labels: bounded.labels };
};

const thrown = (run: () => unknown): unknown => {
  try {
    return run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected an error");
};

const thrownBySteps = (occupancy: HvpMeshOccupancy, limits: HvpMeshBudgets): unknown =>
  thrown(() => drainSteps(occupancy, limits));

describe("owned HVP occupancy mesh steps", () => {
  it("keeps mixed-material negative-world geometry, ranges, bounds and metadata", () => {
    const occupancy = makeOccupancy(2, 1, 1, [[0, 0, 0, 1], [1, 0, 0, 2]], { x: -2, y: -0.5, z: -3 });
    const { synchronous } = expectParity(occupancy);
    expect(synchronous.unitFaceCount).toBe(10);
    expect(synchronous.faceCount).toBe(10);
    expect(synchronous.outerFaceCount).toBe(10);
    expect(synchronous.cavityFaceCount).toBe(0);
    expect(synchronous.positions).toHaveLength(120);
    expect(synchronous.normals).toHaveLength(120);
    expect(synchronous.indices).toHaveLength(60);
    expect(synchronous.materialRanges).toEqual(Array.from({ length: 10 }, (_, index) => ({
      slot: index % 2 === 0 ? 1 : 2,
      startIndex: index * 6,
      indexCount: 6
    })));
    expect(synchronous.boundsMeters).toEqual({
      min: { x: -2, y: -0.5, z: -3 },
      max: { x: 0, y: 0.5, z: -2 }
    });
    expect(synchronous.tempEstimateBytes).toBe(3_440);
  });

  it("preserves AO elbow output and hand-derived corner shading", () => {
    const occupancy = makeOccupancy(2, 2, 1, [
      [0, 0, 0, 1],
      [0, 1, 0, 1],
      [1, 0, 0, 1]
    ]);
    const { synchronous } = expectParity(occupancy, budgets, true);
    expect(synchronous.unitFaceCount).toBe(14);
    expect(synchronous.colors).not.toBeNull();

    const shaded = Array.from({ length: synchronous.positions.length / 3 }, (_, vertex) => vertex)
      .filter((vertex) => synchronous.normals[vertex * 3] === 1
        && synchronous.positions[vertex * 3] === 1
        && synchronous.positions[vertex * 3 + 1] === 1
        && synchronous.positions[vertex * 3 + 2] === 0)
      .map((vertex) => synchronous.colors![vertex * 3]!);
    expect(shaded).toEqual([Math.fround(0.8)]);
  });

  it("counts enclosed cavity faces without borrowing the tiny-cell oracle metadata", () => {
    const cells: SolidCell[] = [];
    for (let y = 0; y < 3; y += 1) {
      for (let z = 0; z < 3; z += 1) {
        for (let x = 0; x < 3; x += 1) {
          if (x !== 1 || y !== 1 || z !== 1) {
            cells.push([x, y, z, 1]);
          }
        }
      }
    }
    const { synchronous } = expectParity(makeOccupancy(3, 3, 3, cells));
    expect(synchronous.unitFaceCount).toBe(60);
    expect(synchronous.faceCount).toBe(12);
    expect(synchronous.outerFaceCount).toBe(12);
    expect(synchronous.cavityFaceCount).toBe(0);
  });

  it("preserves empty output and ghost/silent neighbor culling", () => {
    const empty = expectParity(makeOccupancy(2, 2, 2)).synchronous;
    expect(empty.unitFaceCount).toBe(0);
    expect(empty.faceCount).toBe(0);
    expect(empty.boundsMeters).toEqual({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } });
    expect(empty.materialRanges).toEqual([]);
    expect(empty.tempEstimateBytes).toBe(0);

    const ghost = expectParity(makeOccupancy(1, 1, 1, [[0, 0, 0, 1]], { x: 0, y: 0, z: 0 }, {
      ghostSlotAt: (x, y, z) => x === -1 && y === 0 && z === 0 ? 1 : 0
    })).synchronous;
    const silent = expectParity(makeOccupancy(2, 1, 1, [[0, 0, 0, 1]], { x: 0, y: 0, z: 0 }, {
      silentSolidAt: (x, y, z) => x === 1 && y === 0 && z === 0
    })).synchronous;
    expect(ghost.unitFaceCount).toBe(5);
    expect(silent.unitFaceCount).toBe(5);
  });

  it("batches sorting, large rectangle growth, deletion and final typed-array copies", () => {
    const cells: SolidCell[] = [];
    for (let z = 0; z < 129; z += 1) {
      for (let x = 0; x < 129; x += 1) {
        cells.push([x, 0, z, 1]);
      }
    }
    for (let z = 32; z < 96; z += 1) {
      for (let x = 150; x < 214; x += 1) {
        if ((x + z) % 2 === 0) {
          cells.push([x, 0, z, 2]);
        }
      }
    }
    const { synchronous, labels } = expectParity(makeOccupancy(214, 1, 129, cells));
    expect(synchronous.unitFaceCount).toBe(46_086);
    for (const stage of [
      "packed-sort-write",
      "greedy-column",
      "greedy-row",
      "greedy-delete",
      "mesh-copy-positions",
      "mesh-copy-indices"
    ]) {
      expect(labels).toContain(stage);
    }
  });

  it("yields through air scans in fixed 1024-cell batches and supports return cancellation", () => {
    const air = makeOccupancy(17, 17, 17);
    const { synchronous, labels } = expectParity(air);
    expect(synchronous.faceCount).toBe(0);
    expect(labels).toHaveLength(Math.floor((17 * 17 * 17) / 1024));
    expect(new Set(labels)).toEqual(new Set(["occupancy-scan"]));

    const cursor = meshHvpOccupancySteps(makeOccupancy(16, 16, 16), budgets, "cancel", "step-v1");
    const first = cursor.next();
    expect(first.done).toBe(false);
    expect(typeof first.value).toBe("string");
    const cancelled = cursor.return(undefined as never);
    expect(cancelled.done).toBe(true);
    expect(cursor.next().done).toBe(true);
  });

  it("matches synchronous budget errors before producing a mesh", () => {
    const single = makeOccupancy(1, 1, 1, [[0, 0, 0, 1]]);
    const cases: Array<[HvpMeshBudgets, string]> = [
      [{ ...budgets, maxVisitedCells: 0 }, "meshHvpOccupancy BudgetExceeded: 1 cells exceed 0"],
      [{ ...budgets, maxQuads: 5 }, "meshHvpOccupancy BudgetExceeded: 6 faces exceed 5"],
      [{ ...budgets, maxVertices: 23 }, "meshHvpOccupancy BudgetExceeded: 24 vertices / 36 indices over budget"]
    ];
    for (const [limits, message] of cases) {
      const syncError = thrown(() => meshHvpOccupancy(single, limits, "error", "step-v1")) as Error;
      const stepError = thrownBySteps(single, limits) as Error;
      expect(syncError.message).toBe(message);
      expect(stepError.message).toBe(syncError.message);
    }
  });

  it("preserves occupancy getter and proxy read order", () => {
    const trace = (reads: string[]): HvpMeshOccupancy => {
      const innerOrigin = new Proxy({ x: -1, y: 2, z: -3 }, {
        get(target, property, receiver) {
          reads.push(`origin.${String(property)}`);
          return Reflect.get(target, property, receiver);
        }
      });
      const source: HvpMeshOccupancy = {
        sizeX: 1,
        sizeY: 1,
        sizeZ: 1,
        cellMeters: 0.5,
        originMeters: innerOrigin,
        slotAt: () => 1,
        ghostSlotAt: (x, y, z) => x === 1 && y === 0 && z === 0 ? 1 : 0,
        silentSolidAt: () => false
      };
      return new Proxy(source, {
        get(target, property, receiver) {
          reads.push(String(property));
          return Reflect.get(target, property, receiver);
        }
      });
    };
    const syncReads: string[] = [];
    const stepReads: string[] = [];
    const synchronous = meshHvpOccupancy(trace(syncReads), budgets, "step-source", "step-v1", { ao: true });
    const bounded = drainSteps(trace(stepReads), budgets, true).mesh;
    expect(bounded).toEqual(synchronous);
    expect(stepReads).toEqual(syncReads);
  });
});
