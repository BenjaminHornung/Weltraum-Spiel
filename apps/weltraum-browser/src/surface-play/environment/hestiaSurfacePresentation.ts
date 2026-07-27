import {
  canonicalSignature,
  createMaterialProfile,
  materialProfileId,
  materialProfileSignature,
  type ContentHash,
  type MaterialProfile,
  type MaterialProfileId
} from "../../presentation";
import {
  surfaceFrameId,
  voxelBodyId,
  voxelRegionId,
  VOXEL_BRICK_CELL_DIMENSIONS,
  type VoxelCoordinate,
  type VoxelMaterialId
} from "../../voxel";
import {
  createHestiaFieldContext,
  generateHestiaScatter,
  HESTIA_SEA_LEVEL_METERS,
  sampleHestiaSurfaceFields,
  type HestiaScatterKind,
  type HestiaVoxelSizeMeters
} from "../../world-generation/hestia";
import {
  createSurfaceTerrainPresentationSnapshot,
  type SurfaceTerrainPresentationSnapshot
} from "../contracts";

const PRESENTATION_POLICY_VERSION = "hestia-surface-presentation.v1";
const WATER_PATCH_SPACING_METERS = 2;
const WATER_PATCH_SCALE_METERS = 1.16;
const CLEAR_CORRIDOR_HALF_WIDTH_METERS = 2.25;
const CLEAR_CORRIDOR_MIN_Z_METERS = -6;
const CLEAR_CORRIDOR_MAX_Z_METERS = 18;

export interface HestiaSurfaceBrickPresentationFactInput {
  readonly brickId: string;
  readonly coordinate: Readonly<VoxelCoordinate>;
  readonly terrainHash: string;
}

export interface HestiaSurfaceBrickPresentationFact {
  readonly brickId: string;
  readonly coordinate: Readonly<VoxelCoordinate>;
  readonly terrainHash: string;
}

export interface HestiaSurfaceScatterPresentationFact {
  readonly id: string;
  readonly kind: HestiaScatterKind;
  readonly positionMeters: Readonly<{ x: number; y: number; z: number }>;
  readonly yawRadians: number;
  readonly uniformScale: number;
  readonly surfaceMaterialId: VoxelMaterialId;
}

export interface HestiaSurfaceWaterPatchPresentationFact {
  readonly id: string;
  readonly positionMeters: Readonly<{ x: number; y: number; z: number }>;
  readonly uniformScale: number;
  readonly source: "Shore" | "WetDepression";
}

export interface HestiaSurfaceRegionPresentationSnapshotInput {
  readonly terrain: SurfaceTerrainPresentationSnapshot;
  readonly rootSeed: string;
  readonly voxelSizeMeters: HestiaVoxelSizeMeters;
  readonly bricks: readonly HestiaSurfaceBrickPresentationFactInput[];
}

export interface HestiaSurfaceRegionPresentationSnapshot {
  readonly terrain: Readonly<SurfaceTerrainPresentationSnapshot>;
  readonly rootSeed: string;
  readonly voxelSizeMeters: HestiaVoxelSizeMeters;
  readonly bricks: readonly Readonly<HestiaSurfaceBrickPresentationFact>[];
  readonly scatter: readonly Readonly<HestiaSurfaceScatterPresentationFact>[];
  readonly waterPatches: readonly Readonly<HestiaSurfaceWaterPatchPresentationFact>[];
  readonly presentationSignature: ContentHash;
}

const MATERIAL_PROFILE_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: "dark_rock",
    profile: createMaterialProfile({
      id: materialProfileId("hestia-surface:dark_rock"),
      kind: "BasicLit",
      baseColor: { r: 0.045, g: 0.085, b: 0.082 },
      opacity: 1,
      doubleSided: false,
      wireframe: false,
      depthWrite: true
    })
  }),
  Object.freeze({
    key: "wet_soil",
    profile: createMaterialProfile({
      id: materialProfileId("hestia-surface:wet_soil"),
      kind: "BasicLit",
      baseColor: { r: 0.105, g: 0.17, b: 0.145 },
      opacity: 1,
      doubleSided: false,
      wireframe: false,
      depthWrite: true
    })
  }),
  Object.freeze({
    key: "moss",
    profile: createMaterialProfile({
      id: materialProfileId("hestia-surface:moss"),
      kind: "BasicLit",
      baseColor: { r: 0.075, g: 0.245, b: 0.19 },
      opacity: 1,
      doubleSided: false,
      wireframe: false,
      depthWrite: true
    })
  }),
  Object.freeze({
    key: "dense_biological_surface",
    profile: createMaterialProfile({
      id: materialProfileId("hestia-surface:dense_biological_surface"),
      kind: "BasicLit",
      baseColor: { r: 0.045, g: 0.205, b: 0.22 },
      opacity: 1,
      doubleSided: false,
      wireframe: false,
      depthWrite: true
    })
  }),
  Object.freeze({
    key: "shallow_water_boundary",
    profile: createMaterialProfile({
      id: materialProfileId("hestia-surface:shallow_water_boundary"),
      kind: "BasicLit",
      baseColor: { r: 0.07, g: 0.34, b: 0.39 },
      opacity: 1,
      doubleSided: false,
      wireframe: false,
      depthWrite: true
    })
  })
] as const);

