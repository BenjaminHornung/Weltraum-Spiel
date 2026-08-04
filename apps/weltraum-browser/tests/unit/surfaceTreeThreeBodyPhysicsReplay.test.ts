import { beforeAll, describe, expect, it } from "vitest";
import {
  getStructuralVoxel,
  globalQuantumForStructuralCell,
  localCellIndexFromOffset,
  serializeStructuralCellAddress,
  structuralAddressForBrickCell
} from "../../src/voxel/structural";
import {
  SURFACE_RIGID_BODY_MAX_SUBSTEPS,
  createSurfaceRigidBodyWorld,
  readSurfaceRigidBodyStepDiagnostics,
  readSurfaceRigidBodyTerrainBroadphaseStats,
  stepSurfaceRigidBodyWorld,
  type SurfaceRigidBodyState,
  type SurfaceRigidBodyTerrainColliderInput,
  type SurfaceRigidBodyWorld
} from "../../src/surface-play/physics";
import { createHestiaAgileGroundedLocomotionPresetV1 } from "../../src/surface-play/player";
import {
  resolveHestiaSurfacePlayWorld,
  revalidateHestiaSurfacePlayWorld
} from "../../src/surface-play/surfacePlayBootstrap";
import { createHestiaSurfacePlayAuthorityInput } from "../../src/surface-play/surfacePlayConfig";
import {
  createSurfaceRegionVoxelAuthority,
  createSurfaceRegionVoxelCollisionAdapter
} from "../../src/surface-play/voxel-edit";
import {
  createHestiaAuthorityGroundSurfaceProbe,
  deriveHestiaSurfaceRigidBodyTerrainPatch
} from "../../src/surface-play/world";
import { createHestiaUmbrellaTree } from "../../src/surface-play/vegetation/hestiaUmbrellaTree";
import {
  advanceSurfaceTreePhysics,
  createSurfaceTreeRuntimeState,
  preflightSurfaceTreeFire,
  type SurfaceTreeRuntimeState
} from "../../src/surface-play/vegetation/surfaceTreeRuntime";

const THREE_BODY_SCAN_TICKS = 1_200;
const FIRST_BODY_RESTING_TICK = 1_182;
const HIT_NORMAL = Object.freeze({ x: -1, y: 0, z: 0 });

