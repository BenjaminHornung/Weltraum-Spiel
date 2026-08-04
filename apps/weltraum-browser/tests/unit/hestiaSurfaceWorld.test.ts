import { describe, expect, it } from "vitest";
import {
  computeHestiaSurfaceVerticalBand,
  enumerateHestiaSurfaceCandidateCenters,
  HESTIA_COAST_LUSH_PREVIEW_ADMISSION_POLICY,
  revalidateHestiaSurfaceWorldCandidate,
  selectHestiaSurfaceWorld,
  selectHestiaSurfaceWorldCandidate,
  type HestiaSurfaceGroundProbe,
  type HestiaSurfaceWorldSelectionInput
} from "../../src/surface-play/world/hestiaSurfaceWorld";
import {
  createHestiaFieldContext,
  HESTIA_COAST_LUSH_PRESET_ID,
  sampleHestiaGroundSurface,
  sampleHestiaSurfaceFields
} from "../../src/world-generation/hestia";
import type { HestiaAuthorityGroundSurfaceProbe } from "../../src/surface-play/world/hestiaAuthorityGroundProbe";
import { createHestiaSourceGroundProbe } from "../../src/surface-play/world/hestiaSurfaceGroundProbe";
import {
  HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG,
  HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS
} from "../../src/surface-play/surfacePlayConfig";
import { deriveHestiaSurfaceRigidBodyTerrainColliders } from "../../src/surface-play/world/hestiaSurfaceRigidBodyTerrain";
import {
  surfaceFrameId,
  voxelBodyId,
  voxelRegionId,
  VOXEL_BRICK_CELL_DIMENSIONS
} from "../../src/voxel";

const identity = Object.freeze({
  bodyId: "body:hestia",
  regionId: "region:hestia.surface-play",
  surfaceFrameId: "frame:surface.hestia-play",
  regionRevision: 7
});

const ground = (heightMeters: number) => Object.freeze({
  heightMeters,
  normal: Object.freeze({ x: 0, y: 1, z: 0 }),
  capsuleClear: true
});

const input = (
  probe: HestiaSurfaceGroundProbe,
  frameOriginMeters = Object.freeze({ x: 0, y: 0, z: 0 }),
  waterSurfaceHeightMeters = 0
): HestiaSurfaceWorldSelectionInput => ({
  identity,
  rootSeed: "hestia-surface-world-unit",
  voxelSizeMeters: 0.5,
  frameOriginMeters,
  waterSurfaceHeightMeters,
  probe
});

const coastFieldIdentity = Object.freeze({
  profile: HESTIA_COAST_LUSH_PRESET_ID,
  rootSeed: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.seed,
  bodyId: voxelBodyId(HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.bodyId),
  surfaceFrameId: surfaceFrameId(HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.surfaceFrameId),
  regionId: voxelRegionId(HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.regionId),
  voxelSizeMeters: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.voxelSizeMeters
} as const);

const coastInput = (): HestiaSurfaceWorldSelectionInput => ({
  identity: {
    bodyId: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.bodyId,
    regionId: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.regionId,
    surfaceFrameId: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.surfaceFrameId,
    regionRevision: 0
  },
  profile: HESTIA_COAST_LUSH_PRESET_ID,
  rootSeed: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.seed,
  voxelSizeMeters: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.voxelSizeMeters,
  frameOriginMeters: HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
  waterSurfaceHeightMeters: 0,
  probe: createHestiaSourceGroundProbe({
    fieldIdentity: coastFieldIdentity,
    capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
    collisionSkinMeters: 0.02
  })
});

