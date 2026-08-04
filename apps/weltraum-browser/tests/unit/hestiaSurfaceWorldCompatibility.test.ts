import { beforeAll, describe, expect, it } from "vitest";
import {
  HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
  HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG,
  HESTIA_SURFACE_PLAY_V1_CONFIG
} from "../../src/surface-play/surfacePlayConfig";
import {
  createSurfaceRegionVoxelAuthority,
  createSurfaceRegionVoxelCollisionAdapter
} from "../../src/surface-play/voxel-edit";
import { createSurfaceNetsVoxelMeshProduct, validateVoxelMeshProduct } from "../../src/voxel";
import {
  createHestiaSourceGroundProbe,
  createHestiaAuthorityGroundProbe,
  enumerateHestiaCapsuleClearanceSamplePoints,
  HESTIA_SURFACE_WORLD_V1,
  selectHestiaSurfaceWorld,
  type HestiaSurfaceWorldFacts
} from "../../src/surface-play/world";
import { resolveHestiaSurfacePlayWorld, revalidateHestiaSurfacePlayWorld } from "../../src/surface-play/surfacePlayBootstrap";
import { createHestiaAgileGroundedLocomotionPresetV1 } from "../../src/surface-play/player";
import {
  createHestiaFieldContext,
  HESTIA_PRESET_ID,
  HESTIA_SEA_LEVEL_METERS,
  sampleHestiaDensityFields,
  sampleHestiaSurfaceFields,
  type HestiaFieldIdentityInput
} from "../../src/world-generation/hestia";
import { classifyHestiaMaterial } from "../../src/world-generation/hestia/materialClassifier";
import {
  surfaceFrameId,
  voxelBodyId,
  voxelRegionId,
  VOXEL_BRICK_CELL_DIMENSIONS
} from "../../src/voxel";

const capsule = Object.freeze({ radiusMeters: 0.35, heightMeters: 1.8 });
const currentFieldIdentity: HestiaFieldIdentityInput = Object.freeze({
  rootSeed: HESTIA_SURFACE_PLAY_V1_CONFIG.seed,
  bodyId: voxelBodyId(HESTIA_SURFACE_PLAY_V1_CONFIG.bodyId),
  surfaceFrameId: surfaceFrameId(HESTIA_SURFACE_PLAY_V1_CONFIG.surfaceFrameId),
  regionId: voxelRegionId(HESTIA_SURFACE_PLAY_V1_CONFIG.regionId),
  voxelSizeMeters: HESTIA_SURFACE_PLAY_V1_CONFIG.voxelSizeMeters
});

const selectCurrentSurfaceWorld = (): Readonly<HestiaSurfaceWorldFacts> => {
  const probe = createHestiaSourceGroundProbe({
    fieldIdentity: currentFieldIdentity,
    capsule,
    collisionSkinMeters: 0.02
  });
  const result = selectHestiaSurfaceWorld({
    identity: {
      bodyId: HESTIA_SURFACE_PLAY_V1_CONFIG.bodyId,
      regionId: HESTIA_SURFACE_PLAY_V1_CONFIG.regionId,
      surfaceFrameId: HESTIA_SURFACE_PLAY_V1_CONFIG.surfaceFrameId,
      regionRevision: 0
    },
    rootSeed: HESTIA_SURFACE_PLAY_V1_CONFIG.seed,
    voxelSizeMeters: HESTIA_SURFACE_PLAY_V1_CONFIG.voxelSizeMeters,
    frameOriginMeters: HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
    waterSurfaceHeightMeters: HESTIA_SEA_LEVEL_METERS,
    probe
  });
  if (result.status !== "Selected") throw new Error(result.failure.message);
  return result.world;
};