export const HESTIA_SURFACE_MATERIAL_PROFILES: readonly MaterialProfile[] = Object.freeze(
  MATERIAL_PROFILE_DEFINITIONS.map(({ profile }) => profile)
);

const MATERIAL_PROFILE_IDS = new Map<string, MaterialProfileId>(
  MATERIAL_PROFILE_DEFINITIONS.map(({ key, profile }) => [key, profile.id])
);

export const hestiaSurfaceMaterialProfileIdForKey = (materialKey: string): MaterialProfileId => {
  const profileId = MATERIAL_PROFILE_IDS.get(materialKey);
  if (profileId === undefined) throw new RangeError(`Unsupported Hestia surface material key: ${materialKey}`);
  return profileId;
};

const requireStableText = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value || value.length > 256) {
    throw new TypeError(`${field} must be a non-empty trimmed string with at most 256 characters`);
  }
  return value;
};

const requireCoordinate = (coordinate: Readonly<VoxelCoordinate>, field: string): Readonly<VoxelCoordinate> => {
  if (typeof coordinate !== "object" || coordinate === null || Array.isArray(coordinate)) {
    throw new TypeError(`${field} must be a coordinate`);
  }
  for (const axis of ["x", "y", "z"] as const) {
    if (!Number.isSafeInteger(coordinate[axis])) throw new RangeError(`${field}.${axis} must be a safe integer`);
  }
  return Object.freeze({ x: coordinate.x, y: coordinate.y, z: coordinate.z });
};

const compareAscii = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

const isInsideClearCorridor = (position: Readonly<{ x: number; z: number }>): boolean =>
  Math.abs(position.x) <= CLEAR_CORRIDOR_HALF_WIDTH_METERS
  && position.z >= CLEAR_CORRIDOR_MIN_Z_METERS
  && position.z <= CLEAR_CORRIDOR_MAX_Z_METERS;

const generationInput = (
  snapshot: Pick<HestiaSurfaceRegionPresentationSnapshot, "terrain" | "rootSeed" | "voxelSizeMeters">,
  coordinate: Readonly<VoxelCoordinate>
) => ({
  rootSeed: snapshot.rootSeed,
  bodyId: voxelBodyId(snapshot.terrain.bodyId),
  surfaceFrameId: surfaceFrameId(snapshot.terrain.surfaceFrameId),
  regionId: voxelRegionId(snapshot.terrain.regionId),
  brickCoordinate: coordinate,
  voxelSizeMeters: snapshot.voxelSizeMeters
});

const deriveScatter = (
  snapshot: Pick<HestiaSurfaceRegionPresentationSnapshot, "terrain" | "rootSeed" | "voxelSizeMeters" | "bricks">
): readonly Readonly<HestiaSurfaceScatterPresentationFact>[] => {
  const ids = new Set<string>();
  const facts = snapshot.bricks.flatMap((brick) => generateHestiaScatter(generationInput(snapshot, brick.coordinate)))
    .filter((record) => !isInsideClearCorridor(record.positionMeters))
    .map((record) => {
      if (ids.has(record.id)) throw new RangeError(`Duplicate Hestia scatter ID: ${record.id}`);
      ids.add(record.id);
      return Object.freeze({
        id: record.id,
        kind: record.kind,
        positionMeters: Object.freeze({ ...record.positionMeters }),
        yawRadians: record.yawRadians,
        uniformScale: record.uniformScale,
        surfaceMaterialId: record.surfaceMaterialId
      });
    })
    .sort((left, right) => compareAscii(left.id, right.id));
  return Object.freeze(facts);
};

