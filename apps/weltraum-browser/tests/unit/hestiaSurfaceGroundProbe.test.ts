import { describe, expect, it } from "vitest";
import {
  createHestiaFieldContext,
  HESTIA_SEA_LEVEL_METERS,
  sampleHestiaDensityFields,
  sampleHestiaGroundSurface,
  type HestiaFieldIdentityInput
} from "../../src/world-generation/hestia";
import {
  surfaceFrameId,
  voxelBodyId,
  voxelRegionId
} from "../../src/voxel";
import {
  createHestiaAuthorityGroundSurfaceProbe,
  createHestiaSourceGroundProbe,
  enumerateHestiaCapsuleClearanceSamplePoints,
  adoptHestiaSurfaceWorldAgainstAuthority,
  deriveHestiaSurfaceRigidBodyTerrainColliders,
  selectHestiaSurfaceWorld
} from "../../src/surface-play/world";
import {
  createHestiaSurfacePlayAuthorityInput
} from "../../src/surface-play/surfacePlayConfig";
import {
  createSurfaceRegionVoxelAuthority,
  createSurfaceRegionVoxelCollisionAdapter
} from "../../src/surface-play/voxel-edit";

const fieldIdentity: HestiaFieldIdentityInput = Object.freeze({
  rootSeed: "hestia-surface-play-v1",
  bodyId: voxelBodyId("planet.hestia"),
  surfaceFrameId: surfaceFrameId("frame:surface_hestia_surface_play_v1"),
  regionId: voxelRegionId("region:hestia.surface-play.v1"),
  voxelSizeMeters: 0.5
});

const capsule = Object.freeze({ radiusMeters: 0.35, heightMeters: 1.8 });

