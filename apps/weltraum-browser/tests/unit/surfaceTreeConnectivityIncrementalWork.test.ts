import { describe, expect, it } from "vitest";
import { createSurfaceRigidBodyWorld } from "../../src/surface-play/physics";
import { createHestiaUmbrellaTree } from "../../src/surface-play/vegetation/hestiaUmbrellaTree";
import {
  createSurfaceTreeCollisionBinding,
  raycastSurfaceTreeCollision
} from "../../src/surface-play/vegetation/surfaceTreeCollision";
import {
  decodeStructuralObject,
  deriveStructuralComponentClassification,
  encodeStructuralObject,
  type StructuralObject
} from "../../src/voxel/structural";
import {
  createSurfaceTreeRuntimeState,
  preflightSurfaceTreeFire,
  type SurfaceTreeRuntimeState
} from "../../src/surface-play/vegetation/surfaceTreeRuntime";
import { readStructuralConnectivityWork } from "../../src/voxel/structural/connectivityDiagnostics";

const originMeters = Object.freeze({ x: 64, y: 12.441, z: -32 });
const targetMeters = Object.freeze({ x: 58.0625, y: 11.5411, z: -41.9375 });
const direction = Object.freeze({
  x: targetMeters.x - originMeters.x,
  y: targetMeters.y - originMeters.y,
  z: targetMeters.z - originMeters.z
});
const connectivityBudgets = Object.freeze({
  maxVisitedCells: 8_192,
  maxComponents: 256,
  maxIndexedFacts: 8_192
});

const expectFreshClassificationParity = (object: StructuralObject): void => {
  const serialized = encodeStructuralObject(object);
  const reconstructed = decodeStructuralObject(serialized);
  expect(reconstructed).not.toBe(object);
  expect(encodeStructuralObject(reconstructed)).toBe(serialized);
  expect(reconstructed.commandEvidence).toEqual(object.commandEvidence);

  const indexed = deriveStructuralComponentClassification(object, connectivityBudgets);
  const fresh = deriveStructuralComponentClassification(reconstructed, connectivityBudgets);
  expect(fresh).toEqual(indexed);
  const occupiedCellCount = reconstructed.bricks.reduce((count, brick) => count + brick.cells.length, 0);
  expect(readStructuralConnectivityWork(reconstructed)).toMatchObject({
    mode: "Full",
    candidateCellCount: occupiedCellCount,
    fullVoxelTraversalCount: occupiedCellCount,
    coordinateNeighborProbeCount: occupiedCellCount * 6,
    indexedActiveCellVisitCount: 0,
    cachedAdjacencyProbeCount: 0
  });
};

const createState = (): Readonly<SurfaceTreeRuntimeState> =>
  createSurfaceTreeRuntimeState(
    createHestiaUmbrellaTree({
      instanceId: "hestia.surface-play.umbrella.phase2",
      seed: "hestia.surface-play.umbrella.phase2-seed",
      rootQuantum: { x: 464, y: 72, z: -336 }
    }),
    createSurfaceRigidBodyWorld({
      simulationTick: 0,
      gravityMetersPerSecondSquared: 9.81,
      terrainColliders: []
    })
  );

const fireRealRay = (
  state: Readonly<SurfaceTreeRuntimeState>,
  ordinal: number
) => {
  const raycast = raycastSurfaceTreeCollision(state.collision, {
    binding: createSurfaceTreeCollisionBinding(state.collision),
    originMeters,
    direction,
    maximumDistanceMeters: 30
  });
  expect(raycast.status).toBe("Resolved");
  if (raycast.status !== "Resolved" || raycast.kind !== "Hit") {
    throw new Error("Pinned real Tree ray did not resolve to a hit.");
  }
  const preflight = preflightSurfaceTreeFire(state, {
    fireCommandId: `fire:tree-connectivity-work:${ordinal}`,
    hit: raycast.hit,
    simulationTick: ordinal
  });
  expect(preflight.status).toBe("Ready");
  if (preflight.status !== "Ready") {
    throw new Error("Pinned real Tree fire preflight was rejected.");
  }
  return preflight;
};

describe("Surface Tree incremental connectivity work", () => {
  it("reports indexed global work even when the deletion frontier is zero", () => {
    const first = fireRealRay(createState(), 1);
    const firstWork = readStructuralConnectivityWork(first.state.authority.object);
    expect(firstWork).toMatchObject({
      mode: "DeletionFrontier",
      rebuiltBrickCount: 2,
      removedCellCount: 50,
      fullVoxelTraversalCount: 0,
      frontierVisitedCellCount: 0,
      coordinateNeighborProbeCount: 300
    });
    expect(firstWork).toMatchObject({
      indexedActiveCellVisitCount: 7_983,
      cachedAdjacencyProbeCount: 14_218
    });
    expect((firstWork?.reusedBrickCount ?? -1) + (firstWork?.rebuiltBrickCount ?? -1))
      .toBe(firstWork?.sourceBrickCount);
    expectFreshClassificationParity(first.state.authority.object);

    const firstAuthorityBeforeSecondHit = encodeStructuralObject(first.state.authority.object);
    const second = fireRealRay(first.state, 2);
    expect(second.supportResult).toBe("Detached");
    const damageObject = second.state.bodySources[0]?.sourceObject;
    expect(damageObject).toBeDefined();
    if (damageObject === undefined) {
      throw new Error("Detaching hit did not retain its immutable damage authority.");
    }
    const secondWork = readStructuralConnectivityWork(damageObject);
    expect(secondWork).toMatchObject({
      mode: "DeletionFrontier",
      rebuiltBrickCount: 4,
      removedCellCount: 82,
      fullVoxelTraversalCount: 0,
      frontierVisitedCellCount: 0,
      coordinateNeighborProbeCount: 492
    });
    expect(secondWork).toMatchObject({
      indexedActiveCellVisitCount: 7_737,
      cachedAdjacencyProbeCount: 14_358
    });
    expect((secondWork?.reusedBrickCount ?? -1) + (secondWork?.rebuiltBrickCount ?? -1))
      .toBe(secondWork?.sourceBrickCount);

    expectFreshClassificationParity(damageObject);
    expectFreshClassificationParity(second.state.authority.object);
    expect(readStructuralConnectivityWork(second.state.authority.object)).toMatchObject({
      mode: "DeletionFrontier",
      fullVoxelTraversalCount: 0,
      frontierVisitedCellCount: 0,
      coordinateNeighborProbeCount: 0,
      indexedActiveCellVisitCount: 1_104,
      cachedAdjacencyProbeCount: 0
    });
    expect(encodeStructuralObject(first.state.authority.object)).toBe(firstAuthorityBeforeSecondHit);
  }, 120_000);
});
