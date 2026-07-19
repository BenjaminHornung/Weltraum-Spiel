export const SURFACE_LOCAL_FRAME_SCHEMA_VERSION = 1 as const;

export const SURFACE_BODY_SHAPE_SCHEMA = "weltraum.surface-body-shape" as const;
export const SURFACE_ANCHOR_SCHEMA = "weltraum.surface-anchor" as const;
export const SURFACE_LOCAL_FRAME_SCHEMA = "weltraum.surface-local-frame" as const;
export const ABSOLUTE_SURFACE_STATE_SCHEMA = "weltraum.absolute-surface-state" as const;
export const PROJECTED_SURFACE_STATE_SCHEMA = "weltraum.projected-surface-state" as const;

export interface SurfaceVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SurfaceQuaternion {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export interface SurfaceBodyShape {
  readonly schema: typeof SURFACE_BODY_SHAPE_SCHEMA;
  readonly schemaVersion: typeof SURFACE_LOCAL_FRAME_SCHEMA_VERSION;
  readonly kind: "Sphere" | "OblateEllipsoid";
  readonly bodyId: string;
  readonly bodyFixedFrameId: string;
  readonly revision: number;
  readonly semiMajorAxisMeters: number;
  readonly semiMinorAxisMeters: number;
  readonly firstEccentricitySquared: number;
}

export interface SurfaceGeodeticCoordinates {
  readonly latitudeRadians: number;
  readonly longitudeRadians: number;
  readonly ellipsoidalHeightMeters: number;
}

export interface SurfaceFrameBasis {
  readonly east: SurfaceVector3;
  readonly up: SurfaceVector3;
  readonly south: SurfaceVector3;
}

export interface SurfaceAnchor {
  readonly schema: typeof SURFACE_ANCHOR_SCHEMA;
  readonly schemaVersion: typeof SURFACE_LOCAL_FRAME_SCHEMA_VERSION;
  readonly bodyId: string;
  readonly bodyFixedFrameId: string;
  readonly anchorId: string;
  readonly revision: number;
  readonly geodetic: SurfaceGeodeticCoordinates;
  readonly bodyFixedPositionMeters: SurfaceVector3;
  readonly basis: SurfaceFrameBasis;
}

export type SurfaceCanonicalPrimitive = string | number | boolean | null;
export type SurfaceCanonicalValue =
  | SurfaceCanonicalPrimitive
  | readonly SurfaceCanonicalValue[]
  | { readonly [key: string]: SurfaceCanonicalValue };

export interface SurfaceLocalFrame {
  readonly schema: typeof SURFACE_LOCAL_FRAME_SCHEMA;
  readonly schemaVersion: typeof SURFACE_LOCAL_FRAME_SCHEMA_VERSION;
  readonly bodyId: string;
  readonly bodyFixedFrameId: string;
  readonly surfaceFrameId: string;
  readonly revision: number;
  readonly shape: SurfaceBodyShape;
  readonly anchor: SurfaceAnchor;
  readonly orientationLocalToBodyFixed: SurfaceQuaternion;
  readonly authorityContext?: SurfaceCanonicalValue;
}

export interface SurfaceSemanticIdentity {
  readonly kind: string;
  readonly id: string;
}

export interface AbsoluteSurfaceDirection {
  readonly id: string;
  readonly valueBodyFixed: SurfaceVector3;
}

export interface ProjectedSurfaceDirection {
  readonly id: string;
  readonly valueLocal: SurfaceVector3;
}

export interface AbsoluteSurfaceState {
  readonly schema: typeof ABSOLUTE_SURFACE_STATE_SCHEMA;
  readonly schemaVersion: typeof SURFACE_LOCAL_FRAME_SCHEMA_VERSION;
  readonly stateId: string;
  readonly semanticIdentity: SurfaceSemanticIdentity;
  readonly bodyId: string;
  readonly bodyFixedFrameId: string;
  readonly bodyRevision: number;
  readonly positionBodyFixedMeters: SurfaceVector3;
  readonly velocityBodyFixedMetersPerSecond: SurfaceVector3;
  readonly orientationBodyFixed?: SurfaceQuaternion;
  readonly directionsBodyFixed?: readonly AbsoluteSurfaceDirection[];
}

export interface ProjectedSurfaceState {
  readonly schema: typeof PROJECTED_SURFACE_STATE_SCHEMA;
  readonly schemaVersion: typeof SURFACE_LOCAL_FRAME_SCHEMA_VERSION;
  readonly stateId: string;
  readonly semanticIdentity: SurfaceSemanticIdentity;
  readonly bodyId: string;
  readonly bodyFixedFrameId: string;
  readonly bodyRevision: number;
  readonly surfaceFrameId: string;
  readonly frameRevision: number;
  readonly anchorId: string;
  readonly anchorRevision: number;
  readonly authorityContext?: SurfaceCanonicalValue;
  readonly positionLocalMeters: SurfaceVector3;
  readonly velocityLocalMetersPerSecond: SurfaceVector3;
  readonly orientationLocal?: SurfaceQuaternion;
  readonly directionsLocal?: readonly ProjectedSurfaceDirection[];
}

export type SurfaceLocalFrameErrorCode =
  | "InvalidNumber"
  | "InvalidIdentifier"
  | "InvalidRevision"
  | "InvalidShape"
  | "InvalidAnchor"
  | "InvalidGeodeticHeight"
  | "InvalidVector"
  | "InvalidQuaternion"
  | "InvalidCanonicalValue"
  | "AuthorityMismatch"
  | "UndefinedCenter"
  | "GeodeticNonConvergence";

export class SurfaceLocalFrameError extends Error {
  public readonly code: SurfaceLocalFrameErrorCode;

  public constructor(code: SurfaceLocalFrameErrorCode, message: string) {
    super(message);
    this.name = "SurfaceLocalFrameError";
    this.code = code;
  }
}
