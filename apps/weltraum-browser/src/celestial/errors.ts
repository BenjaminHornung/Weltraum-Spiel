export type CelestialErrorCode =
  | "UnsupportedSchemaVersion"
  | "InvalidCatalog"
  | "InvalidId"
  | "DuplicateBodyId"
  | "InvalidBody"
  | "InvalidNumber"
  | "OutOfRange"
  | "InconsistentMassMu"
  | "UnknownParent"
  | "ParentOrbitMismatch"
  | "RootOrbitMismatch"
  | "ParentCycle"
  | "InvalidOrbit"
  | "InvalidTime"
  | "FrameTimeMismatch"
  | "KeplerConvergenceFailure"
  | "InvalidGravitySource"
  | "InsideMinimumRadius"
  | "NoGravitySource"
  | "InvalidCanonicalJson";

/** Stable fail-closed error contract shared by celestial data and pure math queries. */
export class CelestialError extends Error {
  public readonly code: CelestialErrorCode;
  public readonly path: string;

  public constructor(code: CelestialErrorCode, path: string, message: string) {
    super(message);
    this.name = "CelestialError";
    this.code = code;
    this.path = path;
  }
}

export const failCelestial = (code: CelestialErrorCode, path: string, message: string): never => {
  throw new CelestialError(code, path, message);
};