describe("Hestia source ground probe", () => {
  it("centralizes the existing deterministic four-step zero-density surface", () => {
    const context = createHestiaFieldContext(fieldIdentity);
    const first = sampleHestiaGroundSurface(context, 8, 8);
    const second = sampleHestiaGroundSurface(context, 8, 8);

    expect(second).toEqual(first);
    expect(first.fields.density).toBeCloseTo(0, 4);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("enumerates a deterministic bounded inner capsule volume", () => {
    const points = enumerateHestiaCapsuleClearanceSamplePoints({
      xMeters: 8,
      groundHeightMeters: 3,
      zMeters: 8,
      capsule,
      collisionSkinMeters: 0.02,
      sampleSpacingMeters: 0.25
    });

    expect(points.length).toBeGreaterThan(20);
    expect(points.length).toBeLessThan(256);
    expect(points[0].y).toBeCloseTo(3.02, 12);
    expect(points.at(-1)?.y).toBeCloseTo(4.78, 12);
    expect(new Set(points.map((point) => JSON.stringify(point))).size).toBe(points.length);
    expect(Object.isFrozen(points)).toBe(true);
  });

  it("publishes finite normalized ground facts derived only from Hestia density truth", () => {
    const probe = createHestiaSourceGroundProbe({
      fieldIdentity,
      capsule,
      collisionSkinMeters: 0.02
    });
    const sample = probe.sampleGround(8, 8);
    expect(sample).not.toBeNull();
    expect(sample?.normal.y).toBeGreaterThan(0);
    expect(Math.hypot(sample!.normal.x, sample!.normal.y, sample!.normal.z)).toBeCloseTo(1, 12);

    const context = createHestiaFieldContext(fieldIdentity);
    const density = sampleHestiaDensityFields(context, 8, sample!.heightMeters, 8).density;
    expect(density).toBeCloseTo(0, 4);
    expect(probe.sampleGround(8, 8)).toEqual(sample);
  });

  it("selects a real dry 4x1x4 Hestia footprint from generator truth", () => {
    const probe = createHestiaSourceGroundProbe({ fieldIdentity, capsule, collisionSkinMeters: 0.02 });
    const result = selectHestiaSurfaceWorld({
      identity: {
        bodyId: fieldIdentity.bodyId,
        regionId: fieldIdentity.regionId,
        surfaceFrameId: fieldIdentity.surfaceFrameId,
        regionRevision: 0
      },
      rootSeed: fieldIdentity.rootSeed,
      voxelSizeMeters: fieldIdentity.voxelSizeMeters,
      frameOriginMeters: { x: 0, y: 0, z: 0 },
      waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
      probe
    });

    expect(result.status).toBe("Selected");
    if (result.status !== "Selected") throw new Error(result.failure.message);
    expect(result.world.anchorCenterMeters).toEqual({ x: 64, y: 10.820156477200054, z: -32 });
    expect(result.world.residentBrickCoordinates).toHaveLength(16);
    expect(result.world.environment).toMatchObject({
      identity: result.world.identity,
      rootSeed: fieldIdentity.rootSeed,
      voxelSizeMeters: fieldIdentity.voxelSizeMeters,
      residentBrickCoordinates: result.world.residentBrickCoordinates,
      waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
      anchorCenterMeters: result.world.anchorCenterMeters
    });
    expect(result.world.environment.decorativePopulation.map((fact) => String(fact.kind)))
      .not.toContain("black_trunk");
    expect(result.world.environment.decorativePopulation.every((fact) =>
        Math.abs(fact.positionMeters.x - 64) > 2.25
        || fact.positionMeters.z < -50
        || fact.positionMeters.z > -26
    )).toBe(true);
    expect(result.world.anchorCenterMeters.y).toBeGreaterThanOrEqual(1);
    expect(result.world.traversalDomain.componentBoundsMeters.size.x).toBeGreaterThanOrEqual(32);
    expect(result.world.traversalDomain.componentBoundsMeters.size.z).toBeGreaterThanOrEqual(32);

    const authority = createSurfaceRegionVoxelAuthority(createHestiaSurfacePlayAuthorityInput(result.world));
    const collisionAdapter = createSurfaceRegionVoxelCollisionAdapter(authority);
    const adopted = adoptHestiaSurfaceWorldAgainstAuthority({
      sourceWorld: result.world,
      state: authority.state,
      adapter: collisionAdapter,
      waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
      capsule,
      collisionSkinMeters: 0.02
    });
    expect(adopted.status).toBe("Selected");
    if (adopted.status !== "Selected") throw new Error(adopted.failure.message);
    expect(adopted.world.identity.regionRevision).toBe(authority.state.regionRevision);
    expect(adopted.world.environment.identity).toEqual(adopted.world.identity);
    expect(Math.abs(adopted.world.anchorCenterMeters.y - result.world.anchorCenterMeters.y)).toBeLessThanOrEqual(0.5);

    const knownTreeFallFailurePoint = Object.freeze({ x: 51.5402, z: -45.8631 });
    const failureGroupX = Math.floor(knownTreeFallFailurePoint.x);
    const failureGroupZ = Math.floor(knownTreeFallFailurePoint.z);
    expect(adopted.world.traversalDomain.cells.some((cell) =>
      Math.floor(cell.centerMeters.x) === failureGroupX
      && Math.floor(cell.centerMeters.z) === failureGroupZ
    )).toBe(false);
    const rigidTerrain = deriveHestiaSurfaceRigidBodyTerrainColliders({
      world: adopted.world,
      placement: adopted.world.encounter.structuralTrees[0],
      groundSurfaceProbe: createHestiaAuthorityGroundSurfaceProbe({
        state: authority.state,
        adapter: collisionAdapter
      })
    });
    expect(rigidTerrain.status).toBe("Resolved");
    if (rigidTerrain.status !== "Resolved") throw new Error(rigidTerrain.failure.message);
    expect(rigidTerrain.terrainColliders.some((collider) =>
      knownTreeFallFailurePoint.x >= collider.minimumMeters.x
      && knownTreeFallFailurePoint.x < collider.maximumMeters.x
      && knownTreeFallFailurePoint.z >= collider.minimumMeters.z
      && knownTreeFallFailurePoint.z < collider.maximumMeters.z
    )).toBe(true);

    const staleEnvironmentWorld = Object.freeze({
      ...result.world,
      environment: Object.freeze({ ...result.world.environment, rootSeed: "stale-root-seed" })
    });
    expect(adoptHestiaSurfaceWorldAgainstAuthority({
      sourceWorld: staleEnvironmentWorld,
      state: authority.state,
      adapter: createSurfaceRegionVoxelCollisionAdapter(authority),
      waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
      capsule,
      collisionSkinMeters: 0.02
    })).toMatchObject({
      status: "Rejected",
      failure: { code: "NoAdmissibleLandFootprint" }
    });
  }, 60_000);
});
