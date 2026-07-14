import { createCelestialBodyId } from "../celestial/ids";
import { createFrameStateAtTime, createSystemInertialFrameState } from "../spatial/frameGraph";
import { assertSameUniverseTime, cloneUniverseTime } from "../spatial/frameValidation";
import { parseFrameId } from "../spatial/ids";
import {
  createSpatialVector3,
  quaternionAngularDistanceRadians,
  spatialVectorMagnitude,
  subtractSpatialVectors
} from "../spatial/quaternion";
import { createSpatialKinematicState, transformKinematicState } from "../spatial/transforms";
import {
  FRAME_KINDS,
  SPATIAL_ANGULAR_VELOCITY_ABSOLUTE_TOLERANCE_RADIANS_PER_SECOND,
  SPATIAL_ORIENTATION_TOLERANCE_RADIANS,
  SPATIAL_POSITION_ABSOLUTE_TOLERANCE_METERS,
  SPATIAL_RELATIVE_TOLERANCE,
  SPATIAL_VELOCITY_ABSOLUTE_TOLERANCE_METERS_PER_SECOND,
  type FrameKind,
  type SpatialVector3
} from "../spatial/types";
import {
  createPhysicsSpaceSignature,
  serializeCanonicalPhysicsSpaceValue
} from "./canonical";
import { failPhysicsSpace } from "./errors";
import { parsePhysicsSpaceId } from "./ids";
import {
  PHYSICS_SPACE_KINDS,
  type PhysicsSpaceDescriptor,
  type PhysicsSpaceDescriptorInput,
  type PhysicsSpaceHandoffErrorMetrics,
  type PhysicsSpaceHandoffRequest,
  type PhysicsSpaceHandoffResult,
  type PhysicsSpaceHandoffTolerances,
  type PhysicsSpaceKinematicState,
  type PhysicsSpaceKind
} from "./types";

export const DEFAULT_PHYSICS_SPACE_HANDOFF_TOLERANCES: PhysicsSpaceHandoffTolerances = Object.freeze({
  positionAbsoluteMeters: SPATIAL_POSITION_ABSOLUTE_TOLERANCE_METERS,
  velocityAbsoluteMetersPerSecond: SPATIAL_VELOCITY_ABSOLUTE_TOLERANCE_METERS_PER_SECOND,
  orientationRadians: SPATIAL_ORIENTATION_TOLERANCE_RADIANS,
  angularVelocityAbsoluteRadiansPerSecond:
    SPATIAL_ANGULAR_VELOCITY_ABSOLUTE_TOLERANCE_RADIANS_PER_SECOND,
  relative: SPATIAL_RELATIVE_TOLERANCE
});

const isPhysicsSpaceKind = (value: unknown): value is PhysicsSpaceKind =>
  typeof value === "string" && (PHYSICS_SPACE_KINDS as readonly string[]).includes(value);

const isFrameKind = (value: unknown): value is FrameKind =>
  typeof value === "string" && (FRAME_KINDS as readonly string[]).includes(value);

const assertSpaceFramePair = (kind: PhysicsSpaceKind, frameKind: FrameKind): void => {
  if (frameKind === "RenderRelative") {
    failPhysicsSpace(
      "UNSUPPORTED_FRAME_AUTHORITY",
      "/frameKind",
      "RenderRelative frames cannot own canonical physics-space state."
    );
  }
  const valid =
    (kind === "SystemSpace" && frameKind === "SystemInertial") ||
    (kind === "BodyLocalSpace" && (frameKind === "BodyInertial" || frameKind === "BodyFixed")) ||
    (kind === "SurfaceLocalSpace" && frameKind === "SurfaceLocal");
  if (!valid) {
    failPhysicsSpace("INVALID_PHYSICS_SPACE_KIND", "/frameKind", "Physics space kind is incompatible with its frame kind.");
  }
};

