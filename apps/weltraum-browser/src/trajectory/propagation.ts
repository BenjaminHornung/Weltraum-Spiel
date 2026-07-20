import type { Vec3 } from "../core/vector";
import { createSimulationTick, type SimulationTick } from "../persistence/time";
import {
  integrateTrajectoryStep,
  snapshotLinearPointMassGravitySource,
  snapshotTrajectoryState,
  TrajectoryPropagationError,
  type TrajectoryIntegrationContext
} from "./integrators";
import type {
  ConstantInertialAccelerationSegment,
  GravityCoastSegment,
  ImpulseDeltaVSegment,
  LinearPointMassGravitySource,
  TrajectoryContinuousSegment,
  TrajectoryIntegrator,
  TrajectoryIntegratorPolicy,
  TrajectorySegment,
  TrajectorySegmentResult,
  TrajectoryState,
  ValidTrajectoryRequest
} from "./types";

const ZERO_INERTIAL_ACCELERATION: Vec3 = Object.freeze({ x: 0, y: 0, z: 0 });

export interface TrajectoryIntegratedStep {
  readonly segmentId: TrajectoryContinuousSegment["segmentId"];
  readonly segmentKind: TrajectoryContinuousSegment["kind"];
  readonly resolvedIntegrator: TrajectoryIntegrator;
  readonly stepOrdinal: number;
  readonly startTick: SimulationTick;
  readonly endTick: SimulationTick;
  readonly startState: TrajectoryState;
  readonly endState: TrajectoryState;
}

export interface TrajectorySegmentExecution {
  readonly result: TrajectorySegmentResult;
  readonly steps: readonly TrajectoryIntegratedStep[];
}

export interface TrajectoryPropagationResult {
  readonly initialState: TrajectoryState;
  readonly finalState: TrajectoryState;
  readonly segmentResults: readonly TrajectorySegmentResult[];
  readonly steps: readonly TrajectoryIntegratedStep[];
}

export interface TrajectorySegmentPropagationContext {
  readonly gravitySource: LinearPointMassGravitySource;
  readonly integratorPolicy: TrajectoryIntegratorPolicy;
  readonly stepTicks: number;
  readonly minimumGravityDistanceMeters: number;
}

const invalid = (path: string, message: string): never => {
  throw new TrajectoryPropagationError("InvalidPropagationInput", path, message);
};

const snapshotFiniteVector = (value: Vec3, path: string): Vec3 => {
  const component = (candidate: number, componentPath: string): number => {
    if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
      return invalid(componentPath, "Trajectory vector components must be finite.");
    }
    return Object.is(candidate, -0) ? 0 : candidate;
  };
  return Object.freeze({
    x: component(value.x, `${path}/x`),
    y: component(value.y, `${path}/y`),
    z: component(value.z, `${path}/z`)
  });
};

const checkedVelocityAddition = (velocity: Vec3, deltaVelocity: Vec3): Vec3 => {
  const add = (left: number, right: number, path: string): number => {
    const result = left + right;
    if (!Number.isFinite(result)) {
      throw new TrajectoryPropagationError(
        "NonFiniteValue",
        path,
        "Impulse velocity addition produced a nonfinite value."
      );
    }
    return Object.is(result, -0) ? 0 : result;
  };
  return Object.freeze({
    x: add(velocity.x, deltaVelocity.x, "/impulse/postVelocity/x"),
    y: add(velocity.y, deltaVelocity.y, "/impulse/postVelocity/y"),
    z: add(velocity.z, deltaVelocity.z, "/impulse/postVelocity/z")
  });
};

const exactTick = (value: number, path: string): SimulationTick => {
  try {
    return createSimulationTick(value, path);
  } catch {
    return invalid(path, "Trajectory propagation requires a nonnegative safe integer tick.");
  }
};

const supportedIntegrator = (value: TrajectoryIntegrator, path: string): TrajectoryIntegrator => {
  switch (value) {
    case "SemiImplicitEuler":
    case "VelocityVerlet":
    case "RungeKutta4":
      return value;
    default:
      return invalid(path, "Trajectory propagation requires an explicit supported integrator policy.");
  }
};

export const resolveTrajectoryIntegrator = (
  segment: TrajectoryContinuousSegment,
  policy: TrajectoryIntegratorPolicy
): TrajectoryIntegrator =>
  segment.kind === "GravityCoast"
    ? supportedIntegrator(policy.gravityCoast, "/integratorPolicy/gravityCoast")
    : supportedIntegrator(
        policy.constantInertialAcceleration,
        "/integratorPolicy/constantInertialAcceleration"
      );

