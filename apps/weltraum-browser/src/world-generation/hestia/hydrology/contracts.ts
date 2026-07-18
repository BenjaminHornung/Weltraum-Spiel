declare const hydrologyDatasetIdBrand: unique symbol;
declare const hydrologyRevisionBrand: unique symbol;
declare const waterBodyIdBrand: unique symbol;
declare const riverSegmentIdBrand: unique symbol;

export type HestiaHydrologyDatasetId = string & { readonly [hydrologyDatasetIdBrand]: true };
export type HydrologyDatasetRevision = string & { readonly [hydrologyRevisionBrand]: true };
export type WaterBodyId = string & { readonly [waterBodyIdBrand]: true };
export type RiverSegmentId = string & { readonly [riverSegmentIdBrand]: true };

export interface HydrologyGlobalCoordinate {
  /** Exact global coordinate in 0.125 metre quanta. */
  readonly xQuanta: number;
  /** Exact global coordinate in 0.125 metre quanta. */
  readonly zQuanta: number;
}

export interface HydrologyCellCoordinate extends HydrologyGlobalCoordinate {
  readonly xMeters: number;
  readonly zMeters: number;
}

export interface HydrologyGridDefinition {
  readonly cellsX: 128;
  readonly cellsZ: 128;
  readonly samplesX: 129;
  readonly samplesZ: 129;
  readonly gridSpacingMeters: 2;
  readonly extentXMeters: 256;
  readonly extentZMeters: 256;
  readonly globalQuantumMeters: 0.125;
  readonly originAlignmentQuanta: 16;
}

export interface HydrologyParameters {
  readonly version: HydrologyDatasetRevision;
  readonly gridSpacingMeters: 2;
  readonly seaLevelMeters: number;
  readonly minimumLakeDepthMeters: number;
  readonly riverSourceAccumulationCells: number;
  readonly minimumRiverDepthMeters: number;
  readonly maximumRiverDepthMeters: number;
  readonly minimumRiverHalfWidthMeters: number;
  readonly maximumRiverHalfWidthMeters: number;
  readonly channelBankSlope: number;
  readonly moistureFalloffMeters: number;
  /** Numeric equality and dry-water comparison policy. */
  readonly comparisonEpsilonMeters: number;
  /** Spill elevations are quantized to this scale when stable IDs are derived. */
  readonly spillElevationQuantizationPerMeter: number;
  /** Named coefficient in the V2 carve-depth equation. */
  readonly carveDepthLog2Coefficient: number;
  /** Named coefficient in the V2 half-width equation. */
  readonly halfWidthSqrtCoefficient: number;
  readonly riverWaterSurfaceDepthFraction: number;
  readonly d8DirectionOrder: readonly D8Direction[];
  readonly priorityFloodKeyOrder: readonly ["filledElevation", "globalZ", "globalX", "stableLinearIndex"];
  readonly accumulationContributionPerCell: 1;
  readonly moistureFormulaVersion: "linear-distance-plus-depression-v1";
  readonly channelFormulaVersion: "log2-sqrt-v1";
  readonly flatRoutingPolicyVersion: "priority-flood-parent-v1";
  readonly bankBlendFormulaVersion: "linear-slope-v1";
}

export type TerrainHeightSampler = (globalXMeters: number, globalZMeters: number) => number;

export interface HydrologyInput {
  readonly rootSeed: string;
  readonly bodyId: string;
  readonly surfaceFrameId: string;
  readonly datasetId: HestiaHydrologyDatasetId;
  readonly origin: HydrologyGlobalCoordinate;
  readonly seaLevelMeters: number;
  readonly parameters: HydrologyParameters;
  readonly terrainHeightSampler: TerrainHeightSampler;
  readonly grid?: HydrologyGridDefinition;
}

export type D8Direction = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
export type HydrologyWaterKind = "Ocean" | "Lake";
export type RiverTermination = "Ocean" | "Lake" | "Boundary" | "Confluence";

