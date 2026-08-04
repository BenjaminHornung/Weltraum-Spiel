import type { Vec3 } from "../../core/vector";
import {
  surfaceFrameId,
  voxelBodyId,
  voxelRegionId,
  VOXEL_BRICK_CELL_DIMENSIONS,
  type VoxelCoordinate,
  type VoxelMaterialId
} from "../../voxel";
import { MICROVOXEL_BASE_QUANTUM_METERS } from "../../voxel/adaptive";
import {
  createHestiaFieldContext,
  generateHestiaScatter,
  HESTIA_COAST_LUSH_PRESET_ID,
  sampleHestiaGroundSurface,
  sampleHestiaSurfaceFields,
  type HestiaGeneratorProfile,
  type HestiaScatterKind,
  type HestiaScatterRecord,
  type HestiaVoxelSizeMeters
} from "../../world-generation/hestia";

export const HESTIA_SURFACE_WORLD_V1 = Object.freeze({
  candidateMinimumOffsetMeters: -64,
  candidateMaximumOffsetMeters: 64,
  candidateStepMeters: 16,
  voxelSizeMeters: 0.5,
  brickSizeMeters: Object.freeze({ x: 16, y: 32, z: 16 }),
  footprintBrickCounts: Object.freeze({ x: 4, y: 1, z: 4 }),
  footprintSizeMeters: Object.freeze({ x: 64, y: 32, z: 64 }),
  residentBoundaryInsetMeters: 8,
  terrainDepthReserveMeters: 8,
  eyeHeightMeters: 1.62,
  upperClearanceMeters: 4,
  waterClearanceMeters: 1,
  maximumSlopeRadians: 50 * Math.PI / 180,
  maximumSpawnSlopeRadians: 12 * Math.PI / 180,
  maximumNeighborStepMeters: 0.4,
  minimumComponentSizeMeters: 32,
  minimumSpawnPerimeterDistanceMeters: 12
});

/** Coast/Lush B preview-only admission; V1 keeps the 12 m rule above. */
export const HESTIA_COAST_LUSH_PREVIEW_ADMISSION_POLICY = Object.freeze({
  id: "hestia.surface-world-admission.coast-lush-preview.v1",
  minimumSpawnPerimeterDistanceMeters: 8.5,
  /** Quarter-voxel allowance for analytic-vs-materialized trilinear clearance. */
  authorityClearanceToleranceMeters: 0.125
} as const);

const WATER_PATCH_SPACING_METERS = 2;
const WATER_PATCH_SCALE_METERS = 1.16;
const CLEAR_CORRIDOR_HALF_WIDTH_METERS = 2.25;
const CLEAR_CORRIDOR_FORWARD_METERS = 18;
const CLEAR_CORRIDOR_REAR_METERS = 6;

export interface HestiaSurfaceWorldIdentity {
  readonly bodyId: string;
  readonly regionId: string;
  readonly surfaceFrameId: string;
  readonly regionRevision: number;
}

export interface HestiaSurfaceGroundSample {
  readonly heightMeters: number;
  readonly normal: Vec3;
  readonly capsuleClear: boolean;
}

/**
 * The runtime adapter owns authority sampling. This pure selector neither
 * samples presentation geometry nor invents a second terrain representation.
 */
export interface HestiaSurfaceGroundProbe {
  sampleGround(xMeters: number, zMeters: number): Readonly<HestiaSurfaceGroundSample> | null;
}

export interface HestiaSurfaceWorldSelectionInput {
  readonly identity: Readonly<HestiaSurfaceWorldIdentity>;
  readonly profile?: HestiaGeneratorProfile;
  readonly rootSeed: string;
  readonly voxelSizeMeters: HestiaVoxelSizeMeters;
  readonly frameOriginMeters: Vec3;
  readonly waterSurfaceHeightMeters: number;
  readonly probe: HestiaSurfaceGroundProbe;
}

