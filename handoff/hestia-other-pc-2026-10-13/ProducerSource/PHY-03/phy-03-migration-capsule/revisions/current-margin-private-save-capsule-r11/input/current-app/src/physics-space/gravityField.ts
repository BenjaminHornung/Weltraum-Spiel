import {
  createGravitySource,
  gravitationalAccelerationAt,
  gravitySourceFromRuntimeState,
  selectDominantGravitySource
} from "../celestial/gravity";
import type { CelestialBodyDefinition, CelestialRuntimeState } from "../celestial/types";
import { validateUniverseTime, type UniverseTime } from "../persistence/time";
import { createFrameStateAtTime } from "../spatial/frameGraph";
import { assertSameUniverseTime, cloneUniverseTime } from "../spatial/frameValidation";
import {
  addSpatialVectors,
  createSpatialVector3,
  spatialVector3
} from "../spatial/quaternion";
import {
  directionFromSystemInertial,
  positionToSystemInertial
} from "../spatial/transforms";
import type { FrameStateAtTime } from "../spatial/types";
import {
  createPhysicsSpaceSignature,
  serializeCanonicalPhysicsSpaceValue
} from "./canonical";
import { failPhysicsSpace } from "./errors";
import { parseGravitySourceBindingId } from "./ids";
import type {
  GravityFieldSnapshot,
  GravityFieldSnapshotInput,
  GravityQueryInput,
  GravityQueryResult,
  GravitySourceBinding,
  GravitySourceBindingInput
} from "./types";

const cloneFrameState = (state: FrameStateAtTime): FrameStateAtTime =>
  createFrameStateAtTime({
    frameId: state.frameId,
    systemFrameId: state.systemFrameId,
    time: state.time,
    originPositionMeters: state.originPositionMeters,
    orientation: state.orientation,
    originVelocityMetersPerSecond: state.originVelocityMetersPerSecond,
    angularVelocityRadiansPerSecond: state.angularVelocityRadiansPerSecond
  });

export const createGravitySourceBinding = (input: GravitySourceBindingInput): GravitySourceBinding => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return failPhysicsSpace("INVALID_INPUT", "", "Gravity source binding input must be an object.");
  }
  const time = validateUniverseTime(input.time, "/time");
  if (input.runtimeState.requestedTimeSeconds !== time.epochSeconds) {
    return failPhysicsSpace(
      "TIME_MISMATCH",
      "/runtimeState/requestedTimeSeconds",
      "Celestial runtime state must match the binding Universe time exactly."
    );
  }
  const source = gravitySourceFromRuntimeState(input.body, input.runtimeState, input.minimumQueryRadiusMeters);
  return Object.freeze({
    bindingId: parseGravitySourceBindingId(source.bodyId, "/bindingId"),
    time: cloneUniverseTime(time),
    source
  });
};

export const bindGravitySource = (
  body: CelestialBodyDefinition,
  runtimeState: CelestialRuntimeState,
  time: UniverseTime,
  minimumQueryRadiusMeters?: number
): GravitySourceBinding => createGravitySourceBinding({ body, runtimeState, time, minimumQueryRadiusMeters });

const cloneBinding = (binding: GravitySourceBinding, index: number, expectedTime: UniverseTime): GravitySourceBinding => {
  if (binding === null || typeof binding !== "object" || Array.isArray(binding)) {
    return failPhysicsSpace("INVALID_INPUT", `/bindings/${index}`, "Gravity source binding must be an object.");
  }
  assertSameUniverseTime(binding.time, expectedTime, `/bindings/${index}/time`);
  const source = createGravitySource(binding.source);
  const bindingId = parseGravitySourceBindingId(binding.bindingId, `/bindings/${index}/bindingId`);
  if (bindingId !== source.bodyId) {
    return failPhysicsSpace(
      "FRAME_MISMATCH",
      `/bindings/${index}/bindingId`,
      "Gravity binding ID must equal its Celestial source body ID."
    );
  }
  return Object.freeze({ bindingId, time: cloneUniverseTime(expectedTime), source });
};

