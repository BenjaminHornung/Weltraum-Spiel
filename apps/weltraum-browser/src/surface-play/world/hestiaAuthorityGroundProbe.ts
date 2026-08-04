import { VOXEL_BRICK_CELL_DIMENSIONS } from "../../voxel";
import {
  HESTIA_COAST_LUSH_PRESET_ID,
  HESTIA_GENERATOR_VERSION_COAST_LUSH_V1,
  HESTIA_PRESET_ID
} from "../../world-generation/hestia";
import {
  HESTIA_COAST_LUSH_PREVIEW_ADMISSION_POLICY,
  HESTIA_SURFACE_WORLD_V1
} from "./hestiaSurfaceWorld";
import type { SurfaceCapsule } from "../contracts";
import type {
  SurfaceRegionVoxelCollisionAdapter,
  SurfaceRegionVoxelState,
  SurfaceVoxelCollisionBinding,
  SurfaceVoxelEditIntent,
  SurfaceVoxelEditResult,
  SurfaceVoxelRaycastResult
} from "../voxel-edit";
import { enumerateHestiaCapsuleClearanceSamplePoints } from "./hestiaSurfaceGroundProbe";
import {
  rebindHestiaSurfaceWorldIdentity,
  revalidateHestiaSurfaceWorldCandidate,
  reselectHestiaSurfaceWorldAffectedGrid,
  type HestiaSurfaceGroundProbe,
  type HestiaSurfaceGroundSample,
  type HestiaSurfaceWorldFacts,
  type HestiaSurfaceWorldSelectionResult
} from "./hestiaSurfaceWorld";

export interface HestiaAuthorityGroundProbeInput {
  readonly state: Readonly<SurfaceRegionVoxelState>;
  readonly adapter: Readonly<SurfaceRegionVoxelCollisionAdapter>;
  readonly capsule: SurfaceCapsule;
  readonly collisionSkinMeters: number;
}

export interface HestiaAuthorityGroundSurfaceProbeIdentity {
  readonly bodyId: string;
  readonly regionId: string;
  readonly surfaceFrameId: string;
  readonly regionRevision: number;
  readonly editRevision: number;
}

export interface HestiaAuthorityGroundSurfaceProbe {
  readonly identity: Readonly<HestiaAuthorityGroundSurfaceProbeIdentity>;
  sampleGroundSurface(
    xMeters: number,
    zMeters: number
  ): Readonly<SurfaceVoxelRaycastResult>;
}

