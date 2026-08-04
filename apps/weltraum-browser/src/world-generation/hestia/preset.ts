import {
  editRevision,
  generatorVersion,
  HESTIA_MATERIAL_REGISTRY_V1,
  sourceRevision,
  type EditRevision,
  type GeneratorVersion,
  type SourceRevision,
  type SurfaceFrameId,
  type VoxelBodyId,
  type VoxelCoordinate,
  type VoxelMaterialId,
  type VoxelMaterialSemantic,
  type VoxelRegionId
} from "../../voxel";

export const HESTIA_PRESET_ID = "hestia.nebelwald-archipelago.preview.v1" as const;
export const HESTIA_GENERATOR_VERSION_V1: GeneratorVersion = generatorVersion("hestia.microvoxel.generator.v1");
export const HESTIA_SEED_NAMESPACE_V1 = "hestia.seed.v1" as const;
export const HESTIA_COAST_LUSH_PRESET_ID = "hestia.coast-lush.surface-play.preview.v1" as const;
export const HESTIA_GENERATOR_VERSION_COAST_LUSH_V1: GeneratorVersion =
  generatorVersion("hestia.microvoxel.generator.coast-lush.v1");
export const HESTIA_SEED_NAMESPACE_COAST_LUSH_V1 = "hestia.seed.coast-lush.v1" as const;
export const HESTIA_SOURCE_REVISION_V1: SourceRevision = sourceRevision(0);
export const HESTIA_EDIT_REVISION_V1: EditRevision = editRevision(0);
export const HESTIA_VOXEL_SIZES_METERS = Object.freeze([0.25, 0.5] as const);

export type HestiaVoxelSizeMeters = (typeof HESTIA_VOXEL_SIZES_METERS)[number];
export type HestiaGeneratorProfile = typeof HESTIA_PRESET_ID | typeof HESTIA_COAST_LUSH_PRESET_ID;

export interface HestiaGeneratorIdentity {
  readonly profile: HestiaGeneratorProfile;
  readonly presetId: HestiaGeneratorProfile;
  readonly generatorVersion: GeneratorVersion;
  readonly seedNamespace: typeof HESTIA_SEED_NAMESPACE_V1 | typeof HESTIA_SEED_NAMESPACE_COAST_LUSH_V1;
}

/** The exact canonical inputs permitted to influence Hestia V1 generation. */
export interface HestiaFieldIdentityInput {
  /** Absent keeps all existing callers on the byte-identical V1 path. */
  readonly profile?: HestiaGeneratorProfile;
  readonly rootSeed: string;
  readonly bodyId: VoxelBodyId;
  readonly surfaceFrameId: SurfaceFrameId;
  readonly regionId: VoxelRegionId;
  readonly voxelSizeMeters: HestiaVoxelSizeMeters;
}

export interface HestiaGenerationInput extends HestiaFieldIdentityInput {
  readonly brickCoordinate: VoxelCoordinate;
}

export const resolveHestiaGeneratorIdentity = (
  profile: HestiaGeneratorProfile | undefined
): HestiaGeneratorIdentity => {
  if (
    profile !== undefined
    && profile !== HESTIA_PRESET_ID
    && profile !== HESTIA_COAST_LUSH_PRESET_ID
  ) {
    throw new TypeError("profile must be an approved Hestia generator identity");
  }
  return profile === HESTIA_COAST_LUSH_PRESET_ID ? {
      profile,
      presetId: profile,
      generatorVersion: HESTIA_GENERATOR_VERSION_COAST_LUSH_V1,
      seedNamespace: HESTIA_SEED_NAMESPACE_COAST_LUSH_V1
    }
  : {
      profile: HESTIA_PRESET_ID,
      presetId: HESTIA_PRESET_ID,
      generatorVersion: HESTIA_GENERATOR_VERSION_V1,
      seedNamespace: HESTIA_SEED_NAMESPACE_V1
    };
};

const canonicalMaterialId = (semantic: VoxelMaterialSemantic): VoxelMaterialId => {
  const matches = HESTIA_MATERIAL_REGISTRY_V1.definitions.filter(
    (definition) => definition.semantic === semantic
  );
  if (matches.length !== 1) {
    throw new TypeError(`Canonical Hestia V1 registry must define ${semantic} exactly once`);
  }
  return matches[0]!.id;
};

/** Stable byte IDs consumed from the validated canonical VoxelBrick V1 registry. */
export const HESTIA_MATERIAL_IDS: Readonly<{
  SolidRock: VoxelMaterialId;
  WetSoil: VoxelMaterialId;
  MossCover: VoxelMaterialId;
  DenseBiologicalSurface: VoxelMaterialId;
  ShallowWaterBoundary: VoxelMaterialId;
}> = Object.freeze({
  SolidRock: canonicalMaterialId("SolidRock"),
  WetSoil: canonicalMaterialId("WetSoil"),
  MossCover: canonicalMaterialId("MossCover"),
  DenseBiologicalSurface: canonicalMaterialId("DenseBiologicalSurface"),
  ShallowWaterBoundary: canonicalMaterialId("ShallowWaterBoundary")
});

export const HESTIA_SEA_LEVEL_METERS = 0 as const;
export const HESTIA_SCATTER_SPACING_METERS = 2 as const;
