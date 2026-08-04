import { createWeaponMountPose } from "../../src/combat";
import { describe, expect, it } from "vitest";
import { MICROVOXEL_BASE_QUANTUM_METERS, hashAdaptiveCanonical } from "../../src/voxel/adaptive";
import { globalQuantumForStructuralCell, type StructuralComponent } from "../../src/voxel/structural";
import {
  admitSurfaceRigidBodyBatch,
  createSurfaceRigidBodyCandidate,
  createSurfaceRigidBodyWorld,
  type SurfaceRigidBodyOccupiedCell
} from "../../src/surface-play/physics";
import { createSurfacePlayerSnapshot, createSurfacePlayIdentity } from "../../src/surface-play/contracts";
import {
  createSurfaceCombatRuntimeState,
  executeSurfaceCombatFire
} from "../../src/surface-play/combat";
import { quantizeSurfaceHitCoordinateMeters } from "../../src/surface-play/surfacePlayQuantization";
import {
  resolveHestiaSurfacePlayWorld,
  revalidateHestiaSurfacePlayWorld
} from "../../src/surface-play/surfacePlayBootstrap";
import { createHestiaSurfacePlayAuthorityInput } from "../../src/surface-play/surfacePlayConfig";
import { createSurfaceRegionVoxelAuthority } from "../../src/surface-play/voxel-edit";
import { createHestiaUmbrellaTree } from "../../src/surface-play/vegetation/hestiaUmbrellaTree";
import {
  SURFACE_TREE_CANONICAL_HIT_SCHEMA_VERSION,
  createSurfaceTreeAuthority,
  deriveSurfaceTreeDetachedComponents,
  previewSurfaceTreeHit
} from "../../src/surface-play/vegetation/surfaceTreeAuthority";
import {
  createSurfaceTreeCollisionBinding,
  raycastSurfaceTreeCollision
} from "../../src/surface-play/vegetation/surfaceTreeCollision";
import {
  createSurfaceTreeRuntimeStateFromAuthority,
  preflightSurfaceTreeFire,
  type SurfaceTreeRuntimeState
} from "../../src/surface-play/vegetation/surfaceTreeRuntime";

type Axis = "x" | "y" | "z";
type Cell = Readonly<SurfaceRigidBodyOccupiedCell>;
type Box = Readonly<{ minimumCell: Cell; maximumCellExclusive: Cell }>;

const TRUNK_SEMANTIC_KEY = "hestia.surface-play.umbrella-segment.v1:fa597ad320aab403";
const RAYS = [
  {
    commandId: "stock-cut:1",
    originMeters: { x: 58.15625, y: 12.28125, z: -37.625 },
    direction: { x: 0, y: 0, z: -1 },
    hitAddress: { x: 465, y: 98, z: -334 },
    centerQuantum: { x: 465, y: 98, z: -333 },
    pointMeters: { x: 58.15625, y: 12.28125, z: -41.625 }
  },
  {
    commandId: "stock-cut:2",
    originMeters: { x: 63.3125, y: 11.5625, z: -41.9375 },
    direction: { x: -1, y: 0, z: 0 },
    hitAddress: { x: 466, y: 92, z: -336 },
    centerQuantum: { x: 467, y: 92, z: -336 },
    pointMeters: { x: 58.375, y: 11.5625, z: -41.9375 }
  },
  {
    commandId: "stock-cut:3",
    originMeters: { x: 54.27696609406726, y: 11.5625, z: -45.72303390593274 },
    direction: { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 },
    hitAddress: { x: 462, y: 92, z: -338 },
    centerQuantum: { x: 462, y: 92, z: -338 },
    pointMeters: { x: 57.75, y: 11.5625, z: -42.25 }
  },
  {
    commandId: "stock-cut:4",
    originMeters: { x: 53.34036443740345, y: 11.5625, z: -39.576432218701724 },
    direction: { x: 0.8944271909999159, y: 0, z: -0.4472135954999579 },
    hitAddress: { x: 462, y: 92, z: -335 },
    centerQuantum: { x: 462, y: 92, z: -334 },
    pointMeters: { x: 57.75, y: 11.5625, z: -41.78125 }
  }
] as const;

