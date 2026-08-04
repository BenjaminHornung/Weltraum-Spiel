import { beforeAll, describe, expect, it } from "vitest";
import { validateVoxelStableId } from "../../src/voxel";
import {
  createSurfaceCapsuleSweepQuery,
  createSurfaceGroundContactQuery,
  createSurfacePlayerCommand,
  createSurfacePlayIdentity,
  createSurfaceRayQuery,
  type SurfaceAuthorityBinding
} from "../../src/surface-play/contracts";
import {
  createRevisionBoundSurfaceCollisionPort,
  type SurfaceCollisionDelegate
} from "../../src/surface-play/collision";
import {
  advanceSurfaceFixedStepRuntime,
  applySurfaceFixedStepCapsuleSeparation,
  createHestiaAgileGroundedLocomotionPresetV1,
  createSurfaceFixedStepRuntime,
  createSurfaceLocomotionState,
  type SurfaceFixedStepRuntime,
  type SurfaceLocomotionState
} from "../../src/surface-play/player";
import {
  admitSurfaceRigidBodyBatch,
  createSurfaceRigidBodyCandidate,
  createSurfaceRigidBodyWorld,
  separateSurfaceRigidBodyCapsule,
  stepSurfaceRigidBodyWorld,
  type SurfaceRigidBodyWorld
} from "../../src/surface-play/physics";
import { createHestiaUmbrellaTree } from "../../src/surface-play/vegetation/hestiaUmbrellaTree";
import {
  createSurfaceTreeAuthority,
  previewSurfaceTreeCanonicalHit,
  type SurfaceTreeAuthoritySnapshot
} from "../../src/surface-play/vegetation/surfaceTreeAuthority";
import {
  createSurfaceTreeCollisionSnapshot,
  type SurfaceTreeCollisionSnapshot
} from "../../src/surface-play/vegetation/surfaceTreeCollision";
import { createAttachedSurfaceTreeCollisionDelegate } from "../../src/surface-play/vegetation/surfaceTreeCollisionDelegate";

const config = createHestiaAgileGroundedLocomotionPresetV1();
const fixedDelta = config.fixedDeltaSeconds;
const baseIdentity = createSurfacePlayIdentity({
  bodyId: "body:hestia",
  regionId: "region:hestia-test",
  surfaceFrameId: "frame:hestia-test",
  generatorVersion: "hestia.generator.test",
  seed: "hestia-tree-collision-delegate",
  regionRevision: 4
});
const baseBinding: Readonly<SurfaceAuthorityBinding> = Object.freeze({
  bodyId: baseIdentity.bodyId,
  regionId: baseIdentity.regionId,
  surfaceFrameId: baseIdentity.surfaceFrameId,
  regionRevision: baseIdentity.regionRevision,
  simulationTick: 7
});

let authority: SurfaceTreeAuthoritySnapshot;
let tree: SurfaceTreeCollisionSnapshot;

beforeAll(() => {
  authority = createSurfaceTreeAuthority(createHestiaUmbrellaTree());
  tree = createSurfaceTreeCollisionSnapshot(authority);
}, 120_000);

const floorContact = (
  x: number,
  z: number,
  distanceMeters: number
) => ({
  pointMeters: { x, y: 0, z },
  normal: { x: 0, y: 1, z: 0 },
  distanceMeters,
  colliderId: "terrain:floor"
});

const flatTerrain: SurfaceCollisionDelegate = {
  queryGroundContact(query) {
    const bottom = query.positionMeters.y - query.capsule.heightMeters / 2;
    return {
      status: "Resolved",
      queryId: query.queryId,
      contact: bottom >= -1e-9 && bottom <= query.maximumDistanceMeters
        ? floorContact(query.positionMeters.x, query.positionMeters.z, Math.max(0, bottom))
        : null
    };
  },
  sweepCapsule: (query) => ({
    status: "Resolved",
    queryId: query.queryId,
    fraction: 1,
    contact: null
  }),
  queryRay: (query) => ({
    status: "Resolved",
    queryId: query.queryId,
    contact: null
  }),
  queryLine: (query) => ({
    status: "Resolved",
    queryId: query.queryId,
    contact: null
  })
};

const physicsWorld = () => createSurfaceRigidBodyWorld({
  simulationTick: 0,
  gravityMetersPerSecondSquared: config.gravityMetersPerSecondSquared,
  terrainColliders: []
});

