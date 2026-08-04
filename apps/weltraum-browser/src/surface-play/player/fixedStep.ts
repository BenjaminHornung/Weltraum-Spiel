import { cross, dot, magnitude, scale, sub, type Vec3 } from "../../core/vector";
import type { SurfaceCollisionQueryPort, SurfacePlayerCommand } from "../contracts";
import {
  createSurfaceLocomotionState,
  stepSurfaceLocomotion,
  type SurfaceLocomotionConfig,
  type SurfaceLocomotionContext,
  type SurfaceLocomotionRejection,
  type SurfaceLocomotionState
} from "./locomotion";

export interface SurfaceFixedStepRuntime {
  readonly previousState: Readonly<SurfaceLocomotionState>;
  readonly currentState: Readonly<SurfaceLocomotionState>;
  readonly accumulatorSeconds: number;
  readonly interpolationAlpha: number;
}

export type SurfaceFixedStepAdvanceResult =
  | Readonly<{ readonly status: "Advanced"; readonly runtime: Readonly<SurfaceFixedStepRuntime>; readonly steps: number }>
  | Readonly<{
    readonly status: "Rejected";
    readonly runtime: Readonly<SurfaceFixedStepRuntime>;
    readonly steps: number;
    readonly rejection: Readonly<SurfaceLocomotionRejection>;
  }>;

export type SurfaceFixedStepCommandFactory = (
  simulationTick: number,
  state: Readonly<SurfaceLocomotionState>
) => Readonly<SurfacePlayerCommand>;

const SURFACE_FIXED_STEP_CONTACT_PROJECTION_MAX_ITERATIONS = 16 as const;
const SURFACE_FIXED_STEP_CONTACT_FEASIBILITY_EPSILON = 1e-9 as const;

const isFiniteVector = (value: Readonly<Vec3>): boolean =>
  Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);

const isContactFeasible = (
  velocityMetersPerSecond: Readonly<Vec3>,
  contactNormals: readonly Readonly<Vec3>[]
): boolean => contactNormals.every((normal) =>
  dot(velocityMetersPerSecond, normal) >= -SURFACE_FIXED_STEP_CONTACT_FEASIBILITY_EPSILON
);

const nearestFeasibleContactVelocity = (
  sourceVelocityMetersPerSecond: Readonly<Vec3>,
  contactNormals: readonly Readonly<Vec3>[]
): Vec3 => {
  let best: Vec3 | null = null;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  const consider = (candidate: Vec3): void => {
    if (!isFiniteVector(candidate) || !isContactFeasible(candidate, contactNormals)) return;
    const delta = sub(candidate, sourceVelocityMetersPerSecond);
    const distanceSquared = dot(delta, delta);
    if (distanceSquared < bestDistanceSquared) {
      best = candidate;
      bestDistanceSquared = distanceSquared;
    }
  };

  consider(sourceVelocityMetersPerSecond);
  for (const normal of contactNormals) {
    const lengthSquared = dot(normal, normal);
    if (lengthSquared <= 0 || !Number.isFinite(lengthSquared)) continue;
    consider(sub(
      sourceVelocityMetersPerSecond,
      scale(normal, dot(sourceVelocityMetersPerSecond, normal) / lengthSquared)
    ));
  }
  for (let leftIndex = 0; leftIndex < contactNormals.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < contactNormals.length; rightIndex += 1) {
      const line = cross(contactNormals[leftIndex]!, contactNormals[rightIndex]!);
      const lineLength = magnitude(line);
      if (lineLength <= 0 || !Number.isFinite(lineLength)) continue;
      const unitLine = scale(line, 1 / lineLength);
      consider(scale(unitLine, dot(sourceVelocityMetersPerSecond, unitLine)));
    }
  }
  consider({ x: 0, y: 0, z: 0 });

  if (best === null) {
    throw new Error("Surface fixed-step contact normals admit no finite velocity.");
  }
  return best;
};