const ATTACHED_PREFIXES = [
  {
    objectRevision: 0,
    editRevision: 0,
    contentHash: "fnv1a64-v1:af46cf17266d1f94",
    occupiedCellCount: 2_711,
    componentId: "fnv1a64-v1:b40f9e06a3ac506a"
  },
  {
    objectRevision: 1,
    editRevision: 1,
    contentHash: "fnv1a64-v1:4cd36b61c2c31461",
    occupiedCellCount: 2_649,
    componentId: "fnv1a64-v1:0d7e7b6c497148a6"
  },
  {
    objectRevision: 2,
    editRevision: 2,
    contentHash: "fnv1a64-v1:965d6eeaf9bc32c3",
    occupiedCellCount: 2_587,
    componentId: "fnv1a64-v1:6dc8643e3fd5c628"
  },
  {
    objectRevision: 3,
    editRevision: 3,
    contentHash: "fnv1a64-v1:aca134bf6145804e",
    occupiedCellCount: 2_557,
    componentId: "fnv1a64-v1:d2749566c007db9e"
  }
] as const;

const AXIS_ORDERS = [
  ["x", "y", "z"], ["x", "z", "y"], ["y", "x", "z"],
  ["y", "z", "x"], ["z", "x", "y"], ["z", "y", "x"]
] as const satisfies readonly (readonly Axis[])[];

const cellKey = (cell: Cell): string => `${cell.x},${cell.y},${cell.z}`;
const compareCells = (left: Cell, right: Cell): number =>
  left.z - right.z || left.y - right.y || left.x - right.x;

const boxesForOrder = (occupiedCells: readonly Cell[], order: readonly Axis[]): readonly Box[] => {
  const cells = [...occupiedCells].sort(compareCells);
  const available = new Set(cells.map(cellKey));
  const boxes: Box[] = [];
  const contains = (minimum: Cell, maximumExclusive: Cell): boolean => {
    for (let z = minimum.z; z < maximumExclusive.z; z += 1) {
      for (let y = minimum.y; y < maximumExclusive.y; y += 1) {
        for (let x = minimum.x; x < maximumExclusive.x; x += 1) {
          if (!available.has(`${x},${y},${z}`)) return false;
        }
      }
    }
    return true;
  };
  for (const seed of cells) {
    if (!available.has(cellKey(seed))) continue;
    const maximumCellExclusive = { x: seed.x + 1, y: seed.y + 1, z: seed.z + 1 };
    for (const axis of order) {
      while (contains(seed, {
        ...maximumCellExclusive,
        [axis]: maximumCellExclusive[axis] + 1
      })) maximumCellExclusive[axis] += 1;
    }
    for (let z = seed.z; z < maximumCellExclusive.z; z += 1) {
      for (let y = seed.y; y < maximumCellExclusive.y; y += 1) {
        for (let x = seed.x; x < maximumCellExclusive.x; x += 1) {
          available.delete(`${x},${y},${z}`);
        }
      }
    }
    boxes.push({ minimumCell: seed, maximumCellExclusive: { ...maximumCellExclusive } });
  }
  return boxes;
};

const expectExactDisjointCover = (occupiedCells: readonly Cell[], boxes: readonly Box[]): void => {
  const expected = new Set(occupiedCells.map(cellKey));
  const covered = new Set<string>();
  for (const box of boxes) {
    for (let z = box.minimumCell.z; z < box.maximumCellExclusive.z; z += 1) {
      for (let y = box.minimumCell.y; y < box.maximumCellExclusive.y; y += 1) {
        for (let x = box.minimumCell.x; x < box.maximumCellExclusive.x; x += 1) {
          const key = `${x},${y},${z}`;
          expect(expected.has(key), `extra collider cell ${key}`).toBe(true);
          expect(covered.has(key), `overlapping collider cell ${key}`).toBe(false);
          covered.add(key);
        }
      }
    }
  }
  expect([...expected].filter((key) => !covered.has(key))).toEqual([]);
};