export interface HestiaSurfaceCandidateCenter {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface HestiaSurfaceVerticalBand {
  readonly minimumMeters: number;
  readonly maximumExclusiveMeters: number;
}

export interface HestiaSurfaceTraversalCell {
  readonly gridX: number;
  readonly gridZ: number;
  readonly centerMeters: Readonly<{ readonly x: number; readonly z: number }>;
  readonly groundHeightMeters: number;
  readonly groundNormal: Vec3;
}

export interface HestiaSurfaceTraversalDomain {
  readonly identity: Readonly<HestiaSurfaceWorldIdentity>;
  readonly gridSizeMeters: 0.5;
  readonly gridOriginMeters: Readonly<{ readonly x: number; readonly z: number }>;
  readonly gridCounts: Readonly<{ readonly x: number; readonly z: number }>;
  readonly residentInsetBoundsMeters: Readonly<{
    readonly minInclusive: Readonly<{ readonly x: number; readonly z: number }>;
    readonly maxExclusive: Readonly<{ readonly x: number; readonly z: number }>;
  }>;
  readonly componentBoundsMeters: Readonly<{
    readonly minInclusive: Readonly<{ readonly x: number; readonly z: number }>;
    readonly maxExclusive: Readonly<{ readonly x: number; readonly z: number }>;
    readonly size: Readonly<{ readonly x: number; readonly z: number }>;
  }>;
  readonly spawnGridCell: Readonly<{ readonly gridX: number; readonly gridZ: number }>;
  readonly spawnPerimeterDistanceMeters: number;
  readonly cells: readonly Readonly<HestiaSurfaceTraversalCell>[];
}

export interface HestiaShoreBoundary {
  readonly identity: Readonly<HestiaSurfaceWorldIdentity>;
  readonly gridSizeMeters: 0.5;
  readonly gridOriginMeters: Readonly<{ readonly x: number; readonly z: number }>;
  readonly gridCounts: Readonly<{ readonly x: number; readonly z: number }>;
  readonly residentInsetBoundsMeters: HestiaSurfaceTraversalDomain["residentInsetBoundsMeters"];
  readonly dryCellKeys: readonly string[];
}

export type HestiaSurfaceDecorativePopulationKind = Exclude<HestiaScatterKind, "black_trunk">;

export interface HestiaSurfaceDecorativePopulationFact {
  readonly id: string;
  readonly kind: HestiaSurfaceDecorativePopulationKind;
  readonly positionMeters: Vec3;
  readonly yawRadians: number;
  readonly uniformScale: number;
  readonly surfaceMaterialId: VoxelMaterialId;
}

export interface HestiaSurfaceWaterPatchFact {
  readonly id: string;
  readonly positionMeters: Vec3;
  readonly uniformScale: number;
  readonly source: "Shore" | "WetDepression";
}

export interface HestiaSurfaceEnvironmentWorldFacts {
  readonly identity: Readonly<HestiaSurfaceWorldIdentity>;
  readonly rootSeed: string;
  readonly voxelSizeMeters: HestiaVoxelSizeMeters;
  readonly residentBrickCoordinates: readonly Readonly<VoxelCoordinate>[];
  readonly waterSurfaceHeightMeters: number;
  readonly anchorCenterMeters: Vec3;
  readonly decorativePopulation: readonly Readonly<HestiaSurfaceDecorativePopulationFact>[];
  readonly waterPatches: readonly Readonly<HestiaSurfaceWaterPatchFact>[];
}

export interface HestiaSurfaceWorldFacts {
  readonly identity: Readonly<HestiaSurfaceWorldIdentity>;
  readonly anchorCenterMeters: Vec3;
  readonly verticalBand: Readonly<HestiaSurfaceVerticalBand>;
  readonly brickBounds: Readonly<{
    readonly minInclusive: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
    readonly maxExclusive: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
  }>;
  readonly residentBrickCoordinates: readonly Readonly<{ readonly x: number; readonly y: number; readonly z: number }>[];
  readonly traversalDomain: Readonly<HestiaSurfaceTraversalDomain>;
  readonly shoreBoundary: Readonly<HestiaShoreBoundary>;
  readonly waterSurfaceHeightMeters: number;
  readonly environment: Readonly<HestiaSurfaceEnvironmentWorldFacts>;
  readonly encounter: Readonly<HestiaSurfaceEncounterFacts>;
}

export interface HestiaSurfaceStructuralTreePlacement {
  readonly instanceId: string;
  readonly seed: string;
  readonly rootQuantum: Readonly<{ readonly x: number; readonly y: number; readonly z: number }>;
}

export interface HestiaSurfaceEncounterFacts {
  readonly surveyDronePositionMeters: Vec3;
  readonly structuralTrees: readonly Readonly<HestiaSurfaceStructuralTreePlacement>[];
}

export type HestiaSurfaceWorldSelectionResult =
  | Readonly<{ readonly status: "Selected"; readonly world: Readonly<HestiaSurfaceWorldFacts> }>
  | Readonly<{
    readonly status: "Rejected";
    readonly failure: Readonly<{
      readonly code: "NoAdmissibleLandFootprint";
      readonly message: string;
      readonly attemptedCandidateCount: number;
    }>;
  }>;

interface CandidateCell extends HestiaSurfaceTraversalCell {
  readonly key: string;
}

interface HestiaSurfaceCandidateGrid {
  readonly xCoordinates: readonly number[];
  readonly zCoordinates: readonly number[];
  readonly innerMinX: number;
  readonly innerMaxX: number;
  readonly innerMinZ: number;
  readonly innerMaxZ: number;
  readonly spawnGridX: number;
  readonly spawnGridZ: number;
}

export interface HestiaSurfaceAffectedGridBounds {
  readonly minimumGridX: number;
  readonly maximumGridX: number;
  readonly minimumGridZ: number;
  readonly maximumGridZ: number;
}

const candidateCellsByWorld = new WeakMap<
  Readonly<HestiaSurfaceWorldFacts>,
  ReadonlyMap<string, CandidateCell>
>();

interface QueueEntry {
  readonly cell: CandidateCell;
  readonly distanceMeters: number;
}

type CandidateWorldFinalizationPolicy = "InitialAdmission" | "PostEditRevalidation";

const minimumSpawnPerimeterDistanceMeters = (
  input: HestiaSurfaceWorldSelectionInput
): number => input.profile === HESTIA_COAST_LUSH_PRESET_ID
  ? HESTIA_COAST_LUSH_PREVIEW_ADMISSION_POLICY.minimumSpawnPerimeterDistanceMeters
  : HESTIA_SURFACE_WORLD_V1.minimumSpawnPerimeterDistanceMeters;

const requireProfileIdentityPair = (input: HestiaSurfaceWorldSelectionInput): void => {
  const isCoastIdentityTuple = input.rootSeed === "hestia-surface-play-coast-lush-v1"
    && input.identity.bodyId === "planet.hestia"
    && input.identity.regionId === "region:hestia.surface-play.coast-lush.v1"
    && input.identity.surfaceFrameId === "frame:surface_hestia_surface_play_coast_lush_v1";
  if (input.profile === HESTIA_COAST_LUSH_PRESET_ID && !isCoastIdentityTuple) {
    throw new TypeError("Coast/Lush profile requires its approved identity tuple.");
  }
  if (input.profile !== HESTIA_COAST_LUSH_PRESET_ID && isCoastIdentityTuple) {
    throw new TypeError("Coast/Lush identity tuple requires its approved profile.");
  }
};

const EPSILON = 1e-9;
const NEIGHBOR_OFFSETS = Object.freeze(
  [-1, 0, 1].flatMap((z) => [-1, 0, 1]
    .map((x) => Object.freeze({ x, z })))
    .filter(({ x, z }) => x !== 0 || z !== 0)
);

const freezeVec3 = (value: Vec3): Vec3 => Object.freeze({ x: value.x, y: value.y, z: value.z });
const freezePoint2 = (x: number, z: number) => Object.freeze({ x, z });
const cellKey = (gridX: number, gridZ: number): string => `${gridZ}:${gridX}`;
const compareAscii = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

type DecorativeScatterRecord = HestiaScatterRecord & {
  readonly kind: HestiaSurfaceDecorativePopulationKind;
};

const isDecorativeScatter = (record: HestiaScatterRecord): record is DecorativeScatterRecord =>
  record.kind !== "black_trunk";

const isInsideClearCorridor = (
  position: Readonly<{ readonly x: number; readonly z: number }>,
  anchor: Readonly<{ readonly x: number; readonly z: number }>
): boolean => Math.abs(position.x - anchor.x) <= CLEAR_CORRIDOR_HALF_WIDTH_METERS
  && position.z >= anchor.z - CLEAR_CORRIDOR_FORWARD_METERS
  && position.z <= anchor.z + CLEAR_CORRIDOR_REAR_METERS;

const generationInput = (
  input: Pick<
    HestiaSurfaceWorldSelectionInput,
    "identity" | "profile" | "rootSeed" | "voxelSizeMeters"
  >,
  coordinate: Readonly<VoxelCoordinate>
) => ({
  profile: input.profile,
  rootSeed: input.rootSeed,
  bodyId: voxelBodyId(input.identity.bodyId),
  surfaceFrameId: surfaceFrameId(input.identity.surfaceFrameId),
  regionId: voxelRegionId(input.identity.regionId),
  brickCoordinate: coordinate,
  voxelSizeMeters: input.voxelSizeMeters
});

const deriveEnvironmentFacts = (
  input: HestiaSurfaceWorldSelectionInput,
  identity: Readonly<HestiaSurfaceWorldIdentity>,
  anchorCenterMeters: Vec3,
  residentBrickCoordinates: readonly Readonly<VoxelCoordinate>[],
  grid: Readonly<HestiaSurfaceCandidateGrid>,
  dryCellKeys: readonly string[]
): Readonly<HestiaSurfaceEnvironmentWorldFacts> => {
  const populationIds = new Set<string>();
  const dryCells = new Set(dryCellKeys);
  const decorativePopulation = residentBrickCoordinates
    .flatMap((coordinate) => generateHestiaScatter(generationInput(input, coordinate)))
    .filter(isDecorativeScatter)
    .filter((record) => !isInsideClearCorridor(record.positionMeters, anchorCenterMeters))
    .map((record) => {
      if (populationIds.has(record.id)) throw new RangeError(`Duplicate Hestia population ID: ${record.id}`);
      populationIds.add(record.id);
      return Object.freeze({
        id: record.id,
        kind: record.kind,
        positionMeters: freezeVec3(record.positionMeters),
        yawRadians: record.yawRadians,
        uniformScale: record.uniformScale,
        surfaceMaterialId: record.surfaceMaterialId
      });
    })
    .sort((left, right) => compareAscii(left.id, right.id));

  const brickWidthMeters = VOXEL_BRICK_CELL_DIMENSIONS.x * input.voxelSizeMeters;
  const brickDepthMeters = VOXEL_BRICK_CELL_DIMENSIONS.z * input.voxelSizeMeters;
  const waterPatches: HestiaSurfaceWaterPatchFact[] = [];
  for (const coordinate of residentBrickCoordinates) {
    const context = createHestiaFieldContext(generationInput(input, coordinate));
    const minX = coordinate.x * brickWidthMeters;
    const minZ = coordinate.z * brickDepthMeters;
    const columns = Math.floor(brickWidthMeters / WATER_PATCH_SPACING_METERS);
    const rows = Math.floor(brickDepthMeters / WATER_PATCH_SPACING_METERS);
    for (let zIndex = 0; zIndex < rows; zIndex += 1) {
      for (let xIndex = 0; xIndex < columns; xIndex += 1) {
        const x = minX + (xIndex + 0.5) * WATER_PATCH_SPACING_METERS;
        const z = minZ + (zIndex + 0.5) * WATER_PATCH_SPACING_METERS;
        const surface = sampleHestiaSurfaceFields(context, x, z);
        const coastLush = input.profile === HESTIA_COAST_LUSH_PRESET_ID
          ? surface.coastLush
          : undefined;
        const ground = coastLush === undefined
          ? undefined
          : sampleHestiaGroundSurface(context, x, z, surface);
        const shore = coastLush === undefined
          ? surface.surfaceHeight <= input.waterSurfaceHeightMeters + 0.35
          : ground !== undefined
            && coastLush.basinMask >= 0.60
            && ground.heightMeters <= 0.25;
        const wetDepression = coastLush === undefined
          ? surface.wetDepression >= 0.72
            && surface.surfaceHeight <= input.waterSurfaceHeightMeters + 1.25
          : !shore
            && ground !== undefined
            && coastLush.wetFoldMask >= 0.55
            && coastLush.wetDepression >= 0.58
            && ground.heightMeters < 1.00;
        if (!shore && !wetDepression) continue;
        if (
          coastLush !== undefined
          && (
            isInsideClearCorridor({ x, z }, anchorCenterMeters)
            || dryCells.has(cellKey(
              Math.round((x - grid.innerMinX) / HESTIA_SURFACE_WORLD_V1.voxelSizeMeters),
              Math.round((z - grid.innerMinZ) / HESTIA_SURFACE_WORLD_V1.voxelSizeMeters)
            ))
          )
        ) continue;
        waterPatches.push(Object.freeze({
          id: `hestia.water-patch.v1:${coordinate.x}:${coordinate.y}:${coordinate.z}:${xIndex}:${zIndex}`,
          positionMeters: freezeVec3({
            x,
            y: shore
              ? input.waterSurfaceHeightMeters + 0.055
              : (ground?.heightMeters ?? surface.surfaceHeight) + 0.045,
            z
          }),
          uniformScale: WATER_PATCH_SCALE_METERS,
          source: shore ? "Shore" : "WetDepression"
        }));
      }
    }
  }
  waterPatches.sort((left, right) => compareAscii(left.id, right.id));

  return Object.freeze({
    identity,
    rootSeed: input.rootSeed,
    voxelSizeMeters: input.voxelSizeMeters,
    residentBrickCoordinates,
    waterSurfaceHeightMeters: input.waterSurfaceHeightMeters,
    anchorCenterMeters,
    decorativePopulation: Object.freeze(decorativePopulation),
    waterPatches: Object.freeze(waterPatches)
  });
};

const encounterFacts = (
  anchor: Readonly<HestiaSurfaceTraversalCell>,
  cells: readonly Readonly<HestiaSurfaceTraversalCell>[]
): Readonly<HestiaSurfaceEncounterFacts> => {
  const desired = { x: anchor.centerMeters.x - 6, z: anchor.centerMeters.z - 10 };
  const treeCell = [...cells]
    .filter((cell) => Math.hypot(
      cell.centerMeters.x - anchor.centerMeters.x,
      cell.centerMeters.z - anchor.centerMeters.z
    ) >= 6)
    .sort((left, right) => {
      const leftDistance = (left.centerMeters.x - desired.x) ** 2
        + (left.centerMeters.z - desired.z) ** 2;
      const rightDistance = (right.centerMeters.x - desired.x) ** 2
        + (right.centerMeters.z - desired.z) ** 2;
      return leftDistance - rightDistance
        || left.gridZ - right.gridZ
        || left.gridX - right.gridX;
    })[0];
  if (treeCell === undefined) {
    throw new Error("Selected Hestia World has no deterministic Structural Tree placement.");
  }
  const instanceId = "hestia.surface-play.umbrella.phase2";
  return Object.freeze({
    surveyDronePositionMeters: freezeVec3({
      x: anchor.centerMeters.x,
      y: anchor.groundHeightMeters + 1.62,
      z: anchor.centerMeters.z - 12
    }),
    structuralTrees: Object.freeze([Object.freeze({
      instanceId,
      seed: instanceId + "-seed",
      rootQuantum: Object.freeze({
        x: Math.round(treeCell.centerMeters.x / MICROVOXEL_BASE_QUANTUM_METERS),
        y: Math.floor(treeCell.groundHeightMeters / MICROVOXEL_BASE_QUANTUM_METERS),
        z: Math.round(treeCell.centerMeters.z / MICROVOXEL_BASE_QUANTUM_METERS)
      })
    })])
  });
};

const requireFinite = (value: number, name: string): number => {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
  return value;
};

const requireInput = (input: HestiaSurfaceWorldSelectionInput): void => {
  requireProfileIdentityPair(input);
  requireFinite(input.frameOriginMeters.x, "frameOriginMeters.x");
  requireFinite(input.frameOriginMeters.y, "frameOriginMeters.y");
  requireFinite(input.frameOriginMeters.z, "frameOriginMeters.z");
  requireFinite(input.waterSurfaceHeightMeters, "waterSurfaceHeightMeters");
  if (input.profile === HESTIA_COAST_LUSH_PRESET_ID && input.waterSurfaceHeightMeters !== 0) {
    throw new RangeError("Coast/Lush profile requires a zero water surface height.");
  }
  if (
    typeof input.rootSeed !== "string"
    || input.rootSeed.length === 0
    || input.rootSeed.trim() !== input.rootSeed
    || input.rootSeed.length > 256
  ) throw new TypeError("Hestia Surface World rootSeed is invalid.");
  if (input.voxelSizeMeters !== HESTIA_SURFACE_WORLD_V1.voxelSizeMeters) {
    throw new RangeError("Hestia Surface World V1 requires 0.5 m voxels.");
  }
  if (
    input.identity.bodyId.length === 0
    || input.identity.regionId.length === 0
    || input.identity.surfaceFrameId.length === 0
    || !Number.isSafeInteger(input.identity.regionRevision)
    || input.identity.regionRevision < 0
  ) throw new TypeError("Hestia Surface World identity is invalid.");
  if (typeof input.probe.sampleGround !== "function") {
    throw new TypeError("Hestia Surface World requires an authority-owned ground probe.");
  }
};

const frozenIdentity = (
  identity: Readonly<HestiaSurfaceWorldIdentity>
): Readonly<HestiaSurfaceWorldIdentity> => Object.freeze({ ...identity });

const normalUp = (normal: Vec3): number | null => {
  if (![normal.x, normal.y, normal.z].every(Number.isFinite)) return null;
  const length = Math.hypot(normal.x, normal.y, normal.z);
  return length <= EPSILON ? null : normal.y / length;
};

const frozenNormal = (normal: Vec3): Vec3 => {
  const length = Math.hypot(normal.x, normal.y, normal.z);
  return freezeVec3({ x: normal.x / length, y: normal.y / length, z: normal.z / length });
};

const validSample = (
  sample: Readonly<HestiaSurfaceGroundSample> | null
): sample is Readonly<HestiaSurfaceGroundSample> => sample !== null
  && Number.isFinite(sample.heightMeters)
  && normalUp(sample.normal) !== null
  && typeof sample.capsuleClear === "boolean";

export const enumerateHestiaSurfaceCandidateCenters = (
  frameOriginMeters: Vec3
): readonly Readonly<HestiaSurfaceCandidateCenter>[] => {
  requireFinite(frameOriginMeters.x, "frameOriginMeters.x");
  requireFinite(frameOriginMeters.y, "frameOriginMeters.y");
  requireFinite(frameOriginMeters.z, "frameOriginMeters.z");
  const candidates: Array<HestiaSurfaceCandidateCenter & { readonly distanceSquared: number }> = [];
  for (
    let zOffset = HESTIA_SURFACE_WORLD_V1.candidateMinimumOffsetMeters;
    zOffset <= HESTIA_SURFACE_WORLD_V1.candidateMaximumOffsetMeters;
    zOffset += HESTIA_SURFACE_WORLD_V1.candidateStepMeters
  ) {
    for (
      let xOffset = HESTIA_SURFACE_WORLD_V1.candidateMinimumOffsetMeters;
      xOffset <= HESTIA_SURFACE_WORLD_V1.candidateMaximumOffsetMeters;
      xOffset += HESTIA_SURFACE_WORLD_V1.candidateStepMeters
    ) {
      candidates.push({
        x: frameOriginMeters.x + xOffset,
        y: frameOriginMeters.y,
        z: frameOriginMeters.z + zOffset,
        distanceSquared: xOffset * xOffset + zOffset * zOffset
      });
    }
  }
  candidates.sort((left, right) =>
    left.distanceSquared - right.distanceSquared
    || left.z - right.z
    || left.x - right.x
  );
  return Object.freeze(candidates.map(({ x, y, z }) => Object.freeze({ x, y, z })));
};

export const computeHestiaSurfaceVerticalBand = (
  frameOriginYMeters: number,
  groundYMeters: number
): Readonly<HestiaSurfaceVerticalBand> | null => {
  requireFinite(frameOriginYMeters, "frameOriginYMeters");
  requireFinite(groundYMeters, "groundYMeters");
  const minimumMeters = frameOriginYMeters
    + HESTIA_SURFACE_WORLD_V1.footprintSizeMeters.y
    * Math.floor(
      (
        groundYMeters
        - frameOriginYMeters
        - HESTIA_SURFACE_WORLD_V1.terrainDepthReserveMeters
      ) / HESTIA_SURFACE_WORLD_V1.footprintSizeMeters.y
    );
  const maximumExclusiveMeters = minimumMeters + HESTIA_SURFACE_WORLD_V1.footprintSizeMeters.y;
  return maximumExclusiveMeters + EPSILON
    < groundYMeters + HESTIA_SURFACE_WORLD_V1.eyeHeightMeters + HESTIA_SURFACE_WORLD_V1.upperClearanceMeters
    ? null
    : Object.freeze({ minimumMeters, maximumExclusiveMeters });
};

const gridCoordinates = (minimum: number, maximum: number): readonly number[] => {
  const count = Math.round((maximum - minimum) / HESTIA_SURFACE_WORLD_V1.voxelSizeMeters) + 1;
  return Object.freeze(Array.from(
    { length: count },
    (_, index) => minimum + index * HESTIA_SURFACE_WORLD_V1.voxelSizeMeters
  ));
};

const candidateGrid = (
  candidate: Readonly<HestiaSurfaceCandidateCenter>
): Readonly<HestiaSurfaceCandidateGrid> => {
  const halfFootprint = HESTIA_SURFACE_WORLD_V1.footprintSizeMeters.x / 2;
  const innerMinX = candidate.x - halfFootprint + HESTIA_SURFACE_WORLD_V1.residentBoundaryInsetMeters;
  const innerMaxX = candidate.x + halfFootprint - HESTIA_SURFACE_WORLD_V1.residentBoundaryInsetMeters;
  const innerMinZ = candidate.z - halfFootprint + HESTIA_SURFACE_WORLD_V1.residentBoundaryInsetMeters;
  const innerMaxZ = candidate.z + halfFootprint - HESTIA_SURFACE_WORLD_V1.residentBoundaryInsetMeters;
  const xCoordinates = gridCoordinates(innerMinX, innerMaxX);
  const zCoordinates = gridCoordinates(innerMinZ, innerMaxZ);
  return Object.freeze({
    xCoordinates,
    zCoordinates,
    innerMinX,
    innerMaxX,
    innerMinZ,
    innerMaxZ,
    spawnGridX: Math.round((candidate.x - innerMinX) / HESTIA_SURFACE_WORLD_V1.voxelSizeMeters),
    spawnGridZ: Math.round((candidate.z - innerMinZ) / HESTIA_SURFACE_WORLD_V1.voxelSizeMeters)
  });
};

const candidateCellFromSample = (
  input: HestiaSurfaceWorldSelectionInput,
  verticalBand: Readonly<HestiaSurfaceVerticalBand>,
  gridX: number,
  gridZ: number,
  x: number,
  z: number,
  sample: Readonly<HestiaSurfaceGroundSample> | null
): CandidateCell | null => {
  const terrainDepthReserveMeters = input.profile === HESTIA_COAST_LUSH_PRESET_ID
    ? 0
    : HESTIA_SURFACE_WORLD_V1.terrainDepthReserveMeters;
  if (!validSample(sample) || !sample.capsuleClear) return null;
  const up = normalUp(sample.normal);
  if (
    up === null
    || up + EPSILON < Math.cos(HESTIA_SURFACE_WORLD_V1.maximumSlopeRadians)
    || sample.heightMeters + EPSILON
      < input.waterSurfaceHeightMeters + HESTIA_SURFACE_WORLD_V1.waterClearanceMeters
    || sample.heightMeters + EPSILON
      < verticalBand.minimumMeters + terrainDepthReserveMeters
    || sample.heightMeters + HESTIA_SURFACE_WORLD_V1.eyeHeightMeters
      + HESTIA_SURFACE_WORLD_V1.upperClearanceMeters
      > verticalBand.maximumExclusiveMeters + EPSILON
  ) return null;
  const key = cellKey(gridX, gridZ);
  return Object.freeze({
    key,
    gridX,
    gridZ,
    centerMeters: freezePoint2(x, z),
    groundHeightMeters: sample.heightMeters,
    groundNormal: frozenNormal(sample.normal)
  });
};

const componentFromSpawn = (
  cells: ReadonlyMap<string, CandidateCell>,
  spawn: CandidateCell
): readonly CandidateCell[] => {
  const pending: CandidateCell[] = [spawn];
  const visited = new Set<string>([spawn.key]);
  const component: CandidateCell[] = [];
  for (let cursor = 0; cursor < pending.length; cursor += 1) {
    const current = pending[cursor]!;
    component.push(current);
    for (const offset of NEIGHBOR_OFFSETS) {
      const neighbor = cells.get(cellKey(current.gridX + offset.x, current.gridZ + offset.z));
      if (
        neighbor === undefined
        || visited.has(neighbor.key)
        || Math.abs(neighbor.groundHeightMeters - current.groundHeightMeters)
          > HESTIA_SURFACE_WORLD_V1.maximumNeighborStepMeters + EPSILON
      ) continue;
      visited.add(neighbor.key);
      pending.push(neighbor);
    }
  }
  component.sort((left, right) => left.gridZ - right.gridZ || left.gridX - right.gridX);
  return Object.freeze(component);
};

const isPerimeterCell = (
  cell: CandidateCell,
  component: ReadonlyMap<string, CandidateCell>
): boolean => NEIGHBOR_OFFSETS.some((offset) => {
  const neighbor = component.get(cellKey(cell.gridX + offset.x, cell.gridZ + offset.z));
  return neighbor === undefined
    || Math.abs(neighbor.groundHeightMeters - cell.groundHeightMeters)
      > HESTIA_SURFACE_WORLD_V1.maximumNeighborStepMeters + EPSILON;
});

class StableDistanceQueue {
  readonly #entries: QueueEntry[] = [];

