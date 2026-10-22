import type { UniverseTime } from "../persistence/time";
import type { FrameId } from "./ids";

export const SPATIAL_QUATERNION_NORM_TOLERANCE = 1e-12;
export const SPATIAL_BASIS_TOLERANCE = 1e-12;
export const SPATIAL_POSITION_ABSOLUTE_TOLERANCE_METERS = 1e-5;
export const SPATIAL_VELOCITY_ABSOLUTE_TOLERANCE_METERS_PER_SECOND = 1e-9;
export const SPATIAL_ORIENTATION_TOLERANCE_RADIANS = 1e-10;
export const SPATIAL_ANGULAR_VELOCITY_ABSOLUTE_TOLERANCE_RADIANS_PER_SECOND = 1e-12;
export const SPATIAL_RELATIVE_TOLERANCE = 2e-15;

export interface SpatialVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SpatialQuaternion {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export type SpatialVelocity = SpatialVector3;
export type SpatialAngularVelocity = SpatialVector3;

export interface SpatialPose {
  readonly positionMeters: SpatialVector3;
  readonly orientation: SpatialQuaternion;
}

export interface SpatialKinematicState extends SpatialPose {
  readonly velocityMetersPerSecond: SpatialVelocity;
  readonly angularVelocityRadiansPerSecond: SpatialAngularVelocity;
}

export const FRAME_KINDS = [
  "SystemInertial",
  "BodyInertial",
  "BodyFixed",
  "SurfaceLocal",
  "LocalPhysics",
  "RenderRelative"
] as const;

export type FrameKind = (typeof FRAME_KINDS)[number];

export interface FrameDefinitionInput {
  readonly frameId: FrameId | string;
  readonly kind: FrameKind;
  readonly parentFrameId: FrameId | string | null;
  readonly canonicalAuthority?: boolean;
}

export interface FrameDefinition {
  readonly frameId: FrameId;
  readonly kind: FrameKind;
  readonly parentFrameId: FrameId | null;
  readonly canonicalAuthority: boolean;
}

export interface FrameTransformAtTime {
  readonly frameId: FrameId;
  readonly parentFrameId: FrameId;
  readonly time: UniverseTime;
  readonly translationMeters: SpatialVector3;
  readonly orientation: SpatialQuaternion;
  readonly originVelocityMetersPerSecond: SpatialVelocity;
  readonly angularVelocityRadiansPerSecond: SpatialAngularVelocity;
}

export interface FrameStateAtTime {
  readonly frameId: FrameId;
  readonly systemFrameId: FrameId;
  readonly time: UniverseTime;
  readonly originPositionMeters: SpatialVector3;
  readonly orientation: SpatialQuaternion;
  readonly originVelocityMetersPerSecond: SpatialVelocity;
  readonly angularVelocityRadiansPerSecond: SpatialAngularVelocity;
}

export interface FrameGraph {
  readonly rootFrameId: FrameId;
  readonly definitions: readonly FrameDefinition[];
  readonly definitionById: Readonly<Record<string, FrameDefinition>>;
  readonly canonicalJson: string;
  readonly signature: string;
  readonly getDefinition: (frameId: FrameId | string) => FrameDefinition;
}
