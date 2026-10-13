import { type CelestialBodyId } from "./ids";
import { type CelestialBodyDefinition, type CelestialBodyType, type CelestialCatalog } from "./types";
export declare const createCelestialCatalog: (value: unknown) => CelestialCatalog;
export declare const findCelestialBody: (catalog: CelestialCatalog, bodyId: CelestialBodyId | string) => CelestialBodyDefinition | undefined;
export declare const requireCelestialBody: (catalog: CelestialCatalog, bodyId: CelestialBodyId | string) => CelestialBodyDefinition;
export declare const childBodyIdsFor: (catalog: CelestialCatalog, parentBodyId: CelestialBodyId | string) => readonly CelestialBodyId[];
export declare const bodyIdsForType: (catalog: CelestialCatalog, bodyType: CelestialBodyType) => readonly CelestialBodyId[];
