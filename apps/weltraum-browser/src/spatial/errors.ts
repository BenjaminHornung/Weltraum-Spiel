export type SpatialErrorCode =
  | "INVALID_INPUT"
  | "INVALID_FRAME_ID"
  | "INVALID_FRAME_KIND"
  | "DUPLICATE_FRAME_ID"
  | "UNKNOWN_PARENT_FRAME"
  | "INVALID_FRAME_ROOT"
  | "FRAME_CYCLE"
  | "INVALID_FRAME_AUTHORITY"
  | "TIME_MISMATCH"
  | "NONFINITE_VALUE"
  | "ZERO_QUATERNION"
  | "INVALID_QUATERNION"
  | "INVALID_ROTATION"
  | "INVALID_SURFACE_ANCHOR"
  | "FRAME_MISMATCH";

export class SpatialError extends Error {
  public constructor(
    public readonly code: SpatialErrorCode,
    public readonly path: string,
    message: string
  ) {
    super(message);
    this.name = "SpatialError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const failSpatial = (code: SpatialErrorCode, path: string, message: string): never => {
  throw new SpatialError(code, path, message);
};