const restingPhysicsWorld = (): Readonly<SurfaceRigidBodyWorld> => {
  let world = createSurfaceRigidBodyWorld({
    simulationTick: 0,
    gravityMetersPerSecondSquared: config.gravityMetersPerSecondSquared,
    terrainColliders: [{
      colliderKey: "terrain:resting-body-ground",
      minimumMeters: { x: 99, y: -1, z: -1 },
      maximumMeters: { x: 101, y: 0, z: 1 }
    }]
  });
  const admission = admitSurfaceRigidBodyBatch(world, [createSurfaceRigidBodyCandidate({
    bodyId: "body:resting-support",
    componentId: "component:resting-support",
    objectId: "object:resting-support",
    sourceObjectRevision: 1,
    sourceContentHash: "fnv1a64-v1:1111111111111111",
    occupiedCells: [{ x: 0, y: 0, z: 0 }],
    cellSizeMeters: 1,
    massKg: 1,
    centerOfMassMeters: { x: 0.5, y: 0.5, z: 0.5 },
    inertiaTensorKgMetersSquared: { xx: 1, yy: 1, zz: 1, xy: 0, xz: 0, yz: 0 },
    colliderRevision: 1,
    detachedAtSimulationTick: 0,
    positionMeters: { x: 100, y: 0.5, z: 0 }
  })]);
  if (admission.status !== "Admitted") throw new Error("Resting-body fixture admission failed.");
  world = admission.world;
  for (let tick = 0; tick < 120; tick += 1) {
    const result = stepSurfaceRigidBodyWorld(world);
    if (result.status !== "Advanced") throw new Error("Resting-body fixture physics failed.");
    world = result.world;
  }
  if (world.bodies[0]?.lifecycle !== "Resting") {
    throw new Error("Resting-body fixture did not reach Resting.");
  }
  return world;
};

const collisionPort = (
  snapshot: Readonly<SurfaceTreeCollisionSnapshot>,
  readBinding: () => Readonly<SurfaceAuthorityBinding> = () => baseBinding,
  world: Readonly<SurfaceRigidBodyWorld> = physicsWorld(),
  terrain: SurfaceCollisionDelegate = flatTerrain
) => createRevisionBoundSurfaceCollisionPort({
  readAuthorityBinding: readBinding,
  delegate: createAttachedSurfaceTreeCollisionDelegate({
    terrain,
    tree: snapshot,
    physicsWorld: world
  })
});

const rayQueryInsideCell = (
  snapshot: Readonly<SurfaceTreeCollisionSnapshot>,
  cellIndex: number,
  queryId: string
) => {
  const cell = snapshot.cells[cellIndex];
  if (cell === undefined) throw new Error("Tree fixture must contain the requested authoritative cell.");
  return createSurfaceRayQuery({
    ...baseBinding,
    queryId,
    kind: "Ray",
    originMeters: {
      x: (cell.minMeters.x + cell.maxMeters.x) / 2,
      y: (cell.minMeters.y + cell.maxMeters.y) / 2,
      z: (cell.minMeters.z + cell.maxMeters.z) / 2
    },
    direction: { x: 1, y: 0, z: 0 },
    maximumDistanceMeters: 0.05
  });
};

const rayInsideCell = (
  snapshot: Readonly<SurfaceTreeCollisionSnapshot>,
  cellIndex: number,
  queryId: string
) => collisionPort(snapshot).queryRay(rayQueryInsideCell(snapshot, cellIndex, queryId));

const contactColliderId = (
  result: ReturnType<ReturnType<typeof collisionPort>["queryRay"]>
): string => {
  expect(result.status).toBe("Resolved");
  if (result.status !== "Resolved") throw new Error(result.message);
  expect(result.contact).not.toBeNull();
  if (result.contact === null) throw new Error("Expected the ray to hit an authoritative Tree cell.");
  return result.contact.colliderId;
};