  public push(entry: QueueEntry): void {
    this.#entries.push(entry);
    let index = this.#entries.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.#compare(this.#entries[parent]!, entry) <= 0) break;
      this.#entries[index] = this.#entries[parent]!;
      index = parent;
    }
    this.#entries[index] = entry;
  }

  public pop(): QueueEntry | undefined {
    const first = this.#entries[0];
    const last = this.#entries.pop();
    if (first === undefined || last === undefined || this.#entries.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.#entries.length) break;
      const child = right < this.#entries.length
        && this.#compare(this.#entries[right]!, this.#entries[left]!) < 0
        ? right
        : left;
      if (this.#compare(last, this.#entries[child]!) <= 0) break;
      this.#entries[index] = this.#entries[child]!;
      index = child;
    }
    this.#entries[index] = last;
    return first;
  }

  #compare(left: QueueEntry, right: QueueEntry): number {
    return left.distanceMeters - right.distanceMeters
      || left.cell.gridZ - right.cell.gridZ
      || left.cell.gridX - right.cell.gridX;
  }
}

const distanceFromSpawnToPerimeter = (
  spawn: CandidateCell,
  component: ReadonlyMap<string, CandidateCell>
): number => {
  const distances = new Map<string, number>([[spawn.key, 0]]);
  const queue = new StableDistanceQueue();
  queue.push({ cell: spawn, distanceMeters: 0 });
  while (true) {
    const entry = queue.pop();
    if (entry === undefined) return Number.POSITIVE_INFINITY;
    if (entry.distanceMeters !== distances.get(entry.cell.key)) continue;
    if (isPerimeterCell(entry.cell, component)) return entry.distanceMeters;
    for (const offset of NEIGHBOR_OFFSETS) {
      const neighbor = component.get(cellKey(entry.cell.gridX + offset.x, entry.cell.gridZ + offset.z));
      if (
        neighbor === undefined
        || Math.abs(neighbor.groundHeightMeters - entry.cell.groundHeightMeters)
          > HESTIA_SURFACE_WORLD_V1.maximumNeighborStepMeters + EPSILON
      ) continue;
      const step = HESTIA_SURFACE_WORLD_V1.voxelSizeMeters
        * (offset.x !== 0 && offset.z !== 0 ? Math.SQRT2 : 1);
      const candidateDistance = entry.distanceMeters + step;
      const previous = distances.get(neighbor.key);
      if (previous !== undefined && previous <= candidateDistance + EPSILON) continue;
      distances.set(neighbor.key, candidateDistance);
      queue.push({ cell: neighbor, distanceMeters: candidateDistance });
    }
  }
};

