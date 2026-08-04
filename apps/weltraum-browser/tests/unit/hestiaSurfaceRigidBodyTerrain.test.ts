import { beforeAll, describe, expect, it } from "vitest";
import { rotateSpatialVector } from "../../src/spatial/quaternion";
import { getStructuralVoxel } from "../../src/voxel/structural";
import {
  createHestiaAgileGroundedLocomotionPresetV1
} from "../../src/surface-play/player";
import {
  createSurfaceRigidBodyWorld,
  type SurfaceRigidBodyState,
  type SurfaceRigidBodyTerrainColliderInput
} from "../../src/surface-play/physics";
import {
  resolveHestiaSurfacePlayWorld,
  revalidateHestiaSurfacePlayWorld
} from "../../src/surface-play/surfacePlayBootstrap";
import {
  HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
  createHestiaSurfacePlayAuthorityInput
} from "../../src/surface-play/surfacePlayConfig";
import {
  SURFACE_VOXEL_EDIT_QUANTUM_METERS,
  SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
  applySurfaceVoxelEdit,
  createSurfaceRegionVoxelAuthority,
  createSurfaceRegionVoxelCollisionAdapter,
  type SurfaceRegionVoxelAuthority,
  type SurfaceVoxelEditIntent
} from "../../src/surface-play/voxel-edit";
import {
  HESTIA_RIGID_BODY_TERRAIN_PATCH_MAX_COLLIDERS,
  createHestiaAuthorityGroundSurfaceProbe,
  deriveHestiaSurfaceRigidBodyTerrainColliders,
  deriveHestiaSurfaceRigidBodyTerrainPatch,
  refreshHestiaSurfaceRigidBodyTerrainPatch,
  revalidateHestiaSurfaceWorldIncrementallyAgainstAuthority,
  type HestiaSurfaceRigidBodyTerrainPatch,
  type HestiaSurfaceStructuralTreePlacement,
  type HestiaSurfaceWorldFacts
} from "../../src/surface-play/world";
import { HESTIA_SEA_LEVEL_METERS } from "../../src/world-generation/hestia";
import { createHestiaUmbrellaTree } from "../../src/surface-play/vegetation/hestiaUmbrellaTree";
import { deriveSurfaceTreeCanonicalHit } from "../../src/surface-play/vegetation/surfaceTreeAuthority";
import {
  advanceSurfaceTreePhysics,
  createSurfaceTreeRuntimeState,
  preflightSurfaceTreeFire
} from "../../src/surface-play/vegetation/surfaceTreeRuntime";

let authority!: SurfaceRegionVoxelAuthority;
let world!: Readonly<HestiaSurfaceWorldFacts>;
let placement!: Readonly<HestiaSurfaceStructuralTreePlacement>;
let terrainColliders!: readonly Readonly<SurfaceRigidBodyTerrainColliderInput>[];
let terrainPatch!: Readonly<HestiaSurfaceRigidBodyTerrainPatch>;
const TREE_FALL_MINIMUM_VERIFICATION_TICKS = 600;
const TREE_FALL_MAXIMUM_VERIFICATION_TICKS = 1_200;

const colliderAt = (
  colliders: readonly Readonly<SurfaceRigidBodyTerrainColliderInput>[],
  xMeters: number,
  zMeters: number
) => colliders.find((collider) =>
  xMeters >= collider.minimumMeters.x
  && xMeters < collider.maximumMeters.x
  && zMeters >= collider.minimumMeters.z
  && zMeters < collider.maximumMeters.z
);

beforeAll(() => {
  const sourceWorld = resolveHestiaSurfacePlayWorld();
  authority = createSurfaceRegionVoxelAuthority(createHestiaSurfacePlayAuthorityInput(sourceWorld));
  const adopted = revalidateHestiaSurfacePlayWorld(authority, sourceWorld);
  if (adopted.status === "Rejected") throw new Error(adopted.failure.message);
  world = adopted.world;
  placement = world.encounter.structuralTrees[0];
  const adapter = createSurfaceRegionVoxelCollisionAdapter(authority);
  const terrain = deriveHestiaSurfaceRigidBodyTerrainPatch({
    world,
    placement,
    authorityState: authority.state,
    groundSurfaceProbe: createHestiaAuthorityGroundSurfaceProbe({
      state: authority.state,
      adapter
    })
  });
  if (terrain.status === "Rejected") throw new Error(terrain.failure.message);
  terrainPatch = terrain.patch;
  terrainColliders = terrain.terrainColliders;
}, 120_000);