describe("attached Surface Tree collision delegate", () => {
  it("uses a Resting Dynamic Body as walkable support when Terrain is outside the ground probe", () => {
    const world = restingPhysicsWorld();
    const body = world.bodies[0];
    const collider = body?.colliders[0];
    if (body === undefined || collider === undefined) throw new Error("Resting-body fixture is incomplete.");
    const bodyTopMeters = body.positionMeters.y
      + collider.centerMeters.y
      + collider.halfExtentsMeters.y;
    const result = collisionPort(tree, () => baseBinding, world)
      .queryGroundContact(createSurfaceGroundContactQuery({
        ...baseBinding,
        queryId: "tree-body-ground-support",
        kind: "GroundContact",
        capsule: config.capsule,
        positionMeters: { x: 100, y: bodyTopMeters + config.capsule.heightMeters / 2, z: 0 },
        maximumDistanceMeters: config.groundProbeDistanceMeters
      }));

    expect(result.status).toBe("Resolved");
    if (result.status !== "Resolved") throw new Error(result.message);
    expect(result.contact).toMatchObject({
      normal: { x: 0, y: 1, z: 0 },
      distanceMeters: 0,
      colliderId: "structural-body:body:resting-support:0"
    });
  });

  it("keeps a pose-equal Falling Dynamic Body collidable but excludes it from Ground Support", () => {
    const resting = restingPhysicsWorld();
    const body = resting.bodies[0];
    const collider = body?.colliders[0];
    if (body === undefined || collider === undefined) throw new Error("Falling-body fixture is incomplete.");
    const falling = Object.freeze({
      ...resting,
      bodies: Object.freeze([Object.freeze({ ...body, lifecycle: "Falling" as const })])
    });
    const bodyTopMeters = body.positionMeters.y
      + collider.centerMeters.y
      + collider.halfExtentsMeters.y;
    const port = collisionPort(tree, () => baseBinding, falling);
    const ground = port.queryGroundContact(createSurfaceGroundContactQuery({
      ...baseBinding,
      queryId: "tree-body-falling-not-support",
      kind: "GroundContact",
      capsule: config.capsule,
      positionMeters: { x: 100, y: bodyTopMeters + config.capsule.heightMeters / 2, z: 0 },
      maximumDistanceMeters: config.groundProbeDistanceMeters
    }));
    const sweep = port.sweepCapsule(createSurfaceCapsuleSweepQuery({
      ...baseBinding,
      kind: "CapsuleSweep",
      queryId: "tree-body-falling-collision",
      capsule: config.capsule,
      startPositionMeters: { x: 98, y: body.positionMeters.y, z: 0 },
      displacementMeters: { x: 4, y: 0, z: 0 }
    }));

    expect(ground.status).toBe("Resolved");
    if (ground.status !== "Resolved") throw new Error(ground.message);
    expect(ground.contact).toBeNull();
    expect(sweep.status).toBe("Resolved");
    if (sweep.status !== "Resolved") throw new Error(sweep.message);
    expect(sweep.contact?.colliderId).toBe("structural-body:body:resting-support:0");
  });

  it("uses a stable body-first tie break when Terrain and Resting support are equidistant", () => {
    const world = restingPhysicsWorld();
    const body = world.bodies[0];
    const collider = body?.colliders[0];
    if (body === undefined || collider === undefined) throw new Error("Resting-body fixture is incomplete.");
    const bodyTopMeters = body.positionMeters.y
      + collider.centerMeters.y
      + collider.halfExtentsMeters.y;
    const tiedTerrain: SurfaceCollisionDelegate = {
      ...flatTerrain,
      queryGroundContact: (query) => ({
        status: "Resolved",
        queryId: query.queryId,
        contact: {
          pointMeters: { x: query.positionMeters.x, y: bodyTopMeters, z: query.positionMeters.z },
          normal: { x: 0, y: 1, z: 0 },
          distanceMeters: 0,
          colliderId: "terrain:tied-support"
        }
      })
    };
    const port = collisionPort(tree, () => baseBinding, world, tiedTerrain);
    const query = createSurfaceGroundContactQuery({
      ...baseBinding,
      queryId: "tree-body-tied-support",
      kind: "GroundContact",
      capsule: config.capsule,
      positionMeters: { x: 100, y: bodyTopMeters + config.capsule.heightMeters / 2, z: 0 },
      maximumDistanceMeters: config.groundProbeDistanceMeters
    });

    const first = port.queryGroundContact(query);
    const repeat = port.queryGroundContact(query);
    expect(first.status).toBe("Resolved");
    expect(repeat.status).toBe("Resolved");
    if (first.status !== "Resolved" || repeat.status !== "Resolved") {
      throw new Error("Tied support fixture unexpectedly rejected.");
    }
    expect(first.contact?.colliderId).toBe("structural-body:body:resting-support:0");
    expect(repeat.contact?.colliderId).toBe("structural-body:body:resting-support:0");
  });

  it("depenetrates a Resting body before four fixed ticks can accumulate unsupported gravity", () => {
    const world = restingPhysicsWorld();
    const body = world.bodies[0];
    const collider = body?.colliders[0];
    if (body === undefined || collider === undefined) throw new Error("Resting-body fixture is incomplete.");
    const bodyTopMeters = body.positionMeters.y
      + collider.centerMeters.y
      + collider.halfExtentsMeters.y;
    let authorityTick = 0;
    const port = collisionPort(
      tree,
      () => ({ ...baseBinding, simulationTick: authorityTick }),
      world
    );
    const initial = createSurfaceLocomotionState({
      playerId: "player:resting-body-separation",
      surfaceFrameId: baseBinding.surfaceFrameId,
      positionMeters: { x: 100, y: bodyTopMeters + config.capsule.heightMeters / 2 - 0.1, z: 0 },
      velocityMetersPerSecond: { x: 0, y: -100, z: 0 },
      yawRadians: 0,
      pitchRadians: 0,
      grounded: false,
      groundNormal: { x: 0, y: 1, z: 0 },
      movementMode: "Airborne",
      capsule: config.capsule,
      simulationTick: 0,
      jumpHeld: false,
      supportState: "Unsupported"
    });
    let fixedStep = createSurfaceFixedStepRuntime(initial);
    const separation = separateSurfaceRigidBodyCapsule(world, {
      capsule: initial.capsule,
      positionMeters: initial.positionMeters,
      skinMeters: config.collisionSkinMeters
    });
    expect(separation.status).toBe("Separated");
    fixedStep = applySurfaceFixedStepCapsuleSeparation(
      fixedStep,
      {
        positionMeters: separation.positionMeters,
        contactNormals: separation.contacts.map((contact) => contact.normal)
      },
      config.fixedDeltaSeconds
    );
    expect(fixedStep.currentState.positionMeters).not.toEqual(initial.positionMeters);
    expect(fixedStep.currentState.velocityMetersPerSecond.y).toBe(0);

    const positions = [JSON.stringify(fixedStep.currentState.positionMeters)];
    const downwardVelocities = [fixedStep.currentState.velocityMetersPerSecond.y];
    for (let tick = 0; tick < 4; tick += 1) {
      const result = advanceSurfaceFixedStepRuntime(
        fixedStep,
        fixedDelta,
        (simulationTick, state) => {
          authorityTick = simulationTick;
          return createSurfacePlayerCommand({
            playerId: state.playerId,
            surfaceFrameId: state.surfaceFrameId,
            simulationTick,
            moveAxes: { forward: 0, right: 0 },
            lookDeltaRadians: { yaw: 0, pitch: 0 },
            sprint: false,
            crouch: null,
            jump: false,
            fire: false,
            pointerLockIntent: "Unchanged",
            reset: "None"
          });
        },
        {
          bodyId: baseBinding.bodyId,
          regionId: baseBinding.regionId,
          surfaceFrameId: baseBinding.surfaceFrameId,
          regionRevision: baseBinding.regionRevision
        },
        port,
        config
      );
      expect(result.status).toBe("Advanced");
      if (result.status !== "Advanced") throw new Error(result.rejection.message);
      fixedStep = result.runtime;
      positions.push(JSON.stringify(fixedStep.currentState.positionMeters));
      downwardVelocities.push(fixedStep.currentState.velocityMetersPerSecond.y);
    }

    expect(fixedStep.currentState.grounded).toBe(true);
    expect(fixedStep.currentState.supportState).toBe("SupportedResting");
    expect(new Set(positions.slice(1)).size).toBe(1);
    expect(downwardVelocities).toEqual([0, 0, 0, 0, 0]);
  });

  it("publishes stable contract-valid collider identities for authoritative cells and revisions", () => {
    const firstId = contactColliderId(rayInsideCell(tree, 0, "tree-ray:first"));
    const repeatId = contactColliderId(rayInsideCell(tree, 0, "tree-ray:repeat"));
    const otherId = contactColliderId(
      rayInsideCell(tree, tree.cells.length - 1, "tree-ray:other")
    );

    expect(validateVoxelStableId(firstId, "tree.colliderId").valid).toBe(true);
    expect(firstId.length).toBeLessThanOrEqual(128);
    expect(repeatId).toBe(firstId);
    expect(otherId).not.toBe(firstId);
    expect(firstId).not.toContain("{");
    expect(firstId).not.toContain("\"");

    const preview = previewSurfaceTreeCanonicalHit(authority, 0);
    expect(preview.status).toBe("Accepted");
    if (preview.status !== "Accepted") throw new Error("Tree revision fixture unexpectedly rejected.");
    const revisedTree = createSurfaceTreeCollisionSnapshot(preview.authority);
    const revisedId = contactColliderId(rayInsideCell(revisedTree, 0, "tree-ray:revised"));

    expect(revisedTree.binding.objectRevision).toBe(tree.binding.objectRevision + 1);
    expect(revisedId).not.toBe(firstId);
    expect(validateVoxelStableId(revisedId, "tree.revisedColliderId").valid).toBe(true);
  }, 120_000);

  it("binds collider identity to authoritative content and stays unique across the fixture", () => {
    const baselineId = contactColliderId(rayInsideCell(tree, 0, "tree-ray:content-baseline"));
    const alternateContentHash = tree.binding.objectContentHash === "fnv1a64-v1:0000000000000000"
      ? "fnv1a64-v1:0000000000000001"
      : "fnv1a64-v1:0000000000000000";
    const alternateTree = Object.freeze({
      ...tree,
      binding: Object.freeze({
        ...tree.binding,
        objectContentHash: alternateContentHash
      })
    });
    const alternateId = contactColliderId(
      rayInsideCell(alternateTree, 0, "tree-ray:content-alternate")
    );

    expect(alternateId).not.toBe(baselineId);

    const port = collisionPort(tree);
    const idsFor = (pass: string) => tree.cells.map((_cell, index) => contactColliderId(
      port.queryRay(rayQueryInsideCell(tree, index, `tree-fixture:${pass}:${index}`))
    ));
    const firstPass = idsFor("first");
    const secondPass = idsFor("second");

    expect(secondPass).toEqual(firstPass);
    expect(new Set(firstPass).size).toBe(tree.cells.length);
    expect(firstPass.every((id) => validateVoxelStableId(id, "tree.fixtureColliderId").valid)).toBe(true);
  }, 120_000);

  it("keeps fixed-step locomotion advancing through trunk contact, rest, and movement away", () => {
    const trunkCell = tree.cells.find((cell) =>
      cell.minMeters.y <= 0.9
      && cell.maxMeters.y >= 0.9
    ) ?? tree.cells[0];
    if (trunkCell === undefined) throw new Error("Tree fixture must contain a trunk cell.");
    const trunkCenter = {
      x: (trunkCell.minMeters.x + trunkCell.maxMeters.x) / 2,
      z: (trunkCell.minMeters.z + trunkCell.maxMeters.z) / 2
    };
    const context = {
      bodyId: baseBinding.bodyId,
      regionId: baseBinding.regionId,
      surfaceFrameId: baseBinding.surfaceFrameId,
      regionRevision: baseBinding.regionRevision
    };
    let authorityTick = 0;
    const port = collisionPort(tree, () => ({ ...baseBinding, simulationTick: authorityTick }));
    let runtime: Readonly<SurfaceFixedStepRuntime> = createSurfaceFixedStepRuntime(
      createSurfaceLocomotionState({
        playerId: "player:tree-liveness",
        surfaceFrameId: baseBinding.surfaceFrameId,
        positionMeters: { x: trunkCenter.x - 2, y: config.capsule.heightMeters / 2, z: trunkCenter.z },
        velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
        yawRadians: Math.PI / 2,
        pitchRadians: 0,
        grounded: true,
        groundNormal: { x: 0, y: 1, z: 0 },
        movementMode: "Walk",
        capsule: config.capsule,
        simulationTick: 0,
        jumpHeld: false
      })
    );
    const advance = (forward: number) => {
      const result = advanceSurfaceFixedStepRuntime(
        runtime,
        fixedDelta,
        (simulationTick, state) => {
          authorityTick = simulationTick;
          return createSurfacePlayerCommand({
            playerId: state.playerId,
            surfaceFrameId: state.surfaceFrameId,
            simulationTick,
            moveAxes: { forward, right: 0 },
            lookDeltaRadians: { yaw: 0, pitch: 0 },
            sprint: false,
            crouch: null,
            jump: false,
            fire: false,
            pointerLockIntent: "Unchanged",
            reset: "None"
          });
        },
        context,
        port,
        config
      );
      expect(result.status).toBe("Advanced");
      if (result.status !== "Advanced") throw new Error(result.rejection.message);
      runtime = result.runtime;
    };

    for (let tick = 0; tick < 120; tick += 1) advance(1);
    const stoppedAt = runtime.currentState.positionMeters.x;
    expect(stoppedAt).toBeGreaterThan(trunkCenter.x - 2);
    expect(stoppedAt).toBeLessThan(trunkCenter.x);

    for (let tick = 0; tick < 120; tick += 1) advance(0);
    expect(runtime.currentState.simulationTick).toBe(240);
    expect(runtime.currentState.positionMeters.x).toBeCloseTo(stoppedAt, 6);

    for (let tick = 0; tick < 30; tick += 1) advance(-1);
    expect(runtime.currentState.simulationTick).toBe(270);
    expect(runtime.currentState.positionMeters.x).toBeLessThan(stoppedAt);
  }, 120_000);

  it("pauses rejected frame time and performs bounded work after matching snapshot adoption", () => {
    const initial = createSurfaceLocomotionState({
      playerId: "player:revision-recovery",
      surfaceFrameId: baseBinding.surfaceFrameId,
      positionMeters: { x: 50, y: config.capsule.heightMeters / 2, z: 50 },
      velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
      yawRadians: 0,
      pitchRadians: 0,
      grounded: true,
      groundNormal: { x: 0, y: 1, z: 0 },
      movementMode: "Walk",
      capsule: config.capsule,
      simulationTick: 0,
      jumpHeld: false
    });
    const context = {
      bodyId: baseBinding.bodyId,
      regionId: baseBinding.regionId,
      surfaceFrameId: baseBinding.surfaceFrameId,
      regionRevision: baseBinding.regionRevision
    };
    let authorityRevision = baseBinding.regionRevision + 1;
    let authorityTick = 1;
    const port = collisionPort(tree, () => ({
      ...baseBinding,
      regionRevision: authorityRevision,
      simulationTick: authorityTick
    }));
    let moveAxes = { forward: 0, right: 0 };
    const attemptedTicks: number[] = [];
    const commandFactory = (
      simulationTick: number,
      state: Readonly<SurfaceLocomotionState>
    ) => {
      authorityTick = simulationTick;
      attemptedTicks.push(simulationTick);
      return createSurfacePlayerCommand({
        playerId: state.playerId,
        surfaceFrameId: state.surfaceFrameId,
        simulationTick,
        moveAxes,
        lookDeltaRadians: { yaw: 0, pitch: 0 },
        sprint: false,
        crouch: null,
        jump: false,
        fire: false,
        pointerLockIntent: "Unchanged",
        reset: "None"
      });
    };
    let runtime: Readonly<SurfaceFixedStepRuntime> = createSurfaceFixedStepRuntime(initial);
    for (let frame = 0; frame < 120; frame += 1) {
      const rejected = advanceSurfaceFixedStepRuntime(
        runtime,
        fixedDelta,
        commandFactory,
        context,
        port,
        config
      );
      expect(rejected.status).toBe("Rejected");
      if (rejected.status !== "Rejected") throw new Error("Expected a stale revision rejection.");
      expect(rejected.rejection.collisionRejection?.code).toBe("StaleRevision");
      expect(rejected.steps).toBe(0);
      expect(rejected.runtime.currentState.simulationTick).toBe(0);
      expect(rejected.runtime.accumulatorSeconds).toBeLessThan(fixedDelta);
      runtime = rejected.runtime;
    }
    expect(new Set(attemptedTicks)).toEqual(new Set([1]));

    authorityRevision = baseBinding.regionRevision;
    moveAxes = { forward: 0, right: 1 };
    const recovered = advanceSurfaceFixedStepRuntime(
      runtime,
      fixedDelta,
      commandFactory,
      context,
      port,
      config
    );

    expect(recovered.status).toBe("Advanced");
    if (recovered.status !== "Advanced") throw new Error(recovered.rejection.message);
    expect(recovered.steps).toBe(1);
    expect(recovered.runtime.currentState.simulationTick).toBe(1);
    expect(recovered.runtime.currentState.positionMeters.x).toBeLessThan(initial.positionMeters.x);
    expect(recovered.runtime.accumulatorSeconds).toBe(0);

    moveAxes = { forward: 1, right: 0 };
    const next = advanceSurfaceFixedStepRuntime(
      recovered.runtime,
      fixedDelta,
      commandFactory,
      context,
      port,
      config
    );

    expect(next.status).toBe("Advanced");
    if (next.status !== "Advanced") throw new Error(next.rejection.message);
    expect(next.steps).toBe(1);
    expect(next.runtime.currentState.simulationTick).toBe(2);
    expect(next.runtime.currentState.positionMeters.z).toBeGreaterThan(initial.positionMeters.z);
  }, 120_000);
});