// Command IDs are part of Structural content identity, so the one bounded discovery run is pinned too.
const PINNED_BRANCH_HITS = Object.freeze([
  Object.freeze({
    fireCommandId: "discovery:sequential:1",
    segmentId: "hestia.surface-play.umbrella-segment.v1:65da57d2cc00cc72",
    address: Object.freeze({
      brickOriginQuantum: Object.freeze({ x: 464, y: 112, z: -336 }),
      localIndex: 2_200
    }),
    globalQuantum: Object.freeze({ x: 472, y: 121, z: -328 }),
    pointMeters: Object.freeze({ x: 59.0625, y: 15.1875, z: -40.9375 }),
    previousAuthorityRevision: 0,
    previousAuthorityContentHash: "fnv1a64-v1:af46cf17266d1f94",
    damageRevision: 1,
    damageContentHash: "fnv1a64-v1:35e7715e972a09eb",
    finalAuthorityRevision: 2,
    finalAuthorityContentHash: "fnv1a64-v1:9140ec8fcd91d3d6",
    changedCellCount: 10,
    componentId: "fnv1a64-v1:bc6e964f53592b3c",
    bodyId: "surface-tree-body:fnv1a64-v1:bc6e964f53592b3c",
    occupiedCellCount: 400,
    massKg: 93.75,
    colliderCount: 7,
    activationSimulationTick: 2,
    bodyCount: 1
  }),
  Object.freeze({
    fireCommandId: "discovery:sequential:2",
    segmentId: "hestia.surface-play.umbrella-segment.v1:6e1cc42871946de1",
    address: Object.freeze({
      brickOriginQuantum: Object.freeze({ x: 448, y: 112, z: -336 }),
      localIndex: 2_970
    }),
    globalQuantum: Object.freeze({ x: 458, y: 121, z: -325 }),
    pointMeters: Object.freeze({ x: 57.3125, y: 15.1875, z: -40.5625 }),
    previousAuthorityRevision: 2,
    previousAuthorityContentHash: "fnv1a64-v1:9140ec8fcd91d3d6",
    damageRevision: 3,
    damageContentHash: "fnv1a64-v1:fcdb173ff66509fd",
    finalAuthorityRevision: 4,
    finalAuthorityContentHash: "fnv1a64-v1:da696701e113696f",
    changedCellCount: 8,
    componentId: "fnv1a64-v1:f18a9d243f22c310",
    bodyId: "surface-tree-body:fnv1a64-v1:f18a9d243f22c310",
    occupiedCellCount: 314,
    massKg: 73.59375,
    colliderCount: 9,
    activationSimulationTick: 1_184,
    bodyCount: 2
  }),
  Object.freeze({
    fireCommandId: "discovery:sequential:3",
    segmentId: "hestia.surface-play.umbrella-segment.v1:e5c14506e3e91253",
    address: Object.freeze({
      brickOriginQuantum: Object.freeze({ x: 448, y: 112, z: -352 }),
      localIndex: 1_438
    }),
    globalQuantum: Object.freeze({ x: 462, y: 121, z: -347 }),
    pointMeters: Object.freeze({ x: 57.8125, y: 15.1875, z: -43.3125 }),
    previousAuthorityRevision: 4,
    previousAuthorityContentHash: "fnv1a64-v1:da696701e113696f",
    damageRevision: 5,
    damageContentHash: "fnv1a64-v1:79fb7b71d7a3122d",
    finalAuthorityRevision: 6,
    finalAuthorityContentHash: "fnv1a64-v1:1651d1e1163ac121",
    changedCellCount: 8,
    componentId: "fnv1a64-v1:1eed2271184168cb",
    bodyId: "surface-tree-body:fnv1a64-v1:1eed2271184168cb",
    occupiedCellCount: 276,
    massKg: 64.6875,
    colliderCount: 9,
    activationSimulationTick: 1_185,
    bodyCount: 3
  })
] as const);

let terrainColliders!: readonly Readonly<SurfaceRigidBodyTerrainColliderInput>[];
let tree!: ReturnType<typeof createHestiaUmbrellaTree>;

beforeAll(() => {
  const sourceWorld = resolveHestiaSurfacePlayWorld();
  const authority = createSurfaceRegionVoxelAuthority(createHestiaSurfacePlayAuthorityInput(sourceWorld));
  const adopted = revalidateHestiaSurfacePlayWorld(authority, sourceWorld);
  if (adopted.status === "Rejected") throw new Error(adopted.failure.message);
  const placement = adopted.world.encounter.structuralTrees[0];
  tree = createHestiaUmbrellaTree(placement);
  const terrain = deriveHestiaSurfaceRigidBodyTerrainPatch({
    world: adopted.world,
    placement,
    authorityState: authority.state,
    groundSurfaceProbe: createHestiaAuthorityGroundSurfaceProbe({
      state: authority.state,
      adapter: createSurfaceRegionVoxelCollisionAdapter(authority)
    })
  });
  if (terrain.status === "Rejected") throw new Error(terrain.failure.message);
  terrainColliders = terrain.terrainColliders;
}, 120_000);

const finiteBody = (body: Readonly<SurfaceRigidBodyState>): boolean => [
  body.positionMeters.x,
  body.positionMeters.y,
  body.positionMeters.z,
  body.orientation.x,
  body.orientation.y,
  body.orientation.z,
  body.orientation.w,
  body.linearVelocityMetersPerSecond.x,
  body.linearVelocityMetersPerSecond.y,
  body.linearVelocityMetersPerSecond.z,
  body.angularVelocityRadiansPerSecond.x,
  body.angularVelocityRadiansPerSecond.y,
  body.angularVelocityRadiansPerSecond.z
].every(Number.isFinite);

type SurfaceRigidBodyStepDiagnostics = NonNullable<
  ReturnType<typeof readSurfaceRigidBodyStepDiagnostics>
>;

