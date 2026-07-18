import {
  canonicalAdaptiveJson,
  deepFreeze,
  hashAdaptiveCanonical,
  isDeepFrozen
} from "../../../voxel/adaptive";

export const canonicalHestiaVegetationJson = (value: unknown): string => canonicalAdaptiveJson(value);
export const hashHestiaVegetationCanonical = (value: unknown): string => hashAdaptiveCanonical(value);
export const freezeHestiaVegetationValue = <T>(value: T): T => deepFreeze(value);
export const isHestiaVegetationValueFrozen = (value: unknown): boolean => isDeepFrozen(value);

export const hestiaVegetationHashUnitFloat = (value: unknown): number => {
  const digest = hashAdaptiveCanonical(value);
  return Number.parseInt(digest.slice(-8), 16) / 0x1_0000_0000;
};
