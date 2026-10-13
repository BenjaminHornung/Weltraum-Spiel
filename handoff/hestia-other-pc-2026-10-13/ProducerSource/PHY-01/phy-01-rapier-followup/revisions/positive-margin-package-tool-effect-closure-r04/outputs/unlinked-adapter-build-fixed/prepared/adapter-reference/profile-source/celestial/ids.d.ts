declare const celestialBodyIdBrand: unique symbol;
declare const celestialCatalogIdBrand: unique symbol;
export type CelestialBodyId = string & {
    readonly [celestialBodyIdBrand]: "CelestialBodyId";
};
export type CelestialCatalogId = string & {
    readonly [celestialCatalogIdBrand]: "CelestialCatalogId";
};
export declare const isStableCelestialId: (value: unknown) => value is string;
export declare const createCelestialBodyId: (value: unknown, path?: string) => CelestialBodyId;
export declare const createCelestialCatalogId: (value: unknown, path?: string) => CelestialCatalogId;
export {};