const assertStateAtSegment = (
  state: TrajectoryState,
  segmentFrameId: TrajectorySegment["frameId"],
  segmentTick: SimulationTick,
  path: string
): void => {
  if (state.frameId !== segmentFrameId) {
    invalid(`${path}/frameId`, "Trajectory segment and state frames must match exactly.");
  }
  if (state.epochTick !== segmentTick) {
    invalid(`${path}/tick`, "Trajectory segment must execute at the state's exact epoch tick.");
  }
};

export const applyImpulseDeltaV = (
  state: TrajectoryState,
  segment: ImpulseDeltaVSegment
): TrajectorySegmentExecution => {
  const preImpulseState = snapshotTrajectoryState(state, "/impulse/preState");
  const impulseTick = exactTick(segment.tick, "/impulse/tick");
  assertStateAtSegment(preImpulseState, segment.frameId, impulseTick, "/impulse");
  const deltaVelocity = snapshotFiniteVector(
    segment.deltaVelocityMetersPerSecond,
    "/impulse/deltaVelocityMetersPerSecond"
  );
  const postImpulseState: TrajectoryState = Object.freeze({
    frameId: preImpulseState.frameId,
    epochTick: impulseTick,
    positionMeters: snapshotFiniteVector(preImpulseState.positionMeters, "/impulse/postPositionMeters"),
    velocityMetersPerSecond: checkedVelocityAddition(
      preImpulseState.velocityMetersPerSecond,
      deltaVelocity
    ),
    massKilograms: preImpulseState.massKilograms
  });
  const result = Object.freeze({
    kind: "ImpulseDeltaV" as const,
    segmentId: segment.segmentId,
    frameId: segment.frameId,
    tick: impulseTick,
    preImpulseState,
    postImpulseState
  });
  return Object.freeze({ result, steps: Object.freeze([]) });
};

const propagationAcceleration = (segment: TrajectoryContinuousSegment): Vec3 =>
  segment.kind === "ConstantInertialAcceleration"
    ? snapshotFiniteVector(
        segment.accelerationMetersPerSecondSquared,
        "/segment/accelerationMetersPerSecondSquared"
      )
    : ZERO_INERTIAL_ACCELERATION;

const createContinuousResult = (
  segment: TrajectoryContinuousSegment,
  resolvedIntegrator: TrajectoryIntegrator,
  integrationSteps: number,
  initialState: TrajectoryState,
  finalState: TrajectoryState
): TrajectorySegmentResult => {
  const common = {
    segmentId: segment.segmentId,
    frameId: initialState.frameId,
    startTick: initialState.epochTick,
    endTick: finalState.epochTick,
    resolvedIntegrator,
    integrationSteps,
    initialState,
    finalState
  };
  if (segment.kind === "GravityCoast") {
    return Object.freeze({ kind: "GravityCoast", ...common } satisfies GravityCoastSegment & TrajectorySegmentResult);
  }
  return Object.freeze({
    kind: "ConstantInertialAcceleration",
    ...common
  } satisfies Omit<ConstantInertialAccelerationSegment, "accelerationMetersPerSecondSquared"> & TrajectorySegmentResult);
};

