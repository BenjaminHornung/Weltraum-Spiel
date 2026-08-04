import { describe, expect, it } from "vitest";
import { createQuaternionFromAxisAngle, rotateSpatialVector } from "../../src/spatial/quaternion";
import { hashAdaptiveCanonical, isDeepFrozen } from "../../src/voxel/adaptive";
import {
  admitSurfaceRigidBodyBatch,
  clearSurfaceRigidBodyWorld,
  createSurfaceRigidBodyCandidate,
  createSurfaceRigidBodyWorld,
  raycastSurfaceRigidBodies,
  replaceSurfaceRigidBodyTerrainColliders,
  separateSurfaceRigidBodyCapsule,
  stepSurfaceRigidBodyWorld,
  SURFACE_RIGID_BODY_CAPSULE_SEPARATION_MAX_ITERATIONS,
  SURFACE_RIGID_BODY_MAX_ROTATION_PER_SUBSTEP_RADIANS,
  SURFACE_RIGID_BODY_MAX_SUBSTEPS,
  SURFACE_RIGID_BODY_MAX_TRANSLATION_PER_SUBSTEP_METERS,
  SURFACE_RIGID_BODY_TICK_SECONDS,
  surfaceRigidBodySnapshots,
  sweepSurfaceRigidBodyCapsule,
  type SurfaceRigidBodyCandidate,
  type SurfaceRigidBodyOccupiedCell,
  type SurfaceRigidBodyState,
  type SurfaceRigidBodyWorld
} from "../../src/surface-play/physics";
import {
  readSurfaceRigidBodyStepDiagnostics,
  readSurfaceRigidBodyTerrainBroadphaseStats
} from "../../src/surface-play/physics/surfaceRigidBodyWorld";

const HASH = "fnv1a64-v1:1111111111111111";
const WOOD_CELL_SIZE_METERS = 0.125;
const WOOD_CELL_MASS_KG = 1.26953125;
const WOOD_CELL_INERTIA_KG_METERS_SQUARED =
  WOOD_CELL_MASS_KG * WOOD_CELL_SIZE_METERS ** 2 / 6;

const candidate = (
  index: number,
  overrides: Partial<Parameters<typeof createSurfaceRigidBodyCandidate>[0]> = {}
): Readonly<SurfaceRigidBodyCandidate> => createSurfaceRigidBodyCandidate({
  bodyId: `body:tree:${index}`,
  componentId: `component:tree:${index}`,
  objectId: `object:tree:${index}`,
  sourceObjectRevision: 1,
  sourceContentHash: HASH,
  occupiedCells: [{ x: 0, y: 0, z: 0 }],
  cellSizeMeters: 1,
  massKg: 1,
  centerOfMassMeters: { x: 0.5, y: 0.5, z: 0.5 },
  inertiaTensorKgMetersSquared: { xx: 1, yy: 1, zz: 1, xy: 0, xz: 0, yz: 0 },
  colliderRevision: 1,
  detachedAtSimulationTick: 0,
  ...overrides
});

const combCells = (): readonly SurfaceRigidBodyOccupiedCell[] =>
  Array.from({ length: 65 }, (_, pillar) =>
    Array.from({ length: 16 }, (_, y) => ({ x: pillar * 8, y, z: 0 }))
  ).flat();

const rehashColliderRepresentation = (
  source: SurfaceRigidBodyCandidate["colliderRepresentation"],
  overrides: Partial<SurfaceRigidBodyCandidate["colliderRepresentation"]>
): SurfaceRigidBodyCandidate["colliderRepresentation"] => {
  const merged = { ...source, ...overrides };
  const { representationHash: _representationHash, ...withoutHash } = merged;
  return Object.freeze({
    ...withoutHash,
    representationHash: hashAdaptiveCanonical({
      domain: "surface-rigid-body-collider-representation",
      ...withoutHash
    })
  });
};

const emptyWorld = (simulationTick = 0, gravity = 9.81) => createSurfaceRigidBodyWorld({
  simulationTick,
  gravityMetersPerSecondSquared: gravity,
  terrainColliders: []
});

const admitted = (
  world: Readonly<SurfaceRigidBodyWorld>,
  candidates: readonly Readonly<SurfaceRigidBodyCandidate>[]
): Readonly<SurfaceRigidBodyWorld> => {
  const result = admitSurfaceRigidBodyBatch(world, candidates);
  expect(result.status).toBe("Admitted");
  if (result.status !== "Admitted") throw new Error("fixture admission failed");
  return result.world;
};

const woodCellCandidate = (
  index: number,
  overrides: Partial<Parameters<typeof createSurfaceRigidBodyCandidate>[0]>
): Readonly<SurfaceRigidBodyCandidate> => candidate(index, {
  cellSizeMeters: WOOD_CELL_SIZE_METERS,
  massKg: WOOD_CELL_MASS_KG,
  centerOfMassMeters: {
    x: WOOD_CELL_SIZE_METERS / 2,
    y: WOOD_CELL_SIZE_METERS / 2,
    z: WOOD_CELL_SIZE_METERS / 2
  },
  inertiaTensorKgMetersSquared: {
    xx: WOOD_CELL_INERTIA_KG_METERS_SQUARED,
    yy: WOOD_CELL_INERTIA_KG_METERS_SQUARED,
    zz: WOOD_CELL_INERTIA_KG_METERS_SQUARED,
    xy: 0,
    xz: 0,
    yz: 0
  },
  ...overrides
});

const requiredMotionSubsteps = (
  body: Readonly<SurfaceRigidBodyState>,
  gravityMetersPerSecondSquared: number
): number => {
  const gravityDelta = body.lifecycle === "Resting"
    ? 0
    : gravityMetersPerSecondSquared * SURFACE_RIGID_BODY_TICK_SECONDS;
  const predictedLinearSpeed = Math.hypot(
    body.linearVelocityMetersPerSecond.x,
    body.linearVelocityMetersPerSecond.y - gravityDelta,
    body.linearVelocityMetersPerSecond.z
  );
  const angularSpeed = Math.hypot(
    body.angularVelocityRadiansPerSecond.x,
    body.angularVelocityRadiansPerSecond.y,
    body.angularVelocityRadiansPerSecond.z
  );
  return Math.max(
    1,
    Math.ceil(
      predictedLinearSpeed
        / (SURFACE_RIGID_BODY_MAX_TRANSLATION_PER_SUBSTEP_METERS
          / SURFACE_RIGID_BODY_TICK_SECONDS)
    ),
    Math.ceil(
      angularSpeed
        / (SURFACE_RIGID_BODY_MAX_ROTATION_PER_SUBSTEP_RADIANS
          / SURFACE_RIGID_BODY_TICK_SECONDS)
    )
  );
};

const totalKineticEnergy = (world: Readonly<SurfaceRigidBodyWorld>): number =>
  world.bodies.reduce((total, body) => total
    + 0.5 * body.massKg * (
      body.linearVelocityMetersPerSecond.x ** 2
      + body.linearVelocityMetersPerSecond.y ** 2
      + body.linearVelocityMetersPerSecond.z ** 2
    )
    + 0.5 * WOOD_CELL_INERTIA_KG_METERS_SQUARED * (
      body.angularVelocityRadiansPerSecond.x ** 2
      + body.angularVelocityRadiansPerSecond.y ** 2
      + body.angularVelocityRadiansPerSecond.z ** 2
    ), 0);

const totalLinearMomentum = (world: Readonly<SurfaceRigidBodyWorld>) =>
  world.bodies.reduce((total, body) => ({
    x: total.x + body.massKg * body.linearVelocityMetersPerSecond.x,
    y: total.y + body.massKg * body.linearVelocityMetersPerSecond.y,
    z: total.z + body.massKg * body.linearVelocityMetersPerSecond.z
  }), { x: 0, y: 0, z: 0 });

