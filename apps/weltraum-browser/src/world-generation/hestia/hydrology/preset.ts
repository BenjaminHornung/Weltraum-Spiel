import {
  hydrologyDatasetRevision,
  type D8Direction,
  type HydrologyGridDefinition,
  type HydrologyParameters
} from "./contracts";

export const HESTIA_HYDROLOGY_GENERATOR_VERSION_V2 = hydrologyDatasetRevision("hestia.hydrology.generator.v2");

export const HESTIA_HYDROLOGY_GRID_V2: HydrologyGridDefinition = Object.freeze({
  cellsX: 128,
  cellsZ: 128,
  samplesX: 129,
  samplesZ: 129,
  gridSpacingMeters: 2,
  extentXMeters: 256,
  extentZMeters: 256,
  globalQuantumMeters: 0.125,
  originAlignmentQuanta: 16
});

export const HESTIA_HYDROLOGY_D8_ORDER: readonly D8Direction[] = Object.freeze([
  "N", "NE", "E", "SE", "S", "SW", "W", "NW"
]);

export const HESTIA_HYDROLOGY_D8_DIAGONAL_DISTANCE_MULTIPLIER = Math.SQRT2;

/**
 * Complete V2 numeric policy. Formula coefficients, comparison epsilon,
 * quantization, ordering and contribution weight are versioned here so the
 * solver contains no anonymous hydrology tuning constants.
 */
export const HESTIA_HYDROLOGY_PARAMETERS_V2: HydrologyParameters = Object.freeze({
  version: HESTIA_HYDROLOGY_GENERATOR_VERSION_V2,
  gridSpacingMeters: 2,
  seaLevelMeters: 0,
  minimumLakeDepthMeters: 0.15,
  riverSourceAccumulationCells: 48,
  minimumRiverDepthMeters: 0.20,
  maximumRiverDepthMeters: 2.50,
  minimumRiverHalfWidthMeters: 0.50,
  maximumRiverHalfWidthMeters: 4.00,
  channelBankSlope: 0.65,
  moistureFalloffMeters: 18,
  comparisonEpsilonMeters: 1e-9,
  spillElevationQuantizationPerMeter: 1_000_000,
  carveDepthLog2Coefficient: 0.35,
  halfWidthSqrtCoefficient: 0.60,
  riverWaterSurfaceDepthFraction: 0.50,
  d8DirectionOrder: HESTIA_HYDROLOGY_D8_ORDER,
  priorityFloodKeyOrder: Object.freeze(["filledElevation", "globalZ", "globalX", "stableLinearIndex"] as const),
  accumulationContributionPerCell: 1,
  moistureFormulaVersion: "linear-distance-plus-depression-v1",
  channelFormulaVersion: "log2-sqrt-v1",
  flatRoutingPolicyVersion: "priority-flood-parent-v1",
  bankBlendFormulaVersion: "linear-slope-v1"
});

export const HESTIA_HYDROLOGY_MEMORY_BUDGET_BYTES_V2 = 8 * 1024 * 1024;
