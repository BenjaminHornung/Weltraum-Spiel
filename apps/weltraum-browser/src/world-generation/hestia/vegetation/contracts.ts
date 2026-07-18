import type { VoxelMaterialId } from "../../../voxel";
import type { GlobalQuantumCoordinate } from "../../../voxel/adaptive";
import type {
  StructuralAcceptedCommandResult,
  StructuralComponent,
  StructuralComponentClassification,
  StructuralDestructionCommand,
  StructuralMassProperties,
  StructuralMaterialId,
  StructuralPartId
} from "../../../voxel/structural";
import type { HydrologyTerrainAdjustment, HydrologyWaterKind } from "../hydrology";

export const HESTIA_VEGETATION_SCHEMA_VERSION = "hestia-vegetation-v1" as const;
export const HESTIA_VEGETATION_GRID_QUANTA = 48 as const;
export const HESTIA_VEGETATION_GRID_METERS = 6 as const;
export const HESTIA_VEGETATION_MAX_JITTER_QUANTA = 16 as const;
export const HESTIA_VEGETATION_MAX_JITTER_METERS = 2 as const;
export const HESTIA_UMBRELLA_TREE_GRAPH_SCHEMA_VERSION = "hestia-umbrella-tree-graph-v1" as const;
export const HESTIA_VEGETATION_TRUNK_CUT_SCHEMA_VERSION = "hestia-vegetation-trunk-cut-v1" as const;

export const HESTIA_VEGETATION_SPECIES_IDS = Object.freeze([
  "hestia.umbrella-tree.v1",
  "hestia.mist-sprout.v1",
  "hestia.luminous-cap.v1"
] as const);

export type HestiaVegetationSpeciesId = (typeof HESTIA_VEGETATION_SPECIES_IDS)[number];

export const HESTIA_VEGETATION_BIOME_IDS = Object.freeze([
  "hestia.biome.mist-forest.v1",
  "hestia.biome.wetland.v1",
  "hestia.biome.biological-glade.v1"
] as const);

export type HestiaVegetationBiomeId = (typeof HESTIA_VEGETATION_BIOME_IDS)[number];

export interface HestiaVegetationSpeciesDefinition {
  readonly id: HestiaVegetationSpeciesId;
  readonly maximumSlopeDegrees: number;
  readonly minimumMoisture: number;
  readonly maximumMoisture: number;
  readonly minimumRiverDistanceMeters: number;
  readonly maximumRiverDistanceMeters: number;
  readonly minimumWaterDistanceMeters: number;
  readonly maximumWaterDistanceMeters: number;
  readonly crownRadiusMeters: number;
  readonly allowedMaterialIds: readonly VoxelMaterialId[];
  readonly allowedBiomeIds: readonly HestiaVegetationBiomeId[];
}

export interface HestiaVegetationRegionBounds {
  readonly minXQuanta: number;
  readonly maxXQuanta: number;
  readonly minZQuanta: number;
  readonly maxZQuanta: number;
}

export interface HestiaVegetationCandidateRequest {
  readonly rootSeed: string;
  readonly bodyId: string;
  readonly surfaceFrameId: string;
  readonly regions: readonly HestiaVegetationRegionBounds[];
  readonly speciesIds?: readonly (HestiaVegetationSpeciesId | string)[];
}

export interface HestiaVegetationCandidate {
  readonly schemaVersion: typeof HESTIA_VEGETATION_SCHEMA_VERSION;
  readonly candidateId: string;
  readonly speciesId: HestiaVegetationSpeciesId;
  readonly anchorQuanta: Readonly<{
    x: GlobalQuantumCoordinate;
    z: GlobalQuantumCoordinate;
  }>;
  readonly jitterQuanta: Readonly<{
    x: number;
    z: number;
  }>;
  readonly positionQuanta: Readonly<{
    x: GlobalQuantumCoordinate;
    z: GlobalQuantumCoordinate;
  }>;
  readonly positionMeters: Readonly<{
    x: number;
    z: number;
  }>;
  readonly candidateHash: string;
}