export const createHestiaAuthorityGroundSurfaceProbe = (
  input: Readonly<Pick<HestiaAuthorityGroundProbeInput, "state" | "adapter">>
): Readonly<HestiaAuthorityGroundSurfaceProbe> => {
  const { state } = input;
  const binding: Readonly<SurfaceVoxelCollisionBinding> = Object.freeze({
    bodyId: state.bodyId,
    regionId: state.regionId,
    surfaceFrameId: state.surfaceFrameId,
    expectedRegionRevision: state.regionRevision
  });
  const identity = Object.freeze({
    bodyId: state.bodyId,
    regionId: state.regionId,
    surfaceFrameId: state.surfaceFrameId,
    regionRevision: state.regionRevision,
    editRevision: state.editRevision
  });
  const brickHeightMeters = VOXEL_BRICK_CELL_DIMENSIONS.y * state.voxelSizeMeters;
  const topMeters = state.brickBounds.maxExclusive.y * brickHeightMeters - state.voxelSizeMeters;
  const bottomMeters = state.brickBounds.minInclusive.y * brickHeightMeters;
  const maximumDistanceMeters = topMeters - bottomMeters;
  const maxSteps = Math.ceil(maximumDistanceMeters / (state.voxelSizeMeters / 4)) + 1;
  const cache = new Map<string, Readonly<SurfaceVoxelRaycastResult>>();

  const sampleGroundSurface = (
    xMeters: number,
    zMeters: number
  ): Readonly<SurfaceVoxelRaycastResult> => {
    const cacheKey = `${xMeters}:${zMeters}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;
    const ground = input.adapter.queryGround({
      ...binding,
      positionMeters: { x: xMeters, y: topMeters, z: zMeters },
      maximumDistanceMeters,
      maxSteps
    });
    cache.set(cacheKey, ground);
    return ground;
  };
  return Object.freeze({ identity, sampleGroundSurface });
};

export const createHestiaAuthorityGroundProbe = (
  input: Readonly<HestiaAuthorityGroundProbeInput>
): Readonly<HestiaSurfaceGroundProbe> => {
  const { state } = input;
  const groundSurfaceProbe = createHestiaAuthorityGroundSurfaceProbe(input);
  const binding: Readonly<SurfaceVoxelCollisionBinding> = Object.freeze({
    bodyId: state.bodyId,
    regionId: state.regionId,
    surfaceFrameId: state.surfaceFrameId,
    expectedRegionRevision: state.regionRevision
  });
  const cache = new Map<string, Readonly<HestiaSurfaceGroundSample> | null>();

  const sampleGround = (xMeters: number, zMeters: number): Readonly<HestiaSurfaceGroundSample> | null => {
    if (!Number.isFinite(xMeters) || !Number.isFinite(zMeters)) return null;
    const cacheKey = `${xMeters}:${zMeters}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;
    const ground = groundSurfaceProbe.sampleGroundSurface(xMeters, zMeters);
    if (ground.status === "Rejected" || ground.hit === null) {
      cache.set(cacheKey, null);
      return null;
    }
    const clearancePoints = enumerateHestiaCapsuleClearanceSamplePoints({
      xMeters,
      groundHeightMeters: ground.hit.pointMeters.y,
      zMeters,
      capsule: input.capsule,
      collisionSkinMeters: input.collisionSkinMeters,
      sampleSpacingMeters: state.voxelSizeMeters / 2
    });
    const clearanceToleranceMeters = state.generatorVersion === HESTIA_GENERATOR_VERSION_COAST_LUSH_V1
      ? HESTIA_COAST_LUSH_PREVIEW_ADMISSION_POLICY.authorityClearanceToleranceMeters
      : 0;
    const capsuleClear = clearancePoints.every((point) => {
      const density = input.adapter.sampleDensity(binding, point);
      return density.status === "Resolved"
        && density.density >= -(input.collisionSkinMeters + clearanceToleranceMeters);
    });
    const sample = Object.freeze({
      heightMeters: ground.hit.pointMeters.y,
      normal: Object.freeze({ ...ground.hit.normal }),
      capsuleClear
    });
    cache.set(cacheKey, sample);
    return sample;
  };
  return Object.freeze({ sampleGround });
};

const rejectedWorldBinding = (message: string): HestiaSurfaceWorldSelectionResult => Object.freeze({
  status: "Rejected",
  failure: Object.freeze({
    code: "NoAdmissibleLandFootprint",
    message,
    attemptedCandidateCount: 1
  })
});

