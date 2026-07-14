export type PhysicsSpaceErrorCode =
  | "INVALID_INPUT"
  | "INVALID_PHYSICS_SPACE_ID"
  | "INVALID_PHYSICS_SPACE_KIND"
  | "INVALID_PROBE_ID"
  | "DUPLICATE_GRAVITY_BINDING"
  | "EMPTY_GRAVITY_FIELD"
  | "TIME_MISMATCH"
  | "FRAME_MISMATCH"
  | "INVALID_TIME_STEP"
  | "NONFINITE_VALUE"
  | "INVALID_TOLERANCE"
  | "HANDOFF_TOLERANCE_EXCEEDED"
  | "UNSUPPORTED_FRAME_AUTHORITY";

export class PhysicsSpaceError extends Error {
  public constructor(
    public readonly code: PhysicsSpaceErrorCode,
    public readonly path: string,
    message: string
  ) {
    super(message);
    this.name = "PhysicsSpaceError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const failPhysicsSpace = (code: PhysicsSpaceErrorCode, path: string, message: string): never => {
  throw new PhysicsSpaceError(code, path, message);
};