const representativeFacts = (world: Readonly<HestiaSurfaceWorldFacts>) => {
  const spawn = world.traversalDomain.cells.find((cell) =>
    cell.gridX === world.traversalDomain.spawnGridCell.gridX
    && cell.gridZ === world.traversalDomain.spawnGridCell.gridZ
  );
  if (spawn === undefined) throw new Error("Selected world must contain its spawn traversal cell.");
  const decorative = world.environment.decorativePopulation;
  const water = world.environment.waterPatches;
  return {
    presetId: HESTIA_PRESET_ID,
    identity: world.identity,
    rootSeed: world.environment.rootSeed,
    voxelSizeMeters: world.environment.voxelSizeMeters,
    waterSurfaceHeightMeters: world.waterSurfaceHeightMeters,
    anchorCenterMeters: world.anchorCenterMeters,
    verticalBand: world.verticalBand,
    brickBounds: world.brickBounds,
    residentBrickCoordinates: world.residentBrickCoordinates,
    traversal: {
      gridOriginMeters: world.traversalDomain.gridOriginMeters,
      gridCounts: world.traversalDomain.gridCounts,
      componentBoundsMeters: world.traversalDomain.componentBoundsMeters,
      spawnGridCell: world.traversalDomain.spawnGridCell,
      spawnPerimeterDistanceMeters: world.traversalDomain.spawnPerimeterDistanceMeters,
      dryCellCount: world.shoreBoundary.dryCellKeys.length,
      spawn
    },
    decorativePopulation: {
      count: decorative.length,
      sproutCount: decorative.filter((fact) => fact.kind === "cyan_luminous_sprout").length,
      capCount: decorative.filter((fact) => fact.kind === "cyan_luminous_cap").length,
      first: decorative[0],
      last: decorative.at(-1)
    },
    waterPatches: {
      count: water.length,
      shoreCount: water.filter((fact) => fact.source === "Shore").length,
      wetDepressionCount: water.filter((fact) => fact.source === "WetDepression").length,
      first: water[0],
      last: water.at(-1)
    },
    encounter: world.encounter
  };
};

const coordinateKey = (coordinate: Readonly<{ x: number; y: number; z: number }>): string =>
  `${coordinate.x}:${coordinate.y}:${coordinate.z}`;