describe("Hestia Surface World selection", () => {
  it("enumerates the finite candidate lattice by distance, global z, then global x", () => {
    const candidates = enumerateHestiaSurfaceCandidateCenters({ x: 100, y: 3, z: 200 });

    expect(candidates).toHaveLength(81);
    expect(candidates.slice(0, 9).map(({ x, z }) => [x, z])).toEqual([
      [100, 200],
      [100, 184],
      [84, 200],
      [116, 200],
      [100, 216],
      [84, 184],
      [116, 184],
      [84, 216],
      [116, 216]
    ]);
    expect(Object.isFrozen(candidates)).toBe(true);
    expect(candidates.every(Object.isFrozen)).toBe(true);
  });

  it("uses the exact aligned vertical-band formula and upper-clearance rejection", () => {
    expect(computeHestiaSurfaceVerticalBand(3, 43)).toEqual({
      minimumMeters: 35,
      maximumExclusiveMeters: 67
    });
    expect(computeHestiaSurfaceVerticalBand(3, 10)).toBeNull();
  });

  it("keeps the initial 12 m spawn-to-perimeter reserve when selecting a candidate", () => {
    const probe: HestiaSurfaceGroundProbe = {
      sampleGround(xMeters, zMeters) {
        return xMeters === 8 && zMeters === 8 ? null : ground(8);
      }
    };

    const result = selectHestiaSurfaceWorldCandidate(input(probe), { x: 0, y: 0, z: 0 });

    expect(result).toMatchObject({
      status: "Rejected",
      failure: { code: "NoAdmissibleLandFootprint", attemptedCandidateCount: 1 }
    });
  });

  it("uses the named Coast preview policy without relaxing the V1 reserve", () => {
    const probe: HestiaSurfaceGroundProbe = {
      sampleGround(xMeters, zMeters) {
        return xMeters === 10 && zMeters === 0 ? null : ground(8);
      }
    };
    const v1Result = selectHestiaSurfaceWorldCandidate(input(probe), { x: 0, y: 0, z: 0 });
    expect(v1Result.status).toBe("Rejected");

    const coastResult = selectHestiaSurfaceWorldCandidate({
      ...input(probe),
      profile: HESTIA_COAST_LUSH_PRESET_ID,
      identity: {
        ...identity,
        bodyId: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.bodyId,
        regionId: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.regionId,
        surfaceFrameId: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.surfaceFrameId
      },
      rootSeed: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.seed
    }, { x: 0, y: 0, z: 0 });
    expect(coastResult.status).toBe("Selected");
    if (coastResult.status !== "Selected") throw new Error(coastResult.failure.message);
    expect(HESTIA_COAST_LUSH_PREVIEW_ADMISSION_POLICY).toEqual({
      id: "hestia.surface-world-admission.coast-lush-preview.v1",
      minimumSpawnPerimeterDistanceMeters: 8.5,
      authorityClearanceToleranceMeters: 0.125
    });
    expect(coastResult.world.traversalDomain.spawnPerimeterDistanceMeters)
      .toBeGreaterThanOrEqual(HESTIA_COAST_LUSH_PREVIEW_ADMISSION_POLICY.minimumSpawnPerimeterDistanceMeters);
    expect(coastResult.world.traversalDomain.spawnPerimeterDistanceMeters).toBeLessThan(12);
  });

  it("fails closed for a Coast profile mixed with the V1 identity tuple", () => {
    expect(() => selectHestiaSurfaceWorldCandidate({
      ...input({ sampleGround: () => ground(8) }),
      profile: HESTIA_COAST_LUSH_PRESET_ID
    }, { x: 0, y: 0, z: 0 })).toThrow(/approved identity tuple/i);
  });

  it("fails closed for a Coast identity tuple without the Coast profile", () => {
    expect(() => selectHestiaSurfaceWorldCandidate({
      ...input({ sampleGround: () => ground(8) }),
      identity: {
        ...identity,
        bodyId: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.bodyId,
        regionId: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.regionId,
        surfaceFrameId: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.surfaceFrameId
      },
      rootSeed: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.seed
    }, { x: 0, y: 0, z: 0 })).toThrow(/requires its approved profile/i);
  });

  it("requires Coast sea level while retaining finite V1 water heights", () => {
    expect(() => selectHestiaSurfaceWorldCandidate({
      ...coastInput(),
      waterSurfaceHeightMeters: 1
    }, { x: 64, y: 8, z: -32 })).toThrow(/zero water surface height/i);

    const v1Result = selectHestiaSurfaceWorldCandidate(
      input({ sampleGround: () => ground(8) }, undefined, 7),
      { x: 0, y: 0, z: 0 }
    );
    expect(v1Result.status).toBe("Selected");
  });

  it("admits the approved Coast anchor deterministically under the Coast policy", () => {
    const fieldIdentity = {
      profile: HESTIA_COAST_LUSH_PRESET_ID,
      rootSeed: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.seed,
      bodyId: voxelBodyId(HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.bodyId),
      surfaceFrameId: surfaceFrameId(HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.surfaceFrameId),
      regionId: voxelRegionId(HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.regionId),
      voxelSizeMeters: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.voxelSizeMeters
    } as const;
    const probe = createHestiaSourceGroundProbe({
      fieldIdentity,
      capsule: { radiusMeters: 0.35, heightMeters: 1.8 },
      collisionSkinMeters: 0.02
    });
    const result = selectHestiaSurfaceWorldCandidate({
      identity: {
        bodyId: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.bodyId,
        regionId: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.regionId,
        surfaceFrameId: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.surfaceFrameId,
        regionRevision: 0
      },
      profile: HESTIA_COAST_LUSH_PRESET_ID,
      rootSeed: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.seed,
      voxelSizeMeters: HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG.voxelSizeMeters,
      frameOriginMeters: HESTIA_SURFACE_PLAY_FRAME_ORIGIN_METERS,
      waterSurfaceHeightMeters: 0,
      probe
    }, { x: 64, y: 8, z: -32 });
    expect(result.status).toBe("Selected");
    if (result.status !== "Selected") throw new Error(result.failure.message);
    expect(result.world.anchorCenterMeters).toEqual({ x: 64, y: 8, z: -32 });
    expect(result.world.traversalDomain.spawnPerimeterDistanceMeters)
      .toBeGreaterThanOrEqual(HESTIA_COAST_LUSH_PREVIEW_ADMISSION_POLICY.minimumSpawnPerimeterDistanceMeters);
    expect(result.world.traversalDomain.spawnPerimeterDistanceMeters).toBeLessThan(12);
    expect(result.world.residentBrickCoordinates).toHaveLength(16);
  }, 60_000);

  it("does not reinterpret a post-edit interior crater rim as the initial dry perimeter", () => {
    const selected = selectHestiaSurfaceWorldCandidate(
      input({ sampleGround: () => ground(8) }),
      { x: 0, y: 0, z: 0 }
    );
    if (selected.status !== "Selected") throw new Error(selected.failure.message);
    const postEditInput = input({
      sampleGround(xMeters, zMeters) {
        return xMeters === 8 && zMeters === 8 ? null : ground(8);
      }
    });
    const revalidated = revalidateHestiaSurfaceWorldCandidate({
      ...postEditInput,
      identity: { ...postEditInput.identity, regionRevision: 8 }
    }, selected.world);

    expect(revalidated.status).toBe("Selected");
    if (revalidated.status !== "Selected") throw new Error(revalidated.failure.message);
    expect(revalidated.world.traversalDomain.spawnPerimeterDistanceMeters).toBeLessThan(12);
    expect(revalidated.world.shoreBoundary.dryCellKeys)
      .toBe(selected.world.shoreBoundary.dryCellKeys);
  });

  it("skips an invalid origin, admits the first canonical dry component, and publishes immutable footprint facts", () => {
    const probe: HestiaSurfaceGroundProbe = {
      sampleGround(xMeters, zMeters) {
        if (xMeters === 0 && zMeters === 0) return null;
        return ground(8);
      }
    };

    const result = selectHestiaSurfaceWorld(input(probe));

    expect(result.status).toBe("Selected");
    if (result.status !== "Selected") throw new Error(result.failure.message);
    expect(result.world.anchorCenterMeters).toEqual({ x: 0, y: 8, z: -16 });
    expect(result.world.verticalBand).toEqual({
      minimumMeters: 0,
      maximumExclusiveMeters: 32
    });
    expect(result.world.brickBounds).toEqual({
      minInclusive: { x: -2, y: 0, z: -3 },
      maxExclusive: { x: 2, y: 1, z: 1 }
    });
    expect(result.world.residentBrickCoordinates).toHaveLength(16);
    expect(result.world.traversalDomain.componentBoundsMeters.size.x).toBeGreaterThanOrEqual(32);
    expect(result.world.traversalDomain.componentBoundsMeters.size.z).toBeGreaterThanOrEqual(32);
    expect(result.world.traversalDomain.spawnPerimeterDistanceMeters).toBeGreaterThanOrEqual(12);
    expect(result.world.waterSurfaceHeightMeters).toBe(0);
    expect(result.world.environment).toMatchObject({
      identity: result.world.identity,
      rootSeed: "hestia-surface-world-unit",
      voxelSizeMeters: 0.5,
      residentBrickCoordinates: result.world.residentBrickCoordinates,
      waterSurfaceHeightMeters: 0,
      anchorCenterMeters: result.world.anchorCenterMeters
    });
    expect(result.world.environment.decorativePopulation.map((fact) => String(fact.kind)))
      .not.toContain("black_trunk");
    expect(result.world.environment.decorativePopulation.every((fact) =>
      Math.abs(fact.positionMeters.x - result.world.anchorCenterMeters.x) > 2.25
      || fact.positionMeters.z < result.world.anchorCenterMeters.z - 18
      || fact.positionMeters.z > result.world.anchorCenterMeters.z + 6
    )).toBe(true);
    expect(result.world.encounter.surveyDronePositionMeters).toEqual({
      x: result.world.anchorCenterMeters.x,
      y: result.world.anchorCenterMeters.y + 1.62,
      z: result.world.anchorCenterMeters.z - 12
    });
    expect(result.world.encounter.structuralTrees).toHaveLength(1);
    const treeRoot = result.world.encounter.structuralTrees[0].rootQuantum;
    expect(Math.hypot(
      treeRoot.x * 0.125 - result.world.anchorCenterMeters.x,
      treeRoot.z * 0.125 - result.world.anchorCenterMeters.z
    )).toBeGreaterThanOrEqual(6);
    expect(treeRoot.y * 0.125).toBeLessThanOrEqual(result.world.anchorCenterMeters.y);
    const groundSurfaceProbe: HestiaAuthorityGroundSurfaceProbe = Object.freeze({
      identity: Object.freeze({ ...result.world.identity, editRevision: 0 }),
      sampleGroundSurface(xMeters: number, zMeters: number) {
        const sample = probe.sampleGround(xMeters, zMeters);
        return Object.freeze({
          status: "Resolved" as const,
          hit: sample === null ? null : Object.freeze({
            pointMeters: Object.freeze({ x: xMeters, y: sample.heightMeters, z: zMeters }),
            normal: sample.normal,
            distanceMeters: 0
          }),
          regionRevision: result.world.identity.regionRevision,
          editRevision: 0
        });
      }
    });
    const rigidTerrain = deriveHestiaSurfaceRigidBodyTerrainColliders({
      world: result.world,
      placement: result.world.encounter.structuralTrees[0],
      groundSurfaceProbe
    });
    expect(rigidTerrain.status).toBe("Resolved");
    if (rigidTerrain.status !== "Resolved") throw new Error(rigidTerrain.failure.message);
    expect(rigidTerrain.terrainColliders.length).toBeGreaterThan(0);
    expect(rigidTerrain.terrainColliders.length).toBeLessThanOrEqual(26 * 26);
    expect(rigidTerrain.terrainColliders.some((cell) =>
      treeRoot.x * 0.125 >= cell.minimumMeters.x
      && treeRoot.x * 0.125 < cell.maximumMeters.x
      && treeRoot.z * 0.125 >= cell.minimumMeters.z
      && treeRoot.z * 0.125 < cell.maximumMeters.z)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.world)).toBe(true);
    expect(Object.isFrozen(result.world.environment)).toBe(true);
    expect(Object.isFrozen(result.world.environment.decorativePopulation)).toBe(true);
    expect(Object.isFrozen(result.world.environment.waterPatches)).toBe(true);
    expect(result.world.environment.decorativePopulation.every((fact) =>
      Object.isFrozen(fact) && Object.isFrozen(fact.positionMeters)
    )).toBe(true);
    expect(result.world.environment.waterPatches.every((fact) =>
      Object.isFrozen(fact) && Object.isFrozen(fact.positionMeters)
    )).toBe(true);
    expect(Object.isFrozen(result.world.traversalDomain.cells)).toBe(true);
    const repeated = selectHestiaSurfaceWorld(input(probe));
    expect(repeated).toEqual(result);
    expect(JSON.stringify(repeated)).toBe(JSON.stringify(result));
  });

  it("uses the selected World water height when publishing water patches", () => {
    const result = selectHestiaSurfaceWorld(input({ sampleGround: () => ground(8) }, undefined, 7));
    expect(result.status).toBe("Selected");
    if (result.status !== "Selected") throw new Error(result.failure.message);
    const shore = result.world.environment.waterPatches.filter((patch) => patch.source === "Shore");
    expect(shore.length).toBeGreaterThan(0);
    expect(shore.every((patch) => patch.positionMeters.y === 7.055)).toBe(true);
  });

  it("uses canonical Coast ground facts and excludes corridor, dry-cell, precedence, and threshold failures", () => {
    const result = selectHestiaSurfaceWorldCandidate(coastInput(), { x: 64, y: 8, z: -32 });
    expect(result.status).toBe("Selected");
    if (result.status !== "Selected") throw new Error(result.failure.message);

    const world = result.world;
    const context = createHestiaFieldContext(coastFieldIdentity);
    const dryCells = new Set(world.shoreBoundary.dryCellKeys);
    const actual = new Map(world.environment.waterPatches.map((patch) => [
      `${patch.positionMeters.x}:${patch.positionMeters.z}`,
      patch
    ]));
    const expected = new Map<string, { readonly source: "Shore" | "WetDepression"; readonly y: number }>();
    let shoreCandidates = 0;
    let wetCandidates = 0;
    let shoreHeightThresholdFailures = 0;
    let wetFoldThresholdFailures = 0;

    for (const coordinate of world.residentBrickCoordinates) {
      const minX = coordinate.x * VOXEL_BRICK_CELL_DIMENSIONS.x * world.environment.voxelSizeMeters;
      const minZ = coordinate.z * VOXEL_BRICK_CELL_DIMENSIONS.z * world.environment.voxelSizeMeters;
      const columns = Math.floor(VOXEL_BRICK_CELL_DIMENSIONS.x * world.environment.voxelSizeMeters / 2);
      const rows = Math.floor(VOXEL_BRICK_CELL_DIMENSIONS.z * world.environment.voxelSizeMeters / 2);
      for (let zIndex = 0; zIndex < rows; zIndex += 1) {
        for (let xIndex = 0; xIndex < columns; xIndex += 1) {
          const x = minX + (xIndex + 0.5) * 2;
          const z = minZ + (zIndex + 0.5) * 2;
          const surface = sampleHestiaSurfaceFields(context, x, z);
          const groundSample = sampleHestiaGroundSurface(context, x, z, surface);
          const coast = groundSample.fields.coastLush;
          if (coast === undefined) throw new Error("Coast sample must publish Coast/Lush fields.");
          const shore = coast.basinMask >= 0.60 && groundSample.heightMeters <= 0.25;
          const wet = !shore
            && coast.wetFoldMask >= 0.55
            && coast.wetDepression >= 0.58
            && groundSample.heightMeters < 1.00;
          const dryCellKey = `${Math.round((z - world.shoreBoundary.gridOriginMeters.z) / 0.5)}:${Math.round((x - world.shoreBoundary.gridOriginMeters.x) / 0.5)}`;
          const inClearCorridor = Math.abs(x - world.anchorCenterMeters.x) <= 2.25
            && z >= world.anchorCenterMeters.z - 18
            && z <= world.anchorCenterMeters.z + 6;
          const excluded = inClearCorridor || dryCells.has(dryCellKey);
          const key = `${x}:${z}`;

          if (shore) shoreCandidates += 1;
          if (wet) wetCandidates += 1;
          if (coast.basinMask >= 0.60 && groundSample.heightMeters > 0.25) {
            shoreHeightThresholdFailures += 1;
          }
          if (!shore && coast.wetFoldMask < 0.55 && coast.wetDepression >= 0.58 && groundSample.heightMeters < 1.00) {
            wetFoldThresholdFailures += 1;
          }
          if ((!shore && !wet) || excluded) continue;
          expected.set(key, {
            source: shore ? "Shore" : "WetDepression",
            y: shore ? 0.055 : groundSample.heightMeters + 0.045
          });
        }
      }
    }

    expect(shoreCandidates).toBeGreaterThan(0);
    expect(wetCandidates).toBeGreaterThan(0);
    expect(shoreHeightThresholdFailures).toBeGreaterThan(0);
    expect(wetFoldThresholdFailures).toBeGreaterThan(0);
    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [key, admission] of expected) {
      const patch = actual.get(key);
      expect(patch).toBeDefined();
      expect(patch?.source).toBe(admission.source);
      expect(patch?.positionMeters.y).toBe(admission.y);
    }
    expect([...actual.values()].every((patch) => {
      const x = patch.positionMeters.x;
      const z = patch.positionMeters.z;
      const inClearCorridor = Math.abs(x - world.anchorCenterMeters.x) <= 2.25
        && z >= world.anchorCenterMeters.z - 18
        && z <= world.anchorCenterMeters.z + 6;
      const dryCellKey = `${Math.round((z - world.shoreBoundary.gridOriginMeters.z) / 0.5)}:${Math.round((x - world.shoreBoundary.gridOriginMeters.x) / 0.5)}`;
      return !inClearCorridor && !dryCells.has(dryCellKey);
    })).toBe(true);
    expect([...actual.values()].filter((patch) => patch.source === "WetDepression").every((patch) => {
      const surface = sampleHestiaSurfaceFields(context, patch.positionMeters.x, patch.positionMeters.z);
      const groundSample = sampleHestiaGroundSurface(context, patch.positionMeters.x, patch.positionMeters.z, surface);
      return groundSample.fields.coastLush !== undefined
        && !(groundSample.fields.coastLush.basinMask >= 0.60 && groundSample.heightMeters <= 0.25);
    })).toBe(true);

    const componentCount = (source: "Shore" | "WetDepression"): number => {
      const remaining = new Map<string, { readonly x: number; readonly z: number }>(
        [...actual.values()]
          .filter((patch) => patch.source === source)
          .map((patch) => [
            `${patch.positionMeters.x}:${patch.positionMeters.z}`,
            { x: patch.positionMeters.x, z: patch.positionMeters.z }
          ] as const)
      );
      let count = 0;
      while (remaining.size > 0) {
        const first = remaining.values().next().value as { readonly x: number; readonly z: number } | undefined;
        if (first === undefined) break;
        remaining.delete(`${first.x}:${first.z}`);
        const pending = [first];
        count += 1;
        for (let index = 0; index < pending.length; index += 1) {
          const current = pending[index]!;
          for (const [x, z] of [
            [current.x - 2, current.z],
            [current.x + 2, current.z],
            [current.x, current.z - 2],
            [current.x, current.z + 2]
          ] as const) {
            const key = `${x}:${z}`;
            const neighbor = remaining.get(key);
            if (neighbor === undefined) continue;
            remaining.delete(key);
            pending.push(neighbor);
          }
        }
      }
      return count;
    };

    expect(componentCount("Shore")).toBe(1);
    const residentBrickSizeMeters = VOXEL_BRICK_CELL_DIMENSIONS.x * world.environment.voxelSizeMeters;
    expect([...actual.values()].some((patch) =>
      patch.source === "Shore"
      && patch.positionMeters.x >= 5 * residentBrickSizeMeters
      && patch.positionMeters.x < 6 * residentBrickSizeMeters
    )).toBe(true);
    expect(componentCount("WetDepression")).toBeLessThanOrEqual(1);
  });

  it("fails closed with an immutable typed result when no candidate qualifies", () => {
    const result = selectHestiaSurfaceWorld(input({ sampleGround: () => null }));

    expect(result).toEqual({
      status: "Rejected",
      failure: {
        code: "NoAdmissibleLandFootprint",
        message: "No deterministic Hestia land candidate satisfies the Surface Play traversal contract.",
        attemptedCandidateCount: 81
      }
    });
    if (result.status !== "Rejected") throw new Error("Expected land selection to fail closed.");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.failure)).toBe(true);
  });
});