export interface HestiaVegetationCandidateSet {
  readonly schemaVersion: typeof HESTIA_VEGETATION_SCHEMA_VERSION;
  readonly candidates: readonly HestiaVegetationCandidate[];
  readonly contentHash: string;
}

export type HestiaVegetationWaterKind = HydrologyWaterKind | "River" | null;

export interface HestiaVegetationHydrologySample extends HydrologyTerrainAdjustment {
  readonly waterKind: HestiaVegetationWaterKind;
  readonly distanceToWaterMeters: number;
}

export type HestiaVegetationHydrologySampler = (
  globalXMeters: number,
  globalZMeters: number
) => HestiaVegetationHydrologySample | null;

export interface HestiaVegetationTerrainQuery {
  readonly xMeters: number;
  readonly zMeters: number;
  readonly terrainHeightMeters: number;
  readonly rootQuantum: Readonly<{
    x: GlobalQuantumCoordinate;
    y: GlobalQuantumCoordinate;
    z: GlobalQuantumCoordinate;
  }>;
}

export interface HestiaVegetationTerrainSample {
  readonly materialId: VoxelMaterialId;
  readonly biomeId: HestiaVegetationBiomeId | string;
  readonly rootMaterialId: StructuralMaterialId | number;
}

export type HestiaVegetationTerrainSampler = (
  query: HestiaVegetationTerrainQuery
) => HestiaVegetationTerrainSample | null;

export interface HestiaVegetationPopulationBudget {
  readonly maxInstances: number;
  readonly maxCrownAreaSquareMeters: number;
}

export interface HestiaVegetationPopulationRequest extends HestiaVegetationCandidateRequest {
  readonly hydrologySampler: HestiaVegetationHydrologySampler;
  readonly terrainSampler: HestiaVegetationTerrainSampler;
  readonly budget: HestiaVegetationPopulationBudget;
}

export interface HestiaVegetationInstance {
  readonly schemaVersion: typeof HESTIA_VEGETATION_SCHEMA_VERSION;
  readonly instanceId: string;
  readonly speciesId: HestiaVegetationSpeciesId;
  readonly candidateId: string;
  readonly candidateHash: string;
  readonly positionMeters: Readonly<{ x: number; y: number; z: number }>;
  readonly rootQuantum: Readonly<{
    x: GlobalQuantumCoordinate;
    y: GlobalQuantumCoordinate;
    z: GlobalQuantumCoordinate;
  }>;
  readonly slopeDegrees: number;
  readonly moisture: number;
  readonly materialId: VoxelMaterialId;
  readonly biomeId: HestiaVegetationBiomeId;
  readonly rootMaterialId: StructuralMaterialId;
  readonly crownRadiusMeters: number;
  readonly instanceHash: string;
}

export type HestiaVegetationPlacementRejectionReason =
  | "MissingTerrain"
  | "SlopeOutOfRange"
  | "OceanOrLake"
  | "RiverDistanceOutOfRange"
  | "WaterDistanceOutOfRange"
  | "MoistureOutOfRange"
  | "MaterialNotAllowed"
  | "BiomeNotAllowed"
  | "AirRoot"
  | "CrownSpacing"
  | "BudgetExceeded";

export interface HestiaVegetationPlacementRejection {
  readonly candidateId: string;
  readonly candidateHash: string;
  readonly reason: HestiaVegetationPlacementRejectionReason;
}

export interface HestiaVegetationPopulation {
  readonly schemaVersion: typeof HESTIA_VEGETATION_SCHEMA_VERSION;
  readonly candidateSetHash: string;
  readonly instances: readonly HestiaVegetationInstance[];
  readonly rejections: readonly HestiaVegetationPlacementRejection[];
  readonly usedCrownAreaSquareMeters: number;
  readonly populationHash: string;
}