const rigidBodyAabb = (
  body: Readonly<SurfaceRigidBodyState>,
  collider: Readonly<SurfaceRigidBodyState["colliders"][number]>
) => {
  const rotatedCenter = rotateSpatialVector(body.orientation, collider.centerMeters);
  const center = {
    x: body.positionMeters.x + rotatedCenter.x,
    y: body.positionMeters.y + rotatedCenter.y,
    z: body.positionMeters.z + rotatedCenter.z
  };
  const axes = [
    rotateSpatialVector(body.orientation, { x: 1, y: 0, z: 0 }),
    rotateSpatialVector(body.orientation, { x: 0, y: 1, z: 0 }),
    rotateSpatialVector(body.orientation, { x: 0, y: 0, z: 1 })
  ] as const;
  const half = collider.halfExtentsMeters;
  const extent = (axis: "x" | "y" | "z") =>
    Math.abs(axes[0][axis]) * half.x
    + Math.abs(axes[1][axis]) * half.y
    + Math.abs(axes[2][axis]) * half.z;
  return {
    minimum: { x: center.x - extent("x"), y: center.y - extent("y"), z: center.z - extent("z") },
    maximum: { x: center.x + extent("x"), y: center.y + extent("y"), z: center.z + extent("z") }
  };
};

const runCanonicalTreeFall = (): Readonly<{
  physicsWorld: Readonly<ReturnType<typeof createSurfaceRigidBodyWorld>>;
  fallingPoses: readonly string[];
  supportResults: readonly string[];
}> => {
  const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
  let state = createSurfaceTreeRuntimeState(
    createHestiaUmbrellaTree(placement),
    createSurfaceRigidBodyWorld({
      simulationTick: 0,
      gravityMetersPerSecondSquared: locomotion.gravityMetersPerSecondSquared,
      terrainColliders
    })
  );
  const supportResults: string[] = [];
  for (let ordinal = 0; ordinal < 3; ordinal += 1) {
    const hit = deriveSurfaceTreeCanonicalHit(state.authority, ordinal);
    const voxel = getStructuralVoxel(state.authority.object, hit.address);
    const preflight = preflightSurfaceTreeFire(state, {
      fireCommandId: `fire:tree-fall-terrain:${ordinal + 1}`,
      hit: {
        address: hit.address,
        materialId: hit.materialId,
        semanticKey: voxel?.semanticKey ?? null,
        pointMeters: hit.pointMeters,
        normal: { x: -1, y: 0, z: 0 }
      },
      simulationTick: state.physicsWorld.simulationTick + 1
    });
    if (preflight.status !== "Ready") {
      throw new Error(`Canonical Tree cut ${ordinal + 1} was rejected: ${preflight.code}.`);
    }
    supportResults.push(preflight.supportResult);
    state = advanceSurfaceTreePhysics(preflight.state);
  }
  const fallingPoses = new Set<string>();
  for (let tick = 0; tick < TREE_FALL_MAXIMUM_VERIFICATION_TICKS; tick += 1) {
    const body = state.physicsWorld.bodies[0];
    if (body?.lifecycle === "Falling") {
      fallingPoses.add(JSON.stringify({
        positionMeters: body.positionMeters,
        orientation: body.orientation
      }));
    }
    if (state.physicsWorld.physicsFailure !== null) break;
    if (
      state.physicsWorld.simulationTick >= TREE_FALL_MINIMUM_VERIFICATION_TICKS
      && body?.lifecycle === "Resting"
    ) break;
    state = advanceSurfaceTreePhysics(state);
  }
  return Object.freeze({
    physicsWorld: state.physicsWorld,
    fallingPoses: Object.freeze([...fallingPoses]),
    supportResults: Object.freeze(supportResults)
  });
};