const samePoint3 = (left: Vec3, right: Vec3): boolean =>
  left.x === right.x && left.y === right.y && left.z === right.z;

const sameEncounter = (
  left: Readonly<HestiaSurfaceEncounterFacts>,
  right: Readonly<HestiaSurfaceEncounterFacts>
): boolean => samePoint3(left.surveyDronePositionMeters, right.surveyDronePositionMeters)
  && left.structuralTrees.length === right.structuralTrees.length
  && left.structuralTrees.every((tree, index) => {
    const candidate = right.structuralTrees[index];
    return candidate !== undefined
      && tree.instanceId === candidate.instanceId
      && tree.seed === candidate.seed
      && tree.rootQuantum.x === candidate.rootQuantum.x
      && tree.rootQuantum.y === candidate.rootQuantum.y
      && tree.rootQuantum.z === candidate.rootQuantum.z;
  });

const finalizeCandidateWorld = (
  input: HestiaSurfaceWorldSelectionInput,
  candidate: Readonly<HestiaSurfaceCandidateCenter>,
  spawnSample: Readonly<HestiaSurfaceGroundSample>,
  verticalBand: Readonly<HestiaSurfaceVerticalBand>,
  grid: Readonly<HestiaSurfaceCandidateGrid>,
  cells: ReadonlyMap<string, CandidateCell>,
  policy: CandidateWorldFinalizationPolicy,
  sourceWorld?: Readonly<HestiaSurfaceWorldFacts>,
  sourceCandidateCells?: ReadonlyMap<string, CandidateCell>
): Readonly<HestiaSurfaceWorldFacts> | null => {
  const spawnCell = cells.get(cellKey(grid.spawnGridX, grid.spawnGridZ));
  if (spawnCell === undefined) return null;
  const component = componentFromSpawn(cells, spawnCell);
  const componentMap = new Map(component.map((cell) => [cell.key, cell]));
  const minX = Math.min(...component.map((cell) => cell.centerMeters.x));
  const maxX = Math.max(...component.map((cell) => cell.centerMeters.x));
  const minZ = Math.min(...component.map((cell) => cell.centerMeters.z));
  const maxZ = Math.max(...component.map((cell) => cell.centerMeters.z));
  if (
    maxX - minX + EPSILON < HESTIA_SURFACE_WORLD_V1.minimumComponentSizeMeters
    || maxZ - minZ + EPSILON < HESTIA_SURFACE_WORLD_V1.minimumComponentSizeMeters
  ) return null;
  const spawnPerimeterDistanceMeters = distanceFromSpawnToPerimeter(spawnCell, componentMap);
  if (
    policy === "InitialAdmission"
    && spawnPerimeterDistanceMeters + EPSILON < minimumSpawnPerimeterDistanceMeters(input)
  ) return null;

  const identity = frozenIdentity(input.identity);
  const residentInsetBoundsMeters = sourceWorld?.traversalDomain.residentInsetBoundsMeters
    ?? Object.freeze({
      minInclusive: freezePoint2(grid.innerMinX, grid.innerMinZ),
      maxExclusive: freezePoint2(grid.innerMaxX, grid.innerMaxZ)
    });
  const sourceTraversalCells = new Map(
    sourceWorld?.traversalDomain.cells.map((cell) => [cellKey(cell.gridX, cell.gridZ), cell]) ?? []
  );
  const traversalCells = Object.freeze(component.map(({ key, ...cell }) => {
    const prior = sourceTraversalCells.get(key);
    return sourceCandidateCells?.get(key) === cells.get(key) && prior !== undefined
      ? prior
      : Object.freeze(cell);
  }));
  const traversalDomain: Readonly<HestiaSurfaceTraversalDomain> = Object.freeze({
    identity,
    gridSizeMeters: HESTIA_SURFACE_WORLD_V1.voxelSizeMeters,
    gridOriginMeters: sourceWorld?.traversalDomain.gridOriginMeters
      ?? freezePoint2(grid.innerMinX, grid.innerMinZ),
    gridCounts: sourceWorld?.traversalDomain.gridCounts
      ?? Object.freeze({ x: grid.xCoordinates.length, z: grid.zCoordinates.length }),
    residentInsetBoundsMeters,
    componentBoundsMeters: Object.freeze({
      minInclusive: freezePoint2(minX, minZ),
      maxExclusive: freezePoint2(
        maxX + HESTIA_SURFACE_WORLD_V1.voxelSizeMeters,
        maxZ + HESTIA_SURFACE_WORLD_V1.voxelSizeMeters
      ),
      size: freezePoint2(maxX - minX, maxZ - minZ)
    }),
    spawnGridCell: sourceWorld?.traversalDomain.spawnGridCell
      ?? Object.freeze({ gridX: grid.spawnGridX, gridZ: grid.spawnGridZ }),
    spawnPerimeterDistanceMeters,
    cells: traversalCells
  });
  // Local Terrain edits may change walkable connectivity without changing the
  // immutable coast/water mask selected for this resident World footprint.
  const dryCellKeys = sourceWorld?.shoreBoundary.dryCellKeys
    ?? Object.freeze(component.map((cell) => cell.key));
  const shoreBoundary: Readonly<HestiaShoreBoundary> = Object.freeze({
    identity,
    gridSizeMeters: traversalDomain.gridSizeMeters,
    gridOriginMeters: traversalDomain.gridOriginMeters,
    gridCounts: traversalDomain.gridCounts,
    residentInsetBoundsMeters,
    dryCellKeys
  });
  const derivedEncounter = encounterFacts(spawnCell, traversalCells);
  const encounter = sourceWorld !== undefined && sameEncounter(sourceWorld.encounter, derivedEncounter)
    ? sourceWorld.encounter
    : derivedEncounter;

  const xBrickOffset = Math.round((candidate.x - input.frameOriginMeters.x) / HESTIA_SURFACE_WORLD_V1.brickSizeMeters.x);
  const zBrickOffset = Math.round((candidate.z - input.frameOriginMeters.z) / HESTIA_SURFACE_WORLD_V1.brickSizeMeters.z);
  const yBrickOffset = Math.round((verticalBand.minimumMeters - input.frameOriginMeters.y) / HESTIA_SURFACE_WORLD_V1.brickSizeMeters.y);
  const computedBrickBounds = Object.freeze({
    minInclusive: Object.freeze({
      x: xBrickOffset - HESTIA_SURFACE_WORLD_V1.footprintBrickCounts.x / 2,
      y: yBrickOffset,
      z: zBrickOffset - HESTIA_SURFACE_WORLD_V1.footprintBrickCounts.z / 2
    }),
    maxExclusive: Object.freeze({
      x: xBrickOffset + HESTIA_SURFACE_WORLD_V1.footprintBrickCounts.x / 2,
      y: yBrickOffset + HESTIA_SURFACE_WORLD_V1.footprintBrickCounts.y,
      z: zBrickOffset + HESTIA_SURFACE_WORLD_V1.footprintBrickCounts.z / 2
    })
  });
  const brickBounds = sourceWorld !== undefined
    && JSON.stringify(sourceWorld.brickBounds) === JSON.stringify(computedBrickBounds)
    ? sourceWorld.brickBounds
    : computedBrickBounds;
  const residentBrickCoordinates = sourceWorld?.residentBrickCoordinates ?? Object.freeze(
    Array.from(
      { length: HESTIA_SURFACE_WORLD_V1.footprintBrickCounts.z },
      (_, zIndex) => zIndex + brickBounds.minInclusive.z
    ).flatMap((z) => Array.from(
      { length: HESTIA_SURFACE_WORLD_V1.footprintBrickCounts.x },
      (_, xIndex) => Object.freeze({
        x: xIndex + brickBounds.minInclusive.x,
        y: yBrickOffset,
        z
      })
    ))
  );
  const computedAnchorCenterMeters = freezeVec3({
    x: candidate.x,
    y: spawnSample.heightMeters,
    z: candidate.z
  });
  const anchorCenterMeters = sourceWorld !== undefined
    && samePoint3(sourceWorld.anchorCenterMeters, computedAnchorCenterMeters)
    ? sourceWorld.anchorCenterMeters
    : computedAnchorCenterMeters;
  const environment = sourceWorld === undefined
    ? deriveEnvironmentFacts(
      input,
      identity,
      anchorCenterMeters,
      residentBrickCoordinates,
      grid,
      dryCellKeys
    )
    : Object.freeze({
      ...sourceWorld.environment,
      identity,
      anchorCenterMeters,
      residentBrickCoordinates,
      decorativePopulation: sourceWorld.environment.decorativePopulation,
      waterPatches: sourceWorld.environment.waterPatches
    });
  const stableVerticalBand = sourceWorld !== undefined
    && sourceWorld.verticalBand.minimumMeters === verticalBand.minimumMeters
    && sourceWorld.verticalBand.maximumExclusiveMeters === verticalBand.maximumExclusiveMeters
    ? sourceWorld.verticalBand
    : verticalBand;
  const world = Object.freeze({
    identity,
    anchorCenterMeters,
    verticalBand: stableVerticalBand,
    brickBounds,
    residentBrickCoordinates,
    traversalDomain,
    shoreBoundary,
    waterSurfaceHeightMeters: input.waterSurfaceHeightMeters,
    environment,
    encounter
  });
  candidateCellsByWorld.set(world, new Map(cells));
  return world;
};