export const createPhysicsSpaceDescriptor = (input: PhysicsSpaceDescriptorInput): PhysicsSpaceDescriptor => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return failPhysicsSpace("INVALID_INPUT", "", "Physics space descriptor input must be an object.");
  }
  const spaceId = parsePhysicsSpaceId(input.spaceId, "/spaceId");
  if (!isPhysicsSpaceKind(input.kind)) {
    return failPhysicsSpace("INVALID_PHYSICS_SPACE_KIND", "/kind", "Physics space kind is unsupported.");
  }
  if (!isFrameKind(input.frameKind)) {
    return failPhysicsSpace("INVALID_PHYSICS_SPACE_KIND", "/frameKind", "Physics space frame kind is unsupported.");
  }
  assertSpaceFramePair(input.kind, input.frameKind);
  if (input.frameDefinition === null || typeof input.frameDefinition !== "object" || Array.isArray(input.frameDefinition)) {
    return failPhysicsSpace("INVALID_INPUT", "/frameDefinition", "Physics space requires a frame definition.");
  }
  const definitionFrameId = parseFrameId(input.frameDefinition.frameId, "/frameDefinition/frameId");
  const definitionParentFrameId = input.frameDefinition.parentFrameId === null
    ? null
    : parseFrameId(input.frameDefinition.parentFrameId, "/frameDefinition/parentFrameId");
  if (!isFrameKind(input.frameDefinition.kind)) {
    return failPhysicsSpace("INVALID_PHYSICS_SPACE_KIND", "/frameDefinition/kind", "Frame definition kind is unsupported.");
  }
  if (input.frameDefinition.kind === "RenderRelative") {
    return failPhysicsSpace(
      "UNSUPPORTED_FRAME_AUTHORITY",
      "/frameDefinition/kind",
      "RenderRelative frames cannot own canonical physics-space state."
    );
  }
  if (typeof input.frameDefinition.canonicalAuthority !== "boolean" || !input.frameDefinition.canonicalAuthority) {
    return failPhysicsSpace(
      "UNSUPPORTED_FRAME_AUTHORITY",
      "/frameDefinition/canonicalAuthority",
      "Physics space frame definition must be canonical authority."
    );
  }
  if (input.frameDefinition.kind !== input.frameKind) {
    return failPhysicsSpace("FRAME_MISMATCH", "/frameDefinition/kind", "Frame definition kind must match frameKind.");
  }
  const frameDefinition = Object.freeze({
    frameId: definitionFrameId,
    kind: input.frameDefinition.kind,
    parentFrameId: definitionParentFrameId,
    canonicalAuthority: true
  });
  const frameState = createFrameStateAtTime({
    frameId: input.frameState.frameId,
    systemFrameId: input.frameState.systemFrameId,
    time: input.frameState.time,
    originPositionMeters: input.frameState.originPositionMeters,
    orientation: input.frameState.orientation,
    originVelocityMetersPerSecond: input.frameState.originVelocityMetersPerSecond,
    angularVelocityRadiansPerSecond: input.frameState.angularVelocityRadiansPerSecond
  });
  if (frameDefinition.frameId !== frameState.frameId) {
    return failPhysicsSpace("FRAME_MISMATCH", "/frameDefinition/frameId", "Frame definition must identify the bound frame state.");
  }
  if (input.kind === "SystemSpace" && frameState.frameId !== frameState.systemFrameId) {
    return failPhysicsSpace("FRAME_MISMATCH", "/frameState/frameId", "SystemSpace must bind the SystemInertial root state.");
  }
  return Object.freeze({ spaceId, kind: input.kind, frameKind: input.frameKind, frameDefinition, frameState });
};

const toleranceValue = (value: unknown, fallback: number, path: string): number => {
  const parsed = value === undefined ? fallback : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < 0) {
    return failPhysicsSpace("INVALID_TOLERANCE", path, "Handoff tolerance must be finite and nonnegative.");
  }
  return Object.is(parsed, -0) ? 0 : parsed;
};