export const propagateContinuousTrajectorySegment = (
  state: TrajectoryState,
  segment: TrajectoryContinuousSegment,
  context: TrajectorySegmentPropagationContext
): TrajectorySegmentExecution => {
  const initialState = snapshotTrajectoryState(state, "/segment/initialState");
  const startTick = exactTick(segment.startTick, "/segment/startTick");
  const endTick = exactTick(segment.endTick, "/segment/endTick");
  assertStateAtSegment(initialState, segment.frameId, startTick, "/segment");
  if (!Number.isSafeInteger(context.stepTicks) || context.stepTicks <= 0) {
    return invalid("/stepTicks", "Trajectory propagation stepTicks must be a positive safe integer.");
  }
  const durationTicks = endTick - startTick;
  if (!Number.isSafeInteger(durationTicks) || durationTicks <= 0) {
    return invalid("/segment/endTick", "Continuous trajectory duration must be a positive safe tick count.");
  }
  if (durationTicks % context.stepTicks !== 0) {
    return invalid("/segment/endTick", "Continuous trajectory duration must align exactly to stepTicks.");
  }
  if (context.gravitySource.frameId !== initialState.frameId) {
    return invalid("/gravitySource/frameId", "Gravity source and trajectory state frames must match exactly.");
  }

  const resolvedIntegrator = resolveTrajectoryIntegrator(segment, context.integratorPolicy);
  const gravitySource = snapshotLinearPointMassGravitySource(context.gravitySource);
  const integrationContext: TrajectoryIntegrationContext = Object.freeze({
    gravitySource,
    minimumGravityDistanceMeters: context.minimumGravityDistanceMeters,
    inertialAccelerationMetersPerSecondSquared: propagationAcceleration(segment)
  });
  const integrationStepCount = durationTicks / context.stepTicks;
  const steps: TrajectoryIntegratedStep[] = [];
  let currentState = initialState;

  for (let stepIndex = 0; stepIndex < integrationStepCount; stepIndex += 1) {
    const expectedStartTick = startTick + stepIndex * context.stepTicks;
    const expectedEndTick = startTick + (stepIndex + 1) * context.stepTicks;
    if (
      !Number.isSafeInteger(expectedStartTick) ||
      !Number.isSafeInteger(expectedEndTick) ||
      currentState.epochTick !== expectedStartTick
    ) {
      throw new TrajectoryPropagationError(
        "UnsafeTickArithmetic",
        "/segment/steps",
        "Continuous trajectory step boundaries must remain exact safe integer ticks."
      );
    }
    const endState = integrateTrajectoryStep(
      resolvedIntegrator,
      currentState,
      context.stepTicks,
      integrationContext
    );
    if (endState.epochTick !== expectedEndTick) {
      throw new TrajectoryPropagationError(
        "UnsafeTickArithmetic",
        "/segment/steps/endTick",
        "Integrator output did not preserve the exact step boundary tick."
      );
    }
    steps.push(
      Object.freeze({
        segmentId: segment.segmentId,
        segmentKind: segment.kind,
        resolvedIntegrator,
        stepOrdinal: stepIndex + 1,
        startTick: currentState.epochTick,
        endTick: endState.epochTick,
        startState: currentState,
        endState
      })
    );
    currentState = endState;
  }

  const result = createContinuousResult(
    segment,
    resolvedIntegrator,
    integrationStepCount,
    initialState,
    currentState
  );
  return Object.freeze({ result, steps: Object.freeze(steps) });
};

export const propagateTrajectorySegment = (
  state: TrajectoryState,
  segment: TrajectorySegment,
  context: TrajectorySegmentPropagationContext
): TrajectorySegmentExecution =>
  segment.kind === "ImpulseDeltaV"
    ? applyImpulseDeltaV(state, segment)
    : propagateContinuousTrajectorySegment(state, segment, context);

export const propagateTrajectoryRequest = (
  validatedRequest: ValidTrajectoryRequest
): TrajectoryPropagationResult => {
  const request = validatedRequest.request;
  const initialState = snapshotTrajectoryState(request.initialState, "/initialState");
  const gravitySource = snapshotLinearPointMassGravitySource(request.gravitySource);
  if (gravitySource.frameId !== initialState.frameId) {
    return invalid("/gravitySource/frameId", "Gravity source and initial state frames must match exactly.");
  }
  const context: TrajectorySegmentPropagationContext = Object.freeze({
    gravitySource,
    integratorPolicy: Object.freeze({
      gravityCoast: supportedIntegrator(
        request.integratorPolicy.gravityCoast,
        "/integratorPolicy/gravityCoast"
      ),
      constantInertialAcceleration: supportedIntegrator(
        request.integratorPolicy.constantInertialAcceleration,
        "/integratorPolicy/constantInertialAcceleration"
      )
    }),
    stepTicks: request.stepTicks,
    minimumGravityDistanceMeters: request.toleranceProfile.minimumGravityDistanceMeters
  });
  const segmentResults: TrajectorySegmentResult[] = [];
  const steps: TrajectoryIntegratedStep[] = [];
  let currentState = initialState;

  for (const segment of request.segments) {
    const execution = propagateTrajectorySegment(currentState, segment, context);
    segmentResults.push(execution.result);
    for (const step of execution.steps) {
      steps.push(step);
    }
    currentState = execution.result.kind === "ImpulseDeltaV"
      ? execution.result.postImpulseState
      : execution.result.finalState;
  }

  return Object.freeze({
    initialState,
    finalState: currentState,
    segmentResults: Object.freeze(segmentResults),
    steps: Object.freeze(steps)
  });
};