const readOrderedStepDiagnostics = (
  world: Readonly<SurfaceRigidBodyWorld>,
  context: string
): SurfaceRigidBodyStepDiagnostics => {
  const diagnostics = readSurfaceRigidBodyStepDiagnostics(world);
  if (diagnostics === undefined) {
    throw new Error(`Missing Surface Physics step diagnostics for ${context}.`);
  }
  const worldBodyIds = world.bodies.map((body) => body.bodyId);
  const diagnosticsBodyIds = diagnostics.bodies.map((body) => body.bodyId);
  const bodyOrderMatches = worldBodyIds.length === diagnosticsBodyIds.length
    && worldBodyIds.every((bodyId, index) => bodyId === diagnosticsBodyIds[index]);
  if (!bodyOrderMatches) {
    throw new Error(
      `Surface Physics diagnostics body order mismatch for ${context}: `
      + `world=${JSON.stringify(worldBodyIds)} diagnostics=${JSON.stringify(diagnosticsBodyIds)}.`
    );
  }
  return diagnostics;
};

const requiredMotionSubstepsFromDiagnostics = (
  diagnostics: SurfaceRigidBodyStepDiagnostics,
  context: string
): readonly number[] => Object.freeze(diagnostics.bodies.map((body) => {
  if (body.requiredMotionSubsteps === null) {
    throw new Error(`Missing required motion substeps in Surface Physics diagnostics for ${context}.`);
  }
  return body.requiredMotionSubsteps;
}));

const rotationSubstepsCharacterization = (
  diagnostics: SurfaceRigidBodyStepDiagnostics,
  context: string
): readonly Readonly<{ readonly bodyId: string; readonly requiredRotationSubsteps: number }>[] =>
  Object.freeze(diagnostics.bodies.map((body) => {
    if (body.requiredRotationSubsteps === null) {
      throw new Error(`Missing required rotation substeps in Surface Physics diagnostics for ${context}.`);
    }
    return Object.freeze({
      bodyId: body.bodyId,
      requiredRotationSubsteps: body.requiredRotationSubsteps
    });
  }));

const pinnedHitFor = (
  state: Readonly<SurfaceTreeRuntimeState>,
  pin: typeof PINNED_BRANCH_HITS[number]
) => {
  const brick = state.authority.object.bricks.find((candidate) =>
    candidate.key.originQuantum.x === pin.address.brickOriginQuantum.x
    && candidate.key.originQuantum.y === pin.address.brickOriginQuantum.y
    && candidate.key.originQuantum.z === pin.address.brickOriginQuantum.z
  );
  if (brick === undefined) throw new Error(`Pinned brick is absent for ${pin.fireCommandId}.`);
  const cell = brick.cells.find((candidate) => candidate.localIndex === pin.address.localIndex);
  if (cell === undefined) throw new Error(`Pinned cell is absent for ${pin.fireCommandId}.`);
  const address = structuralAddressForBrickCell(brick, cell.localIndex);
  const globalQuantum = globalQuantumForStructuralCell(address);
  const pointMeters = Object.freeze({
    x: (globalQuantum.x + 0.5) * 0.125,
    y: (globalQuantum.y + 0.5) * 0.125,
    z: (globalQuantum.z + 0.5) * 0.125
  });
  const voxel = getStructuralVoxel(state.authority.object, address);

  expect(brick.key.level).toBe(4);
  expect(localCellIndexFromOffset(address.local)).toBe(pin.address.localIndex);
  expect(globalQuantum).toEqual(pin.globalQuantum);
  expect(pointMeters).toEqual(pin.pointMeters);
  expect(voxel).toMatchObject({ materialId: 2, semanticKey: pin.segmentId });

  return Object.freeze({
    address,
    addressKey: serializeStructuralCellAddress(address),
    materialId: cell.state.materialId,
    semanticKey: cell.state.semanticKey,
    pointMeters,
    normal: HIT_NORMAL
  });
};