export interface HydrologySample {
  readonly coordinate: HydrologyCellCoordinate;
  readonly stableLinearIndex: number;
  readonly terrainHeight: number;
  readonly filledElevation: number;
  readonly depressionDepth: number;
  readonly spillElevation: number;
  readonly basinId: string | null;
  readonly isOcean: boolean;
  readonly waterBodyId: WaterBodyId | null;
  readonly waterSurfaceHeight: number | null;
}

export interface HydrologyCell extends HydrologySample {
  readonly flowDirection: D8Direction | null;
  readonly downstreamCellIndex: number | null;
  readonly isBoundaryOutlet: boolean;
  readonly accumulation: number;
  readonly riverSegmentIds: readonly RiverSegmentId[];
}

export interface WaterBody {
  readonly id: WaterBodyId;
  readonly kind: HydrologyWaterKind;
  readonly minimumCoordinate: HydrologyCellCoordinate;
  readonly spillElevation: number;
  readonly waterLevel: number;
  readonly sampleIndices: readonly number[];
  readonly cellIndices: readonly number[];
}

export interface RiverSegmentPoint {
  readonly cellIndex: number;
  readonly coordinate: HydrologyCellCoordinate;
  readonly accumulation: number;
  readonly carveDepth: number;
  readonly halfWidth: number;
  readonly waterSurfaceHeight: number;
}

export interface RiverSegment {
  readonly id: RiverSegmentId;
  readonly sourceCoordinate: HydrologyCellCoordinate;
  readonly points: readonly RiverSegmentPoint[];
  readonly termination: RiverTermination;
  readonly terminalWaterBodyId: WaterBodyId | null;
}

export interface HydrologyTerrainAdjustment {
  readonly channelDepth: number;
  readonly channelDistance: number;
  readonly bankBlend: number;
  readonly adjustedTerrainHeight: number;
  readonly waterSurfaceHeight?: number;
  readonly waterBodyId?: WaterBodyId;
  readonly moisture: number;
}

export interface HydrologyMemoryBudgetEstimate {
  readonly estimatorVersion: "hydrology-retained-representation-v1";
  readonly snapshotGraphBytes: number;
  readonly canonicalBytes: number;
  readonly totalBytes: number;
  readonly budgetBytes: number;
  readonly withinBudget: boolean;
}

export interface HydrologySnapshot {
  readonly generatorVersion: HydrologyDatasetRevision;
  readonly rootSeed: string;
  readonly bodyId: string;
  readonly surfaceFrameId: string;
  readonly datasetId: HestiaHydrologyDatasetId;
  readonly origin: HydrologyGlobalCoordinate;
  readonly grid: HydrologyGridDefinition;
  readonly parameters: HydrologyParameters;
  readonly samples: readonly HydrologySample[];
  readonly cells: readonly HydrologyCell[];
  readonly waterBodies: readonly WaterBody[];
  readonly riverSegments: readonly RiverSegment[];
  /** Immutable canonical UTF-8 bytes, packed two per string code unit for alias-free retained storage. */
  readonly canonicalBytes: string;
  readonly contentHash: `fnv1a32:${string}`;
}

const requireStableText = (value: string, name: string): string => {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value || value.length > 256) {
    throw new TypeError(`${name} must be a non-empty canonical string of at most 256 characters`);
  }
  return value;
};

export const hestiaHydrologyDatasetId = (value: string): HestiaHydrologyDatasetId =>
  requireStableText(value, "datasetId") as HestiaHydrologyDatasetId;

export const hydrologyDatasetId = hestiaHydrologyDatasetId;

export const hydrologyDatasetRevision = (value: string): HydrologyDatasetRevision =>
  requireStableText(value, "revision") as HydrologyDatasetRevision;

export const waterBodyId = (value: string): WaterBodyId =>
  requireStableText(value, "waterBodyId") as WaterBodyId;

export const riverSegmentId = (value: string): RiverSegmentId =>
  requireStableText(value, "riverSegmentId") as RiverSegmentId;