const createTolerances = (value: PhysicsSpaceHandoffRequest["tolerances"]): PhysicsSpaceHandoffTolerances =>
  Object.freeze({
    positionAbsoluteMeters: toleranceValue(
      value?.positionAbsoluteMeters,
      DEFAULT_PHYSICS_SPACE_HANDOFF_TOLERANCES.positionAbsoluteMeters,
      "/tolerances/positionAbsoluteMeters"
    ),
    velocityAbsoluteMetersPerSecond: toleranceValue(
      value?.velocityAbsoluteMetersPerSecond,
      DEFAULT_PHYSICS_SPACE_HANDOFF_TOLERANCES.velocityAbsoluteMetersPerSecond,
      "/tolerances/velocityAbsoluteMetersPerSecond"
    ),
    orientationRadians: toleranceValue(
      value?.orientationRadians,
      DEFAULT_PHYSICS_SPACE_HANDOFF_TOLERANCES.orientationRadians,
      "/tolerances/orientationRadians"
    ),
    angularVelocityAbsoluteRadiansPerSecond: toleranceValue(
      value?.angularVelocityAbsoluteRadiansPerSecond,
      DEFAULT_PHYSICS_SPACE_HANDOFF_TOLERANCES.angularVelocityAbsoluteRadiansPerSecond,
      "/tolerances/angularVelocityAbsoluteRadiansPerSecond"
    ),
    relative: toleranceValue(
      value?.relative,
      DEFAULT_PHYSICS_SPACE_HANDOFF_TOLERANCES.relative,
      "/tolerances/relative"
    )
  });

const vectorError = (left: SpatialVector3, right: SpatialVector3): number =>
  spatialVectorMagnitude(subtractSpatialVectors(createSpatialVector3(left), createSpatialVector3(right)));

const vectorScale = (left: SpatialVector3, right: SpatialVector3): number =>
  Math.max(spatialVectorMagnitude(left), spatialVectorMagnitude(right));

const parseBindingSet = (
  values: readonly (string | ReturnType<typeof createCelestialBodyId>)[],
  path: string
): readonly ReturnType<typeof createCelestialBodyId>[] => {
  if (!Array.isArray(values)) {
    return failPhysicsSpace("INVALID_INPUT", path, "Gravity binding IDs must be an array.");
  }
  const parsed = values.map((value, index) => createCelestialBodyId(value, `${path}/${index}`));
  parsed.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  for (let index = 1; index < parsed.length; index += 1) {
    if (parsed[index] === parsed[index - 1]) {
      return failPhysicsSpace("DUPLICATE_GRAVITY_BINDING", `${path}/${index}`, "Gravity binding IDs must be unique.");
    }
  }
  return Object.freeze(parsed);
};

const assertWithin = (actual: number, allowed: number, path: string): void => {
  if (!Number.isFinite(actual) || actual > allowed) {
    failPhysicsSpace(
      "HANDOFF_TOLERANCE_EXCEEDED",
      path,
      `Physics-space handoff reconstruction error ${actual} exceeds tolerance ${allowed}.`
    );
  }
};

const enrichKinematicState = (
  state: ReturnType<typeof createSpatialKinematicState>,
  frameId: ReturnType<typeof parseFrameId>,
  time: PhysicsSpaceDescriptor["frameState"]["time"]
): PhysicsSpaceKinematicState => Object.freeze({
  ...state,
  frameId,
  time: cloneUniverseTime(time)
});

