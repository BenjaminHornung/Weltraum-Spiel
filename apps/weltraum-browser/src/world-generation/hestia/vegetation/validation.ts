import {
  deepFreeze,
  globalQuantumCoordinate,
  requireCanonicalString,
  stableAuthorityId
} from "../../../voxel/adaptive";
import { structuralMaterialId } from "../../../voxel/structural";
import {
  HESTIA_VEGETATION_BIOME_IDS,
  HESTIA_VEGETATION_SPECIES_IDS,
  type HestiaVegetationBiomeId,
  type HestiaVegetationPopulationBudget,
  type HestiaVegetationRegionBounds,
  type HestiaVegetationSpeciesId
} from "./contracts";

export type HestiaVegetationErrorCode =
  | "InvalidSpeciesId"
  | "InvalidBiomeId"
  | "InvalidBounds"
  | "InvalidBudget"
  | "InvalidSample";

export class HestiaVegetationError extends Error {
  readonly code: HestiaVegetationErrorCode;
  readonly path: string;

  public constructor(code: HestiaVegetationErrorCode, path: string, message: string) {
    super(message);
    this.name = "HestiaVegetationError";
    this.code = code;
    this.path = path;
  }
}

export const vegetationFail = (
  code: HestiaVegetationErrorCode,
  path: string,
  message: string
): never => {
  throw new HestiaVegetationError(code, path, message);
};

export const hestiaVegetationSpeciesId = (value: unknown): HestiaVegetationSpeciesId => {
  if (typeof value !== "string" || !/^hestia\.[a-z]+(?:-[a-z]+)*\.v1$/.test(value)) {
    return vegetationFail("InvalidSpeciesId", "speciesId", "Species ID is malformed.");
  }
  requireCanonicalString(value, "speciesId");
  if (!(HESTIA_VEGETATION_SPECIES_IDS as readonly string[]).includes(value)) {
    return vegetationFail("InvalidSpeciesId", "speciesId", "Species ID is not in the exact V1 registry.");
  }
  return value as HestiaVegetationSpeciesId;
};

export const hestiaVegetationBiomeId = (value: unknown): HestiaVegetationBiomeId => {
  if (typeof value !== "string" || !(HESTIA_VEGETATION_BIOME_IDS as readonly string[]).includes(value)) {
    return vegetationFail("InvalidBiomeId", "biomeId", "Biome ID is not in the Hestia vegetation V1 set.");
  }
  requireCanonicalString(value, "biomeId");
  return value as HestiaVegetationBiomeId;
};

const safeCoordinate = (value: unknown, path: string): number => {
  if (typeof value !== "number") return vegetationFail("InvalidBounds", path, "Expected a number.");
  return globalQuantumCoordinate(value, path);
};

export const validateHestiaVegetationRegionBounds = (
  value: HestiaVegetationRegionBounds,
  path = "region"
): HestiaVegetationRegionBounds => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return vegetationFail("InvalidBounds", path, "Expected a region bounds object.");
  }
  const keys = Object.keys(value).sort();
  const expected = ["maxXQuanta", "maxZQuanta", "minXQuanta", "minZQuanta"];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return vegetationFail("InvalidBounds", path, "Region bounds must contain exactly min/max X/Z quanta.");
  }
  const result = {
    minXQuanta: safeCoordinate(value.minXQuanta, `${path}/minXQuanta`),
    maxXQuanta: safeCoordinate(value.maxXQuanta, `${path}/maxXQuanta`),
    minZQuanta: safeCoordinate(value.minZQuanta, `${path}/minZQuanta`),
    maxZQuanta: safeCoordinate(value.maxZQuanta, `${path}/maxZQuanta`)
  };
  if (result.minXQuanta >= result.maxXQuanta || result.minZQuanta >= result.maxZQuanta) {
    return vegetationFail("InvalidBounds", path, "Region bounds must be non-empty and half-open.");
  }
  return deepFreeze(result);
};

export const validateHestiaVegetationBudget = (
  value: HestiaVegetationPopulationBudget
): HestiaVegetationPopulationBudget => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return vegetationFail("InvalidBudget", "budget", "Expected a budget object.");
  }
  if (!Number.isSafeInteger(value.maxInstances) || value.maxInstances < 0 || Object.is(value.maxInstances, -0)) {
    return vegetationFail("InvalidBudget", "budget/maxInstances", "maxInstances must be a non-negative safe integer.");
  }
  if (!Number.isFinite(value.maxCrownAreaSquareMeters) || value.maxCrownAreaSquareMeters < 0) {
    return vegetationFail("InvalidBudget", "budget/maxCrownAreaSquareMeters", "Crown-area budget must be finite and non-negative.");
  }
  return deepFreeze({
    maxInstances: value.maxInstances,
    maxCrownAreaSquareMeters: Object.is(value.maxCrownAreaSquareMeters, -0) ? 0 : value.maxCrownAreaSquareMeters
  });
};

export const validateHestiaVegetationRootMaterialId = (value: unknown) =>
  structuralMaterialId(value, "terrainSample/rootMaterialId", true);

export const validateHestiaVegetationAuthorityIdentity = (value: unknown, path: string): string => {
  if (typeof value !== "string") return vegetationFail("InvalidSample", path, "Expected a stable string identity.");
  return stableAuthorityId(value, path);
};