describe("Hestia Surface Play V1 world compatibility", () => {
  let firstWorld: Readonly<HestiaSurfaceWorldFacts>;
  let secondWorld: Readonly<HestiaSurfaceWorldFacts>;

  beforeAll(() => {
    firstWorld = selectCurrentSurfaceWorld();
    secondWorld = selectCurrentSurfaceWorld();
  }, 60_000);

  it("keeps the fixed preset's semantic World Facts stable for equal inputs", () => {
    const first = representativeFacts(firstWorld);
    const second = representativeFacts(secondWorld);

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      presetId: "hestia.nebelwald-archipelago.preview.v1",
      identity: {
        bodyId: "planet.hestia",
        regionId: "region:hestia.surface-play.v1",
        surfaceFrameId: "frame:surface_hestia_surface_play_v1",
        regionRevision: 0
      },
      rootSeed: "hestia-surface-play-v1",
      voxelSizeMeters: 0.5,
      waterSurfaceHeightMeters: 0,
      anchorCenterMeters: { x: 64, y: 10.820156477200054, z: -32 },
      brickBounds: {
        minInclusive: { x: 2, y: 0, z: -4 },
        maxExclusive: { x: 6, y: 1, z: 0 }
      },
      traversal: {
        gridOriginMeters: { x: 40, z: -56 },
        gridCounts: { x: 97, z: 97 },
        componentBoundsMeters: {
          minInclusive: { x: 49.5, z: -56 },
          maxExclusive: { x: 88.5, z: -7.5 },
          size: { x: 38.5, z: 48 }
        },
        spawnGridCell: { gridX: 48, gridZ: 48 },
        spawnPerimeterDistanceMeters: 13.5,
        dryCellCount: 6_397
      },
      decorativePopulation: {
        count: 162,
        sproutCount: 104,
        capCount: 58,
        first: {
          id: "hestia.scatter.v1:0e09574c:100:-12",
          kind: "cyan_luminous_sprout",
          surfaceMaterialId: 2
        },
        last: {
          id: "hestia.scatter.v1:0e09574c:96:-80",
          kind: "cyan_luminous_sprout",
          surfaceMaterialId: 2
        }
      },
      waterPatches: {
        count: 0,
        shoreCount: 0,
        wetDepressionCount: 0
      },
      encounter: {
        surveyDronePositionMeters: { x: 64, y: 12.440156477200055, z: -44 },
        structuralTrees: [{
          instanceId: "hestia.surface-play.umbrella.phase2",
          seed: "hestia.surface-play.umbrella.phase2-seed",
          rootQuantum: { x: 464, y: 72, z: -336 }
        }]
      }
    });
  });

  it("keeps brick, traversal, and decorative ownership unique and half-open", () => {
    const world = firstWorld;
    const expectedBricks = Array.from(
      { length: world.brickBounds.maxExclusive.z - world.brickBounds.minInclusive.z },
      (_, zIndex) => zIndex + world.brickBounds.minInclusive.z
    ).flatMap((z) => Array.from(
      { length: world.brickBounds.maxExclusive.x - world.brickBounds.minInclusive.x },
      (_, xIndex) => ({ x: xIndex + world.brickBounds.minInclusive.x, y: 0, z })
    ));
    expect(world.residentBrickCoordinates).toEqual(expectedBricks);
    expect(new Set(world.residentBrickCoordinates.map(coordinateKey)).size).toBe(expectedBricks.length);

    const dryCells = new Set(world.shoreBoundary.dryCellKeys);
    expect(dryCells.size).toBe(world.shoreBoundary.dryCellKeys.length);
    expect(dryCells.size).toBeLessThan(
      world.shoreBoundary.gridCounts.x * world.shoreBoundary.gridCounts.z
    );
    expect(world.traversalDomain.cells).toHaveLength(dryCells.size);
    for (const cell of world.traversalDomain.cells) {
      expect(dryCells.has(`${cell.gridZ}:${cell.gridX}`)).toBe(true);
      expect(cell.gridX).toBeGreaterThanOrEqual(0);
      expect(cell.gridX).toBeLessThan(world.shoreBoundary.gridCounts.x);
      expect(cell.gridZ).toBeGreaterThanOrEqual(0);
      expect(cell.gridZ).toBeLessThan(world.shoreBoundary.gridCounts.z);
    }

    for (const fact of world.environment.decorativePopulation) {
      const parts = fact.id.split(":");
      const anchorX = Number(parts.at(-2));
      const anchorZ = Number(parts.at(-1));
      const owners = world.residentBrickCoordinates.filter((coordinate) =>
        anchorX >= coordinate.x * VOXEL_BRICK_CELL_DIMENSIONS.x
        && anchorX < (coordinate.x + 1) * VOXEL_BRICK_CELL_DIMENSIONS.x
        && anchorZ >= coordinate.z * VOXEL_BRICK_CELL_DIMENSIONS.z
        && anchorZ < (coordinate.z + 1) * VOXEL_BRICK_CELL_DIMENSIONS.z
      );
      expect(owners, fact.id).toHaveLength(1);
    }
  });

  it("keeps dry, water, shore-near, population, and encounter facts reproducible", () => {
    const first = representativeFacts(firstWorld);
    const second = representativeFacts(secondWorld);
    const spawnKey = `${first.traversal.spawn.gridZ}:${first.traversal.spawn.gridX}`;
    const firstContext = createHestiaFieldContext(currentFieldIdentity);
    const secondContext = createHestiaFieldContext(currentFieldIdentity);
    const drySurface = sampleHestiaSurfaceFields(firstContext, 64, -32);
    const waterSurface = sampleHestiaSurfaceFields(firstContext, -26, -96);
    const shoreSurface = sampleHestiaSurfaceFields(firstContext, -30, -96);

    expect(firstWorld.shoreBoundary.dryCellKeys).toContain(spawnKey);
    expect(first.traversal.spawn.groundHeightMeters).toBeGreaterThanOrEqual(
      HESTIA_SEA_LEVEL_METERS + HESTIA_SURFACE_WORLD_V1.waterClearanceMeters
    );
    expect(drySurface.surfaceHeight).toBeGreaterThan(
      HESTIA_SEA_LEVEL_METERS + HESTIA_SURFACE_WORLD_V1.waterClearanceMeters
    );
    expect({
      water: { surfaceHeight: waterSurface.surfaceHeight, wetDepression: waterSurface.wetDepression },
      shoreNear: { surfaceHeight: shoreSurface.surfaceHeight, wetDepression: shoreSurface.wetDepression }
    }).toEqual({
      water: { surfaceHeight: -1.2355892211150485, wetDepression: 1 },
      shoreNear: { surfaceHeight: 0.09352457566142869, wetDepression: 1 }
    });
    expect(sampleHestiaSurfaceFields(secondContext, -26, -96)).toEqual(waterSurface);
    expect(sampleHestiaSurfaceFields(secondContext, -30, -96)).toEqual(shoreSurface);
    expect(firstWorld.environment.decorativePopulation.map((fact) => fact.id))
      .toEqual(secondWorld.environment.decorativePopulation.map((fact) => fact.id));
    expect(firstWorld.environment.waterPatches.map((patch) => patch.id))
      .toEqual(secondWorld.environment.waterPatches.map((patch) => patch.id));
    expect(new Set(firstWorld.environment.decorativePopulation.map((fact) => fact.id)).size)
      .toBe(firstWorld.environment.decorativePopulation.length);
    expect(new Set(firstWorld.environment.waterPatches.map((patch) => patch.id)).size)
      .toBe(firstWorld.environment.waterPatches.length);
    for (const patch of firstWorld.environment.waterPatches) {
      if (patch.source === "Shore") {
        expect(patch.positionMeters.y).toBe(HESTIA_SEA_LEVEL_METERS + 0.055);
      } else {
        expect(patch.positionMeters.y).toBeGreaterThan(HESTIA_SEA_LEVEL_METERS);
        expect(patch.positionMeters.y).toBeLessThanOrEqual(HESTIA_SEA_LEVEL_METERS + 1.295);
      }
    }
    expect(second.encounter).toEqual(first.encounter);
  });

  it("characterizes the first Coast analytic-to-authority clearance mismatch", () => {
    const coastWorld = resolveHestiaSurfacePlayWorld(
      HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG,
      "hestia.coast-lush.surface-play.preview.v1"
    );
    const authority = createSurfaceRegionVoxelAuthority({
      ...HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG,
      brickBounds: coastWorld.brickBounds,
      residentBrickCoordinates: coastWorld.residentBrickCoordinates
    });
    const adapter = createSurfaceRegionVoxelCollisionAdapter(authority);
    const locomotion = createHestiaAgileGroundedLocomotionPresetV1();
    const sourceProbe = createHestiaSourceGroundProbe({
      fieldIdentity: {
        profile: "hestia.coast-lush.surface-play.preview.v1",
        rootSeed: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.seed,
        bodyId: voxelBodyId(HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.bodyId),
        surfaceFrameId: surfaceFrameId(HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.surfaceFrameId),
        regionId: voxelRegionId(HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.regionId),
        voxelSizeMeters: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.voxelSizeMeters
      },
      capsule: locomotion.capsule,
      collisionSkinMeters: locomotion.collisionSkinMeters
    });
    const probe = createHestiaAuthorityGroundProbe({
      state: authority.state,
      adapter,
      capsule: locomotion.capsule,
      collisionSkinMeters: locomotion.collisionSkinMeters
    });
    const firstCell = coastWorld.traversalDomain.cells[0];
    if (firstCell === undefined) throw new Error("Coast world must contain traversal cells.");
    const sourceSample = sourceProbe.sampleGround(firstCell.centerMeters.x, firstCell.centerMeters.z);
    if (sourceSample === null) throw new Error("Coast source must sample the first traversal cell.");
    const authoritySample = probe.sampleGround(firstCell.centerMeters.x, firstCell.centerMeters.z);
    if (authoritySample === null) throw new Error("Coast authority must sample the first traversal cell.");
    const clearancePoints = enumerateHestiaCapsuleClearanceSamplePoints({
      xMeters: firstCell.centerMeters.x,
      groundHeightMeters: authoritySample.heightMeters,
      zMeters: firstCell.centerMeters.z,
      capsule: locomotion.capsule,
      collisionSkinMeters: locomotion.collisionSkinMeters,
      sampleSpacingMeters: authority.state.voxelSizeMeters / 2
    });
    const binding = {
      bodyId: authority.state.bodyId,
      regionId: authority.state.regionId,
      surfaceFrameId: authority.state.surfaceFrameId,
      expectedRegionRevision: authority.state.regionRevision
    } as const;
    const fieldContext = createHestiaFieldContext({
      profile: "hestia.coast-lush.surface-play.preview.v1",
      rootSeed: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.seed,
      bodyId: voxelBodyId(authority.state.bodyId),
      surfaceFrameId: surfaceFrameId(authority.state.surfaceFrameId),
      regionId: voxelRegionId(authority.state.regionId),
      voxelSizeMeters: authority.state.voxelSizeMeters
    });
    const firstMismatch = clearancePoints.map((point) => {
      const authorityDensity = adapter.sampleDensity(binding, point);
      const surface = sampleHestiaSurfaceFields(fieldContext, point.x, point.z);
      const sourceDensity = sampleHestiaDensityFields(
        fieldContext,
        point.x,
        point.y,
        point.z,
        surface
      );
      return Object.freeze({
        point,
        authorityDensity: authorityDensity.status === "Resolved" ? authorityDensity.density : null,
        authorityMaterialValue: authorityDensity.status === "Resolved" ? authorityDensity.materialValue : null,
        sourceDensity: sourceDensity.density,
        sourceMaterialValue: classifyHestiaMaterial({
          profile: "hestia.coast-lush.surface-play.preview.v1",
          yMeters: point.y,
          density: sourceDensity.density,
          surfaceHeight: surface.surfaceHeight,
          rockBreakup: sourceDensity.rockBreakup,
          wetDepression: surface.wetDepression,
          biological: surface.biological,
          coastLush: surface.coastLush!
        })
      });
    }).find((value) => value.authorityDensity !== null && value.authorityDensity < -locomotion.collisionSkinMeters);
    if (firstMismatch === undefined) throw new Error("Expected a Coast analytic-to-authority clearance mismatch.");
    const sourceSlopeDegrees = Math.acos(sourceSample.normal.y) * 180 / Math.PI;
    const authoritySlopeDegrees = Math.acos(authoritySample.normal.y) * 180 / Math.PI;
    console.info(JSON.stringify({
      gridX: firstCell.gridX,
      gridZ: firstCell.gridZ,
      sourceHeightMeters: firstCell.groundHeightMeters,
      authorityHeightMeters: authoritySample.heightMeters,
      sourceMaterialValue: firstMismatch.sourceMaterialValue,
      authorityMaterialValue: firstMismatch.authorityMaterialValue,
      sourceCapsuleClear: sourceSample.capsuleClear,
      strictAuthorityCapsuleClear: false,
      authorityCapsuleClear: authoritySample.capsuleClear,
      sourceSlopeDegrees,
      authoritySlopeDegrees,
      mismatch: firstMismatch
    }));
    expect({ gridX: firstCell.gridX, gridZ: firstCell.gridZ }).toEqual({ gridX: 46, gridZ: 8 });
    expect(firstCell.groundHeightMeters).toBe(6.8);
    expect(authoritySample.heightMeters).toBe(6.7999267578125);
    expect(firstMismatch.point).toEqual({ x: 62.835, y: 7.1499267578125, z: -52.285788383248864 });
    expect(firstMismatch.sourceDensity).toBe(0.059767305850982666);
    expect(firstMismatch.authorityDensity).toBe(-0.12088499218225479);
    expect(firstMismatch.sourceMaterialValue).toBe(3);
    expect(firstMismatch.authorityMaterialValue).toBe(0);
    expect(sourceSample.capsuleClear).toBe(true);
    expect(authoritySample.capsuleClear).toBe(true);
    expect(sourceSlopeDegrees).toBeCloseTo(15.61, 1);
    expect(authoritySlopeDegrees).toBeCloseTo(31.56, 1);
    expect(revalidateHestiaSurfacePlayWorld(authority, coastWorld).status).toBe("Selected");
    expect(authority.state.materializedBricks).toHaveLength(16);
    for (const descriptor of authority.state.materializedBricks) {
      const materialized = authority.materializeBrick(descriptor.key);
      if (materialized === undefined) throw new Error(`Missing Coast brick ${descriptor.key}.`);
      expect(validateVoxelMeshProduct(createSurfaceNetsVoxelMeshProduct(materialized.voxelBrick))).toEqual({ valid: true });
    }
  }, 60_000);
});