const candidateWorld = (
  input: HestiaSurfaceWorldSelectionInput,
  candidate: Readonly<HestiaSurfaceCandidateCenter>,
  policy: CandidateWorldFinalizationPolicy,
  sourceWorld?: Readonly<HestiaSurfaceWorldFacts>
): Readonly<HestiaSurfaceWorldFacts> | null => {
  const spawnSample = input.probe.sampleGround(candidate.x, candidate.z);
  if (!validSample(spawnSample) || !spawnSample.capsuleClear) return null;
  const spawnUp = normalUp(spawnSample.normal);
  if (
    spawnUp === null
    || spawnUp + EPSILON < Math.cos(HESTIA_SURFACE_WORLD_V1.maximumSpawnSlopeRadians)
    || spawnSample.heightMeters + EPSILON
      < input.waterSurfaceHeightMeters + HESTIA_SURFACE_WORLD_V1.waterClearanceMeters
  ) return null;

  const verticalBand = computeHestiaSurfaceVerticalBand(input.frameOriginMeters.y, spawnSample.heightMeters);
  if (verticalBand === null) return null;
  const grid = candidateGrid(candidate);
  const cells = new Map<string, CandidateCell>();

  for (let gridZ = 0; gridZ < grid.zCoordinates.length; gridZ += 1) {
    const z = grid.zCoordinates[gridZ]!;
    for (let gridX = 0; gridX < grid.xCoordinates.length; gridX += 1) {
      const x = grid.xCoordinates[gridX]!;
      const cell = candidateCellFromSample(
        input,
        verticalBand,
        gridX,
        gridZ,
        x,
        z,
        input.probe.sampleGround(x, z)
      );
      if (cell !== null) cells.set(cell.key, cell);
    }
  }
  return finalizeCandidateWorld(input, candidate, spawnSample, verticalBand, grid, cells, policy, sourceWorld);
};