const applyPinnedRelease = (
  state: Readonly<SurfaceTreeRuntimeState>,
  pin: typeof PINNED_BRANCH_HITS[number],
  simulationTick: number
) => {
  expect(state.authority.objectRevision).toBe(pin.previousAuthorityRevision);
  expect(state.authority.objectContentHash).toBe(pin.previousAuthorityContentHash);
  const hit = pinnedHitFor(state, pin);
  const preflight = preflightSurfaceTreeFire(state, {
    fireCommandId: pin.fireCommandId,
    hit,
    simulationTick
  });
  expect(preflight.status).toBe("Ready");
  if (preflight.status !== "Ready") {
    throw new Error(`${pin.fireCommandId} was rejected with ${preflight.code}.`);
  }
  expect(preflight.supportResult).toBe("Detached");
  expect(preflight.state.authority.objectRevision).toBe(pin.finalAuthorityRevision);
  expect(preflight.state.authority.editRevision).toBe(pin.finalAuthorityRevision);
  expect(preflight.state.authority.objectContentHash).toBe(pin.finalAuthorityContentHash);
  expect(preflight.state.physicsWorld.bodies).toHaveLength(pin.bodyCount);
  expect(preflight.state.bodySources).toHaveLength(pin.bodyCount);
  expect(preflight.state.latestTransition).toMatchObject({
    status: "Applied",
    fireCommandId: pin.fireCommandId,
    previousObjectRevision: pin.previousAuthorityRevision,
    resultingObjectRevision: pin.damageRevision,
    previousContentHash: pin.previousAuthorityContentHash,
    resultingContentHash: pin.damageContentHash,
    changedCellCount: pin.changedCellCount,
    supportResult: "Detached",
    detachedComponentIds: [pin.componentId],
    authorityTransfer: {
      previousObjectRevision: pin.damageRevision,
      resultingObjectRevision: pin.finalAuthorityRevision,
      previousContentHash: pin.damageContentHash,
      resultingContentHash: pin.finalAuthorityContentHash,
      transferredCellCount: pin.occupiedCellCount
    },
    simulationTick
  });
  const bodySource = preflight.state.bodySources.find((candidate) =>
    candidate.candidate.bodyId === pin.bodyId
  );
  if (bodySource === undefined) throw new Error(`Pinned body source is absent for ${pin.fireCommandId}.`);
  expect(bodySource.component.componentId).toBe(pin.componentId);
  expect(bodySource.component.occupiedCells).toHaveLength(pin.occupiedCellCount);
  expect(bodySource.sourceObject.objectRevision).toBe(pin.damageRevision);
  expect(bodySource.sourceObject.contentHash).toBe(pin.damageContentHash);
  expect(bodySource.massProperties.totalMassKg).toBe(pin.massKg);
  expect(bodySource.massProperties.occupiedVoxelCount).toBe(pin.occupiedCellCount);
  expect(Object.values(bodySource.massProperties.inertiaTensorKgMetersSquared).every(Number.isFinite))
    .toBe(true);
  expect(bodySource.candidate.colliderRevision).toBe(pin.damageRevision);
  expect(bodySource.candidate.colliders).toHaveLength(pin.colliderCount);
  expect(bodySource.candidate.activationSimulationTick).toBe(pin.activationSimulationTick);

  return Object.freeze({
    state: preflight.state,
    evidence: Object.freeze({
      fireCommandId: pin.fireCommandId,
      addressKey: hit.addressKey,
      pointMeters: hit.pointMeters,
      normal: hit.normal,
      damageRevision: bodySource.sourceObject.objectRevision,
      damageContentHash: bodySource.sourceObject.contentHash,
      finalAuthorityRevision: preflight.state.authority.objectRevision,
      finalAuthorityContentHash: preflight.state.authority.objectContentHash,
      componentId: bodySource.component.componentId,
      bodyId: bodySource.candidate.bodyId,
      occupiedCellCount: bodySource.component.occupiedCells.length,
      massKg: bodySource.massProperties.totalMassKg,
      inertiaTensorKgMetersSquared: bodySource.massProperties.inertiaTensorKgMetersSquared,
      colliderCount: bodySource.candidate.colliders.length,
      activationSimulationTick: bodySource.candidate.activationSimulationTick
    })
  });
};

