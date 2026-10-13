import type { Vec3 } from "../core/vector";
import type { CelestialBodyDefinition, CelestialRuntimeState, DominantGravitySourceResult, GravityAccelerationResult, GravitySource } from "./types";
export declare const createGravitySource: (value: unknown) => GravitySource;
export declare const gravitySourceFromRuntimeState: (body: CelestialBodyDefinition, state: CelestialRuntimeState, minimumQueryRadiusMeters?: number) => GravitySource;
export declare const gravitationalAccelerationAt: (source: GravitySource, queryPositionMeters: Vec3) => GravityAccelerationResult;
/** Public contract name retained independently of any future force-integration API. */
export declare const gravityAccelerationAtPosition: typeof gravitationalAccelerationAt;
export declare const surfaceGravityMetersPerSecondSquared: (body: CelestialBodyDefinition) => number;
export declare const escapeVelocityMetersPerSecond: (body: CelestialBodyDefinition) => number;
export declare const surfaceGravity: typeof surfaceGravityMetersPerSecondSquared;
export declare const escapeVelocity: typeof escapeVelocityMetersPerSecond;
export declare const selectDominantGravitySource: (sources: readonly GravitySource[], queryPositionMeters: Vec3) => DominantGravitySourceResult;