const freezeRuntime = (
  previousState: Readonly<SurfaceLocomotionState>,
  currentState: Readonly<SurfaceLocomotionState>,
  accumulatorSeconds: number,
  fixedDeltaSeconds: number
): Readonly<SurfaceFixedStepRuntime> => Object.freeze({
  previousState,
  currentState,
  accumulatorSeconds,
  interpolationAlpha: accumulatorSeconds / fixedDeltaSeconds
});

export const createSurfaceFixedStepRuntime = (
  state: Readonly<SurfaceLocomotionState>
): Readonly<SurfaceFixedStepRuntime> => Object.freeze({
  previousState: state,
  currentState: state,
  accumulatorSeconds: 0,
  interpolationAlpha: 0
});

export const applySurfaceFixedStepCapsuleSeparation = (
  runtime: Readonly<SurfaceFixedStepRuntime>,
  correction: Readonly<{
    readonly positionMeters: Vec3;
    readonly contactNormals: readonly Vec3[];
  }>,
  fixedDeltaSeconds: number
): Readonly<SurfaceFixedStepRuntime> => {
  if (correction.contactNormals.length === 0) return runtime;
  const sourceVelocityMetersPerSecond = runtime.currentState.velocityMetersPerSecond;
  let velocityMetersPerSecond = sourceVelocityMetersPerSecond;
  for (
    let iteration = 0;
    iteration < SURFACE_FIXED_STEP_CONTACT_PROJECTION_MAX_ITERATIONS;
    iteration += 1
  ) {
    for (const normal of correction.contactNormals) {
      const intoNormal = dot(velocityMetersPerSecond, normal);
      if (intoNormal < 0) {
        velocityMetersPerSecond = sub(
          velocityMetersPerSecond,
          scale(normal, intoNormal)
        );
      }
    }
  }
  if (!isContactFeasible(velocityMetersPerSecond, correction.contactNormals)) {
    velocityMetersPerSecond = nearestFeasibleContactVelocity(
      sourceVelocityMetersPerSecond,
      correction.contactNormals
    );
  }
  const currentState = createSurfaceLocomotionState({
    ...runtime.currentState,
    positionMeters: correction.positionMeters,
    velocityMetersPerSecond
  });
  return freezeRuntime(
    runtime.previousState,
    currentState,
    runtime.accumulatorSeconds,
    fixedDeltaSeconds
  );
};

export const advanceSurfaceFixedStepRuntime = (
  runtime: Readonly<SurfaceFixedStepRuntime>,
  presentationDeltaSeconds: number,
  commandFactory: SurfaceFixedStepCommandFactory,
  context: Readonly<SurfaceLocomotionContext>,
  collisionPort: SurfaceCollisionQueryPort,
  config: Readonly<SurfaceLocomotionConfig>
): SurfaceFixedStepAdvanceResult => {
  if (!Number.isFinite(presentationDeltaSeconds) || presentationDeltaSeconds < 0) {
    throw new Error("Presentation delta must be finite and non-negative.");
  }

  let accumulatorSeconds = runtime.accumulatorSeconds + presentationDeltaSeconds;
  let previousState = runtime.previousState;
  let currentState = runtime.currentState;
  let steps = 0;

  while (accumulatorSeconds + 1e-12 >= config.fixedDeltaSeconds) {
    const command = commandFactory(currentState.simulationTick + 1, currentState);
    const result = stepSurfaceLocomotion(currentState, command, context, collisionPort, config);
    if (result.status === "Rejected") {
      const pausedAccumulatorSeconds = runtime.accumulatorSeconds + 1e-12 < config.fixedDeltaSeconds
        ? runtime.accumulatorSeconds
        : 0;
      return {
        status: "Rejected",
        runtime: freezeRuntime(previousState, currentState, pausedAccumulatorSeconds, config.fixedDeltaSeconds),
        steps,
        rejection: result.rejection
      };
    }
    previousState = currentState;
    currentState = result.state;
    accumulatorSeconds -= config.fixedDeltaSeconds;
    if (Math.abs(accumulatorSeconds) <= 1e-12) accumulatorSeconds = 0;
    steps += 1;
  }

  return {
    status: "Advanced",
    runtime: freezeRuntime(previousState, currentState, accumulatorSeconds, config.fixedDeltaSeconds),
    steps
  };
};
