import type { CelestialBodyId } from "./ids";
import type { CatalogEphemerisInput, CelestialBodyDefinition, CelestialCatalog, CelestialCatalogEphemeris, CelestialRuntimeState, KeplerSolverOptions } from "./types";
export declare const createRootRuntimeState: (rootBody: CelestialBodyDefinition, requestedTimeSeconds: number) => CelestialRuntimeState;
export declare const propagateChildRuntimeState: (body: CelestialBodyDefinition, rootBodyId: CelestialBodyId, parentState: CelestialRuntimeState, epochSeconds: number, requestedTimeSeconds: number, options?: KeplerSolverOptions) => CelestialRuntimeState;
export declare const computeCatalogEphemeris: (catalog: CelestialCatalog, input: CatalogEphemerisInput) => CelestialCatalogEphemeris;