export const selectHestiaSurfaceWorld = (
  input: HestiaSurfaceWorldSelectionInput
): HestiaSurfaceWorldSelectionResult => {
  requireInput(input);
  const candidates = enumerateHestiaSurfaceCandidateCenters(input.frameOriginMeters);
  for (const candidate of candidates) {
    const world = candidateWorld(input, candidate, "InitialAdmission");
    if (world !== null) return Object.freeze({ status: "Selected", world });
  }
  return Object.freeze({
    status: "Rejected",
    failure: Object.freeze({
      code: "NoAdmissibleLandFootprint",
      message: "No deterministic Hestia land candidate satisfies the Surface Play traversal contract.",
      attemptedCandidateCount: candidates.length
    })
  });
};

export const selectHestiaSurfaceWorldCandidate = (
  input: HestiaSurfaceWorldSelectionInput,
  candidate: Readonly<HestiaSurfaceCandidateCenter>
): HestiaSurfaceWorldSelectionResult => {
  requireInput(input);
  requireFinite(candidate.x, "candidate.x");
  requireFinite(candidate.y, "candidate.y");
  requireFinite(candidate.z, "candidate.z");
  const world = candidateWorld(input, candidate, "InitialAdmission");
  return world === null
    ? Object.freeze({
        status: "Rejected" as const,
        failure: Object.freeze({
          code: "NoAdmissibleLandFootprint" as const,
          message: "The selected Hestia land candidate no longer satisfies the Surface Play traversal contract.",
          attemptedCandidateCount: 1
        })
      })
    : Object.freeze({ status: "Selected" as const, world });
};

