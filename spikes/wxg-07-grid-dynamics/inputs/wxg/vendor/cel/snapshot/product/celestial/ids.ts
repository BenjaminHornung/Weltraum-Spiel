import { failCelestial } from "./errors";

declare const celestialBodyIdBrand: unique symbol;
declare const celestialCatalogIdBrand: unique symbol;

export type CelestialBodyId = string & { readonly [celestialBodyIdBrand]: "CelestialBodyId" };
export type CelestialCatalogId = string & { readonly [celestialCatalogIdBrand]: "CelestialCatalogId" };

const stableCelestialIdPattern = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)*$/;

export const isStableCelestialId = (value: unknown): value is string =>
  typeof value === "string" && stableCelestialIdPattern.test(value);

const createStableId = (value: unknown, path: string, label: string): string => {
  if (!isStableCelestialId(value)) {
    return failCelestial(
      "InvalidId",
      path,
      `${label} must be lowercase ASCII with dot- or underscore-separated alphanumeric segments.`
    );
  }
  return value;
};

export const createCelestialBodyId = (value: unknown, path = "/bodyId"): CelestialBodyId =>
  createStableId(value, path, "Celestial body ID") as CelestialBodyId;

export const createCelestialCatalogId = (value: unknown, path = "/catalogId"): CelestialCatalogId =>
  createStableId(value, path, "Celestial catalog ID") as CelestialCatalogId;
