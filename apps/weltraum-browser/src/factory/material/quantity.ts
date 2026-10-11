import type { FactoryCatalog, FactoryItem, FactoryQuantityBasis } from "../contracts";

export class FactoryMaterialError extends Error {
  constructor(public readonly reason: string) { super(reason); this.name = "FactoryMaterialError"; }
}
export function rejectMaterial(reason: string): never { throw new FactoryMaterialError(reason); }

export interface ExactAmount {
  readonly itemId: string;
  readonly resourceId: FactoryItem["resourceId"];
  readonly quantityBasis: FactoryQuantityBasis;
  readonly quantityUnits: number;
  readonly massMg: number;
}

export const safeWhole = (value: number, label: string, zeroAllowed = false): number => {
  if (!Number.isSafeInteger(value) || value < (zeroAllowed ? 0 : 1)) rejectMaterial(`Invalid${label}`);
  return value;
};
export const safeBigIntNumber = (value: bigint, label: string): number => {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) rejectMaterial(`${label}Overflow`);
  return Number(value);
};
export const findFactoryItem = (catalog: FactoryCatalog, itemId: string): FactoryItem =>
  catalog.items.find((entry) => entry.sourceId === itemId) ?? rejectMaterial("UnknownFactoryItem");

/** Quantities already use catalog units. Foreign kg/fractional units must be explicitly rejected upstream. */
export const validateFactoryAmount = (itemId: string, quantity: number, catalog: FactoryCatalog): ExactAmount => {
  safeWhole(quantity, "Quantity");
  const item = findFactoryItem(catalog, itemId);
  safeWhole(item.massMgPerUnit, "UnitMass");
  const profile = item.volumeProfile;
  if (profile.kind === "unknown") rejectMaterial("UnknownVolumeProfile");
  safeWhole(profile.numeratorMm3, "VolumeNumerator");
  safeWhole(profile.denominatorUnits, "VolumeDenominator");
  if (!profile.sourceRefs.length) rejectMaterial("UnboundVolumeProfile");
  const resource = catalog.resources.resources.find((entry) => entry.resourceId === item.resourceId);
  if (!resource || resource.massPerUnitKg !== item.massMgPerUnit / 1_000_000 || resource.volumePerUnitM3 !== profile.numeratorMm3 / profile.denominatorUnits / 1_000_000_000) rejectMaterial("ResourceDefinitionMismatch");
  if ((item.quantityBasis === "piece") !== (resource.stackRule.kind !== "Bulk")) rejectMaterial("ResourceQuantityBasisMismatch");
  const massMg = safeBigIntNumber(BigInt(quantity) * BigInt(item.massMgPerUnit), "Mass");
  if (BigInt(quantity) * BigInt(profile.numeratorMm3) > BigInt(Number.MAX_SAFE_INTEGER) * BigInt(profile.denominatorUnits)) rejectMaterial("VolumeOverflow");
  return Object.freeze({ itemId, resourceId: item.resourceId, quantityBasis: item.quantityBasis, quantityUnits: quantity, massMg });
};

/** Exact decimal admission of existing Resources kg/m³ limits; this never rounds floating point values. */
export const exactScaledLimit = (value: number, decimalPlaces: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0) rejectMaterial(`Invalid${label}`);
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(value));
  if (!match) rejectMaterial(`Invalid${label}`);
  const fraction = match[2] ?? "";
  const exponent = Number(match[3] ?? 0) + decimalPlaces - fraction.length;
  let units = BigInt(match[1] + fraction);
  if (exponent >= 0) units *= 10n ** BigInt(exponent);
  else {
    const divisor = 10n ** BigInt(-exponent);
    if (units % divisor !== 0n) rejectMaterial(`NonQuantized${label}`);
    units /= divisor;
  }
  return safeBigIntNumber(units, label);
};