export const revalidateHestiaSurfaceWorldCandidate = (
  input: HestiaSurfaceWorldSelectionInput,
  sourceWorld: Readonly<HestiaSurfaceWorldFacts>
): HestiaSurfaceWorldSelectionResult => {
  requireInput(input);
  const candidate = Object.freeze({
    x: sourceWorld.anchorCenterMeters.x,
    y: input.frameOriginMeters.y,
    z: sourceWorld.anchorCenterMeters.z
  });
  const world = candidateWorld(input, candidate, "PostEditRevalidation", sourceWorld);
  return world === null
    ? Object.freeze({
        status: "Rejected" as const,
        failure: Object.freeze({
          code: "NoAdmissibleLandFootprint" as const,
          message: "The local Terrain edit would invalidate the selected Hestia traversal domain.",
          attemptedCandidateCount: 1
        })
      })
    : Object.freeze({ status: "Selected" as const, world });
};

export const rebindHestiaSurfaceWorldIdentity = (
  sourceWorld: Readonly<HestiaSurfaceWorldFacts>,
  identityInput: Readonly<HestiaSurfaceWorldIdentity>
): Readonly<HestiaSurfaceWorldFacts> => {
  if (
    sourceWorld.identity.bodyId !== identityInput.bodyId
    || sourceWorld.identity.regionId !== identityInput.regionId
    || sourceWorld.identity.surfaceFrameId !== identityInput.surfaceFrameId
  ) throw new TypeError("Hestia World identity rebind cannot change body, region, or Surface frame.");
  if (!Number.isSafeInteger(identityInput.regionRevision) || identityInput.regionRevision < 0) {
    throw new TypeError("Hestia World identity rebind requires a non-negative safe region revision.");
  }
  if (sourceWorld.identity.regionRevision === identityInput.regionRevision) return sourceWorld;
  const identity = frozenIdentity(identityInput);
  const world = Object.freeze({
    ...sourceWorld,
    identity,
    traversalDomain: Object.freeze({ ...sourceWorld.traversalDomain, identity }),
    shoreBoundary: Object.freeze({ ...sourceWorld.shoreBoundary, identity }),
    environment: Object.freeze({ ...sourceWorld.environment, identity })
  });
  const cells = candidateCellsByWorld.get(sourceWorld);
  if (cells !== undefined) candidateCellsByWorld.set(world, cells);
  return world;
};

export const reselectHestiaSurfaceWorldAffectedGrid = (input: Readonly<
  HestiaSurfaceWorldSelectionInput & {
    readonly sourceWorld: Readonly<HestiaSurfaceWorldFacts>;
    readonly affectedGridBounds: Readonly<HestiaSurfaceAffectedGridBounds>;
  }
>): HestiaSurfaceWorldSelectionResult => {
  requireInput(input);
  const { sourceWorld, affectedGridBounds } = input;
  if (
    sourceWorld.identity.bodyId !== input.identity.bodyId
    || sourceWorld.identity.regionId !== input.identity.regionId
    || sourceWorld.identity.surfaceFrameId !== input.identity.surfaceFrameId
  ) throw new TypeError("Incremental Hestia World selection identity does not match the source World.");
  if (![affectedGridBounds.minimumGridX, affectedGridBounds.maximumGridX,
    affectedGridBounds.minimumGridZ, affectedGridBounds.maximumGridZ].every(Number.isSafeInteger)) {
    throw new TypeError("Incremental Hestia World affected grid bounds must be safe integers.");
  }
  const sourceCandidateCells = candidateCellsByWorld.get(sourceWorld);
  if (sourceCandidateCells === undefined) return Object.freeze({
    status: "Rejected",
    failure: Object.freeze({
      code: "NoAdmissibleLandFootprint",
      message: "Incremental Hestia World adoption requires the in-memory full-selection candidate cache.",
      attemptedCandidateCount: 1
    })
  });
  const candidate = Object.freeze({
    x: sourceWorld.anchorCenterMeters.x,
    y: input.frameOriginMeters.y,
    z: sourceWorld.anchorCenterMeters.z
  });
  const grid = candidateGrid(candidate);
  if (
    sourceWorld.traversalDomain.gridOriginMeters.x !== grid.innerMinX
    || sourceWorld.traversalDomain.gridOriginMeters.z !== grid.innerMinZ
    || sourceWorld.traversalDomain.gridCounts.x !== grid.xCoordinates.length
    || sourceWorld.traversalDomain.gridCounts.z !== grid.zCoordinates.length
  ) return Object.freeze({
    status: "Rejected",
    failure: Object.freeze({
      code: "NoAdmissibleLandFootprint",
      message: "Incremental Hestia World adoption found stale traversal-grid geometry.",
      attemptedCandidateCount: 1
    })
  });

  const minimumGridX = Math.max(0, affectedGridBounds.minimumGridX);
  const maximumGridX = Math.min(grid.xCoordinates.length - 1, affectedGridBounds.maximumGridX);
  const minimumGridZ = Math.max(0, affectedGridBounds.minimumGridZ);
  const maximumGridZ = Math.min(grid.zCoordinates.length - 1, affectedGridBounds.maximumGridZ);
  if (minimumGridX > maximumGridX || minimumGridZ > maximumGridZ) {
    return Object.freeze({
      status: "Selected",
      world: rebindHestiaSurfaceWorldIdentity(sourceWorld, input.identity)
    });
  }
  const spawnAffected = grid.spawnGridX >= minimumGridX && grid.spawnGridX <= maximumGridX
    && grid.spawnGridZ >= minimumGridZ && grid.spawnGridZ <= maximumGridZ;
  const sourceSpawn = sourceCandidateCells.get(cellKey(grid.spawnGridX, grid.spawnGridZ));
  const spawnSample = spawnAffected
    ? input.probe.sampleGround(candidate.x, candidate.z)
    : sourceSpawn === undefined
      ? null
      : Object.freeze({
        heightMeters: sourceSpawn.groundHeightMeters,
        normal: sourceSpawn.groundNormal,
        capsuleClear: true
      });
  if (!validSample(spawnSample) || !spawnSample.capsuleClear) return Object.freeze({
    status: "Rejected",
    failure: Object.freeze({
      code: "NoAdmissibleLandFootprint",
      message: "The selected Hestia spawn ground is no longer authoritative and capsule-clear.",
      attemptedCandidateCount: 1
    })
  });
  const spawnUp = normalUp(spawnSample.normal);
  if (
    spawnUp === null
    || spawnUp + EPSILON < Math.cos(HESTIA_SURFACE_WORLD_V1.maximumSpawnSlopeRadians)
    || spawnSample.heightMeters + EPSILON
      < input.waterSurfaceHeightMeters + HESTIA_SURFACE_WORLD_V1.waterClearanceMeters
  ) return Object.freeze({
    status: "Rejected",
    failure: Object.freeze({
      code: "NoAdmissibleLandFootprint",
      message: "The selected Hestia spawn no longer satisfies dry-slope safety.",
      attemptedCandidateCount: 1
    })
  });
  const verticalBand = computeHestiaSurfaceVerticalBand(input.frameOriginMeters.y, spawnSample.heightMeters);
  if (
    verticalBand === null
    || verticalBand.minimumMeters !== sourceWorld.verticalBand.minimumMeters
    || verticalBand.maximumExclusiveMeters !== sourceWorld.verticalBand.maximumExclusiveMeters
  ) return Object.freeze({
    status: "Rejected",
    failure: Object.freeze({
      code: "NoAdmissibleLandFootprint",
      message: "The selected Hestia spawn would require a different resident vertical band.",
      attemptedCandidateCount: 1
    })
  });

  const cells = new Map(sourceCandidateCells);
  for (let gridZ = minimumGridZ; gridZ <= maximumGridZ; gridZ += 1) {
    const z = grid.zCoordinates[gridZ]!;
    for (let gridX = minimumGridX; gridX <= maximumGridX; gridX += 1) {
      const x = grid.xCoordinates[gridX]!;
      const key = cellKey(gridX, gridZ);
      const cell = candidateCellFromSample(
        input,
        verticalBand,
        gridX,
        gridZ,
        x,
        z,
        input.probe.sampleGround(x, z)
      );
      if (cell === null) cells.delete(key);
      else cells.set(key, cell);
    }
  }
  const world = finalizeCandidateWorld(
    input,
    candidate,
    spawnSample,
    verticalBand,
    grid,
    cells,
    "PostEditRevalidation",
    sourceWorld,
    sourceCandidateCells
  );
  return world === null
    ? Object.freeze({
        status: "Rejected" as const,
        failure: Object.freeze({
          code: "NoAdmissibleLandFootprint" as const,
          message: "The local Terrain edit would invalidate the selected Hestia traversal domain.",
          attemptedCandidateCount: 1
        })
      })
    : Object.freeze({ status: "Selected" as const, world });
};