const componentFacts = (component: Readonly<StructuralComponent>) => ({
  componentId: component.componentId,
  occupiedCellCount: component.occupiedCells.length,
  anchored: component.anchored
});

const expectAttachedPrefix = (
  state: Readonly<SurfaceTreeRuntimeState>,
  expected: (typeof ATTACHED_PREFIXES)[number]
): void => {
  expect({
    objectRevision: state.authority.objectRevision,
    editRevision: state.authority.editRevision,
    contentHash: state.authority.objectContentHash,
    occupiedCellCount: state.authority.occupiedCellCount,
    components: state.authority.classification.components.map(componentFacts),
    bodySourceCount: state.bodySources.length,
    bodyCount: state.physicsWorld.bodies.length,
    physicsFailure: state.physicsWorld.physicsFailure
  }).toEqual({
    ...expected,
    componentId: undefined,
    components: [{
      componentId: expected.componentId,
      occupiedCellCount: expected.occupiedCellCount,
      anchored: true
    }],
    bodySourceCount: 0,
    bodyCount: 0,
    physicsFailure: null
  });
};

const expectAuthorityRejectionAtomicity = (surfaceFrameId: string): void => {
  const identity = createSurfacePlayIdentity({
    bodyId: "body.hestia",
    regionId: "region.hestia.stock-cut",
    surfaceFrameId,
    generatorVersion: "hestia.generator.v1",
    seed: "hestia-stock-cut-progression-v1",
    regionRevision: 0
  });
  const state = createSurfaceCombatRuntimeState(surfaceFrameId, { x: 0, y: 1.5, z: 20 });
  const result = executeSurfaceCombatFire({
    state,
    player: createSurfacePlayerSnapshot({
      playerId: "surface-player:stock-cut",
      surfaceFrameId,
      positionMeters: { x: 0, y: 0, z: 0 },
      velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
      yawRadians: 0,
      pitchRadians: 0,
      grounded: true,
      movementMode: "Walk",
      capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
      simulationTick: 4
    }),
    command: {
      commandId: "stock-cut:4",
      playerId: "surface-player:stock-cut",
      surfaceFrameId,
      simulationTick: 4
    },
    pose: createWeaponMountPose({
      sourceEntityId: "surface-player:stock-cut",
      ownerId: "surface-owner:player",
      frameId: surfaceFrameId,
      muzzlePosition: { x: 0, y: 1.5, z: 0 },
      forward: { x: 0, y: 0, z: 1 },
      up: { x: 0, y: 1, z: 0 },
      muzzleDirection: { x: 0, y: 0, z: 1 },
      sourceVelocity: { x: 0, y: 0, z: 0 }
    }),
    binding: {
      bodyId: identity.bodyId,
      regionId: identity.regionId,
      surfaceFrameId: identity.surfaceFrameId,
      regionRevision: identity.regionRevision,
      simulationTick: 4
    },
    raycast: {
      query: () => ({
        kind: "Blocked" as const,
        code: "AuthorityRefused" as const,
        message: "Structural authority rejected an intentionally invalid test command."
      })
    }
  });
  expect(result.kind).toBe("BlockedFire");
  expect(result.state.weapon).toEqual(state.weapon);
  expect(result.state.drone).toEqual(state.drone);
  expect(result.impactIntent).toBeNull();
  expect(result.snapshot.events.map((event) => event.kind)).toEqual(["FireRejected"]);
  expect(result.snapshot.latestFireResult).toMatchObject({
    status: "Rejected",
    code: "AuthorityRefused"
  });
};

const createPlacedStockTreeState = (): Readonly<SurfaceTreeRuntimeState> => {
  const sourceWorld = resolveHestiaSurfacePlayWorld();
  const surfaceAuthority = createSurfaceRegionVoxelAuthority(
    createHestiaSurfacePlayAuthorityInput(sourceWorld)
  );
  const adopted = revalidateHestiaSurfacePlayWorld(surfaceAuthority, sourceWorld);
  if (adopted.status === "Rejected") throw new Error(adopted.failure.message);
  const placement = adopted.world.encounter.structuralTrees[0];
  const authority = createSurfaceTreeAuthority(createHestiaUmbrellaTree(placement));
  return createSurfaceTreeRuntimeStateFromAuthority(authority, createSurfaceRigidBodyWorld({
    simulationTick: 0,
    gravityMetersPerSecondSquared: 11.78,
    terrainColliders: []
  }));
};