describe("Hestia rigid-body Terrain authority patch", () => {
  it("covers the route-realistic Tree-Fall area independently of traversal cells and repeats byte-equally", () => {
    const knownFailurePoint = { x: 51.5402, z: -45.8631 };
    expect(world.traversalDomain.cells.some((cell) =>
      Math.floor(cell.centerMeters.x) === Math.floor(knownFailurePoint.x)
      && Math.floor(cell.centerMeters.z) === Math.floor(knownFailurePoint.z)
    )).toBe(false);
    expect(terrainColliders).toHaveLength(HESTIA_RIGID_BODY_TERRAIN_PATCH_MAX_COLLIDERS);
    expect(colliderAt(terrainColliders, knownFailurePoint.x, knownFailurePoint.z)).toBeDefined();

    const derivationStartedAt = performance.now();
    const repeated = deriveHestiaSurfaceRigidBodyTerrainColliders({
      world,
      placement,
      groundSurfaceProbe: createHestiaAuthorityGroundSurfaceProbe({
        state: authority.state,
        adapter: createSurfaceRegionVoxelCollisionAdapter(authority)
      })
    });
    const derivationElapsedMilliseconds = performance.now() - derivationStartedAt;
    expect(repeated.status).toBe("Resolved");
    if (repeated.status !== "Resolved") throw new Error(repeated.failure.message);
    expect(derivationElapsedMilliseconds).toBeLessThan(2_000);
    expect(JSON.stringify(repeated.terrainColliders)).toBe(JSON.stringify(terrainColliders));
  });

  it("re-samples the edited authority revision and lowers the affected contact surface", () => {
    const rootX = placement.rootQuantum.x * SURFACE_VOXEL_EDIT_QUANTUM_METERS;
    const rootZ = placement.rootQuantum.z * SURFACE_VOXEL_EDIT_QUANTUM_METERS;
    const sampleX = Math.floor(rootX) + 0.5;
    const sampleZ = Math.floor(rootZ) + 0.5;
    const priorCollider = colliderAt(terrainColliders, sampleX, sampleZ);
    if (priorCollider === undefined) throw new Error("Expected the Tree-root Terrain collider.");
    const editIntent: SurfaceVoxelEditIntent = {
      schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
      editId: "surface-edit:tree-fall-terrain-revision",
      expectedRegionRevision: authority.state.regionRevision,
      tick: 1,
      actorId: "surface-player:tree-fall-terrain-revision",
      sourceId: "hestia.pulse-cutter.v1",
      sourceImpactIntentId: "impact:tree-fall-terrain-revision",
      bodyId: authority.state.bodyId,
      surfaceFrameId: authority.state.surfaceFrameId,
      regionId: authority.state.regionId,
      operation: "SubtractSphere",
      centerGlobalQuantum: {
        x: Math.round(sampleX / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
        y: Math.round(priorCollider.maximumMeters.y / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
        z: Math.round(sampleZ / SURFACE_VOXEL_EDIT_QUANTUM_METERS)
      },
      quantumMeters: SURFACE_VOXEL_EDIT_QUANTUM_METERS,
      radiusMeters: 0.75
    };
    const transition = applySurfaceVoxelEdit(authority, editIntent);
    expect(transition.result.status).toBe("Applied");
    const adapter = createSurfaceRegionVoxelCollisionAdapter(transition.authority);
    const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
    const revalidated = revalidateHestiaSurfaceWorldIncrementallyAgainstAuthority({
      sourceWorld: world,
      state: transition.state,
      adapter,
      frameOriginMeters: HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
      waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
      capsule: locomotion.capsule,
      collisionSkinMeters: locomotion.collisionSkinMeters,
      editIntent,
      editResult: transition.result
    });
    expect(revalidated.status).toBe("Selected");
    if (revalidated.status !== "Selected") throw new Error(revalidated.failure.message);

    const sampledRevisions: number[] = [];
    const countedAdapter = Object.freeze({
      ...adapter,
      queryGround: (...args: Parameters<typeof adapter.queryGround>) => {
        sampledRevisions.push(args[0].expectedRegionRevision);
        return adapter.queryGround(...args);
      }
    });
    const currentTerrain = deriveHestiaSurfaceRigidBodyTerrainColliders({
      world: revalidated.world,
      placement,
      groundSurfaceProbe: createHestiaAuthorityGroundSurfaceProbe({
        state: transition.state,
        adapter: countedAdapter
      })
    });
    expect(currentTerrain.status).toBe("Resolved");
    if (currentTerrain.status !== "Resolved") throw new Error(currentTerrain.failure.message);
    expect(sampledRevisions).toHaveLength(HESTIA_RIGID_BODY_TERRAIN_PATCH_MAX_COLLIDERS);
    expect(sampledRevisions.every((revision) => revision === transition.state.regionRevision)).toBe(true);
    const currentCollider = colliderAt(currentTerrain.terrainColliders, sampleX, sampleZ);
    expect(currentCollider).toBeDefined();
    expect(currentCollider!.maximumMeters.y).toBeLessThan(priorCollider.maximumMeters.y);
    expect(currentCollider!.colliderKey).toContain(
      `:${transition.state.regionRevision}:${transition.state.editRevision}:`
    );

    expect(deriveHestiaSurfaceRigidBodyTerrainColliders({
      world: revalidated.world,
      placement,
      groundSurfaceProbe: createHestiaAuthorityGroundSurfaceProbe({
        state: authority.state,
        adapter: createSurfaceRegionVoxelCollisionAdapter(authority)
      })
    })).toMatchObject({
      status: "Rejected",
      failure: { attemptedCandidateCount: 0 }
    });
  }, 60_000);

  it("refreshes interior, grid-seam, brick-seam, deep, and NoChange edits exactly with bounded rays", () => {
    const rootX = placement.rootQuantum.x * SURFACE_VOXEL_EDIT_QUANTUM_METERS;
    const rootZ = placement.rootQuantum.z * SURFACE_VOXEL_EDIT_QUANTUM_METERS;
    const sourceProbe = createHestiaAuthorityGroundSurfaceProbe({
      state: authority.state,
      adapter: createSurfaceRegionVoxelCollisionAdapter(authority)
    });
    const surfaceHeight = (x: number, z: number): number => {
      const sample = sourceProbe.sampleGroundSurface(x, z);
      if (sample.status === "Rejected" || sample.hit === null) {
        throw new Error(`Expected authoritative Terrain at ${x}:${z}.`);
      }
      return sample.hit.pointMeters.y;
    };
    const cases = [
      {
        label: "interior",
        x: Math.floor(rootX) + 0.5,
        z: Math.floor(rootZ) + 0.5,
        depth: 0,
        expectedGroundQueries: 9
      },
      {
        label: "grid-seam",
        x: Math.floor(rootX),
        z: Math.floor(rootZ),
        depth: 0,
        expectedGroundQueries: 16
      },
      { label: "brick-seam", x: 56, z: -40, depth: 0, expectedGroundQueries: 16 },
      {
        label: "deep",
        x: Math.floor(rootX) + 1.25,
        z: Math.floor(rootZ) + 0.25,
        depth: 2,
        expectedGroundQueries: 9
      }
    ] as const;

    for (const testCase of cases) {
      const editIntent: SurfaceVoxelEditIntent = {
        schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
        editId: `surface-edit:rigid-terrain-incremental:${testCase.label}`,
        expectedRegionRevision: authority.state.regionRevision,
        tick: 1,
        actorId: "surface-player:rigid-terrain-incremental",
        sourceId: "hestia.pulse-cutter.v1",
        sourceImpactIntentId: `impact:rigid-terrain-incremental:${testCase.label}`,
        bodyId: authority.state.bodyId,
        surfaceFrameId: authority.state.surfaceFrameId,
        regionId: authority.state.regionId,
        operation: "SubtractSphere",
        centerGlobalQuantum: {
          x: Math.round(testCase.x / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
          y: Math.round(
            (surfaceHeight(testCase.x, testCase.z) - testCase.depth)
              / SURFACE_VOXEL_EDIT_QUANTUM_METERS
          ),
          z: Math.round(testCase.z / SURFACE_VOXEL_EDIT_QUANTUM_METERS)
        },
        quantumMeters: SURFACE_VOXEL_EDIT_QUANTUM_METERS,
        radiusMeters: 0.75
      };
      const transition = applySurfaceVoxelEdit(authority, editIntent);
      expect(transition.result.status, testCase.label).toBe("Applied");
      const adapter = createSurfaceRegionVoxelCollisionAdapter(transition.authority);
      const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
      const revalidated = revalidateHestiaSurfaceWorldIncrementallyAgainstAuthority({
        sourceWorld: world,
        state: transition.state,
        adapter,
        frameOriginMeters: HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
        waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
        capsule: locomotion.capsule,
        collisionSkinMeters: locomotion.collisionSkinMeters,
        editIntent,
        editResult: transition.result
      });
      expect(revalidated.status, testCase.label).toBe("Selected");
      if (revalidated.status !== "Selected") throw new Error(revalidated.failure.message);

      let incrementalGroundQueries = 0;
      const countedAdapter = Object.freeze({
        ...adapter,
        queryGround: (...args: Parameters<typeof adapter.queryGround>) => {
          incrementalGroundQueries += 1;
          return adapter.queryGround(...args);
        }
      });
      const incremental = refreshHestiaSurfaceRigidBodyTerrainPatch({
        sourcePatch: terrainPatch,
        world: revalidated.world,
        placement,
        authorityState: transition.state,
        editIntent,
        editResult: transition.result,
        groundSurfaceProbe: createHestiaAuthorityGroundSurfaceProbe({
          state: transition.state,
          adapter: countedAdapter
        })
      });
      const fullReference = deriveHestiaSurfaceRigidBodyTerrainPatch({
        world: revalidated.world,
        placement,
        authorityState: transition.state,
        groundSurfaceProbe: createHestiaAuthorityGroundSurfaceProbe({
          state: transition.state,
          adapter
        })
      });
      expect(incremental.status, testCase.label).toBe("Resolved");
      expect(fullReference.status, testCase.label).toBe("Resolved");
      if (incremental.status !== "Resolved") throw new Error(incremental.failure.message);
      if (fullReference.status !== "Resolved") throw new Error(fullReference.failure.message);
      expect(incrementalGroundQueries, testCase.label).toBe(testCase.expectedGroundQueries);
      expect(incrementalGroundQueries, testCase.label).toBeLessThanOrEqual(16);
      expect(JSON.stringify(incremental.terrainColliders), testCase.label)
        .toBe(JSON.stringify(fullReference.terrainColliders));
      expect(incremental.patch.identity, testCase.label).toEqual({
        bodyId: transition.state.bodyId,
        regionId: transition.state.regionId,
        surfaceFrameId: transition.state.surfaceFrameId,
        regionRevision: transition.state.regionRevision,
        editRevision: transition.state.editRevision,
        regionContentHash: transition.state.currentRegionContentHash
      });
      const unaffectedIndex = terrainPatch.columns.findIndex((column) =>
        Math.hypot(column.groupX + 0.5 - testCase.x, column.groupZ + 0.5 - testCase.z) > 8
      );
      expect(unaffectedIndex, testCase.label).toBeGreaterThanOrEqual(0);
      expect(incremental.patch.columns[unaffectedIndex], testCase.label)
        .toBe(terrainPatch.columns[unaffectedIndex]);
    }

    const noChangeIntent: SurfaceVoxelEditIntent = {
      schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
      editId: "surface-edit:rigid-terrain-incremental:no-change",
      expectedRegionRevision: authority.state.regionRevision,
      tick: 1,
      actorId: "surface-player:rigid-terrain-incremental",
      sourceId: "hestia.pulse-cutter.v1",
      sourceImpactIntentId: "impact:rigid-terrain-incremental:no-change",
      bodyId: authority.state.bodyId,
      surfaceFrameId: authority.state.surfaceFrameId,
      regionId: authority.state.regionId,
      operation: "SubtractSphere",
      centerGlobalQuantum: {
        x: Math.round(rootX / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
        y: Math.round(30 / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
        z: Math.round(rootZ / SURFACE_VOXEL_EDIT_QUANTUM_METERS)
      },
      quantumMeters: SURFACE_VOXEL_EDIT_QUANTUM_METERS,
      radiusMeters: 0.125
    };
    const noChangeTransition = applySurfaceVoxelEdit(authority, noChangeIntent);
    expect(noChangeTransition.result.status).toBe("NoChange");
    const noChangeAdapter = createSurfaceRegionVoxelCollisionAdapter(noChangeTransition.authority);
    const noChangeWorld = Object.freeze({
      ...world,
      identity: Object.freeze({
        ...world.identity,
        regionRevision: noChangeTransition.state.regionRevision
      })
    });
    let noChangeGroundQueries = 0;
    const noChange = refreshHestiaSurfaceRigidBodyTerrainPatch({
      sourcePatch: terrainPatch,
      world: noChangeWorld,
      placement,
      authorityState: noChangeTransition.state,
      editIntent: noChangeIntent,
      editResult: noChangeTransition.result,
      groundSurfaceProbe: createHestiaAuthorityGroundSurfaceProbe({
        state: noChangeTransition.state,
        adapter: Object.freeze({
          ...noChangeAdapter,
          queryGround: (...args: Parameters<typeof noChangeAdapter.queryGround>) => {
            noChangeGroundQueries += 1;
            return noChangeAdapter.queryGround(...args);
          }
        })
      })
    });
    const noChangeReference = deriveHestiaSurfaceRigidBodyTerrainPatch({
      world: noChangeWorld,
      placement,
      authorityState: noChangeTransition.state,
      groundSurfaceProbe: createHestiaAuthorityGroundSurfaceProbe({
        state: noChangeTransition.state,
        adapter: noChangeAdapter
      })
    });
    expect(noChange.status).toBe("Resolved");
    expect(noChangeReference.status).toBe("Resolved");
    if (noChange.status !== "Resolved") throw new Error(noChange.failure.message);
    if (noChangeReference.status !== "Resolved") throw new Error(noChangeReference.failure.message);
    expect(noChangeGroundQueries).toBe(0);
    expect(noChange.patch.columns).toBe(terrainPatch.columns);
    expect(noChange.terrainColliders).toEqual(noChangeReference.terrainColliders);
  }, 180_000);

  it("fails closed for stale bindings, invalid refresh evidence, rejected probes, and invalid caches", () => {
    const rootX = placement.rootQuantum.x * SURFACE_VOXEL_EDIT_QUANTUM_METERS;
    const rootZ = placement.rootQuantum.z * SURFACE_VOXEL_EDIT_QUANTUM_METERS;
    const sampleX = Math.floor(rootX) + 0.5;
    const sampleZ = Math.floor(rootZ) + 0.5;
    const priorCollider = colliderAt(terrainColliders, sampleX, sampleZ);
    if (priorCollider === undefined) throw new Error("Expected Tree-root Terrain collider.");
    const editIntent: SurfaceVoxelEditIntent = {
      schemaVersion: SURFACE_VOXEL_EDIT_SCHEMA_VERSION,
      editId: "surface-edit:rigid-terrain-fail-closed",
      expectedRegionRevision: authority.state.regionRevision,
      tick: 1,
      actorId: "surface-player:rigid-terrain-fail-closed",
      sourceId: "hestia.pulse-cutter.v1",
      sourceImpactIntentId: "impact:rigid-terrain-fail-closed",
      bodyId: authority.state.bodyId,
      surfaceFrameId: authority.state.surfaceFrameId,
      regionId: authority.state.regionId,
      operation: "SubtractSphere",
      centerGlobalQuantum: {
        x: Math.round(sampleX / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
        y: Math.round(priorCollider.maximumMeters.y / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
        z: Math.round(sampleZ / SURFACE_VOXEL_EDIT_QUANTUM_METERS)
      },
      quantumMeters: SURFACE_VOXEL_EDIT_QUANTUM_METERS,
      radiusMeters: 0.75
    };
    const transition = applySurfaceVoxelEdit(authority, editIntent);
    if (transition.result.status !== "Applied") throw new Error("Expected applied fail-closed fixture edit.");
    const adapter = createSurfaceRegionVoxelCollisionAdapter(transition.authority);
    const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
    const revalidated = revalidateHestiaSurfaceWorldIncrementallyAgainstAuthority({
      sourceWorld: world,
      state: transition.state,
      adapter,
      frameOriginMeters: HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
      waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
      capsule: locomotion.capsule,
      collisionSkinMeters: locomotion.collisionSkinMeters,
      editIntent,
      editResult: transition.result
    });
    if (revalidated.status !== "Selected") throw new Error(revalidated.failure.message);
    const groundSurfaceProbe = createHestiaAuthorityGroundSurfaceProbe({
      state: transition.state,
      adapter
    });
    const common = {
      world: revalidated.world,
      placement,
      authorityState: transition.state,
      editIntent,
      editResult: transition.result,
      groundSurfaceProbe
    } as const;

    const stalePatch = Object.freeze({
      ...terrainPatch,
      identity: Object.freeze({ ...terrainPatch.identity, regionContentHash: "stale-region-hash" })
    });
    expect(refreshHestiaSurfaceRigidBodyTerrainPatch({
      ...common,
      sourcePatch: stalePatch
    })).toMatchObject({ status: "Rejected", failure: { attemptedCandidateCount: 0 } });

    const invalidEvidence = Object.freeze({
      ...transition.result,
      requiredCollisionRefreshKeys: Object.freeze([])
    });
    expect(refreshHestiaSurfaceRigidBodyTerrainPatch({
      ...common,
      sourcePatch: terrainPatch,
      editResult: invalidEvidence
    })).toMatchObject({ status: "Rejected", failure: { attemptedCandidateCount: 0 } });

    expect(refreshHestiaSurfaceRigidBodyTerrainPatch({
      ...common,
      sourcePatch: terrainPatch,
      groundSurfaceProbe: createHestiaAuthorityGroundSurfaceProbe({
        state: authority.state,
        adapter: createSurfaceRegionVoxelCollisionAdapter(authority)
      })
    })).toMatchObject({ status: "Rejected", failure: { attemptedCandidateCount: 0 } });

    const invalidColumns = [...terrainPatch.columns];
    invalidColumns[0] = Object.freeze({ ...invalidColumns[0], groupX: invalidColumns[0].groupX + 1 });
    expect(refreshHestiaSurfaceRigidBodyTerrainPatch({
      ...common,
      sourcePatch: Object.freeze({ ...terrainPatch, columns: Object.freeze(invalidColumns) })
    })).toMatchObject({ status: "Rejected", failure: { attemptedCandidateCount: 0 } });

    const rejectedProbe = Object.freeze({
      identity: groundSurfaceProbe.identity,
      sampleGroundSurface: () => Object.freeze({
        status: "Rejected" as const,
        reason: "BudgetExceeded" as const,
        message: "forced rejected probe",
        regionRevision: transition.state.regionRevision,
        editRevision: transition.state.editRevision
      })
    });
    expect(refreshHestiaSurfaceRigidBodyTerrainPatch({
      ...common,
      sourcePatch: terrainPatch,
      groundSurfaceProbe: rejectedProbe
    })).toMatchObject({ status: "Rejected", failure: { attemptedCandidateCount: 1 } });

    const noChangeIntent: SurfaceVoxelEditIntent = {
      ...editIntent,
      editId: "surface-edit:rigid-terrain-fail-closed:no-change",
      sourceImpactIntentId: "impact:rigid-terrain-fail-closed:no-change",
      centerGlobalQuantum: {
        x: Math.round(rootX / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
        y: Math.round(30 / SURFACE_VOXEL_EDIT_QUANTUM_METERS),
        z: Math.round(rootZ / SURFACE_VOXEL_EDIT_QUANTUM_METERS)
      },
      radiusMeters: 0.125
    };
    const noChangeTransition = applySurfaceVoxelEdit(authority, noChangeIntent);
    if (noChangeTransition.result.status !== "NoChange") throw new Error("Expected NoChange fixture edit.");
    const noChangeWorld = Object.freeze({
      ...world,
      identity: Object.freeze({
        ...world.identity,
        regionRevision: noChangeTransition.state.regionRevision
      })
    });
    const emptyPatch = Object.freeze({
      ...terrainPatch,
      columns: Object.freeze(terrainPatch.columns.map((column) => Object.freeze({
        ...column,
        maximumY: null
      })))
    });
    const emptyResult = refreshHestiaSurfaceRigidBodyTerrainPatch({
      sourcePatch: emptyPatch,
      world: noChangeWorld,
      placement,
      authorityState: noChangeTransition.state,
      editIntent: noChangeIntent,
      editResult: noChangeTransition.result,
      groundSurfaceProbe: createHestiaAuthorityGroundSurfaceProbe({
        state: noChangeTransition.state,
        adapter: createSurfaceRegionVoxelCollisionAdapter(noChangeTransition.authority)
      })
    });
    expect(emptyResult).toMatchObject({ status: "Rejected", failure: { attemptedCandidateCount: 0 } });
    expect(terrainPatch.columns.every((column) => column.maximumY !== null)).toBe(true);
  }, 60_000);

  it("lets the canonical detached Tree contact Terrain and reach deterministic rest within unchanged caps", () => {
    const first = runCanonicalTreeFall();
    expect(first.supportResults).toEqual(["Anchored", "Anchored", "Detached"]);
    expect(first.fallingPoses.length).toBeGreaterThanOrEqual(3);
    expect(first.physicsWorld.physicsFailure).toBeNull();
    expect(first.physicsWorld.simulationTick).toBeGreaterThanOrEqual(
      TREE_FALL_MINIMUM_VERIFICATION_TICKS
    );
    expect(first.physicsWorld.bodies).toHaveLength(1);
    const restingBody = first.physicsWorld.bodies[0];
    const firstFallingPose = JSON.parse(first.fallingPoses[0]) as Readonly<{
      readonly positionMeters: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
      readonly orientation: Readonly<{ readonly x: number; readonly y: number; readonly z: number; readonly w: number }>;
    }>;
    const restingUp = rotateSpatialVector(restingBody.orientation, { x: 0, y: 1, z: 0 });
    const restingTiltRadians = Math.acos(Math.max(-1, Math.min(1, restingUp.y)));
    const horizontalFallDisplacementMeters = Math.hypot(
      restingBody.positionMeters.x - firstFallingPose.positionMeters.x,
      restingBody.positionMeters.z - firstFallingPose.positionMeters.z
    );
    expect(restingBody.lifecycle, JSON.stringify({
      simulationTick: restingBody.simulationTick,
      restingTicks: restingBody.restingTicks,
      positionMeters: restingBody.positionMeters,
      linearVelocityMetersPerSecond: restingBody.linearVelocityMetersPerSecond,
      angularVelocityRadiansPerSecond: restingBody.angularVelocityRadiansPerSecond
    })).toBe("Resting");
    expect(restingTiltRadians).toBeGreaterThanOrEqual(Math.PI / 4);
    expect(horizontalFallDisplacementMeters).toBeGreaterThanOrEqual(0.5);
    expect(restingBody.positionMeters.y).toBeGreaterThan(world.verticalBand.minimumMeters);
    const hasTerrainContact = restingBody.colliders.some((collider) => {
      const bounds = rigidBodyAabb(restingBody, collider);
      return terrainColliders.some((terrain) =>
        bounds.maximum.x > terrain.minimumMeters.x
        && bounds.minimum.x < terrain.maximumMeters.x
        && bounds.maximum.z > terrain.minimumMeters.z
        && bounds.minimum.z < terrain.maximumMeters.z
        && bounds.maximum.y >= terrain.maximumMeters.y
        && Math.abs(bounds.minimum.y - terrain.maximumMeters.y) <= 0.125
      );
    });
    expect(hasTerrainContact).toBe(true);

    const repeated = runCanonicalTreeFall();
    expect(repeated.fallingPoses).toEqual(first.fallingPoses);
    expect(JSON.stringify(repeated.physicsWorld))
      .toBe(JSON.stringify(first.physicsWorld));
  }, 120_000);
});