const pointCellIndex = (
  coordinate: number,
  origin: number,
  gridSizeMeters: number
): number => Math.floor((coordinate - origin + gridSizeMeters / 2) / gridSizeMeters);

const shoreDryCellLookups = new WeakMap<Readonly<HestiaShoreBoundary>, ReadonlySet<string>>();

const shoreDryCellLookup = (
  boundary: Readonly<HestiaShoreBoundary>
): ReadonlySet<string> => {
  const cached = shoreDryCellLookups.get(boundary);
  if (cached !== undefined) return cached;
  const created: ReadonlySet<string> = new Set(boundary.dryCellKeys);
  shoreDryCellLookups.set(boundary, created);
  return created;
};

const squaredDistanceToCell = (
  boundary: Readonly<HestiaShoreBoundary>,
  gridX: number,
  gridZ: number,
  point: Readonly<{ readonly x: number; readonly z: number }>
): number => {
  const centerX = boundary.gridOriginMeters.x + gridX * boundary.gridSizeMeters;
  const centerZ = boundary.gridOriginMeters.z + gridZ * boundary.gridSizeMeters;
  const half = boundary.gridSizeMeters / 2;
  const minimumX = Math.max(boundary.residentInsetBoundsMeters.minInclusive.x, centerX - half);
  const maximumX = Math.min(boundary.residentInsetBoundsMeters.maxExclusive.x, centerX + half);
  const minimumZ = Math.max(boundary.residentInsetBoundsMeters.minInclusive.z, centerZ - half);
  const maximumZ = Math.min(boundary.residentInsetBoundsMeters.maxExclusive.z, centerZ + half);
  const xDistance = point.x < minimumX ? minimumX - point.x : point.x > maximumX ? point.x - maximumX : 0;
  const zDistance = point.z < minimumZ ? minimumZ - point.z : point.z > maximumZ ? point.z - maximumZ : 0;
  return xDistance * xDistance + zDistance * zDistance;
};

const containsCapsule = (
  boundary: Readonly<HestiaShoreBoundary>,
  point: Readonly<{ readonly x: number; readonly z: number }>,
  radiusMeters: number,
  dryCells: ReadonlySet<string>
): boolean => {
  const bounds = boundary.residentInsetBoundsMeters;
  if (
    point.x - radiusMeters < bounds.minInclusive.x
    || point.x + radiusMeters >= bounds.maxExclusive.x
    || point.z - radiusMeters < bounds.minInclusive.z
    || point.z + radiusMeters >= bounds.maxExclusive.z
  ) return false;
  const minimumGridX = Math.max(0, pointCellIndex(point.x - radiusMeters, boundary.gridOriginMeters.x, boundary.gridSizeMeters));
  const maximumGridX = Math.min(
    boundary.gridCounts.x - 1,
    pointCellIndex(point.x + radiusMeters, boundary.gridOriginMeters.x, boundary.gridSizeMeters)
  );
  const minimumGridZ = Math.max(0, pointCellIndex(point.z - radiusMeters, boundary.gridOriginMeters.z, boundary.gridSizeMeters));
  const maximumGridZ = Math.min(
    boundary.gridCounts.z - 1,
    pointCellIndex(point.z + radiusMeters, boundary.gridOriginMeters.z, boundary.gridSizeMeters)
  );
  const radiusSquared = radiusMeters * radiusMeters;
  for (let gridZ = minimumGridZ; gridZ <= maximumGridZ; gridZ += 1) {
    for (let gridX = minimumGridX; gridX <= maximumGridX; gridX += 1) {
      if (
        squaredDistanceToCell(boundary, gridX, gridZ, point) <= radiusSquared + EPSILON
        && !dryCells.has(cellKey(gridX, gridZ))
      ) return false;
    }
  }
  return true;
};

/**
 * Returns the last safe fraction before the swept point/capsule would enter
 * non-dry space. `null` means the complete displacement remains inside.
 */
export const findHestiaShoreBoundaryFraction = (
  boundary: Readonly<HestiaShoreBoundary>,
  start: Readonly<{ readonly x: number; readonly z: number }>,
  displacement: Readonly<{ readonly x: number; readonly z: number }>,
  radiusMeters: number
): number | null => {
  requireFinite(start.x, "start.x");
  requireFinite(start.z, "start.z");
  requireFinite(displacement.x, "displacement.x");
  requireFinite(displacement.z, "displacement.z");
  requireFinite(radiusMeters, "radiusMeters");
  if (radiusMeters < 0) throw new RangeError("radiusMeters must be non-negative.");
  const dryCells = shoreDryCellLookup(boundary);
  if (!containsCapsule(boundary, start, radiusMeters, dryCells)) return 0;
  const distanceMeters = Math.hypot(displacement.x, displacement.z);
  if (distanceMeters <= EPSILON) return null;
  const stepCount = Math.max(1, Math.ceil(distanceMeters / (boundary.gridSizeMeters / 8)));
  let previousFraction = 0;
  for (let index = 1; index <= stepCount; index += 1) {
    const fraction = index / stepCount;
    const point = {
      x: start.x + displacement.x * fraction,
      z: start.z + displacement.z * fraction
    };
    if (containsCapsule(boundary, point, radiusMeters, dryCells)) {
      previousFraction = fraction;
      continue;
    }
    let low = previousFraction;
    let high = fraction;
    for (let iteration = 0; iteration < 40; iteration += 1) {
      const middle = (low + high) / 2;
      const middlePoint = {
        x: start.x + displacement.x * middle,
        z: start.z + displacement.z * middle
      };
      if (containsCapsule(boundary, middlePoint, radiusMeters, dryCells)) low = middle;
      else high = middle;
    }
    return Math.max(0, low - EPSILON);
  }
  return null;
};
