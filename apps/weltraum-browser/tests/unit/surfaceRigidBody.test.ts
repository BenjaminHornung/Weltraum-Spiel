import { describe, expect, it } from "vitest";
import {
  createSurfaceRigidBodyCandidate,
  deriveSurfaceRigidBodyColliderBoxes,
  deriveSurfaceRigidBodyColliderRepresentation,
  SURFACE_RIGID_BODY_COLLIDER_REPRESENTATION_SCHEMA_VERSION,
  type SurfaceRigidBodyOccupiedCell
} from "../../src/surface-play/physics";

const HASH = "fnv1a64-v1:0000000000000000";

const isolatedCells = (count: number): readonly SurfaceRigidBodyOccupiedCell[] =>
  Array.from({ length: count }, (_, index) => ({ x: index * 2, y: 0, z: 0 }));

const combCells = (): readonly SurfaceRigidBodyOccupiedCell[] =>
  Array.from({ length: 65 }, (_, pillar) =>
    Array.from({ length: 16 }, (_, y) => ({ x: pillar * 8, y, z: 0 }))
  ).flat();

const multiBroadphaseCells = (): readonly SurfaceRigidBodyOccupiedCell[] =>
  [0, 4_096].flatMap((clusterOriginX) =>
    Array.from({ length: 96 }, (_, index) => ({
      x: clusterOriginX + index * 2,
      y: 0,
      z: 0
    }))
  );

type ColliderCellBounds = Readonly<{
  minimumCell: Readonly<SurfaceRigidBodyOccupiedCell>;
  maximumCellExclusive: Readonly<SurfaceRigidBodyOccupiedCell>;
}>;

const cellKey = (cell: Readonly<SurfaceRigidBodyOccupiedCell>): string =>
  `${cell.x},${cell.y},${cell.z}`;

const expectExactDisjointCover = (
  occupiedCells: readonly SurfaceRigidBodyOccupiedCell[],
  colliders: readonly ColliderCellBounds[]
): void => {
  const expected = new Set(occupiedCells.map(cellKey));
  const covered = new Set<string>();
  for (const collider of colliders) {
    for (let z = collider.minimumCell.z; z < collider.maximumCellExclusive.z; z += 1) {
      for (let y = collider.minimumCell.y; y < collider.maximumCellExclusive.y; y += 1) {
        for (let x = collider.minimumCell.x; x < collider.maximumCellExclusive.x; x += 1) {
          const key = `${x},${y},${z}`;
          expect(expected.has(key), `extra narrowphase collider cell ${key}`).toBe(true);
          expect(covered.has(key), `overlapping narrowphase collider cell ${key}`).toBe(false);
          covered.add(key);
        }
      }
    }
  }
  expect(covered, "narrowphase colliders must exactly cover occupied cells").toEqual(expected);
};