const deriveWaterPatches = (
  snapshot: Pick<HestiaSurfaceRegionPresentationSnapshot, "terrain" | "rootSeed" | "voxelSizeMeters" | "bricks">
): readonly Readonly<HestiaSurfaceWaterPatchPresentationFact>[] => {
  const brickWidthMeters = VOXEL_BRICK_CELL_DIMENSIONS.x * snapshot.voxelSizeMeters;
  const brickDepthMeters = VOXEL_BRICK_CELL_DIMENSIONS.z * snapshot.voxelSizeMeters;
  const facts: Readonly<HestiaSurfaceWaterPatchPresentationFact>[] = [];

  for (const brick of snapshot.bricks) {
    const context = createHestiaFieldContext(generationInput(snapshot, brick.coordinate));
    const minX = brick.coordinate.x * brickWidthMeters;
    const minZ = brick.coordinate.z * brickDepthMeters;
    const columns = Math.floor(brickWidthMeters / WATER_PATCH_SPACING_METERS);
    const rows = Math.floor(brickDepthMeters / WATER_PATCH_SPACING_METERS);
    for (let zIndex = 0; zIndex < rows; zIndex += 1) {
      for (let xIndex = 0; xIndex < columns; xIndex += 1) {
        const x = minX + (xIndex + 0.5) * WATER_PATCH_SPACING_METERS;
        const z = minZ + (zIndex + 0.5) * WATER_PATCH_SPACING_METERS;
        const surface = sampleHestiaSurfaceFields(context, x, z);
        const shore = surface.surfaceHeight <= HESTIA_SEA_LEVEL_METERS + 0.35;
        const wetDepression = surface.wetDepression >= 0.72
          && surface.surfaceHeight <= HESTIA_SEA_LEVEL_METERS + 1.25;
        if (!shore && !wetDepression) continue;
        facts.push(Object.freeze({
          id: `hestia.water-patch.v1:${brick.brickId}:${xIndex}:${zIndex}`,
          positionMeters: Object.freeze({
            x,
            y: shore ? HESTIA_SEA_LEVEL_METERS + 0.055 : surface.surfaceHeight + 0.045,
            z
          }),
          uniformScale: WATER_PATCH_SCALE_METERS,
          source: shore ? "Shore" : "WetDepression"
        }));
      }
    }
  }

  return Object.freeze(facts.sort((left, right) => compareAscii(left.id, right.id)));
};

export const createHestiaSurfacePresentationSnapshot = (
  input: HestiaSurfaceRegionPresentationSnapshotInput
): Readonly<HestiaSurfaceRegionPresentationSnapshot> => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("Hestia surface presentation input must be an object");
  }
  const terrain = createSurfaceTerrainPresentationSnapshot(input.terrain);
  const rootSeed = requireStableText(input.rootSeed, "rootSeed");
  if (input.voxelSizeMeters !== 0.25 && input.voxelSizeMeters !== 0.5) {
    throw new RangeError("voxelSizeMeters must be 0.25 or 0.5");
  }
  if (!Array.isArray(input.bricks) || input.bricks.length > 4096) {
    throw new RangeError("bricks must be a bounded array");
  }

  const brickIds = new Set<string>();
  const bricks = input.bricks.map((brick, index) => {
    if (typeof brick !== "object" || brick === null || Array.isArray(brick)) {
      throw new TypeError(`bricks.${index} must be an object`);
    }
    const brickId = requireStableText(brick.brickId, `bricks.${index}.brickId`);
    if (brickIds.has(brickId)) throw new RangeError(`Duplicate brickId: ${brickId}`);
    brickIds.add(brickId);
    return Object.freeze({
      brickId,
      coordinate: requireCoordinate(brick.coordinate, `bricks.${index}.coordinate`),
      terrainHash: requireStableText(brick.terrainHash, `bricks.${index}.terrainHash`)
    });
  }).sort((left, right) => compareAscii(left.brickId, right.brickId));

  const visibleBrickIds = [...terrain.visibleBrickIds].sort(compareAscii);
  const suppliedBrickIds = bricks.map((brick) => brick.brickId);
  if (visibleBrickIds.length !== suppliedBrickIds.length
    || visibleBrickIds.some((brickId, index) => brickId !== suppliedBrickIds[index])) {
    throw new RangeError("bricks must cover every visible terrain brick exactly once");
  }

  const base = {
    terrain,
    rootSeed,
    voxelSizeMeters: input.voxelSizeMeters,
    bricks: Object.freeze(bricks)
  };
  const scatter = deriveScatter(base);
  const waterPatches = deriveWaterPatches(base);
  const presentationSignature = canonicalSignature({
    policy: PRESENTATION_POLICY_VERSION,
    terrain,
    rootSeed,
    voxelSizeMeters: input.voxelSizeMeters,
    bricks,
    materialProfiles: HESTIA_SURFACE_MATERIAL_PROFILES.map(materialProfileSignature),
    scatter,
    waterPatches
  });

  return Object.freeze({
    ...base,
    scatter,
    waterPatches,
    presentationSignature
  });
};