const runFixedProgression = (): string => {
  let state = createPlacedStockTreeState();
  for (const [index, ray] of RAYS.entries()) {
    expectAttachedPrefix(state, ATTACHED_PREFIXES[index]);
    const before = state;
    const result = raycastSurfaceTreeCollision(before.collision, {
      binding: createSurfaceTreeCollisionBinding(before.collision),
      originMeters: ray.originMeters,
      direction: ray.direction,
      maximumDistanceMeters: 10
    });
    expect(result.status).toBe("Resolved");
    if (result.status !== "Resolved") throw new Error("Fixed Tree ray was rejected.");
    expect(result.kind).toBe("Hit");
    if (result.kind !== "Hit") throw new Error("Fixed Tree ray missed.");
    const centerQuantum = {
      x: quantizeSurfaceHitCoordinateMeters(result.hit.pointMeters.x) / MICROVOXEL_BASE_QUANTUM_METERS,
      y: quantizeSurfaceHitCoordinateMeters(result.hit.pointMeters.y) / MICROVOXEL_BASE_QUANTUM_METERS,
      z: quantizeSurfaceHitCoordinateMeters(result.hit.pointMeters.z) / MICROVOXEL_BASE_QUANTUM_METERS
    };
    expect({
      address: globalQuantumForStructuralCell(result.hit.address),
      centerQuantum,
      pointMeters: result.hit.pointMeters,
      materialId: result.hit.materialId,
      semanticKey: result.hit.semanticKey
    }).toEqual({
      address: ray.hitAddress,
      centerQuantum: ray.centerQuantum,
      pointMeters: ray.pointMeters,
      materialId: 2,
      semanticKey: TRUNK_SEMANTIC_KEY
    });

    const preflight = preflightSurfaceTreeFire(before, {
      fireCommandId: ray.commandId,
      hit: result.hit,
      simulationTick: index + 1
    });
    if (index < RAYS.length - 1) {
      expect(preflight.status).toBe("Ready");
      if (preflight.status !== "Ready") throw new Error(`Stock cut ${index + 1} was rejected.`);
      expect(preflight.supportResult).toBe("Anchored");
      state = preflight.state;
      continue;
    }

    const preview = previewSurfaceTreeHit(before.authority, {
      schemaVersion: SURFACE_TREE_CANONICAL_HIT_SCHEMA_VERSION,
      ordinal: before.authority.object.commandEvidence.length,
      address: result.hit.address,
      globalQuantum: centerQuantum,
      pointMeters: result.hit.pointMeters,
      materialId: result.hit.materialId
    }, "surface-tree-edit:stock-cut:4:3:3");
    expect(preview.status).toBe("Accepted");
    if (preview.status !== "Accepted") throw new Error("Final stock cut was structurally rejected.");
    expect({
      objectRevision: preview.authority.objectRevision,
      editRevision: preview.authority.editRevision,
      contentHash: preview.authority.objectContentHash,
      occupiedCellCount: preview.authority.occupiedCellCount,
      components: preview.authority.classification.components.map(componentFacts)
    }).toEqual({
      objectRevision: 4,
      editRevision: 4,
      contentHash: "fnv1a64-v1:e1dcfb008302471d",
      occupiedCellCount: 2_523,
      components: [
        { componentId: "fnv1a64-v1:8b762aed886a43c0", occupiedCellCount: 549, anchored: true },
        { componentId: "fnv1a64-v1:92666b419b33e798", occupiedCellCount: 1_974, anchored: false }
      ]
    });
    const detached = deriveSurfaceTreeDetachedComponents(preview.authority);
    expect(detached).toHaveLength(1);
    const facts = detached[0];
    expect(facts.component.componentId).toBe("fnv1a64-v1:92666b419b33e798");
    expect(facts.component.occupiedCells).toHaveLength(1_974);
    if (facts.massProperties.centerOfMassMeters === null) throw new Error("Detached body lost center of mass.");
    const occupiedCells = facts.component.occupiedCells.map(globalQuantumForStructuralCell);
    const orderBoxes = AXIS_ORDERS.map((order) => boxesForOrder(occupiedCells, order));
    for (const boxes of orderBoxes) expectExactDisjointCover(occupiedCells, boxes);
    expect(Object.fromEntries(AXIS_ORDERS.map((order, orderIndex) => [
      order.join(""), orderBoxes[orderIndex].length
    ]))).toEqual({ xyz: 65, xzy: 65, yxz: 64, yzx: 66, zxy: 67, zyx: 67 });

    const beforeFinalCut = JSON.stringify(before);
    const candidate = createSurfaceRigidBodyCandidate({
      bodyId: `surface-tree-body:${facts.component.componentId}`,
      componentId: facts.component.componentId,
      objectId: facts.component.objectId,
      sourceObjectRevision: facts.component.objectRevision,
      sourceContentHash: facts.component.sourceContentHash,
      occupiedCells,
      cellSizeMeters: MICROVOXEL_BASE_QUANTUM_METERS,
      massKg: facts.massProperties.totalMassKg,
      centerOfMassMeters: facts.massProperties.centerOfMassMeters,
      inertiaTensorKgMetersSquared: facts.massProperties.inertiaTensorKgMetersSquared,
      colliderRevision: facts.component.objectRevision,
      detachedAtSimulationTick: 4
    });
    const admission = admitSurfaceRigidBodyBatch(before.physicsWorld, [candidate]);
    expect(preflight.status).toBe("Ready");
    if (preflight.status !== "Ready") throw new Error("Final stock cut remained collider-budget blocked.");
    expect(preflight.supportResult).toBe("Detached");
    expect(candidate.colliders).toHaveLength(64);
    expectExactDisjointCover(occupiedCells, candidate.colliders);
    expect(hashAdaptiveCanonical(candidate.colliders)).toBe("fnv1a64-v1:eac7cd887226d1ec");
    expect(candidate.colliderRepresentation).toMatchObject({
      schemaVersion: 2,
      algorithmVersion: "surface-rigid-body-exact-axis-boxes-v3",
      kind: "Exact",
      level: 0,
      exactAxisOrder: "yxz",
      workCounters: {
        occupiedCellCount: 1_974,
        axisOrderEvaluationCount: 3,
        containmentCellProbeBound: 23_688,
        broadphaseLevelCount: 0,
        coarseCellProjectionCount: 0,
        broadphaseMappingEntryCount: 64,
        broadphaseMappingPairProbeCount: 0,
        broadphaseDisjointnessValidationPairProbeCount: 2_016,
        narrowphaseDisjointnessValidationPairProbeCount: 2_016,
        broadphaseMappingValidationPairProbeCount: 4_096,
        narrowphaseColliderCount: 64,
        broadphaseColliderCount: 64
      }
    });
    expect(admission.status).toBe("Admitted");
    expect(preflight.state.bodySources).toHaveLength(1);
    expect(preflight.state.physicsWorld.bodies).toHaveLength(1);
    expect(preflight.state.physicsWorld.bodies[0].colliders).toHaveLength(64);
    expect(preflight.state.physicsWorld.physicsFailure).toBeNull();
    expect(JSON.stringify(before)).toBe(beforeFinalCut);
    expect(before.physicsWorld.bodies).toHaveLength(0);
    expectAuthorityRejectionAtomicity(before.authority.object.frame.surfaceFrameId);
    state = preflight.state;
  }
  return JSON.stringify(state);
};

describe("placed stock Surface Tree cut progression", () => {
  it("admits the fixed real-raycast detachment deterministically", () => {
    const first = runFixedProgression();
    const repeat = runFixedProgression();
    expect(repeat).toBe(first);
  }, 180_000);
});