describe("Surface rigid-body collider derivation", () => {
  it("merges a complete rectangular volume into one exact box", () => {
    const occupiedCells = [0, 1].flatMap((z) => [0, 1].flatMap((y) => [0, 1].map((x) => ({ x, y, z }))));
    const colliders = deriveSurfaceRigidBodyColliderBoxes({
      occupiedCells: [...occupiedCells].reverse(),
      cellSizeMeters: 0.125,
      centerOfMassMeters: { x: 0.125, y: 0.125, z: 0.125 }
    });

    expect(colliders).toEqual([expect.objectContaining({
      colliderIndex: 0,
      centerMeters: { x: 0, y: 0, z: 0 },
      halfExtentsMeters: { x: 0.125, y: 0.125, z: 0.125 },
      minimumCell: { x: 0, y: 0, z: 0 },
      maximumCellExclusive: { x: 2, y: 2, z: 2 }
    })]);
    const representation = deriveSurfaceRigidBodyColliderRepresentation({
      occupiedCells,
      cellSizeMeters: 0.125,
      centerOfMassMeters: { x: 0.125, y: 0.125, z: 0.125 },
      sourceObjectRevision: 1,
      sourceContentHash: HASH
    });
    expect(representation).toMatchObject({
      schemaVersion: SURFACE_RIGID_BODY_COLLIDER_REPRESENTATION_SCHEMA_VERSION,
      algorithmVersion: "surface-rigid-body-exact-axis-boxes-v3",
      kind: "Exact",
      level: 0,
      exactAxisOrder: "xyz"
    });
    expect(representation.workCounters).toEqual({
      occupiedCellCount: 8,
      axisOrderEvaluationCount: 1,
      containmentCellProbeBound: 32,
      broadphaseLevelCount: 0,
      coarseCellProjectionCount: 0,
      broadphaseMappingEntryCount: 1,
      broadphaseMappingPairProbeCount: 0,
      broadphaseDisjointnessValidationPairProbeCount: 0,
      narrowphaseDisjointnessValidationPairProbeCount: 0,
      broadphaseMappingValidationPairProbeCount: 1,
      narrowphaseColliderCount: 1,
      broadphaseColliderCount: 1
    });
    expect(Object.isFrozen(colliders)).toBe(true);
  });

  it("uses stable (z,y,x) seeds and rejects duplicate cells", () => {
    const colliders = deriveSurfaceRigidBodyColliderBoxes({
      occupiedCells: [{ x: 4, y: 2, z: 1 }, { x: 0, y: 1, z: 0 }],
      cellSizeMeters: 1,
      centerOfMassMeters: { x: 0, y: 0, z: 0 }
    });
    expect(colliders.map((collider) => collider.minimumCell)).toEqual([
      { x: 0, y: 1, z: 0 },
      { x: 4, y: 2, z: 1 }
    ]);
    expect(() => deriveSurfaceRigidBodyColliderBoxes({
      occupiedCells: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }],
      cellSizeMeters: 1,
      centerOfMassMeters: { x: 0, y: 0, z: 0 }
    })).toThrow(/duplicate/);
  });

  it("uses a deterministic conservative broadphase when every exact cover exceeds the body budget", () => {
    const occupiedCells = isolatedCells(65);
    const first = deriveSurfaceRigidBodyColliderBoxes({
      occupiedCells: [...occupiedCells].reverse(),
      cellSizeMeters: 1,
      centerOfMassMeters: { x: 0, y: 0, z: 0 }
    });
    const repeat = deriveSurfaceRigidBodyColliderBoxes({
      occupiedCells: [...occupiedCells.slice(17), ...occupiedCells.slice(0, 17)],
      cellSizeMeters: 1,
      centerOfMassMeters: { x: 0, y: 0, z: 0 }
    });

    expect(first).toEqual(repeat);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      minimumCell: { x: 0, y: 0, z: 0 },
      maximumCellExclusive: { x: 129, y: 1, z: 1 }
    });
    for (const cell of occupiedCells) {
      expect(first.some((box) =>
        cell.x >= box.minimumCell.x && cell.x < box.maximumCellExclusive.x
        && cell.y >= box.minimumCell.y && cell.y < box.maximumCellExclusive.y
        && cell.z >= box.minimumCell.z && cell.z < box.maximumCellExclusive.z
      )).toBe(true);
    }
  });

  it("binds exact and adaptive representations to distinct immutable identities and declared work", () => {
    const exact = deriveSurfaceRigidBodyColliderRepresentation({
      occupiedCells: isolatedCells(64),
      cellSizeMeters: 1,
      centerOfMassMeters: { x: 0, y: 0, z: 0 },
      sourceObjectRevision: 3,
      sourceContentHash: HASH
    });
    const adaptive = deriveSurfaceRigidBodyColliderRepresentation({
      occupiedCells: combCells(),
      cellSizeMeters: 0.125,
      centerOfMassMeters: { x: 32.0625, y: 1, z: 0.0625 },
      sourceObjectRevision: 3,
      sourceContentHash: HASH
    });
    const repeat = deriveSurfaceRigidBodyColliderRepresentation({
      occupiedCells: [...combCells()].reverse(),
      cellSizeMeters: 0.125,
      centerOfMassMeters: { x: 32.0625, y: 1, z: 0.0625 },
      sourceObjectRevision: 3,
      sourceContentHash: HASH
    });

    expect(exact.kind).toBe("Exact");
    expect(exact.level).toBe(0);
    expect(exact).toMatchObject({
      schemaVersion: 2,
      algorithmVersion: "surface-rigid-body-exact-axis-boxes-v3",
      exactAxisOrder: "xyz"
    });
    expect(adaptive.kind).toBe("AdaptiveSparse");
    expect(adaptive).toMatchObject({
      schemaVersion: 2,
      algorithmVersion: "surface-rigid-body-adaptive-sparse-v2",
      exactAxisOrder: null
    });
    expect(adaptive.level).toBeGreaterThan(0);
    expect(exact.maximumBroadphaseErrorMeters).toBe(0);
    expect(adaptive.maximumBroadphaseErrorMeters).toBeCloseTo(Math.sqrt(3) * 1.875, 15);
    expect(adaptive.representationHash).not.toBe(exact.representationHash);
    expect(adaptive).toEqual(repeat);
    expect(adaptive.narrowphaseColliders).toHaveLength(65);
    expect(adaptive.broadphaseColliders.length).toBeLessThanOrEqual(64);
    expect(adaptive.workCounters).toMatchObject({
      occupiedCellCount: 1_040,
      axisOrderEvaluationCount: 7,
      containmentCellProbeBound: 25_216,
      broadphaseLevelCount: 4,
      coarseCellProjectionCount: 1_040,
      broadphaseMappingEntryCount: 65,
      broadphaseMappingPairProbeCount: 65,
      broadphaseDisjointnessValidationPairProbeCount: 0,
      narrowphaseDisjointnessValidationPairProbeCount: 2_080,
      broadphaseMappingValidationPairProbeCount: 65,
      narrowphaseColliderCount: 65,
      broadphaseColliderCount: 1
    });
    expect(Object.isFrozen(adaptive)).toBe(true);
    expect(Object.isFrozen(adaptive.narrowphaseColliders)).toBe(true);
  });

  it("counts every multi-broadphase mapping and validation pair probe", () => {
    const occupiedCells = multiBroadphaseCells();
    const first = deriveSurfaceRigidBodyColliderRepresentation({
      occupiedCells: [...occupiedCells].reverse(),
      cellSizeMeters: 0.125,
      centerOfMassMeters: { x: 268, y: 0.0625, z: 0.0625 },
      sourceObjectRevision: 4,
      sourceContentHash: HASH
    });
    const repeat = deriveSurfaceRigidBodyColliderRepresentation({
      occupiedCells: [...occupiedCells.slice(73), ...occupiedCells.slice(0, 73)],
      cellSizeMeters: 0.125,
      centerOfMassMeters: { x: 268, y: 0.0625, z: 0.0625 },
      sourceObjectRevision: 4,
      sourceContentHash: HASH
    });

    expect(first).toEqual(repeat);
    expect(first.representationHash).toBe(repeat.representationHash);
    expect(first).toMatchObject({
      kind: "AdaptiveSparse",
      level: 7,
      exactAxisOrder: null
    });
    expect(first.broadphaseColliders).toHaveLength(2);
    expect(first.narrowphaseColliders).toHaveLength(192);
    expectExactDisjointCover(occupiedCells, first.narrowphaseColliders);
    expect(first.broadphaseNarrowphaseColliderIndices).toEqual([
      Array.from({ length: 96 }, (_, index) => index),
      Array.from({ length: 96 }, (_, index) => index + 96)
    ]);
    for (let broadphaseIndex = 0; broadphaseIndex < first.broadphaseColliders.length; broadphaseIndex += 1) {
      const broadphase = first.broadphaseColliders[broadphaseIndex];
      for (const narrowphaseIndex of first.broadphaseNarrowphaseColliderIndices[broadphaseIndex]) {
        const narrowphase = first.narrowphaseColliders[narrowphaseIndex];
        for (const axis of ["x", "y", "z"] as const) {
          expect(narrowphase.minimumCell[axis]).toBeGreaterThanOrEqual(broadphase.minimumCell[axis]);
          expect(narrowphase.maximumCellExclusive[axis]).toBeLessThanOrEqual(
            broadphase.maximumCellExclusive[axis]
          );
        }
      }
    }
    expect(first.workCounters).toMatchObject({
      occupiedCellCount: 192,
      axisOrderEvaluationCount: 7,
      containmentCellProbeBound: 4_864,
      broadphaseLevelCount: 7,
      coarseCellProjectionCount: 192,
      broadphaseMappingEntryCount: 192,
      broadphaseMappingPairProbeCount: 384,
      broadphaseDisjointnessValidationPairProbeCount: 1,
      narrowphaseDisjointnessValidationPairProbeCount: 18_336,
      broadphaseMappingValidationPairProbeCount: 384,
      narrowphaseColliderCount: 192,
      broadphaseColliderCount: 2
    });
  });

  it.each([
    Number.MIN_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER + 1,
    -(2 ** 52),
    2 ** 52,
    Number.MAX_SAFE_INTEGER - 1,
    Number.MAX_SAFE_INTEGER
  ])(
    "terminates at safe-integer coordinate endpoint %s without losing the half-cell center",
    (coordinate) => {
      const largeBaseMeters = coordinate * 0.125;
      const representation = deriveSurfaceRigidBodyColliderRepresentation({
        occupiedCells: [{ x: coordinate, y: coordinate, z: 0 }],
        cellSizeMeters: 0.125,
        centerOfMassMeters: { x: largeBaseMeters, y: largeBaseMeters, z: 0 },
        sourceObjectRevision: 1,
        sourceContentHash: HASH
      });
      const colliders = representation.broadphaseColliders;

      expect(colliders).toHaveLength(1);
      expect(representation.coordinateOriginCell).toEqual({
        x: coordinate,
        y: coordinate,
        z: 0
      });
      expect(colliders[0]).toMatchObject({
        centerMeters: { x: 0.0625, y: 0.0625, z: 0.0625 },
        minimumCell: { x: 0, y: 0, z: 0 },
        maximumCellExclusive: { x: 1, y: 1, z: 1 }
      });
      expect(Object.values(colliders[0].maximumCellExclusive).every(Number.isSafeInteger)).toBe(true);
    }
  );

  it("projects widely separated adaptive occupancy exactly once", () => {
    const occupiedCells = Array.from(
      { length: 65 },
      (_, index) => ({ x: index * 100_000_000_000, y: 0, z: 0 })
    );
    const representation = deriveSurfaceRigidBodyColliderRepresentation({
      occupiedCells,
      cellSizeMeters: 0.125,
      centerOfMassMeters: { x: 0, y: 0, z: 0 },
      sourceObjectRevision: 1,
      sourceContentHash: HASH
    });

    expect(representation.kind).toBe("AdaptiveSparse");
    expect(representation.workCounters).toMatchObject({
      occupiedCellCount: 65,
      axisOrderEvaluationCount: 7,
      containmentCellProbeBound: 1_816,
      coarseCellProjectionCount: 65
    });
    expect(representation.workCounters.broadphaseLevelCount).toBeLessThanOrEqual(52);
    expect(representation.broadphaseColliders.length).toBeLessThanOrEqual(64);
  });

  it("creates a complete immutable candidate with an N+1 activation tick", () => {
    const candidate = createSurfaceRigidBodyCandidate({
      bodyId: "body:tree:1",
      componentId: "component:crown:1",
      objectId: "object:tree:1",
      sourceObjectRevision: 6,
      sourceContentHash: HASH,
      occupiedCells: isolatedCells(64),
      cellSizeMeters: 0.125,
      massKg: 12,
      centerOfMassMeters: { x: 0, y: 0, z: 0 },
      inertiaTensorKgMetersSquared: { xx: 2, yy: 3, zz: 4, xy: 0, xz: 0, yz: 0 },
      colliderRevision: 6,
      detachedAtSimulationTick: 42
    });

    expect(candidate.colliders).toHaveLength(64);
    expect(candidate.activationSimulationTick).toBe(43);
    expect(candidate.inverseMassPerKg).toBeCloseTo(1 / 12, 15);
    expect(candidate.inverseInertiaTensorPerKgMetersSquared).toEqual({
      xx: 0.5,
      yy: 1 / 3,
      zz: 0.25,
      xy: 0,
      xz: 0,
      yz: 0
    });
    expect(Object.isFrozen(candidate)).toBe(true);
  });
});
