import { type CelestialBodyDefinition } from "./types";
export declare const GRAVITATIONAL_CONSTANT = 6.6743e-11;
export declare const MASS_MU_RELATIVE_TOLERANCE = 0.01;
export declare const isCelestialRecord: (value: unknown) => value is Record<string, unknown>;
export declare const assertCelestialSchemaVersion: (value: unknown, path: string) => void;
export declare const requireFiniteNumber: (value: unknown, path: string) => number;
export declare const requireFinitePositive: (value: unknown, path: string) => number;
export declare const requireFiniteNonNegative: (value: unknown, path: string) => number;
export declare const requireFiniteVec3: (value: unknown, path: string) => {
    readonly x: number;
    readonly y: number;
    readonly z: number;
};
export declare const deepFreezeCelestial: <T>(value: T, seen?: WeakSet<object>) => T;
export declare const createCelestialBodyDefinition: (value: unknown, path?: string) => CelestialBodyDefinition;