const runPinnedThreeBodyReplay = () => {
  const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
  expect(locomotion.gravityMetersPerSecondSquared).toBe(11.78);
  let state = createSurfaceTreeRuntimeState(
    tree,
    createSurfaceRigidBodyWorld({
      simulationTick: 0,
      gravityMetersPerSecondSquared: locomotion.gravityMetersPerSecondSquared,
      terrainColliders
    })
  );
  const releaseEvidence = [];

  const firstRelease = applyPinnedRelease(state, PINNED_BRANCH_HITS[0], 1);
  state = firstRelease.state;
  releaseEvidence.push(firstRelease.evidence);
  for (let tick = 0; tick < 1_200; tick += 1) {
    if (state.physicsWorld.physicsFailure !== null) break;
    if (state.physicsWorld.bodies[0]?.lifecycle === "Resting") break;
    state = advanceSurfaceTreePhysics(state);
  }
  expect(state.physicsWorld.physicsFailure).toBeNull();
  expect(state.physicsWorld.simulationTick).toBe(FIRST_BODY_RESTING_TICK);
  expect(state.physicsWorld.bodies).toHaveLength(1);
  expect(state.physicsWorld.bodies[0]).toMatchObject({
    bodyId: PINNED_BRANCH_HITS[0].bodyId,
    lifecycle: "Resting",
    linearVelocityMetersPerSecond: { x: 0, y: 0, z: 0 },
    angularVelocityRadiansPerSecond: { x: 0, y: 0, z: 0 }
  });

  const secondRelease = applyPinnedRelease(
    state,
    PINNED_BRANCH_HITS[1],
    state.physicsWorld.simulationTick + 1
  );
  state = advanceSurfaceTreePhysics(secondRelease.state);
  releaseEvidence.push(secondRelease.evidence);
  expect(state.physicsWorld.simulationTick).toBe(1_183);
  expect(state.physicsWorld.physicsFailure).toBeNull();

  const thirdRelease = applyPinnedRelease(
    state,
    PINNED_BRANCH_HITS[2],
    state.physicsWorld.simulationTick + 1
  );
  state = advanceSurfaceTreePhysics(thirdRelease.state);
  releaseEvidence.push(thirdRelease.evidence);
  expect(state.physicsWorld.simulationTick).toBe(1_184);
  expect(state.physicsWorld.physicsFailure).toBeNull();
  expect(state.physicsWorld.bodies).toHaveLength(3);
  expect(state.physicsWorld.bodies.filter((body) => body.lifecycle === "Resting")).toHaveLength(1);
  expect(state.physicsWorld.bodies.filter((body) => body.lifecycle === "Falling")).toHaveLength(2);
  expect(state.physicsWorld.bodies.every((body) =>
    body.activationSimulationTick <= state.physicsWorld.simulationTick + 1
  )).toBe(true);

  const preDiscriminatorWorld = state.physicsWorld;
  const preDiscriminatorDiagnostics = readOrderedStepDiagnostics(
    preDiscriminatorWorld,
    "pre-discriminator world"
  );
  const preDiscriminatorRequiredSubsteps = requiredMotionSubstepsFromDiagnostics(
    preDiscriminatorDiagnostics,
    "pre-discriminator world"
  );
  expect(preDiscriminatorWorld.bodies.every(finiteBody)).toBe(true);
  expect(preDiscriminatorRequiredSubsteps.every((value) =>
    value <= SURFACE_RIGID_BODY_MAX_SUBSTEPS
  )).toBe(true);

  let world: Readonly<SurfaceRigidBodyWorld> = preDiscriminatorWorld;
  let discriminatorWorld: Readonly<SurfaceRigidBodyWorld> | null = null;
  let discriminatorTerrainStats: ReturnType<typeof readSurfaceRigidBodyTerrainBroadphaseStats> = undefined;
  let maximumPublishedRequiredSubsteps = Math.max(...preDiscriminatorRequiredSubsteps);
  let tick1243RotationSubsteps: readonly Readonly<{
    readonly bodyId: string;
    readonly requiredRotationSubsteps: number;
  }>[] | null = null;
  let failureEvidence: Readonly<{
    readonly failure: NonNullable<Readonly<SurfaceRigidBodyWorld>["physicsFailure"]>;
    readonly inputRequiredSubsteps: readonly number[];
    readonly inputBodiesFinite: boolean;
    readonly atomicBodyState: boolean;
    readonly terrainBroadphaseStats: ReturnType<typeof readSurfaceRigidBodyTerrainBroadphaseStats>;
  }> | null = null;

  for (let tick = 0; tick < THREE_BODY_SCAN_TICKS; tick += 1) {
    const inputDiagnostics = readOrderedStepDiagnostics(
      world,
      `input world at simulation tick ${world.simulationTick}`
    );
    const inputRequiredSubsteps = requiredMotionSubstepsFromDiagnostics(
      inputDiagnostics,
      `input world at simulation tick ${world.simulationTick}`
    );
    if (world.simulationTick === 1_243) {
      tick1243RotationSubsteps = rotationSubstepsCharacterization(
        inputDiagnostics,
        "input world at simulation tick 1243"
      );
      expect(tick1243RotationSubsteps).toEqual(expect.arrayContaining([
        expect.objectContaining({ requiredRotationSubsteps: 4 })
      ]));
    }
    const stepped = stepSurfaceRigidBodyWorld(world);
    if (tick === 0) {
      discriminatorWorld = stepped.world;
      discriminatorTerrainStats = readSurfaceRigidBodyTerrainBroadphaseStats(stepped.world);
    }
    if (stepped.status === "Failed") {
      const atomicBodyState = JSON.stringify(stepped.world.bodies) === JSON.stringify(world.bodies)
        && stepped.world.simulationTick === world.simulationTick;
      failureEvidence = Object.freeze({
        failure: stepped.failure,
        inputRequiredSubsteps: Object.freeze(inputRequiredSubsteps),
        inputBodiesFinite: world.bodies.every(finiteBody),
        atomicBodyState,
        terrainBroadphaseStats: readSurfaceRigidBodyTerrainBroadphaseStats(stepped.world)
      });
      expect(atomicBodyState).toBe(true);
      break;
    }
    world = stepped.world;
    expect(world.bodies.every(finiteBody)).toBe(true);
    const publishedDiagnostics = readOrderedStepDiagnostics(
      world,
      `published world at simulation tick ${world.simulationTick}`
    );
    const publishedRequiredSubsteps = requiredMotionSubstepsFromDiagnostics(
      publishedDiagnostics,
      `published world at simulation tick ${world.simulationTick}`
    );
    maximumPublishedRequiredSubsteps = Math.max(
      maximumPublishedRequiredSubsteps,
      ...publishedRequiredSubsteps
    );
    expect(publishedRequiredSubsteps.every((value) =>
      value <= SURFACE_RIGID_BODY_MAX_SUBSTEPS
    )).toBe(true);
  }

  if (failureEvidence !== null) {
    throw new Error(`Pinned three-body replay failed: ${JSON.stringify(failureEvidence)}.`);
  }
  if (discriminatorWorld === null) throw new Error("Pinned three-body discriminator did not execute.");
  expect(discriminatorWorld.physicsFailure).toBeNull();
  expect(discriminatorWorld.simulationTick).toBe(1_185);
  expect(world.physicsFailure).toBeNull();
  expect(world.simulationTick).toBe(2_384);
  expect(maximumPublishedRequiredSubsteps).toBeLessThanOrEqual(SURFACE_RIGID_BODY_MAX_SUBSTEPS);
  expect(tick1243RotationSubsteps).toBeDefined();

  return Object.freeze({
    releaseEvidence: Object.freeze(releaseEvidence),
    firstBodyRestingTick: FIRST_BODY_RESTING_TICK,
    preDiscriminatorWorld,
    preDiscriminatorRequiredSubsteps: Object.freeze(preDiscriminatorRequiredSubsteps),
    discriminatorWorld,
    discriminatorTerrainStats,
    tick1243RotationSubsteps,
    maximumPublishedRequiredSubsteps,
    finalWorld: world,
    failureEvidence
  });
};

describe("Surface Tree three-body physics replay", () => {
  it("pins the real Authority path but does not reproduce the latest browser Physics stop", () => {
    const first = runPinnedThreeBodyReplay();
    const repeated = runPinnedThreeBodyReplay();

    expect(JSON.stringify(repeated)).toBe(JSON.stringify(first));
    expect(first.failureEvidence).toBeNull();
    expect(first.releaseEvidence.map((release) => release.bodyId)).toEqual([
      "surface-tree-body:fnv1a64-v1:bc6e964f53592b3c",
      "surface-tree-body:fnv1a64-v1:f18a9d243f22c310",
      "surface-tree-body:fnv1a64-v1:1eed2271184168cb"
    ]);
  }, 180_000);
});