export const revalidateHestiaSurfaceWorldAgainstAuthority = (input: Readonly<{
  sourceWorld: Readonly<HestiaSurfaceWorldFacts>;
  state: Readonly<SurfaceRegionVoxelState>;
  adapter: Readonly<SurfaceRegionVoxelCollisionAdapter>;
  frameOriginMeters: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  waterSurfaceHeightMeters: number;
  capsule: SurfaceCapsule;
  collisionSkinMeters: number;
}>): HestiaSurfaceWorldSelectionResult => {
  const environment = input.sourceWorld.environment;
  const sourceIdentity = input.sourceWorld.identity;
  if (
    sourceIdentity.bodyId !== input.state.bodyId
    || sourceIdentity.regionId !== input.state.regionId
    || sourceIdentity.surfaceFrameId !== input.state.surfaceFrameId
    || environment.identity.bodyId !== sourceIdentity.bodyId
    || environment.identity.regionId !== sourceIdentity.regionId
    || environment.identity.surfaceFrameId !== sourceIdentity.surfaceFrameId
    || environment.identity.regionRevision !== sourceIdentity.regionRevision
    || environment.rootSeed !== input.state.seed
    || environment.voxelSizeMeters !== input.state.voxelSizeMeters
    || environment.waterSurfaceHeightMeters !== input.sourceWorld.waterSurfaceHeightMeters
    || environment.waterSurfaceHeightMeters !== input.waterSurfaceHeightMeters
    || JSON.stringify(environment.anchorCenterMeters) !== JSON.stringify(input.sourceWorld.anchorCenterMeters)
  ) return rejectedWorldBinding(
    "Hestia World environment facts are stale for the materialized authority."
  );
  return revalidateHestiaSurfaceWorldCandidate({
    identity: {
      bodyId: input.state.bodyId,
      regionId: input.state.regionId,
      surfaceFrameId: input.state.surfaceFrameId,
      regionRevision: input.state.regionRevision
    },
    rootSeed: environment.rootSeed,
    profile: input.state.generatorVersion === HESTIA_GENERATOR_VERSION_COAST_LUSH_V1
      ? HESTIA_COAST_LUSH_PRESET_ID
      : HESTIA_PRESET_ID,
    voxelSizeMeters: environment.voxelSizeMeters,
    frameOriginMeters: input.frameOriginMeters,
    waterSurfaceHeightMeters: environment.waterSurfaceHeightMeters,
    probe: createHestiaAuthorityGroundProbe({
      state: input.state,
      adapter: input.adapter,
      capsule: input.capsule,
      collisionSkinMeters: input.collisionSkinMeters
    })
  }, input.sourceWorld);
};

