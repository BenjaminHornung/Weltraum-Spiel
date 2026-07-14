import type {
  CelestialBodyDefinition,
  CelestialRuntimeState,
  DominantGravitySourceResult,
  GravityAccelerationResult,
  GravitySource
} from "../celestial/types";
import type { UniverseTime } from "../persistence/time";
import type { FrameId } from "../spatial/ids";
import type {
  FrameDefinition,
  FrameKind,
  FrameStateAtTime,
  SpatialKinematicState,
  SpatialVector3
} from "../spatial/types";
import type { PhysicsSpaceSignature } from "./canonical";
import type {
  GravitySourceBindingId,
  PhysicsProbeId,
  PhysicsSpaceId
} from "./ids";

export interface GravitySourceBindingInput {
  readonly body: CelestialBodyDefinition;
  readonly runtimeState: CelestialRuntimeState;
  readonly time: UniverseTime;
  readonly minimumQueryRadiusMeters?: number;
}

export interface GravitySourceBinding {
  readonly bindingId: GravitySourceBindingId;
  readonly time: UniverseTime;
  readonly source: GravitySource;
}

export interface GravityFieldSnapshotInput {
  readonly time: UniverseTime;
  readonly systemFrameState: FrameStateAtTime;
  readonly bindings: readonly GravitySourceBinding[];
}

export interface GravityFieldSnapshot {
  readonly time: UniverseTime;
  readonly systemFrameId: FrameId;
  readonly systemFrameState: FrameStateAtTime;
  readonly bindings: readonly GravitySourceBinding[];
  readonly canonicalJson: string;
  readonly signature: PhysicsSpaceSignature;
}

export interface GravityQueryInput {
  readonly field: GravityFieldSnapshot;
  readonly positionMeters: SpatialVector3;
  readonly positionFrameState: FrameStateAtTime;
  readonly outputFrameState?: FrameStateAtTime;
}

export interface GravityQueryResult {
  readonly time: UniverseTime;
  readonly systemPositionMeters: SpatialVector3;
  readonly systemAccelerationMetersPerSecondSquared: SpatialVector3;
  readonly accelerationMetersPerSecondSquared: SpatialVector3;
  readonly outputFrameId: FrameId;
  readonly sourceResults: readonly GravityAccelerationResult[];
  readonly dominantSource: DominantGravitySourceResult | null;
}

export interface PhysicsProbeStateInput {
  readonly probeId: PhysicsProbeId | string;
  readonly frameId: FrameId | string;
  readonly time: UniverseTime;
  readonly positionMeters: SpatialVector3;
  readonly velocityMetersPerSecond: SpatialVector3;
}

export interface PhysicsProbeState {
  readonly probeId: PhysicsProbeId;
  readonly frameId: FrameId;
  readonly time: UniverseTime;
  readonly positionMeters: SpatialVector3;
  readonly velocityMetersPerSecond: SpatialVector3;
}

export interface PhysicsStepInput {
  readonly state: PhysicsProbeState;
  readonly deltaTimeSeconds: number;
  readonly startFrameState: FrameStateAtTime;
  readonly endFrameState: FrameStateAtTime;
  readonly gravityField: GravityFieldSnapshot;
}

export interface PhysicsProbeStepContext extends Omit<PhysicsStepInput, "state"> {}

export interface PhysicsStepResult {
  readonly state: PhysicsProbeState;
  readonly accelerationSystemMetersPerSecondSquared: SpatialVector3;
  readonly absolutePositionMeters: SpatialVector3;
  readonly absoluteVelocityMetersPerSecond: SpatialVector3;
  readonly canonicalJson: string;
  readonly signature: PhysicsSpaceSignature;
}

export interface PhysicsProbeSimulationResult {
  readonly initialState: PhysicsProbeState;
  readonly finalState: PhysicsProbeState;
  readonly steps: readonly PhysicsStepResult[];
  readonly canonicalJson: string;
  readonly signature: PhysicsSpaceSignature;
}

export const PHYSICS_SPACE_KINDS = ["SystemSpace", "BodyLocalSpace", "SurfaceLocalSpace"] as const;
export type PhysicsSpaceKind = (typeof PHYSICS_SPACE_KINDS)[number];

export interface PhysicsSpaceDescriptorInput {
  readonly spaceId: PhysicsSpaceId | string;
  readonly kind: PhysicsSpaceKind;
  readonly frameKind: FrameKind;
  readonly frameDefinition: FrameDefinition;
  readonly frameState: FrameStateAtTime;
}

export interface PhysicsSpaceDescriptor {
  readonly spaceId: PhysicsSpaceId;
  readonly kind: PhysicsSpaceKind;
  readonly frameKind: FrameKind;
  readonly frameDefinition: FrameDefinition;
  readonly frameState: FrameStateAtTime;
}

export interface PhysicsSpaceKinematicState extends SpatialKinematicState {
  readonly frameId: FrameId;
  readonly time: UniverseTime;
}

export interface PhysicsSpaceHandoffTolerances {
  readonly positionAbsoluteMeters: number;
  readonly velocityAbsoluteMetersPerSecond: number;
  readonly orientationRadians: number;
  readonly angularVelocityAbsoluteRadiansPerSecond: number;
  readonly relative: number;
}

export interface PhysicsSpaceHandoffRequest {
  readonly sourceSpace: PhysicsSpaceDescriptor;
  readonly targetSpace: PhysicsSpaceDescriptor;
  readonly sourceState: SpatialKinematicState;
  readonly sourceGravityBindingIds: readonly (GravitySourceBindingId | string)[];
  readonly targetGravityBindingIds: readonly (GravitySourceBindingId | string)[];
  readonly tolerances?: Partial<PhysicsSpaceHandoffTolerances>;
}

export interface PhysicsSpaceHandoffErrorMetrics {
  readonly positionMeters: number;
  readonly velocityMetersPerSecond: number;
  readonly orientationRadians: number;
  readonly angularVelocityRadiansPerSecond: number;
}

export interface PhysicsSpaceHandoffResult {
  readonly sourceSpaceId: PhysicsSpaceId;
  readonly targetSpaceId: PhysicsSpaceId;
  readonly sourceFrameId: FrameId;
  readonly targetFrameId: FrameId;
  readonly time: UniverseTime;
  readonly targetState: PhysicsSpaceKinematicState;
  readonly absoluteState: PhysicsSpaceKinematicState;
  readonly sourceGravityBindingIds: readonly GravitySourceBindingId[];
  readonly targetGravityBindingIds: readonly GravitySourceBindingId[];
  readonly gravityBindingsChanged: boolean;
  readonly reconstructionError: PhysicsSpaceHandoffErrorMetrics;
  readonly canonicalJson: string;
  readonly signature: PhysicsSpaceSignature;
}
