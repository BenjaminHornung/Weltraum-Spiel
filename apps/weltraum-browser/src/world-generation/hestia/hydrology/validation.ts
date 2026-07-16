import type {
  HydrologyGlobalCoordinate,
  HydrologyGridDefinition,
  HydrologyInput,
  HydrologyParameters
} from "./contracts";
import {
  HESTIA_HYDROLOGY_D8_ORDER,
  HESTIA_HYDROLOGY_GENERATOR_VERSION_V2,
  HESTIA_HYDROLOGY_GRID_V2,
  HESTIA_HYDROLOGY_PARAMETERS_V2
} from "./preset";

const requireFinite = (value: number, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new RangeError(`${path} must be finite`);
  return value;
};

const requireStableText = (value: string, path: string): void => {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value || value.length > 256) {
    throw new TypeError(`${path} must be a non-empty canonical string of at most 256 characters`);
  }
};

const sameArray = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

export const assertFixedHydrologyGrid = (grid: HydrologyGridDefinition): void => {
  for (const key of Object.keys(HESTIA_HYDROLOGY_GRID_V2) as (keyof HydrologyGridDefinition)[]) {
    if (grid[key] !== HESTIA_HYDROLOGY_GRID_V2[key]) throw new RangeError(`grid.${key} must use the fixed V2 value`);
  }
};

export const assertAlignedHydrologyOrigin = (origin: HydrologyGlobalCoordinate): void => {
  if (!Number.isSafeInteger(origin.xQuanta) || !Number.isSafeInteger(origin.zQuanta)) {
    throw new RangeError("origin coordinates must be safe integer global quanta");
  }
  if (
    origin.xQuanta % HESTIA_HYDROLOGY_GRID_V2.originAlignmentQuanta !== 0
    || origin.zQuanta % HESTIA_HYDROLOGY_GRID_V2.originAlignmentQuanta !== 0
  ) {
    throw new RangeError("origin coordinates must be aligned to 16 global quanta");
  }
  const maximumOffset = (HESTIA_HYDROLOGY_GRID_V2.samplesX - 1) * HESTIA_HYDROLOGY_GRID_V2.originAlignmentQuanta;
  const maximumX = origin.xQuanta + maximumOffset;
  const maximumZ = origin.zQuanta + maximumOffset;
  if (!Number.isSafeInteger(maximumX) || !Number.isSafeInteger(maximumZ)) {
    throw new RangeError("dataset global coordinates exceed the safe integer range");
  }
  const converted = [
    origin.xQuanta * HESTIA_HYDROLOGY_GRID_V2.globalQuantumMeters,
    origin.zQuanta * HESTIA_HYDROLOGY_GRID_V2.globalQuantumMeters,
    maximumX * HESTIA_HYDROLOGY_GRID_V2.globalQuantumMeters,
    maximumZ * HESTIA_HYDROLOGY_GRID_V2.globalQuantumMeters
  ];
  if (!converted.every(Number.isFinite)) throw new RangeError("dataset metre coordinates must be finite");
};

export const assertHydrologyParameters = (parameters: HydrologyParameters, seaLevelMeters: number): void => {
  if (parameters.version !== HESTIA_HYDROLOGY_GENERATOR_VERSION_V2) {
    throw new RangeError("parameters.version is not supported by the V2 generator");
  }
  if (parameters.gridSpacingMeters !== HESTIA_HYDROLOGY_GRID_V2.gridSpacingMeters) {
    throw new RangeError("parameters.gridSpacingMeters must be 2 metres");
  }
  requireFinite(parameters.seaLevelMeters, "parameters.seaLevelMeters");
  requireFinite(seaLevelMeters, "seaLevelMeters");
  if (parameters.seaLevelMeters !== seaLevelMeters) {
    throw new RangeError("input seaLevelMeters must match the versioned parameters");
  }
  const exactNumericKeys = [
    "gridSpacingMeters", "seaLevelMeters", "minimumLakeDepthMeters", "riverSourceAccumulationCells",
    "minimumRiverDepthMeters", "maximumRiverDepthMeters", "minimumRiverHalfWidthMeters",
    "maximumRiverHalfWidthMeters", "channelBankSlope", "moistureFalloffMeters",
    "comparisonEpsilonMeters", "spillElevationQuantizationPerMeter", "carveDepthLog2Coefficient",
    "halfWidthSqrtCoefficient", "riverWaterSurfaceDepthFraction", "accumulationContributionPerCell"
  ] as const;
  for (const key of exactNumericKeys) {
    requireFinite(parameters[key], `parameters.${key}`);
    if (parameters[key] !== HESTIA_HYDROLOGY_PARAMETERS_V2[key]) {
      throw new RangeError(`parameters.${key} must use the exact V2 preset value`);
    }
  }
  if (!sameArray(parameters.d8DirectionOrder, HESTIA_HYDROLOGY_D8_ORDER)) {
    throw new RangeError("D8 direction order must be N,NE,E,SE,S,SW,W,NW");
  }
  if (!sameArray(parameters.priorityFloodKeyOrder, ["filledElevation", "globalZ", "globalX", "stableLinearIndex"])) {
    throw new RangeError("priority-flood key order is not the V2 canonical order");
  }
  const exactVersionKeys = [
    "moistureFormulaVersion", "channelFormulaVersion", "flatRoutingPolicyVersion", "bankBlendFormulaVersion"
  ] as const;
  for (const key of exactVersionKeys) {
    if (parameters[key] !== HESTIA_HYDROLOGY_PARAMETERS_V2[key]) {
      throw new RangeError(`parameters.${key} must use the exact V2 preset value`);
    }
  }
};

export const assertHydrologyInput = (input: HydrologyInput): void => {
  if (typeof input !== "object" || input === null) throw new TypeError("input must be an object");
  requireStableText(input.rootSeed, "rootSeed");
  requireStableText(input.bodyId, "bodyId");
  requireStableText(input.surfaceFrameId, "surfaceFrameId");
  requireStableText(input.datasetId, "datasetId");
  if (typeof input.terrainHeightSampler !== "function") throw new TypeError("terrainHeightSampler must be a function");
  assertFixedHydrologyGrid(input.grid ?? HESTIA_HYDROLOGY_GRID_V2);
  assertAlignedHydrologyOrigin(input.origin);
  assertHydrologyParameters(input.parameters, input.seaLevelMeters);
};

export const finiteDerived = (value: number, path: string): number => requireFinite(value, path);