const bruteForceStaticTerrainAabbOverlapCount = (world: Readonly<SurfaceRigidBodyWorld>): number => {
  let overlapCount = 0;
  for (const body of world.bodies) {
    if (body.activationSimulationTick > world.simulationTick + 1) continue;
    for (const collider of body.colliders) {
      const localCenter = rotateSpatialVector(body.orientation, collider.centerMeters);
      const center = {
        x: body.positionMeters.x + localCenter.x,
        y: body.positionMeters.y + localCenter.y,
        z: body.positionMeters.z + localCenter.z
      };
      const axes = [
        rotateSpatialVector(body.orientation, { x: 1, y: 0, z: 0 }),
        rotateSpatialVector(body.orientation, { x: 0, y: 1, z: 0 }),
        rotateSpatialVector(body.orientation, { x: 0, y: 0, z: 1 })
      ] as const;
      const half = collider.halfExtentsMeters;
      const worldHalf = {
        x: Math.abs(axes[0].x) * half.x + Math.abs(axes[1].x) * half.y + Math.abs(axes[2].x) * half.z,
        y: Math.abs(axes[0].y) * half.x + Math.abs(axes[1].y) * half.y + Math.abs(axes[2].y) * half.z,
        z: Math.abs(axes[0].z) * half.x + Math.abs(axes[1].z) * half.y + Math.abs(axes[2].z) * half.z
      };
      const minimum = { x: center.x - worldHalf.x, y: center.y - worldHalf.y, z: center.z - worldHalf.z };
      const maximum = { x: center.x + worldHalf.x, y: center.y + worldHalf.y, z: center.z + worldHalf.z };
      for (const terrain of world.terrainColliders) {
        if (
          minimum.x <= terrain.maximumMeters.x && maximum.x >= terrain.minimumMeters.x &&
          minimum.y <= terrain.maximumMeters.y && maximum.y >= terrain.minimumMeters.y &&
          minimum.z <= terrain.maximumMeters.z && maximum.z >= terrain.minimumMeters.z
        ) overlapCount += 1;
      }
    }
  }
  return overlapCount;
};