export const revalidateHestiaSurfaceWorldIncrementallyAgainstAuthority = (input: Readonly<{
  sourceWorld: Readonly<HestiaSurfaceWorldFacts>;
  state: Readonly<SurfaceRegionVoxelState>;
  adapter: Readonly<SurfaceRegionVoxelCollisionAdapter>;
  frameOriginMeters: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  waterSurfaceHeightMeters: number;
  capsule: SurfaceCapsule;
  collisionSkinMeters: number;
  editIntent: Readonly<SurfaceVoxelEditIntent>;
  editResult: Readonly<SurfaceVoxelEditResult>;
}>): HestiaSurfaceWorldSelectionResult => {
  const { sourceWorld, state, editIntent, editResult } = input;
  const environment = sourceWorld.environment;
  const sourceIdentity = sourceWorld.identity;
  if (
    environment.identity.bodyId !== sourceIdentity.bodyId
    || environment.identity.regionId !== sourceIdentity.regionId
    || environment.identity.surfaceFrameId !== sourceIdentity.surfaceFrameId
    || environment.identity.regionRevision !== sourceIdentity.regionRevision
    || environment.rootSeed !== state.seed
    || environment.voxelSizeMeters !== state.voxelSizeMeters
    || environment.waterSurfaceHeightMeters !== sourceWorld.waterSurfaceHeightMeters
    || environment.waterSurfaceHeightMeters !== input.waterSurfaceHeightMeters
    || JSON.stringify(environment.anchorCenterMeters) !== JSON.stringify(sourceWorld.anchorCenterMeters)
    || sourceIdentity.regionRevision !== editResult.priorRegionRevision
    || state.regionRevision !== editResult.resultingRegionRevision
    || editIntent.expectedRegionRevision !== editResult.priorRegionRevision
  ) return rejectedWorldBinding(
    "Incremental Hestia World environment, authority, or edit revisions are stale."
  );
  const identity = Object.freeze({
    bodyId: state.bodyId,
    regionId: state.regionId,
    surfaceFrameId: state.surfaceFrameId,
    regionRevision: state.regionRevision
  });
  if (editResult.status === "Rejected") return rejectedWorldBinding(
    `Rejected Terrain edits cannot be adopted: ${editResult.reason}.`
  );
  if (editResult.status === "NoChange") {
    if (editResult.changedBrickKeys.length !== 0) return rejectedWorldBinding(
      "NoChange Terrain adoption unexpectedly published changed bricks."
    );
    return Object.freeze({
      status: "Selected",
      world: rebindHestiaSurfaceWorldIdentity(sourceWorld, identity)
    });
  }
  if (editResult.changedBrickKeys.length === 0) return rejectedWorldBinding(
    "Applied Terrain adoption did not publish changed bricks."
  );
  const residentKeys = new Set(state.materializedBricks.map((brick) => brick.key));
  if (editResult.changedBrickKeys.some((key) => !residentKeys.has(key))) return rejectedWorldBinding(
    "Applied Terrain adoption references a changed brick outside resident authority coverage."
  );

  const centerMeters = Object.freeze({
    x: editIntent.centerGlobalQuantum.x * editIntent.quantumMeters,
    y: editIntent.centerGlobalQuantum.y * editIntent.quantumMeters,
    z: editIntent.centerGlobalQuantum.z * editIntent.quantumMeters
  });
  const capsuleRingRadiusMeters = input.capsule.radiusMeters - input.collisionSkinMeters;
  const trilinearHorizontalReachMeters = state.voxelSizeMeters;
  const groundNormalHorizontalReachMeters = state.voxelSizeMeters / 2
    + trilinearHorizontalReachMeters;
  const capsuleClearanceHorizontalReachMeters = capsuleRingRadiusMeters
    + trilinearHorizontalReachMeters;
  const dependencyHaloMeters = Math.max(
    groundNormalHorizontalReachMeters,
    capsuleClearanceHorizontalReachMeters
  );
  const influenceRadiusMeters = editIntent.radiusMeters + dependencyHaloMeters;
  const grid = sourceWorld.traversalDomain;
  const minimumGridX = Math.ceil(
    (centerMeters.x - influenceRadiusMeters - grid.gridOriginMeters.x) / grid.gridSizeMeters
  );
  const maximumGridX = Math.floor(
    (centerMeters.x + influenceRadiusMeters - grid.gridOriginMeters.x) / grid.gridSizeMeters
  );
  const minimumGridZ = Math.ceil(
    (centerMeters.z - influenceRadiusMeters - grid.gridOriginMeters.z) / grid.gridSizeMeters
  );
  const maximumGridZ = Math.floor(
    (centerMeters.z + influenceRadiusMeters - grid.gridOriginMeters.z) / grid.gridSizeMeters
  );
  return reselectHestiaSurfaceWorldAffectedGrid({
    sourceWorld,
    identity,
    rootSeed: environment.rootSeed,
    profile: state.generatorVersion === HESTIA_GENERATOR_VERSION_COAST_LUSH_V1
      ? HESTIA_COAST_LUSH_PRESET_ID
      : HESTIA_PRESET_ID,
    voxelSizeMeters: environment.voxelSizeMeters,
    frameOriginMeters: input.frameOriginMeters,
    waterSurfaceHeightMeters: environment.waterSurfaceHeightMeters,
    probe: createHestiaAuthorityGroundProbe({
      state,
      adapter: input.adapter,
      capsule: input.capsule,
      collisionSkinMeters: input.collisionSkinMeters
    }),
    affectedGridBounds: {
      minimumGridX,
      maximumGridX,
      minimumGridZ,
      maximumGridZ
    }
  });
};

const coordinateKey = (value: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>): string =>
  `${value.x}:${value.y}:${value.z}`;

/**
 * Fast initial adoption gate. Exact generation identity plus complete resident
 * brick descriptors bind global truth; distributed ground samples catch
 * materialization/interpolation drift without rebuilding the full 0.5 m grid.
 */