export type HestiaVegetationMaterialRole = "root" | "wood" | "canopy";
export type HestiaVegetationProxyShape = "capsule" | "ellipsoid" | "disc";

export interface HestiaVegetationProxyPart {
  readonly partId: StructuralPartId;
  readonly role: "root" | "trunk" | "branch" | "canopy" | "stem" | "cap" | "leaf";
  readonly materialRole: HestiaVegetationMaterialRole;
  readonly shape: HestiaVegetationProxyShape;
  readonly centerMeters: Readonly<{ x: number; y: number; z: number }>;
  readonly dimensionsMeters: Readonly<{ x: number; y: number; z: number }>;
  readonly yawRadians: number;
  readonly pitchRadians: number;
  /** Phase-2 graph seams. Null until a full structural graph owns the identity. */
  readonly sourceNodeId: string | null;
  readonly sourceSegmentId: string | null;
}

export interface HestiaVegetationProxy {
  readonly schemaVersion: typeof HESTIA_VEGETATION_SCHEMA_VERSION;
  readonly proxyId: string;
  readonly instanceId: string;
  readonly speciesId: HestiaVegetationSpeciesId;
  readonly parts: readonly HestiaVegetationProxyPart[];
  readonly contentHash: string;
}

export type HestiaUmbrellaTreeNodeRole =
  | "root-anchor"
  | "root-junction"
  | "trunk-crown"
  | "primary-tip"
  | "secondary-tip"
  | "canopy-center";

export type HestiaUmbrellaTreeSegmentRole = "root" | "trunk" | "primary" | "secondary" | "canopy";

export interface HestiaUmbrellaTreeNode {
  readonly nodeId: string;
  readonly parentNodeId: string | null;
  readonly role: HestiaUmbrellaTreeNodeRole;
  readonly positionMeters: Readonly<{ x: number; y: number; z: number }>;
}

export interface HestiaUmbrellaTreeSegment {
  readonly segmentId: string;
  readonly parentNodeId: string;
  readonly childNodeId: string;
  readonly role: HestiaUmbrellaTreeSegmentRole;
  readonly materialRole: HestiaVegetationMaterialRole;
  readonly shape: "capsule" | "ellipsoid";
  readonly startRadiusMeters: number;
  readonly endRadiusMeters: number;
  readonly lobeRadiiMeters: Readonly<{ x: number; y: number; z: number }> | null;
}

export interface HestiaUmbrellaTreeGraphBudget {
  readonly maxSecondaryBranches: number;
  readonly maxCanopyLobes: number;
}

export interface HestiaUmbrellaTreeGraph {
  readonly schemaVersion: typeof HESTIA_UMBRELLA_TREE_GRAPH_SCHEMA_VERSION;
  readonly graphId: string;
  readonly instanceId: string;
  readonly rootNodeId: string;
  readonly trunkHeightMeters: number;
  readonly baseRadiusMeters: number;
  readonly primaryBranchCount: number;
  readonly secondaryBranchCount: number;
  readonly canopyLobeCount: number;
  readonly nodes: readonly HestiaUmbrellaTreeNode[];
  readonly segments: readonly HestiaUmbrellaTreeSegment[];
  readonly contentHash: string;
}

export interface HestiaVegetationQuantumBoundsInput {
  readonly min: Readonly<{ x: number; y: number; z: number }>;
  readonly max: Readonly<{ x: number; y: number; z: number }>;
}

export interface HestiaVegetationTrunkCutFacts {
  readonly schemaVersion: typeof HESTIA_VEGETATION_TRUNK_CUT_SCHEMA_VERSION;
  readonly instanceId: string;
  readonly command: StructuralDestructionCommand;
  readonly commandResult: StructuralAcceptedCommandResult;
  readonly classification: StructuralComponentClassification;
  readonly detachedComponent: StructuralComponent;
  readonly detachedMassProperties: StructuralMassProperties;
  readonly contentHash: string;
}
