export type CelestialErrorCode = "UnsupportedSchemaVersion" | "InvalidCatalog" | "InvalidId" | "DuplicateBodyId" | "InvalidBody" | "InvalidNumber" | "OutOfRange" | "InconsistentMassMu" | "UnknownParent" | "ParentOrbitMismatch" | "RootOrbitMismatch" | "ParentCycle" | "InvalidOrbit" | "InvalidTime" | "FrameTimeMismatch" | "KeplerConvergenceFailure" | "InvalidGravitySource" | "InsideMinimumRadius" | "NoGravitySource" | "InvalidCanonicalJson";
/** Stable fail-closed error contract shared by celestial data and pure math queries. */
export declare class CelestialError extends Error {
    readonly code: CelestialErrorCode;
    readonly path: string;
    constructor(code: CelestialErrorCode, path: string, message: string);
}
export declare const failCelestial: (code: CelestialErrorCode, path: string, message: string) => never;