export const adoptHestiaSurfaceWorldAgainstAuthority = (input: Readonly<{
  sourceWorld: Readonly<HestiaSurfaceWorldFacts>;
  state: Readonly<SurfaceRegionVoxelState>;
  adapter: Readonly<SurfaceRegionVoxelCollisionAdapter>;
  waterSurfaceHeightMeters: number;
  capsule: SurfaceCapsule;
  collisionSkinMeters: number;
}>): HestiaSurfaceWorldSelectionResult => {
  const { sourceWorld, state } = input;
  const sameBounds = JSON.stringify(state.brickBounds) === JSON.stringify(sourceWorld.brickBounds);
  const authorityCoordinates = state.residentBrickCoordinates.map(coordinateKey).sort();
  const sourceCoordinates = sourceWorld.residentBrickCoordinates.map(coordinateKey).sort();
  const environmentCoordinates = sourceWorld.environment.residentBrickCoordinates.map(coordinateKey).sort();
  const environmentIdentity = sourceWorld.environment.identity;
  const sameEnvironmentBinding = environmentIdentity.bodyId === sourceWorld.identity.bodyId
    && environmentIdentity.regionId === sourceWorld.identity.regionId
    && environmentIdentity.surfaceFrameId === sourceWorld.identity.surfaceFrameId
    && environmentIdentity.regionRevision === sourceWorld.identity.regionRevision
    && sourceWorld.environment.rootSeed === state.seed
    && sourceWorld.environment.voxelSizeMeters === state.voxelSizeMeters
    && sourceWorld.environment.waterSurfaceHeightMeters === sourceWorld.waterSurfaceHeightMeters
    && sourceWorld.environment.waterSurfaceHeightMeters === input.waterSurfaceHeightMeters
    && JSON.stringify(sourceWorld.environment.anchorCenterMeters) === JSON.stringify(sourceWorld.anchorCenterMeters)
    && JSON.stringify(environmentCoordinates) === JSON.stringify(sourceCoordinates);
  if (
    sourceWorld.identity.bodyId !== state.bodyId
    || sourceWorld.identity.regionId !== state.regionId
    || sourceWorld.identity.surfaceFrameId !== state.surfaceFrameId
    || !sameBounds
    || JSON.stringify(authorityCoordinates) !== JSON.stringify(sourceCoordinates)
    || !sameEnvironmentBinding
  ) return Object.freeze({
    status: "Rejected",
    failure: Object.freeze({
      code: "NoAdmissibleLandFootprint",
      message: "Materialized Hestia authority identity or resident coverage does not match the selected world.",
      attemptedCandidateCount: 1
    })
  });

  const probe = createHestiaAuthorityGroundProbe({
    state,
    adapter: input.adapter,
    capsule: input.capsule,
    collisionSkinMeters: input.collisionSkinMeters
  });
  const cells = sourceWorld.traversalDomain.cells;
  const criticalCells = new Map<string, (typeof cells)[number]>();
  const stride = Math.max(1, Math.floor(cells.length / 32));
  for (let index = 0; index < cells.length; index += stride) {
    const cell = cells[index]!;
    criticalCells.set(`${cell.gridZ}:${cell.gridX}`, cell);
  }
  const spawn = cells.find((cell) =>
    cell.gridX === sourceWorld.traversalDomain.spawnGridCell.gridX
    && cell.gridZ === sourceWorld.traversalDomain.spawnGridCell.gridZ
  );
  if (spawn !== undefined) criticalCells.set(`${spawn.gridZ}:${spawn.gridX}`, spawn);

  const samplesMatch = [...criticalCells.values()].every((cell) => {
    const sample = probe.sampleGround(cell.centerMeters.x, cell.centerMeters.z);
    if (sample === null || !sample.capsuleClear) return false;
    const normalLength = Math.hypot(sample.normal.x, sample.normal.y, sample.normal.z);
    const up = normalLength === 0 ? -1 : sample.normal.y / normalLength;
    return Math.abs(sample.heightMeters - cell.groundHeightMeters) <= state.voxelSizeMeters
      && sample.heightMeters >= input.waterSurfaceHeightMeters + HESTIA_SURFACE_WORLD_V1.waterClearanceMeters
      && up >= Math.cos(HESTIA_SURFACE_WORLD_V1.maximumSlopeRadians);
  });
  if (!samplesMatch || spawn === undefined) return Object.freeze({
    status: "Rejected",
    failure: Object.freeze({
      code: "NoAdmissibleLandFootprint",
      message: "Materialized Hestia authority does not preserve the selected dry traversal samples.",
      attemptedCandidateCount: 1
    })
  });

  const identity = Object.freeze({
    bodyId: state.bodyId,
    regionId: state.regionId,
    surfaceFrameId: state.surfaceFrameId,
    regionRevision: state.regionRevision
  });
  return Object.freeze({
    status: "Selected",
    world: rebindHestiaSurfaceWorldIdentity(sourceWorld, identity)
  });
};