export const createGravityFieldSnapshot = (input: GravityFieldSnapshotInput): GravityFieldSnapshot => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return failPhysicsSpace("INVALID_INPUT", "", "Gravity field snapshot input must be an object.");
  }
  const time = validateUniverseTime(input.time, "/time");
  const systemFrameState = cloneFrameState(input.systemFrameState);
  assertSameUniverseTime(systemFrameState.time, time, "/systemFrameState/time");
  if (systemFrameState.frameId !== systemFrameState.systemFrameId) {
    return failPhysicsSpace(
      "FRAME_MISMATCH",
      "/systemFrameState/frameId",
      "Gravity field snapshot must be bound to its SystemInertial root frame."
    );
  }
  const isZero = (value: { readonly x: number; readonly y: number; readonly z: number }): boolean =>
    value.x === 0 && value.y === 0 && value.z === 0;
  if (
    !isZero(systemFrameState.originPositionMeters) ||
    !isZero(systemFrameState.originVelocityMetersPerSecond) ||
    !isZero(systemFrameState.angularVelocityRadiansPerSecond) ||
    systemFrameState.orientation.x !== 0 ||
    systemFrameState.orientation.y !== 0 ||
    systemFrameState.orientation.z !== 0 ||
    systemFrameState.orientation.w !== 1
  ) {
    return failPhysicsSpace(
      "FRAME_MISMATCH",
      "/systemFrameState",
      "Celestial gravity snapshots require the canonical identity SystemInertial root state."
    );
  }
  if (!Array.isArray(input.bindings) || input.bindings.length === 0) {
    return failPhysicsSpace("EMPTY_GRAVITY_FIELD", "/bindings", "Gravity field requires at least one explicit source binding.");
  }
  const parsed = input.bindings.map((binding, index) => cloneBinding(binding, index, time));
  const seen = new Set<string>();
  for (let index = 0; index < parsed.length; index += 1) {
    const binding = parsed[index];
    if (seen.has(binding.bindingId)) {
      return failPhysicsSpace(
        "DUPLICATE_GRAVITY_BINDING",
        `/bindings/${index}/bindingId`,
        "Gravity source binding IDs must be unique."
      );
    }
    seen.add(binding.bindingId);
  }
  const bindings = Object.freeze(
    parsed.slice().sort((left, right) =>
      left.bindingId < right.bindingId ? -1 : left.bindingId > right.bindingId ? 1 : 0
    )
  );
  const canonicalValue = {
    time,
    systemFrameId: systemFrameState.frameId,
    systemFrameState,
    bindings
  };
  return Object.freeze({
    time: cloneUniverseTime(time),
    systemFrameId: systemFrameState.frameId,
    systemFrameState,
    bindings,
    canonicalJson: serializeCanonicalPhysicsSpaceValue(canonicalValue),
    signature: createPhysicsSpaceSignature(canonicalValue)
  });
};

const assertFrameMatchesField = (
  frame: FrameStateAtTime,
  field: GravityFieldSnapshot,
  path: string
): void => {
  assertSameUniverseTime(frame.time, field.time, `${path}/time`);
  if (frame.systemFrameId !== field.systemFrameId) {
    failPhysicsSpace("FRAME_MISMATCH", `${path}/systemFrameId`, "Gravity query frame has a different SystemInertial root.");
  }
};

export const queryGravityField = (input: GravityQueryInput): GravityQueryResult => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return failPhysicsSpace("INVALID_INPUT", "", "Gravity query input must be an object.");
  }
  assertFrameMatchesField(input.positionFrameState, input.field, "/positionFrameState");
  const outputFrame = input.outputFrameState ?? input.positionFrameState;
  assertFrameMatchesField(outputFrame, input.field, "/outputFrameState");
  const systemPositionMeters = positionToSystemInertial(
    createSpatialVector3(input.positionMeters, "/positionMeters"),
    input.positionFrameState
  );
  const sourceResults = Object.freeze(
    input.field.bindings.map((binding) => gravitationalAccelerationAt(binding.source, systemPositionMeters))
  );
  let systemAcceleration = spatialVector3();
  for (const sourceResult of sourceResults) {
    systemAcceleration = addSpatialVectors(
      systemAcceleration,
      createSpatialVector3(sourceResult.accelerationMetersPerSecondSquared)
    );
  }
  const sources = input.field.bindings.map((binding) => binding.source);
  const dominantSource = sources.some((source) => source.eligible)
    ? selectDominantGravitySource(sources, systemPositionMeters)
    : null;
  return Object.freeze({
    time: cloneUniverseTime(input.field.time),
    systemPositionMeters,
    systemAccelerationMetersPerSecondSquared: systemAcceleration,
    accelerationMetersPerSecondSquared: directionFromSystemInertial(systemAcceleration, outputFrame),
    outputFrameId: outputFrame.frameId,
    sourceResults,
    dominantSource
  });
};

export const gravityAccelerationFromSnapshot = queryGravityField;