describe("Surface rigid-body world", () => {
  it("reserves whole batches through the eighth body and rejects the ninth atomically", () => {
    const eight = admitted(emptyWorld(), Array.from({ length: 8 }, (_, index) => candidate(index)));
    expect(eight.bodies).toHaveLength(8);

    const rejection = admitSurfaceRigidBodyBatch(eight, [candidate(8)]);
    expect(rejection).toEqual({ status: "Rejected", world: eight, code: "BodyCapacityExceeded" });
    expect(rejection.world).toBe(eight);
  });

  it("admits 64 exact boxes and derives a bounded conservative broadphase above that", () => {
    const cells = (count: number): readonly SurfaceRigidBodyOccupiedCell[] =>
      Array.from({ length: count }, (_, index) => ({ x: index * 2, y: 0, z: 0 }));
    const world = emptyWorld();
    const sixtyFour = admitSurfaceRigidBodyBatch(world, [candidate(1, { occupiedCells: cells(64) })]);
    expect(sixtyFour.status).toBe("Admitted");

    const sixtyFive = admitSurfaceRigidBodyBatch(world, [candidate(2, { occupiedCells: cells(65) })]);
    expect(sixtyFive.status).toBe("Admitted");
    if (sixtyFive.status !== "Admitted") throw new Error("Expected adaptive collider admission.");
    expect(sixtyFive.world.bodies[0].colliders).toHaveLength(1);
    expect(sixtyFive.world.bodies[0].colliders[0]).toMatchObject({
      minimumCell: { x: 0, y: 0, z: 0 },
      maximumCellExclusive: { x: 129, y: 1, z: 1 }
    });
    expect(world.bodies).toHaveLength(0);
  });

  it("uses adaptive boxes only for broadphase while ray and player capsule query exact occupancy", () => {
    const comb = candidate(7, {
      occupiedCells: combCells(),
      cellSizeMeters: 0.125,
      centerOfMassMeters: { x: 32.0625, y: 1, z: 0.0625 },
      positionMeters: { x: 32.0625, y: 1, z: 0.0625 }
    });
    expect(comb.colliderRepresentation.kind).toBe("AdaptiveSparse");
    const world = admitted(emptyWorld(0, 0), [comb]);

    expect(raycastSurfaceRigidBodies(world, {
      originMeters: { x: 0.5, y: 1, z: -1 },
      direction: { x: 0, y: 0, z: 1 },
      maximumDistanceMeters: 2
    })).toEqual({ status: "Miss", hit: null });
    expect(raycastSurfaceRigidBodies(world, {
      originMeters: { x: 0.0625, y: 1, z: -1 },
      direction: { x: 0, y: 0, z: 1 },
      maximumDistanceMeters: 2
    })).toMatchObject({ status: "Hit", hit: { bodyId: "body:tree:7" } });

    expect(sweepSurfaceRigidBodyCapsule(world, {
      capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
      startPositionMeters: { x: 0.5, y: 1, z: -1 },
      displacementMeters: { x: 0, y: 0, z: 2 }
    })).toEqual({ status: "Miss", fraction: 1, hit: null });
    expect(sweepSurfaceRigidBodyCapsule(world, {
      capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
      startPositionMeters: { x: 0.0625, y: 1, z: -1 },
      displacementMeters: { x: 0, y: 0, z: 2 }
    })).toMatchObject({ status: "Hit", hit: { bodyId: "body:tree:7" } });

    const contactWorld = admitted(createSurfaceRigidBodyWorld({
      simulationTick: 0,
      gravityMetersPerSecondSquared: 0,
      terrainColliders: [{
        colliderKey: "terrain:comb-gap",
        minimumMeters: { x: 0.4, y: 0.1, z: 0 },
        maximumMeters: { x: 0.6, y: 1.9, z: 0.125 }
      }]
    }), [comb]);
    const contactStep = stepSurfaceRigidBodyWorld(contactWorld);
    expect(contactStep.status).toBe("Advanced");
    expect(readSurfaceRigidBodyStepDiagnostics(contactStep.world)).toMatchObject({
      cumulativeContactCount: 0,
      contactsPerSubstep: [0]
    });
  });

  it("rejects invalid or stale internal collider representation descriptors before admission", () => {
    const valid = candidate(8, { occupiedCells: combCells() });
    const stale = Object.freeze({
      ...valid,
      colliderRepresentation: Object.freeze({
        ...valid.colliderRepresentation,
        sourceObjectRevision: valid.sourceObjectRevision + 1
      })
    });
    const invalid = Object.freeze({
      ...valid,
      colliderRepresentation: Object.freeze({
        ...valid.colliderRepresentation,
        representationHash: HASH
      })
    });
    const noncanonicalNarrowphase = Object.freeze(valid.colliderRepresentation.narrowphaseColliders.map(
      (collider, index) => index === 0
        ? Object.freeze({ ...collider, colliderIndex: 99 })
        : collider
    ));
    const noncanonical = Object.freeze({
      ...valid,
      colliderRepresentation: rehashColliderRepresentation(valid.colliderRepresentation, {
        narrowphaseColliders: noncanonicalNarrowphase
      })
    });
    const firstBroadphase = valid.colliderRepresentation.broadphaseColliders[0];
    if (firstBroadphase === undefined) throw new Error("Expected adaptive broadphase fixture.");
    const duplicatedBroadphase = Object.freeze([
      firstBroadphase,
      Object.freeze({ ...firstBroadphase, colliderIndex: 1 })
    ]);
    const duplicatedMapping = Object.freeze([
      valid.colliderRepresentation.broadphaseNarrowphaseColliderIndices[0],
      valid.colliderRepresentation.broadphaseNarrowphaseColliderIndices[0]
    ]);
    const duplicateOverlapRepresentation = rehashColliderRepresentation(valid.colliderRepresentation, {
      broadphaseColliders: duplicatedBroadphase,
      broadphaseNarrowphaseColliderIndices: duplicatedMapping,
      workCounters: Object.freeze({
        ...valid.colliderRepresentation.workCounters,
        broadphaseColliderCount: 2,
        broadphaseMappingEntryCount:
          valid.colliderRepresentation.workCounters.broadphaseMappingEntryCount * 2
      })
    });
    const duplicateOverlap = Object.freeze({
      ...valid,
      colliders: duplicatedBroadphase,
      colliderRepresentation: duplicateOverlapRepresentation
    });
    const dishonestCounters = Object.freeze({
      ...valid,
      colliderRepresentation: rehashColliderRepresentation(valid.colliderRepresentation, {
        workCounters: Object.freeze({
          ...valid.colliderRepresentation.workCounters,
          occupiedCellCount: valid.colliderRepresentation.workCounters.occupiedCellCount + 1,
          containmentCellProbeBound:
            valid.colliderRepresentation.workCounters.containmentCellProbeBound + 1
        })
      })
    });
    const dishonestPairProbeCounters = Object.freeze({
      ...valid,
      colliderRepresentation: rehashColliderRepresentation(valid.colliderRepresentation, {
        workCounters: Object.freeze({
          ...valid.colliderRepresentation.workCounters,
          broadphaseMappingPairProbeCount:
            valid.colliderRepresentation.workCounters.broadphaseMappingPairProbeCount + 1
        })
      })
    });
    const shiftedBroadphase = Object.freeze(valid.colliderRepresentation.broadphaseColliders.map(
      (collider) => Object.freeze({
        ...collider,
        centerMeters: Object.freeze({
          ...collider.centerMeters,
          x: collider.centerMeters.x + 100
        })
      })
    ));
    const shiftedNarrowphase = Object.freeze(valid.colliderRepresentation.narrowphaseColliders.map(
      (collider) => Object.freeze({
        ...collider,
        centerMeters: Object.freeze({
          ...collider.centerMeters,
          x: collider.centerMeters.x + 100
        })
      })
    ));
    const shiftedGeometry = Object.freeze({
      ...valid,
      colliders: shiftedBroadphase,
      colliderRepresentation: rehashColliderRepresentation(valid.colliderRepresentation, {
        broadphaseColliders: shiftedBroadphase,
        narrowphaseColliders: shiftedNarrowphase
      })
    });

    expect(() => admitSurfaceRigidBodyBatch(emptyWorld(), [stale])).toThrow(/source revision/i);
    expect(() => admitSurfaceRigidBodyBatch(emptyWorld(), [invalid])).toThrow(/representation hash/i);
    expect(() => admitSurfaceRigidBodyBatch(emptyWorld(), [noncanonical])).toThrow(/canonical collider index/i);
    expect(() => admitSurfaceRigidBodyBatch(emptyWorld(), [duplicateOverlap])).toThrow(
      /broadphase ordering|disjoint|overlap mapping/i
    );
    expect(() => admitSurfaceRigidBodyBatch(emptyWorld(), [dishonestCounters])).toThrow(/work counters/i);
    expect(() => admitSurfaceRigidBodyBatch(emptyWorld(), [dishonestPairProbeCounters])).toThrow(/work counters/i);
    expect(() => admitSurfaceRigidBodyBatch(emptyWorld(), [shiftedGeometry])).toThrow(/geometry/i);
  });

  it("publishes at detachment tick N and begins fixed-tick physics at N+1", () => {
    const world = admitted(emptyWorld(5), [candidate(1, { detachedAtSimulationTick: 5 })]);
    expect(surfaceRigidBodySnapshots(world)[0]).toMatchObject({ simulationTick: 5, positionMeters: { y: 0.5 } });

    const result = stepSurfaceRigidBodyWorld(world);
    expect(result.status).toBe("Advanced");
    expect(result.world.simulationTick).toBe(6);
    expect(result.world.bodies[0].positionMeters.y).toBeLessThan(0.5);
  });

  it("admits the exact four-substep translation boundary and atomically fails above it", () => {
    const boundary = admitted(emptyWorld(0, 0), [candidate(1, {
      linearVelocityMetersPerSecond: { x: 15, y: 0, z: 0 }
    })]);
    const boundaryBefore = JSON.stringify(boundary);
    expect(readSurfaceRigidBodyStepDiagnostics(boundary)).toBeUndefined();
    const advanced = stepSurfaceRigidBodyWorld(boundary);
    expect(advanced.status).toBe("Advanced");
    expect(advanced.world.bodies[0].positionMeters.x).toBeCloseTo(0.75, 14);
    expect(JSON.stringify(boundary)).toBe(boundaryBefore);
    const advancedDiagnostics = readSurfaceRigidBodyStepDiagnostics(advanced.world);
    expect(advancedDiagnostics).toMatchObject({
      sourceSimulationTick: 0,
      attemptedSimulationTick: 1,
      outcome: "Advanced",
      stage: "Advanced",
      failureCode: null,
      selectedSubsteps: 4,
      completedSubsteps: 4,
      contactsPerSubstep: [0, 0, 0, 0],
      cumulativeContactCount: 0,
      firstNonFiniteField: null,
      bodies: [{
        bodyId: "body:tree:1",
        active: true,
        sourceObjectRevision: 1,
        sourceContentHash: HASH,
        colliderRevision: 1,
        colliderCount: 1,
        lifecycle: "Falling",
        poseFinite: true,
        linearVelocityFinite: true,
        angularVelocityFinite: true,
        predictedNextTickLinearSpeedMetersPerSecond: 15,
        angularSpeedRadiansPerSecond: 0,
        requiredTranslationSubsteps: 4,
        requiredRotationSubsteps: 0,
        requiredMotionSubsteps: 4
      }]
    });
    expect(advancedDiagnostics).toBeDefined();
    expect(isDeepFrozen(advancedDiagnostics)).toBe(true);

    const over = admitted(emptyWorld(0, 0), [candidate(2, {
      linearVelocityMetersPerSecond: { x: 15.0001, y: 0, z: 0 }
    })]);
    const previous = over.bodies[0];
    const failed = stepSurfaceRigidBodyWorld(over);
    expect(failed.status).toBe("Failed");
    expect(failed.world.simulationTick).toBe(0);
    expect(failed.world.bodies[0]).toBe(previous);
    expect(failed.world.physicsFailure).toMatchObject({ code: "MotionBudgetExceeded", simulationTick: 1 });
    expect(readSurfaceRigidBodyStepDiagnostics(failed.world)).toMatchObject({
      sourceSimulationTick: 0,
      attemptedSimulationTick: 1,
      outcome: "Failed",
      stage: "MotionBudget",
      failureCode: "MotionBudgetExceeded",
      selectedSubsteps: 5,
      completedSubsteps: 0,
      contactsPerSubstep: [],
      cumulativeContactCount: 0,
      firstNonFiniteField: null,
      bodies: [{
        bodyId: "body:tree:2",
        active: true,
        sourceObjectRevision: 1,
        sourceContentHash: HASH,
        colliderRevision: 1,
        colliderCount: 1,
        lifecycle: "Falling",
        poseFinite: true,
        linearVelocityFinite: true,
        angularVelocityFinite: true,
        predictedNextTickLinearSpeedMetersPerSecond: 15.0001,
        angularSpeedRadiansPerSecond: 0,
        requiredTranslationSubsteps: 5,
        requiredRotationSubsteps: 0,
        requiredMotionSubsteps: 5
      }]
    });
  });

  it("classifies the first non-finite input field without publishing scratch state", () => {
    const source = admitted(emptyWorld(11, 0), [candidate(3)]);
    const invalidWorld: Readonly<SurfaceRigidBodyWorld> = Object.freeze({
      ...source,
      bodies: Object.freeze([
        Object.freeze({
          ...source.bodies[0],
          linearVelocityMetersPerSecond: Object.freeze({
            ...source.bodies[0].linearVelocityMetersPerSecond,
            x: Number.NaN
          })
        })
      ])
    });
    const before = JSON.stringify(source);

    const failed = stepSurfaceRigidBodyWorld(invalidWorld);

    expect(failed.status).toBe("Failed");
    expect(failed.world.physicsFailure).toMatchObject({
      code: "NonFiniteState",
      simulationTick: 12,
      bodyIds: ["body:tree:3"]
    });
    expect(JSON.stringify(source)).toBe(before);
    const diagnostics = readSurfaceRigidBodyStepDiagnostics(failed.world);
    expect(diagnostics).toMatchObject({
      sourceSimulationTick: 11,
      attemptedSimulationTick: 12,
      outcome: "Failed",
      stage: "PreStepValidation",
      failureCode: "NonFiniteState",
      selectedSubsteps: null,
      completedSubsteps: 0,
      contactsPerSubstep: [],
      cumulativeContactCount: 0,
      firstNonFiniteField: {
        bodyId: "body:tree:3",
        path: "linearVelocityMetersPerSecond.x"
      },
      bodies: [{
        bodyId: "body:tree:3",
        active: true,
        poseFinite: true,
        linearVelocityFinite: false,
        angularVelocityFinite: true,
        predictedNextTickLinearSpeedMetersPerSecond: null,
        angularSpeedRadiansPerSecond: 0,
        requiredTranslationSubsteps: null,
        requiredRotationSubsteps: 0,
        requiredMotionSubsteps: null
      }]
    });
    expect(Number.isNaN(diagnostics?.firstNonFiniteField?.value)).toBe(true);
    expect(diagnostics).toBeDefined();
    expect(isDeepFrozen(diagnostics)).toBe(true);
  });

  it.each([
    {
      name: "Terrain-only",
      preservesLinearMomentum: false,
      createWorld: () => admitted(createSurfaceRigidBodyWorld({
        simulationTick: 0,
        gravityMetersPerSecondSquared: 0,
        terrainColliders: [{
          colliderKey: "terrain:post-contact-budget",
          minimumMeters: { x: -1, y: -1, z: -1 },
          maximumMeters: { x: 1, y: 0, z: 1 }
        }]
      }), [woodCellCandidate(500, {
        positionMeters: { x: 0, y: 0.06, z: 0 },
        orientation: createQuaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.2),
        linearVelocityMetersPerSecond: { x: 0, y: -2, z: 0 }
      })])
    },
    {
      name: "Body/Body-only",
      preservesLinearMomentum: true,
      createWorld: () => admitted(emptyWorld(0, 0), [
        woodCellCandidate(501, {
          positionMeters: { x: -0.04, y: 0, z: 0 },
          linearVelocityMetersPerSecond: { x: 1.0337, y: 0, z: 0 }
        }),
        woodCellCandidate(502, {
          positionMeters: { x: 0.04, y: 0.0048, z: 0 },
          orientation: createQuaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.04),
          linearVelocityMetersPerSecond: { x: -1.0337, y: 0, z: 0 }
        })
      ])
    }
  ])("keeps $name contact impulses inside the published next-tick motion budget", ({
    createWorld,
    preservesLinearMomentum
  }) => {
    const run = () => {
      const initial = createWorld();
      const energyBefore = totalKineticEnergy(initial);
      const momentumBefore = totalLinearMomentum(initial);
      const first = stepSurfaceRigidBodyWorld(initial);
      expect(first.status).toBe("Advanced");
      if (first.status !== "Advanced") throw new Error("Contact fixture did not reach its first published tick.");
      const energyAfter = totalKineticEnergy(first.world);
      const momentumAfter = totalLinearMomentum(first.world);
      const requiredSubsteps = first.world.bodies.map((body) =>
        requiredMotionSubsteps(body, first.world.gravityMetersPerSecondSquared));
      const maximumAngularSpeed = Math.max(...first.world.bodies.map((body) => Math.hypot(
        body.angularVelocityRadiansPerSecond.x,
        body.angularVelocityRadiansPerSecond.y,
        body.angularVelocityRadiansPerSecond.z
      )));
      const second = stepSurfaceRigidBodyWorld(first.world);
      return {
        first,
        second,
        energyBefore,
        energyAfter,
        momentumBefore,
        momentumAfter,
        requiredSubsteps,
        maximumAngularSpeed
      };
    };

    const result = run();
    const repeated = run();
    expect(JSON.stringify(repeated)).toBe(JSON.stringify(result));
    expect(result.energyAfter).toBeLessThanOrEqual(result.energyBefore + 1e-12);
    expect(result.maximumAngularSpeed).toBeGreaterThan(0);
    if (preservesLinearMomentum) {
      expect(result.momentumAfter.x).toBeCloseTo(result.momentumBefore.x, 14);
      expect(result.momentumAfter.y).toBeCloseTo(result.momentumBefore.y, 14);
      expect(result.momentumAfter.z).toBeCloseTo(result.momentumBefore.z, 14);
    }
    expect.soft(
      result.requiredSubsteps.every((substeps) => substeps <= SURFACE_RIGID_BODY_MAX_SUBSTEPS),
      `published requiredSubsteps=${JSON.stringify(result.requiredSubsteps)}, motions=${JSON.stringify(result.first.world.bodies.map((body) => ({
        linear: body.linearVelocityMetersPerSecond,
        angular: body.angularVelocityRadiansPerSecond
      })))}`
    ).toBe(true);
    expect.soft(
      result.second.status,
      `next tick=${JSON.stringify(result.second.world.physicsFailure)}`
    ).toBe("Advanced");
    expect.soft(result.second.world.physicsFailure).toBeNull();
  });

  it("keeps the one-body multi-substep Terrain response inside the shared angular boundary", () => {
    const run = () => {
      const initial = admitted(createSurfaceRigidBodyWorld({
        simulationTick: 0,
        gravityMetersPerSecondSquared: 11.78,
        terrainColliders: [{
          colliderKey: "terrain:single-body-multi-substep-regression",
          minimumMeters: { x: -2, y: -1, z: -2 },
          maximumMeters: { x: 2, y: 0, z: 2 }
        }]
      }), [woodCellCandidate(900, {
        positionMeters: { x: 0, y: 0.03, z: 0 },
        orientation: createQuaternionFromAxisAngle({ x: 0, y: 0, z: 1 }, 0.2),
        linearVelocityMetersPerSecond: { x: 0, y: -12, z: 0 }
      })]);
      const first = stepSurfaceRigidBodyWorld(initial);
      expect(first.status).toBe("Advanced");
      if (first.status !== "Advanced") throw new Error("Expected the pinned first tick to advance.");
      const firstDiagnostics = readSurfaceRigidBodyStepDiagnostics(first.world);
      const second = stepSurfaceRigidBodyWorld(first.world);
      return Object.freeze({
        firstWorld: first.world,
        firstDiagnostics,
        second,
        secondDiagnostics: readSurfaceRigidBodyStepDiagnostics(second.world)
      });
    };

    const result = run();
    expect(result.firstDiagnostics).toMatchObject({
      outcome: "Advanced",
      selectedSubsteps: 4,
      completedSubsteps: 4,
      contactsPerSubstep: [1, 1, 1, 1],
      cumulativeContactCount: 4,
      bodies: [{
        bodyId: "body:tree:900",
        colliderCount: 1,
        lifecycle: "Falling",
        requiredTranslationSubsteps: 3,
        requiredRotationSubsteps: 4,
        requiredMotionSubsteps: 4
      }]
    });
    expect(result.firstWorld.bodies[0].angularVelocityRadiansPerSecond.z)
      .toBe(-8.377580409572783);
    expect(result.second.status).toBe("Advanced");
    expect(result.second.world.physicsFailure).toBeNull();
    expect(result.secondDiagnostics).toMatchObject({
      outcome: "Advanced",
      stage: "Advanced",
      failureCode: null,
      selectedSubsteps: 4,
      completedSubsteps: 4,
      bodies: [{
        requiredTranslationSubsteps: 3,
        requiredRotationSubsteps: 4,
        requiredMotionSubsteps: 4
      }]
    });
    expect(JSON.stringify(run())).toBe(JSON.stringify(result));
  });

  it("fails on the 257th generated contact without publishing scratch state", () => {
    const cells = Array.from({ length: 64 }, (_, index) => ({ x: index * 2, y: 0, z: 0 }));
    const terrainColliders = Array.from({ length: 5 }, (_, index) => ({
      colliderKey: `terrain:${index}`,
      minimumMeters: { x: -1, y: -1, z: -1 },
      maximumMeters: { x: 128, y: 2, z: 2 }
    }));
    const base = createSurfaceRigidBodyWorld({ simulationTick: 0, gravityMetersPerSecondSquared: 0, terrainColliders });
    const world = admitted(base, [candidate(1, { occupiedCells: cells })]);
    const before = JSON.stringify(surfaceRigidBodySnapshots(world));

    const failed = stepSurfaceRigidBodyWorld(world);
    expect(failed.status).toBe("Failed");
    expect(failed.world.physicsFailure?.code).toBe("ContactBudgetExceeded");
    expect(JSON.stringify(surfaceRigidBodySnapshots(failed.world))).toBe(before);
    expect(readSurfaceRigidBodyStepDiagnostics(failed.world)).toMatchObject({
      sourceSimulationTick: 0,
      attemptedSimulationTick: 1,
      outcome: "Failed",
      stage: "ContactBudget",
      failureCode: "ContactBudgetExceeded",
      selectedSubsteps: 1,
      completedSubsteps: 0,
      contactsPerSubstep: [320],
      cumulativeContactCount: 320,
      firstNonFiniteField: null,
      bodies: [{
        bodyId: "body:tree:1",
        active: true,
        sourceObjectRevision: 1,
        sourceContentHash: HASH,
        colliderRevision: 1,
        colliderCount: 64
      }]
    });
  });

  it("settles on authoritative terrain after exactly 120 slow outer ticks", () => {
    const base = createSurfaceRigidBodyWorld({
      simulationTick: 0,
      gravityMetersPerSecondSquared: 9.81,
      terrainColliders: [{
        colliderKey: "terrain:ground",
        minimumMeters: { x: -10, y: -1, z: -10 },
        maximumMeters: { x: 10, y: 0, z: 10 }
      }]
    });
    let world = admitted(base, [candidate(1)]);
    for (let tick = 0; tick < 119; tick += 1) {
      const result = stepSurfaceRigidBodyWorld(world);
      expect(result.status).toBe("Advanced");
      world = result.world;
    }
    expect(world.bodies[0].lifecycle).toBe("Falling");
    const final = stepSurfaceRigidBodyWorld(world);
    expect(final.status).toBe("Advanced");
    expect(final.world.bodies[0]).toMatchObject({
      lifecycle: "Resting",
      restingTicks: 120,
      linearVelocityMetersPerSecond: { x: 0, y: 0, z: 0 },
      angularVelocityRadiansPerSecond: { x: 0, y: 0, z: 0 }
    });
  });

  it("is byte-deterministic and clears bodies only through explicit cleanup", () => {
    const first = admitted(emptyWorld(0, 0), [candidate(2), candidate(1)]);
    const second = admitted(emptyWorld(0, 0), [candidate(1), candidate(2)]);
    const firstStep = stepSurfaceRigidBodyWorld(first);
    const secondStep = stepSurfaceRigidBodyWorld(second);
    expect(JSON.stringify(surfaceRigidBodySnapshots(firstStep.world))).toBe(JSON.stringify(surfaceRigidBodySnapshots(secondStep.world)));

    const cleared = clearSurfaceRigidBodyWorld(firstStep.world);
    expect(cleared.bodies).toEqual([]);
    expect(cleared.simulationTick).toBe(firstStep.world.simulationTick);
  });

  it("raycasts the current rotated compound OBB with normalized direction and no mutation", () => {
    const orientation = createQuaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 4);
    const world = admitted(emptyWorld(0, 0), [candidate(1, {
      positionMeters: { x: 0, y: 1, z: 0 },
      orientation
    })]);
    const before = JSON.stringify(world);

    const hit = raycastSurfaceRigidBodies(world, {
      originMeters: { x: -3, y: 1, z: 0 },
      direction: { x: 10, y: 0, z: 0 },
      maximumDistanceMeters: 8
    });
    expect(hit.status).toBe("Hit");
    if (hit.status !== "Hit") throw new Error("Rotated rigid body unexpectedly missed.");
    expect(hit.hit).toMatchObject({
      bodyId: "body:tree:1",
      componentId: "component:tree:1",
      colliderIndex: 0
    });
    expect(hit.hit.distanceMeters).toBeCloseTo(3 - Math.SQRT1_2, 12);
    expect(hit.hit.pointMeters.x).toBeCloseTo(-Math.SQRT1_2, 12);
    expect(hit.hit.normal.x).toBeLessThan(-0.7);
    expect(Math.hypot(hit.hit.normal.x, hit.hit.normal.y, hit.hit.normal.z)).toBeCloseTo(1, 14);
    expect(JSON.stringify(world)).toBe(before);
    expect(isDeepFrozen(hit)).toBe(true);
  });

  it("uses stable body ID and collider ordering for equal nearest ray hits", () => {
    const world = admitted(emptyWorld(0, 0), [
      candidate(2, { positionMeters: { x: 0, y: 1, z: 0 } }),
      candidate(1, { positionMeters: { x: 0, y: 1, z: 0 } })
    ]);
    const hit = raycastSurfaceRigidBodies(world, {
      originMeters: { x: -3, y: 1, z: 0 },
      direction: { x: 1, y: 0, z: 0 },
      maximumDistanceMeters: 8
    });
    expect(hit).toMatchObject({ status: "Hit", hit: { bodyId: "body:tree:1", colliderIndex: 0 } });
  });

  it("returns outward normals for negative-direction rays and downward capsule sweeps", () => {
    const world = admitted(emptyWorld(0, 0), [candidate(1, {
      positionMeters: { x: 0, y: 1, z: 0 }
    })]);
    const ray = raycastSurfaceRigidBodies(world, {
      originMeters: { x: 3, y: 1, z: 0 },
      direction: { x: -1, y: 0, z: 0 },
      maximumDistanceMeters: 8
    });
    const groundSweep = sweepSurfaceRigidBodyCapsule(world, {
      capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
      startPositionMeters: { x: 0, y: 3, z: 0 },
      displacementMeters: { x: 0, y: -4, z: 0 }
    });

    expect(ray).toMatchObject({ status: "Hit", hit: { normal: { x: 1, y: 0, z: 0 } } });
    expect(groundSweep).toMatchObject({ status: "Hit", hit: { normal: { x: 0, y: 1, z: 0 } } });
  });

  it("queries Resting bodies and deterministically misses an empty world", () => {
    const empty = emptyWorld(0, 0);
    const rayMiss = raycastSurfaceRigidBodies(empty, {
      originMeters: { x: 0, y: 1, z: 0 },
      direction: { x: 1, y: 0, z: 0 },
      maximumDistanceMeters: 8
    });
    const sweepMiss = sweepSurfaceRigidBodyCapsule(empty, {
      capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
      startPositionMeters: { x: 0, y: 1, z: 0 },
      displacementMeters: { x: 2, y: 0, z: 0 }
    });
    expect(rayMiss).toEqual({ status: "Miss", hit: null });
    expect(sweepMiss).toEqual({ status: "Miss", fraction: 1, hit: null });
    expect(isDeepFrozen(rayMiss)).toBe(true);
    expect(isDeepFrozen(sweepMiss)).toBe(true);

    let resting = admitted(empty, [candidate(1, { positionMeters: { x: 0, y: 1, z: 0 } })]);
    for (let tick = 0; tick < 120; tick += 1) {
      const next = stepSurfaceRigidBodyWorld(resting);
      expect(next.status).toBe("Advanced");
      resting = next.world;
    }
    expect(resting.bodies[0].lifecycle).toBe("Resting");
    expect(raycastSurfaceRigidBodies(resting, {
      originMeters: { x: -3, y: 1, z: 0 },
      direction: { x: 1, y: 0, z: 0 },
      maximumDistanceMeters: 8
    })).toMatchObject({ status: "Hit", hit: { bodyId: "body:tree:1" } });
  });

  it("sweeps the V1 upright capsule in body-local space and fails closed on start overlap", () => {
    const world = admitted(emptyWorld(0, 0), [candidate(1, {
      positionMeters: { x: 0, y: 1, z: 0 },
      orientation: createQuaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 4)
    })]);
    const before = JSON.stringify(world);
    const swept = sweepSurfaceRigidBodyCapsule(world, {
      capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
      startPositionMeters: { x: -3, y: 1, z: 0 },
      displacementMeters: { x: 6, y: 0, z: 0 }
    });
    expect(swept.status).toBe("Hit");
    if (swept.status !== "Hit") throw new Error("Rotated rigid-body capsule sweep unexpectedly missed.");
    expect(swept.fraction).toBeGreaterThan(0);
    expect(swept.fraction).toBeLessThan(0.5);
    expect(swept.hit.bodyId).toBe("body:tree:1");
    expect(swept.hit.normal.x).toBeLessThan(-0.7);

    const overlap = sweepSurfaceRigidBodyCapsule(world, {
      capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
      startPositionMeters: { x: 0, y: 1, z: 0 },
      displacementMeters: { x: 1, y: 0, z: 0 }
    });
    expect(overlap).toMatchObject({
      status: "Hit",
      fraction: 0,
      hit: { bodyId: "body:tree:1", colliderIndex: 0, fraction: 0, distanceMeters: 0 }
    });
    if (overlap.status !== "Hit") throw new Error("Start overlap unexpectedly missed.");
    expect(Math.hypot(overlap.hit.normal.x, overlap.hit.normal.y, overlap.hit.normal.z)).toBeCloseTo(1, 14);
    expect(JSON.stringify(world)).toBe(before);
    expect(isDeepFrozen(swept)).toBe(true);
    expect(isDeepFrozen(overlap)).toBe(true);
  });

  it("deterministically separates a capsule start-overlap within the fixed work budget", () => {
    const world = admitted(emptyWorld(0, 0), [candidate(1, {
      positionMeters: { x: 0, y: 1, z: 0 },
      orientation: createQuaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 4)
    })]);
    const before = JSON.stringify(world);
    const query = {
      capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
      positionMeters: { x: 0, y: 1, z: 0 },
      skinMeters: 0.02
    } as const;

    const first = separateSurfaceRigidBodyCapsule(world, query);
    const repeat = separateSurfaceRigidBodyCapsule(world, query);

    expect(first).toEqual(repeat);
    expect(first.status).toBe("Separated");
    expect(first.iterations).toBeGreaterThan(0);
    expect(first.iterations).toBeLessThanOrEqual(SURFACE_RIGID_BODY_CAPSULE_SEPARATION_MAX_ITERATIONS);
    expect(first.positionMeters).not.toEqual(query.positionMeters);
    expect(sweepSurfaceRigidBodyCapsule(world, {
      capsule: query.capsule,
      startPositionMeters: first.positionMeters,
      displacementMeters: { x: 0, y: 0, z: 0 }
    })).toEqual({ status: "Miss", fraction: 1, hit: null });
    const outwardNormal = first.contacts[first.contacts.length - 1]?.normal;
    if (outwardNormal === undefined) throw new Error("Expected a deterministic separation contact.");
    expect(sweepSurfaceRigidBodyCapsule(world, {
      capsule: query.capsule,
      startPositionMeters: first.positionMeters,
      displacementMeters: {
        x: outwardNormal.x * 0.1,
        y: outwardNormal.y * 0.1,
        z: outwardNormal.z * 0.1
      }
    })).toEqual({ status: "Miss", fraction: 1, hit: null });
    expect(JSON.stringify(world)).toBe(before);
    expect(isDeepFrozen(first)).toBe(true);
  });

  it("escapes overlapping expanded boxes in a compound voxel collider without oscillating", () => {
    const compoundCandidate = candidate(2, {
      occupiedCells: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 }
      ]
    });
    expect(compoundCandidate.colliders.length).toBeGreaterThan(1);
    const world = admitted(emptyWorld(0, 0), [compoundCandidate]);
    const body = world.bodies[0];
    const first = body.colliders[0];
    const second = body.colliders[1];
    const capsule = { radiusMeters: 0.35, heightMeters: 1.8 } as const;
    const expansion = { x: capsule.radiusMeters, y: capsule.heightMeters / 2, z: capsule.radiusMeters };
    const overlapMinimum = {
      x: Math.max(first.centerMeters.x - first.halfExtentsMeters.x - expansion.x, second.centerMeters.x - second.halfExtentsMeters.x - expansion.x),
      y: Math.max(first.centerMeters.y - first.halfExtentsMeters.y - expansion.y, second.centerMeters.y - second.halfExtentsMeters.y - expansion.y),
      z: Math.max(first.centerMeters.z - first.halfExtentsMeters.z - expansion.z, second.centerMeters.z - second.halfExtentsMeters.z - expansion.z)
    };
    const overlapMaximum = {
      x: Math.min(first.centerMeters.x + first.halfExtentsMeters.x + expansion.x, second.centerMeters.x + second.halfExtentsMeters.x + expansion.x),
      y: Math.min(first.centerMeters.y + first.halfExtentsMeters.y + expansion.y, second.centerMeters.y + second.halfExtentsMeters.y + expansion.y),
      z: Math.min(first.centerMeters.z + first.halfExtentsMeters.z + expansion.z, second.centerMeters.z + second.halfExtentsMeters.z + expansion.z)
    };
    expect(overlapMaximum.x).toBeGreaterThan(overlapMinimum.x);
    expect(overlapMaximum.y).toBeGreaterThan(overlapMinimum.y);
    expect(overlapMaximum.z).toBeGreaterThan(overlapMinimum.z);
    const startPositionMeters = {
      x: body.positionMeters.x + (overlapMinimum.x + overlapMaximum.x) / 2,
      y: body.positionMeters.y + (overlapMinimum.y + overlapMaximum.y) / 2,
      z: body.positionMeters.z + (overlapMinimum.z + overlapMaximum.z) / 2
    };

    const result = separateSurfaceRigidBodyCapsule(world, {
      capsule,
      positionMeters: startPositionMeters,
      skinMeters: 0.02
    });

    expect(result.status).toBe("Separated");
    expect(result.iterations).toBe(1);
    expect(sweepSurfaceRigidBodyCapsule(world, {
      capsule,
      startPositionMeters: result.positionMeters,
      displacementMeters: { x: 0, y: 0, z: 0 }
    })).toEqual({ status: "Miss", fraction: 1, hit: null });
  });

  it("rolls back a rounded partial correction when bounded separation cannot make further progress", () => {
    const noProgressCoordinate = 10_000_000_000_000_000;
    const world = admitted(emptyWorld(0, 0), [candidate(3, {
      cellSizeMeters: 5,
      centerOfMassMeters: { x: 2.5, y: 2.5, z: 2.5 },
      positionMeters: { x: noProgressCoordinate, y: noProgressCoordinate, z: noProgressCoordinate }
    })]);
    const startPositionMeters = {
      x: noProgressCoordinate,
      y: noProgressCoordinate,
      z: noProgressCoordinate
    } as const;

    const result = separateSurfaceRigidBodyCapsule(world, {
      capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
      positionMeters: startPositionMeters,
      skinMeters: 0.02
    });

    expect(result.status).toBe("Blocked");
    expect(result.iterations).toBe(SURFACE_RIGID_BODY_CAPSULE_SEPARATION_MAX_ITERATIONS);
    expect(result.contacts).toHaveLength(SURFACE_RIGID_BODY_CAPSULE_SEPARATION_MAX_ITERATIONS);
    expect(result.positionMeters).toEqual(startPositionMeters);
  });

  it("immutably replaces sorted Terrain colliders without changing body snapshots", () => {
    const world = admitted(emptyWorld(7, 0), [candidate(1, { detachedAtSimulationTick: 7 })]);
    const snapshots = surfaceRigidBodySnapshots(world);
    const replacement = replaceSurfaceRigidBodyTerrainColliders(world, [
      {
        colliderKey: "terrain:z",
        minimumMeters: { x: 4, y: -1, z: 4 },
        maximumMeters: { x: 5, y: 0, z: 5 }
      },
      {
        colliderKey: "terrain:a",
        minimumMeters: { x: -5, y: -1, z: -5 },
        maximumMeters: { x: -4, y: 0, z: -4 }
      }
    ]);
    expect(replacement).not.toBe(world);
    expect(replacement.bodies).toBe(world.bodies);
    expect(replacement.physicsFailure).toBe(world.physicsFailure);
    expect(replacement.simulationTick).toBe(7);
    expect(replacement.terrainColliders.map((collider) => collider.colliderKey))
      .toEqual(["terrain:a", "terrain:z"]);
    expect(surfaceRigidBodySnapshots(replacement)).toEqual(snapshots);
    expect(world.terrainColliders).toEqual([]);
    expect(() => replaceSurfaceRigidBodyTerrainColliders(world, [
      {
        colliderKey: "terrain:duplicate",
        minimumMeters: { x: 0, y: -1, z: 0 },
        maximumMeters: { x: 1, y: 0, z: 1 }
      },
      {
        colliderKey: "terrain:duplicate",
        minimumMeters: { x: 2, y: -1, z: 2 },
        maximumMeters: { x: 3, y: 0, z: 3 }
      }
    ])).toThrowError("terrain collider keys must be unique");
    expect(isDeepFrozen(replacement)).toBe(true);
  });

  it("never reuses a Terrain index after immutable collider-list replacement", () => {
    const farTerrain = [{
      colliderKey: "terrain:far",
      minimumMeters: { x: 100, y: -1, z: 100 },
      maximumMeters: { x: 101, y: 0, z: 101 }
    }] as const;
    let world = admitted(createSurfaceRigidBodyWorld({
      simulationTick: 0,
      gravityMetersPerSecondSquared: 0,
      terrainColliders: farTerrain
    }), [candidate(90, { positionMeters: { x: 0, y: 0.45, z: 0 } })]);

    const first = stepSurfaceRigidBodyWorld(world);
    expect(readSurfaceRigidBodyTerrainBroadphaseStats(first.world)).toMatchObject({
      terrainBoxPreparationCount: 1,
      candidatePairCount: 0
    });
    world = first.world;
    const cached = stepSurfaceRigidBodyWorld(world);
    expect(readSurfaceRigidBodyTerrainBroadphaseStats(cached.world)).toMatchObject({
      terrainBoxPreparationCount: 0,
      candidatePairCount: 0
    });

    const replaced = replaceSurfaceRigidBodyTerrainColliders(cached.world, [{
      colliderKey: "terrain:near",
      minimumMeters: { x: -2, y: -1, z: -2 },
      maximumMeters: { x: 2, y: 0, z: 2 }
    }]);
    const current = stepSurfaceRigidBodyWorld(replaced);
    expect(readSurfaceRigidBodyTerrainBroadphaseStats(current.world)).toMatchObject({
      terrainBoxPreparationCount: 1,
      candidatePairCount: 1,
      aabbOverlapCount: 1
    });
  });

  it("preserves local Terrain outcomes with far distractors for rotated, moving, boundary-touching, and no-contact bodies", () => {
    const ground = [{
      colliderKey: "terrain:ground",
      minimumMeters: { x: -2, y: -1, z: -2 },
      maximumMeters: { x: 2, y: 0, z: 2 }
    }] as const;
    const wall = [{
      colliderKey: "terrain:wall",
      minimumMeters: { x: -1, y: 0, z: -1 },
      maximumMeters: { x: 0, y: 1, z: 1 }
    }] as const;
    const layeredGround = [{
      colliderKey: "terrain:layer:a",
      minimumMeters: { x: -2, y: -1, z: -2 },
      maximumMeters: { x: 2, y: 0, z: 2 }
    }, {
      colliderKey: "terrain:layer:z",
      minimumMeters: { x: -0.75, y: -0.5, z: -0.75 },
      maximumMeters: { x: 0.75, y: 0.05, z: 0.75 }
    }] as const;
    const distractors = Array.from({ length: 96 }, (_, index) => ({
      colliderKey: `terrain:distractor:${index.toString().padStart(3, "0")}`,
      minimumMeters: { x: 1_000 + index * 3, y: -1, z: 1_000 },
      maximumMeters: { x: 1_001 + index * 3, y: 0, z: 1_001 }
    }));
    const scenarios = [
      {
        name: "rotated penetration",
        terrain: layeredGround,
        overrides: {
          positionMeters: { x: 0, y: 0.45, z: 0 },
          orientation: createQuaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 5),
          angularVelocityRadiansPerSecond: { x: 0, y: 0.1, z: 0 }
        }
      },
      {
        name: "moving zero-penetration landing",
        terrain: ground,
        overrides: {
          positionMeters: { x: 0, y: 0.51, z: 0 },
          linearVelocityMetersPerSecond: { x: 0.2, y: -0.6, z: 0 }
        }
      },
      {
        name: "boundary-touching side",
        terrain: wall,
        overrides: { positionMeters: { x: 0.5, y: 0.5, z: 0 } }
      },
      {
        name: "no contact",
        terrain: ground,
        overrides: { positionMeters: { x: 0, y: 5, z: 0 } }
      }
    ] as const;

    for (const [index, scenario] of scenarios.entries()) {
      const reference = admitted(createSurfaceRigidBodyWorld({
        simulationTick: 0,
        gravityMetersPerSecondSquared: 0,
        terrainColliders: scenario.terrain
      }), [candidate(100 + index, scenario.overrides)]);
      const indexed = admitted(createSurfaceRigidBodyWorld({
        simulationTick: 0,
        gravityMetersPerSecondSquared: 0,
        terrainColliders: [...scenario.terrain, ...distractors]
      }), [candidate(100 + index, scenario.overrides)]);
      const referenceStep = stepSurfaceRigidBodyWorld(reference);
      const indexedStep = stepSurfaceRigidBodyWorld(indexed);
      expect({
        status: indexedStep.status,
        simulationTick: indexedStep.world.simulationTick,
        bodies: surfaceRigidBodySnapshots(indexedStep.world),
        physicsFailure: indexedStep.world.physicsFailure
      }, scenario.name).toEqual({
        status: referenceStep.status,
        simulationTick: referenceStep.world.simulationTick,
        bodies: surfaceRigidBodySnapshots(referenceStep.world),
        physicsFailure: referenceStep.world.physicsFailure
      });
      const stats = readSurfaceRigidBodyTerrainBroadphaseStats(indexedStep.world);
      expect(stats, scenario.name).toBeDefined();
      expect(stats!.candidatePairCount, scenario.name).toBeLessThan(stats!.bruteForcePairCount);
    }
  });

  it("falls back to all canonical entries for a no-progress 1e16 body query", () => {
    const noProgressCoordinate = 10_000_000_000_000_000;
    const world = admitted(createSurfaceRigidBodyWorld({
      simulationTick: 0,
      gravityMetersPerSecondSquared: 0,
      terrainColliders: [{
        colliderKey: "terrain:regular-origin",
        minimumMeters: { x: 0, y: -1, z: 0 },
        maximumMeters: { x: 1, y: 0, z: 1 }
      }, {
        colliderKey: "terrain:unsafe-coordinate",
        minimumMeters: { x: noProgressCoordinate - 2, y: 100, z: noProgressCoordinate - 2 },
        maximumMeters: { x: noProgressCoordinate + 2, y: 101, z: noProgressCoordinate + 2 }
      }]
    }), [candidate(400, {
      positionMeters: { x: noProgressCoordinate, y: 0.5, z: noProgressCoordinate }
    })]);
    expect(noProgressCoordinate + 1).toBe(noProgressCoordinate);
    expect(bruteForceStaticTerrainAabbOverlapCount(world)).toBe(0);

    const result = stepSurfaceRigidBodyWorld(world);
    expect(result.status).toBe("Advanced");
    expect(result.world.physicsFailure).toBeNull();
    expect(surfaceRigidBodySnapshots(result.world)[0].positionMeters).toEqual(world.bodies[0].positionMeters);
    expect(readSurfaceRigidBodyTerrainBroadphaseStats(result.world)).toMatchObject({
      terrainColliderCount: 2,
      bodyColliderQueryCount: 1,
      bruteForcePairCount: 2,
      candidatePairCount: 2,
      aabbOverlapCount: 0
    });
  });

  it("matches an independent brute-force AABB oracle and includes huge overflow Terrain contacts canonically", () => {
    const terrainColliders = [{
      colliderKey: "terrain:regular-far",
      minimumMeters: { x: 10, y: -1, z: 10 },
      maximumMeters: { x: 11, y: 0, z: 11 }
    }, {
      colliderKey: "terrain:overflow-ground",
      minimumMeters: { x: -100_000, y: -1, z: -100_000 },
      maximumMeters: { x: 100_000, y: 0, z: 100_000 }
    }] as const;
    const createWorld = (
      terrain: Parameters<typeof createSurfaceRigidBodyWorld>[0]["terrainColliders"]
    ) => admitted(createSurfaceRigidBodyWorld({
      simulationTick: 0,
      gravityMetersPerSecondSquared: 0,
      terrainColliders: terrain
    }), [candidate(401, {
      positionMeters: { x: 0, y: 0.45, z: 0 },
      orientation: createQuaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 5)
    })]);
    const firstWorld = createWorld(terrainColliders);
    const reorderedWorld = createWorld([...terrainColliders].reverse());
    const bruteForceOverlapCount = bruteForceStaticTerrainAabbOverlapCount(firstWorld);
    expect(bruteForceOverlapCount).toBe(1);

    const first = stepSurfaceRigidBodyWorld(firstWorld);
    const reordered = stepSurfaceRigidBodyWorld(reorderedWorld);
    expect(first.status).toBe("Advanced");
    expect(reordered.status).toBe("Advanced");
    expect(first.world.physicsFailure).toBeNull();
    expect(surfaceRigidBodySnapshots(first.world)).toEqual(surfaceRigidBodySnapshots(reordered.world));
    expect(first.world.bodies[0].positionMeters.y).toBeGreaterThan(firstWorld.bodies[0].positionMeters.y);
    expect(readSurfaceRigidBodyTerrainBroadphaseStats(first.world)).toMatchObject({
      terrainColliderCount: 2,
      bodyColliderQueryCount: 1,
      bruteForcePairCount: 2,
      candidatePairCount: 1,
      aabbOverlapCount: bruteForceOverlapCount
    });
  });

  it("preserves canonical resting ticks and byte-equal snapshots with far Terrain distractors", () => {
    const ground = {
      colliderKey: "terrain:ground",
      minimumMeters: { x: -10, y: -1, z: -10 },
      maximumMeters: { x: 10, y: 0, z: 10 }
    } as const;
    const distractors = Array.from({ length: 64 }, (_, index) => ({
      colliderKey: `terrain:far:${index.toString().padStart(2, "0")}`,
      minimumMeters: { x: 500 + index * 2, y: -1, z: 500 },
      maximumMeters: { x: 501 + index * 2, y: 0, z: 501 }
    }));
    let reference = admitted(createSurfaceRigidBodyWorld({
      simulationTick: 0,
      gravityMetersPerSecondSquared: 9.81,
      terrainColliders: [ground]
    }), [candidate(200)]);
    let indexed = admitted(createSurfaceRigidBodyWorld({
      simulationTick: 0,
      gravityMetersPerSecondSquared: 9.81,
      terrainColliders: [ground, ...distractors]
    }), [candidate(200)]);

    for (let tick = 0; tick < 120; tick += 1) {
      const referenceStep = stepSurfaceRigidBodyWorld(reference);
      const indexedStep = stepSurfaceRigidBodyWorld(indexed);
      expect(indexedStep.status).toBe("Advanced");
      expect(referenceStep.status).toBe("Advanced");
      expect(JSON.stringify(surfaceRigidBodySnapshots(indexedStep.world)))
        .toBe(JSON.stringify(surfaceRigidBodySnapshots(referenceStep.world)));
      reference = referenceStep.world;
      indexed = indexedStep.world;
    }
    expect(indexed.bodies[0]).toMatchObject({ lifecycle: "Resting", restingTicks: 120 });
    expect(indexed.physicsFailure).toBeNull();
  });

  it("reduces the 55 by 576 Terrain pair budget and reuses the identity-bound index", () => {
    const terrainColliders = Array.from({ length: 24 * 24 }, (_, index) => {
      const x = index % 24;
      const z = Math.floor(index / 24);
      return {
        colliderKey: `terrain:${z.toString().padStart(2, "0")}:${x.toString().padStart(2, "0")}`,
        minimumMeters: { x: x - 12, y: -1, z: z - 12 },
        maximumMeters: { x: x - 11, y: 0, z: z - 11 }
      };
    });
    const occupiedCells = Array.from({ length: 55 }, (_, index) => ({
      x: (index % 11) * 2,
      y: 0,
      z: Math.floor(index / 11) * 2
    }));
    let world = admitted(createSurfaceRigidBodyWorld({
      simulationTick: 0,
      gravityMetersPerSecondSquared: 0,
      terrainColliders
    }), [candidate(300, {
      occupiedCells,
      centerOfMassMeters: { x: 10.5, y: 0.5, z: 4.5 },
      positionMeters: { x: 0, y: 10, z: 0 }
    })]);
    expect(world.bodies[0].colliders).toHaveLength(55);

    const first = stepSurfaceRigidBodyWorld(world);
    expect(first.status).toBe("Advanced");
    const firstStats = readSurfaceRigidBodyTerrainBroadphaseStats(first.world);
    expect(firstStats).toMatchObject({
      terrainColliderCount: 576,
      bodyColliderQueryCount: 55,
      bruteForcePairCount: 31_680,
      candidatePairCount: 495,
      terrainBoxPreparationCount: 576
    });
    expect(firstStats!.candidatePairCount).toBeLessThan(2_000);
    world = first.world;

    const cached = stepSurfaceRigidBodyWorld(world);
    expect(cached.status).toBe("Advanced");
    const finalStats = readSurfaceRigidBodyTerrainBroadphaseStats(cached.world)!;
    expect(finalStats).toMatchObject({
      terrainColliderCount: 576,
      bodyColliderQueryCount: 55,
      bruteForcePairCount: 31_680,
      candidatePairCount: firstStats!.candidatePairCount,
      terrainBoxPreparationCount: 0,
      bucketCount: firstStats!.bucketCount
    });
    expect(finalStats.candidatePairCount).toBeLessThan(finalStats.bruteForcePairCount / 10);
  });
});