export const handoffPhysicsSpace = (request: PhysicsSpaceHandoffRequest): PhysicsSpaceHandoffResult => {
  if (request === null || typeof request !== "object" || Array.isArray(request)) {
    return failPhysicsSpace("INVALID_INPUT", "", "Physics-space handoff request must be an object.");
  }
  const sourceSpace = createPhysicsSpaceDescriptor(request.sourceSpace);
  const targetSpace = createPhysicsSpaceDescriptor(request.targetSpace);
  assertSameUniverseTime(sourceSpace.frameState.time, targetSpace.frameState.time, "/time");
  if (sourceSpace.frameState.systemFrameId !== targetSpace.frameState.systemFrameId) {
    return failPhysicsSpace("FRAME_MISMATCH", "/targetSpace/frameState/systemFrameId", "Handoff spaces must share one SystemInertial root.");
  }
  const sourceMetadata = request.sourceState as Partial<PhysicsSpaceKinematicState>;
  if (sourceMetadata.frameId !== undefined || sourceMetadata.time !== undefined) {
    if (sourceMetadata.frameId === undefined || sourceMetadata.time === undefined) {
      return failPhysicsSpace("INVALID_INPUT", "/sourceState", "Explicit source state metadata requires both frameId and time.");
    }
    if (parseFrameId(sourceMetadata.frameId, "/sourceState/frameId") !== sourceSpace.frameState.frameId) {
      return failPhysicsSpace("FRAME_MISMATCH", "/sourceState/frameId", "Source state frame ID must match source space.");
    }
    assertSameUniverseTime(sourceMetadata.time, sourceSpace.frameState.time, "/sourceState/time");
  }
  const sourceState = createSpatialKinematicState(request.sourceState);
  const tolerances = createTolerances(request.tolerances);
  const sourceGravityBindingIds = parseBindingSet(request.sourceGravityBindingIds, "/sourceGravityBindingIds");
  const targetGravityBindingIds = parseBindingSet(request.targetGravityBindingIds, "/targetGravityBindingIds");
  const systemFrame = createSystemInertialFrameState(
    sourceSpace.frameState.systemFrameId,
    sourceSpace.frameState.time
  );
  const absoluteState = enrichKinematicState(
    transformKinematicState(sourceState, sourceSpace.frameState, systemFrame),
    systemFrame.frameId,
    systemFrame.time
  );
  const targetState = enrichKinematicState(
    transformKinematicState(sourceState, sourceSpace.frameState, targetSpace.frameState),
    targetSpace.frameState.frameId,
    targetSpace.frameState.time
  );
  const reconstructedAbsolute = transformKinematicState(targetState, targetSpace.frameState, systemFrame);
  const reconstructionError: PhysicsSpaceHandoffErrorMetrics = Object.freeze({
    positionMeters: vectorError(absoluteState.positionMeters, reconstructedAbsolute.positionMeters),
    velocityMetersPerSecond: vectorError(
      absoluteState.velocityMetersPerSecond,
      reconstructedAbsolute.velocityMetersPerSecond
    ),
    orientationRadians: quaternionAngularDistanceRadians(
      absoluteState.orientation,
      reconstructedAbsolute.orientation
    ),
    angularVelocityRadiansPerSecond: vectorError(
      absoluteState.angularVelocityRadiansPerSecond,
      reconstructedAbsolute.angularVelocityRadiansPerSecond
    )
  });
  assertWithin(
    reconstructionError.positionMeters,
    tolerances.positionAbsoluteMeters +
      tolerances.relative * vectorScale(absoluteState.positionMeters, reconstructedAbsolute.positionMeters),
    "/reconstructionError/positionMeters"
  );
  assertWithin(
    reconstructionError.velocityMetersPerSecond,
    tolerances.velocityAbsoluteMetersPerSecond +
      tolerances.relative * vectorScale(
        absoluteState.velocityMetersPerSecond,
        reconstructedAbsolute.velocityMetersPerSecond
      ),
    "/reconstructionError/velocityMetersPerSecond"
  );
  assertWithin(
    reconstructionError.orientationRadians,
    tolerances.orientationRadians,
    "/reconstructionError/orientationRadians"
  );
  assertWithin(
    reconstructionError.angularVelocityRadiansPerSecond,
    tolerances.angularVelocityAbsoluteRadiansPerSecond +
      tolerances.relative * vectorScale(
        absoluteState.angularVelocityRadiansPerSecond,
        reconstructedAbsolute.angularVelocityRadiansPerSecond
      ),
    "/reconstructionError/angularVelocityRadiansPerSecond"
  );
  const gravityBindingsChanged =
    sourceGravityBindingIds.length !== targetGravityBindingIds.length ||
    sourceGravityBindingIds.some((bindingId, index) => bindingId !== targetGravityBindingIds[index]);
  const canonicalValue = {
    sourceSpaceId: sourceSpace.spaceId,
    targetSpaceId: targetSpace.spaceId,
    sourceFrameId: sourceSpace.frameState.frameId,
    targetFrameId: targetSpace.frameState.frameId,
    time: cloneUniverseTime(sourceSpace.frameState.time),
    targetState,
    absoluteState,
    sourceGravityBindingIds,
    targetGravityBindingIds,
    gravityBindingsChanged,
    reconstructionError
  };
  return Object.freeze({
    ...canonicalValue,
    canonicalJson: serializeCanonicalPhysicsSpaceValue(canonicalValue),
    signature: createPhysicsSpaceSignature(canonicalValue)
  });
};

export const executePhysicsSpaceHandoff = handoffPhysicsSpace;
