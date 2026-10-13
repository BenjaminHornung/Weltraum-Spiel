import type { OrbitDefinition, KeplerSolution, KeplerSolverOptions, RelativeOrbitalState } from "./types";
export declare const DEFAULT_KEPLER_SOLVER_OPTIONS: KeplerSolverOptions;
export declare const normalizeAngleRadians: (angleRadians: number) => number;
export declare const solveEllipticKepler: (meanAnomalyRadians: number, eccentricity: number, options?: KeplerSolverOptions) => KeplerSolution;
export declare const orbitalPeriodSeconds: (semiMajorAxisMeters: number, parentMu: number) => number;
export declare const propagateKeplerOrbit: (orbit: OrbitDefinition, parentMu: number, epochSeconds: number, requestedTimeSeconds: number, options?: KeplerSolverOptions) => RelativeOrbitalState;
