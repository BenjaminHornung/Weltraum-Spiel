import type { Vec3 } from "../core/vector";
import {
  createSimulationTick,
  UNIVERSE_TICKS_PER_SECOND,
  type SimulationTick
} from "../persistence/time";
import type {
  LinearPointMassGravitySource,
  TrajectoryIntegrator,
  TrajectoryState
} from "./types";

export type TrajectoryPropagationErrorCode =
  | "InvalidPropagationInput"
  | "MinimumGravityDistance"
  | "NonFiniteValue"
  | "UnsafeTickArithmetic";

export class TrajectoryPropagationError extends Error {
  public constructor(
    public readonly code: TrajectoryPropagationErrorCode,
    public readonly path: string,
    message: string
  ) {
    super(message);
    this.name = "TrajectoryPropagationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface TrajectoryIntegrationContext {
  readonly gravitySource: LinearPointMassGravitySource;
  readonly minimumGravityDistanceMeters: number;
  readonly inertialAccelerationMetersPerSecondSquared: Vec3;
}

const fail = (code: TrajectoryPropagationErrorCode, path: string, message: string): never => {
  throw new TrajectoryPropagationError(code, path, message);
};

const canonicalFinite = (value: number, path: string): number => {
  if (!Number.isFinite(value)) {
    return fail("NonFiniteValue", path, "Trajectory propagation produced a nonfinite value.");
  }
  return Object.is(value, -0) ? 0 : value;
};

const inputFinite = (value: number, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail("InvalidPropagationInput", path, "Trajectory propagation requires a finite number.");
  }
  return Object.is(value, -0) ? 0 : value;
};

const positiveFinite = (value: number, path: string): number => {
  const parsed = inputFinite(value, path);
  if (parsed <= 0) {
    return fail("InvalidPropagationInput", path, "Trajectory propagation requires a positive finite number.");
  }
  return parsed;
};

const checkedAdd = (left: number, right: number, path: string): number =>
  canonicalFinite(left + right, path);

const checkedSubtract = (left: number, right: number, path: string): number =>
  canonicalFinite(left - right, path);

const checkedMultiply = (left: number, right: number, path: string): number =>
  canonicalFinite(left * right, path);

const checkedDivide = (numerator: number, denominator: number, path: string): number =>
  canonicalFinite(numerator / denominator, path);

const snapshotVector = (value: Vec3, path: string): Vec3 =>
  Object.freeze({
    x: inputFinite(value.x, `${path}/x`),
    y: inputFinite(value.y, `${path}/y`),
    z: inputFinite(value.z, `${path}/z`)
  });

const checkedVector = (x: number, y: number, z: number, path: string): Vec3 =>
  Object.freeze({
    x: canonicalFinite(x, `${path}/x`),
    y: canonicalFinite(y, `${path}/y`),
    z: canonicalFinite(z, `${path}/z`)
  });

const addVectors = (left: Vec3, right: Vec3, path: string): Vec3 =>
  checkedVector(
    checkedAdd(left.x, right.x, `${path}/x`),
    checkedAdd(left.y, right.y, `${path}/y`),
    checkedAdd(left.z, right.z, `${path}/z`),
    path
  );

const subtractVectors = (left: Vec3, right: Vec3, path: string): Vec3 =>
  checkedVector(
    checkedSubtract(left.x, right.x, `${path}/x`),
    checkedSubtract(left.y, right.y, `${path}/y`),
    checkedSubtract(left.z, right.z, `${path}/z`),
    path
  );

const scaleVector = (value: Vec3, factor: number, path: string): Vec3 =>
  checkedVector(
    checkedMultiply(value.x, factor, `${path}/x`),
    checkedMultiply(value.y, factor, `${path}/y`),
    checkedMultiply(value.z, factor, `${path}/z`),
    path
  );

const addScaledVector = (base: Vec3, value: Vec3, factor: number, path: string): Vec3 =>
  addVectors(base, scaleVector(value, factor, `${path}/scaled`), path);

export const snapshotTrajectoryState = (state: TrajectoryState, path = "/state"): TrajectoryState => {
  let epochTick: SimulationTick;
  try {
    epochTick = createSimulationTick(state.epochTick, `${path}/epochTick`);
  } catch {
    return fail(
      "InvalidPropagationInput",
      `${path}/epochTick`,
      "Trajectory state epoch must be a nonnegative safe integer tick."
    );
  }
  const frameIdText: string = state.frameId;
  if (frameIdText.length === 0) {
    return fail("InvalidPropagationInput", `${path}/frameId`, "Trajectory state frame must be explicit.");
  }
  return Object.freeze({
    frameId: state.frameId,
    epochTick,
    positionMeters: snapshotVector(state.positionMeters, `${path}/positionMeters`),
    velocityMetersPerSecond: snapshotVector(
      state.velocityMetersPerSecond,
      `${path}/velocityMetersPerSecond`
    ),
    massKilograms: positiveFinite(state.massKilograms, `${path}/massKilograms`)
  });
};

export const snapshotLinearPointMassGravitySource = (
  source: LinearPointMassGravitySource,
  path = "/gravitySource"
): LinearPointMassGravitySource => {
  let epochTick: SimulationTick;
  try {
    epochTick = createSimulationTick(source.epochTick, `${path}/epochTick`);
  } catch {
    return fail(
      "InvalidPropagationInput",
      `${path}/epochTick`,
      "Gravity source epoch must be a nonnegative safe integer tick."
    );
  }
  const frameIdText: string = source.frameId;
  if (frameIdText.length === 0) {
    return fail("InvalidPropagationInput", `${path}/frameId`, "Gravity source frame must be explicit.");
  }
  return Object.freeze({
    frameId: source.frameId,
    epochTick,
    positionMeters: snapshotVector(source.positionMeters, `${path}/positionMeters`),
    velocityMetersPerSecond: snapshotVector(
      source.velocityMetersPerSecond,
      `${path}/velocityMetersPerSecond`
    ),
    gravitationalParameterMu: positiveFinite(
      source.gravitationalParameterMu,
      `${path}/gravitationalParameterMu`
    )
  });
};

const snapshotContext = (context: TrajectoryIntegrationContext): TrajectoryIntegrationContext =>
  Object.freeze({
    gravitySource: snapshotLinearPointMassGravitySource(context.gravitySource),
    minimumGravityDistanceMeters: positiveFinite(
      context.minimumGravityDistanceMeters,
      "/minimumGravityDistanceMeters"
    ),
    inertialAccelerationMetersPerSecondSquared: snapshotVector(
      context.inertialAccelerationMetersPerSecondSquared,
      "/inertialAccelerationMetersPerSecondSquared"
    )
  });

const sourcePositionAtStage = (
  source: LinearPointMassGravitySource,
  stageTick: number,
  path: string
): Vec3 => {
  const parsedStageTick = inputFinite(stageTick, `${path}/stageTick`);
  const elapsedTicksCandidate = parsedStageTick - source.epochTick;
  const reconstructedStageTick = source.epochTick + elapsedTicksCandidate;
  if (
    !Number.isFinite(elapsedTicksCandidate) ||
    !Number.isFinite(reconstructedStageTick) ||
    reconstructedStageTick !== parsedStageTick
  ) {
    return fail(
      "UnsafeTickArithmetic",
      `${path}/elapsedTicks`,
      "Source-relative stage tick subtraction must be finite and exactly reversible."
    );
  }
  const elapsedTicks = Object.is(elapsedTicksCandidate, -0) ? 0 : elapsedTicksCandidate;
  const elapsedSeconds = checkedDivide(
    elapsedTicks,
    UNIVERSE_TICKS_PER_SECOND,
    `${path}/elapsedSeconds`
  );
  return addScaledVector(
    source.positionMeters,
    source.velocityMetersPerSecond,
    elapsedSeconds,
    `${path}/positionMeters`
  );
};

export const propagateLinearGravitySourcePosition = (
  source: LinearPointMassGravitySource,
  stageTick: number
): Vec3 => sourcePositionAtStage(snapshotLinearPointMassGravitySource(source), stageTick, "/sourceStage");

const accelerationAtStage = (
  objectPositionMeters: Vec3,
  stageTick: number,
  context: TrajectoryIntegrationContext,
  path: string
): Vec3 => {
  const sourcePosition = sourcePositionAtStage(context.gravitySource, stageTick, `${path}/source`);
  const displacement = subtractVectors(sourcePosition, objectPositionMeters, `${path}/displacement`);
  const distanceMeters = canonicalFinite(
    Math.hypot(displacement.x, displacement.y, displacement.z),
    `${path}/distanceMeters`
  );
  if (distanceMeters <= context.minimumGravityDistanceMeters) {
    return fail(
      "MinimumGravityDistance",
      `${path}/distanceMeters`,
      "Gravity acceleration is undefined at or below the explicit minimum distance."
    );
  }

  const normalizedDisplacement = scaleVector(
    displacement,
    checkedDivide(1, distanceMeters, `${path}/normalizedDisplacement/inverseDistance`),
    `${path}/normalizedDisplacement`
  );
  // Evaluate mu / r^2 before applying the normalized direction. This avoids
  // underflow in mu / r^3 before multiplication by a very large displacement.
  const accelerationMagnitude = checkedDivide(
    checkedDivide(
      context.gravitySource.gravitationalParameterMu,
      distanceMeters,
      `${path}/accelerationMagnitude/r1`
    ),
    distanceMeters,
    `${path}/accelerationMagnitude/r2`
  );
  const gravityAcceleration = scaleVector(
    normalizedDisplacement,
    accelerationMagnitude,
    `${path}/gravityAcceleration`
  );
  return addVectors(
    gravityAcceleration,
    context.inertialAccelerationMetersPerSecondSquared,
    `${path}/totalAcceleration`
  );
};

export const evaluateTrajectoryAcceleration = (
  objectPositionMeters: Vec3,
  stageTick: number,
  context: TrajectoryIntegrationContext
): Vec3 =>
  accelerationAtStage(
    snapshotVector(objectPositionMeters, "/objectPositionMeters"),
    stageTick,
    snapshotContext(context),
    "/acceleration"
  );

interface PreparedStep {
  readonly state: TrajectoryState;
  readonly context: TrajectoryIntegrationContext;
  readonly stepTicks: number;
  readonly deltaSeconds: number;
  readonly endTick: SimulationTick;
  readonly midpointTick: number;
}

const prepareStep = (
  state: TrajectoryState,
  stepTicks: number,
  context: TrajectoryIntegrationContext
): PreparedStep => {
  const ownedState = snapshotTrajectoryState(state);
  const ownedContext = snapshotContext(context);
  if (ownedContext.gravitySource.frameId !== ownedState.frameId) {
    return fail(
      "InvalidPropagationInput",
      "/gravitySource/frameId",
      "Gravity source and trajectory state frames must match exactly."
    );
  }
  if (!Number.isSafeInteger(stepTicks) || stepTicks <= 0) {
    return fail("InvalidPropagationInput", "/stepTicks", "Integrator stepTicks must be a positive safe integer.");
  }
  if (stepTicks > Number.MAX_SAFE_INTEGER - ownedState.epochTick) {
    return fail("UnsafeTickArithmetic", "/stepTicks", "Integrator step end tick is unsafe.");
  }
  const endTick = createSimulationTick(ownedState.epochTick + stepTicks, "/endTick");
  const midpointTick = checkedAdd(ownedState.epochTick, stepTicks / 2, "/midpointTick");
  if (
    (midpointTick - ownedState.epochTick) * 2 !== stepTicks ||
    (endTick - midpointTick) * 2 !== stepTicks
  ) {
    return fail(
      "UnsafeTickArithmetic",
      "/midpointTick",
      "Integrator midpoint tick cannot be represented exactly."
    );
  }
  const deltaSeconds = checkedDivide(stepTicks, UNIVERSE_TICKS_PER_SECOND, "/deltaSeconds");
  return Object.freeze({
    state: ownedState,
    context: ownedContext,
    stepTicks,
    deltaSeconds,
    endTick,
    midpointTick
  });
};

const createEndState = (
  prepared: PreparedStep,
  positionMeters: Vec3,
  velocityMetersPerSecond: Vec3
): TrajectoryState =>
  Object.freeze({
    frameId: prepared.state.frameId,
    epochTick: prepared.endTick,
    positionMeters: snapshotVector(positionMeters, "/result/positionMeters"),
    velocityMetersPerSecond: snapshotVector(
      velocityMetersPerSecond,
      "/result/velocityMetersPerSecond"
    ),
    massKilograms: prepared.state.massKilograms
  });

export const integrateSemiImplicitEulerStep = (
  state: TrajectoryState,
  stepTicks: number,
  context: TrajectoryIntegrationContext
): TrajectoryState => {
  const prepared = prepareStep(state, stepTicks, context);
  const acceleration = accelerationAtStage(
    prepared.state.positionMeters,
    prepared.state.epochTick,
    prepared.context,
    "/semiImplicitEuler/startAcceleration"
  );
  const velocity = addScaledVector(
    prepared.state.velocityMetersPerSecond,
    acceleration,
    prepared.deltaSeconds,
    "/semiImplicitEuler/velocity"
  );
  const position = addScaledVector(
    prepared.state.positionMeters,
    velocity,
    prepared.deltaSeconds,
    "/semiImplicitEuler/position"
  );
  return createEndState(prepared, position, velocity);
};

export const integrateVelocityVerletStep = (
  state: TrajectoryState,
  stepTicks: number,
  context: TrajectoryIntegrationContext
): TrajectoryState => {
  const prepared = prepareStep(state, stepTicks, context);
  const startAcceleration = accelerationAtStage(
    prepared.state.positionMeters,
    prepared.state.epochTick,
    prepared.context,
    "/velocityVerlet/startAcceleration"
  );
  const deltaSecondsSquared = checkedMultiply(
    prepared.deltaSeconds,
    prepared.deltaSeconds,
    "/velocityVerlet/deltaSecondsSquared"
  );
  const driftedPosition = addScaledVector(
    addScaledVector(
      prepared.state.positionMeters,
      prepared.state.velocityMetersPerSecond,
      prepared.deltaSeconds,
      "/velocityVerlet/position/velocityTerm"
    ),
    startAcceleration,
    checkedMultiply(0.5, deltaSecondsSquared, "/velocityVerlet/position/accelerationFactor"),
    "/velocityVerlet/position"
  );
  const endAcceleration = accelerationAtStage(
    driftedPosition,
    prepared.endTick,
    prepared.context,
    "/velocityVerlet/endAcceleration"
  );
  const averageAcceleration = addVectors(
    scaleVector(startAcceleration, 0.5, "/velocityVerlet/averageAcceleration/start"),
    scaleVector(endAcceleration, 0.5, "/velocityVerlet/averageAcceleration/end"),
    "/velocityVerlet/averageAcceleration"
  );
  const velocity = addScaledVector(
    prepared.state.velocityMetersPerSecond,
    averageAcceleration,
    prepared.deltaSeconds,
    "/velocityVerlet/velocity"
  );
  return createEndState(prepared, driftedPosition, velocity);
};

interface StateDerivative {
  readonly position: Vec3;
  readonly velocity: Vec3;
}

const derivativeAtStage = (
  positionMeters: Vec3,
  velocityMetersPerSecond: Vec3,
  stageTick: number,
  context: TrajectoryIntegrationContext,
  path: string
): StateDerivative =>
  Object.freeze({
    position: snapshotVector(velocityMetersPerSecond, `${path}/positionDerivative`),
    velocity: accelerationAtStage(positionMeters, stageTick, context, `${path}/velocityDerivative`)
  });

const rk4WeightedDerivative = (
  first: Vec3,
  second: Vec3,
  third: Vec3,
  fourth: Vec3,
  path: string
): Vec3 =>
  addVectors(
    addVectors(scaleVector(first, 1 / 6, `${path}/k1`), scaleVector(second, 1 / 3, `${path}/k2`), path),
    addVectors(scaleVector(third, 1 / 3, `${path}/k3`), scaleVector(fourth, 1 / 6, `${path}/k4`), path),
    path
  );

export const integrateRungeKutta4Step = (
  state: TrajectoryState,
  stepTicks: number,
  context: TrajectoryIntegrationContext
): TrajectoryState => {
  const prepared = prepareStep(state, stepTicks, context);
  const halfDeltaSeconds = checkedMultiply(0.5, prepared.deltaSeconds, "/rungeKutta4/halfDeltaSeconds");

  const k1 = derivativeAtStage(
    prepared.state.positionMeters,
    prepared.state.velocityMetersPerSecond,
    prepared.state.epochTick,
    prepared.context,
    "/rungeKutta4/k1"
  );
  const k2 = derivativeAtStage(
    addScaledVector(
      prepared.state.positionMeters,
      k1.position,
      halfDeltaSeconds,
      "/rungeKutta4/k2/position"
    ),
    addScaledVector(
      prepared.state.velocityMetersPerSecond,
      k1.velocity,
      halfDeltaSeconds,
      "/rungeKutta4/k2/velocity"
    ),
    prepared.midpointTick,
    prepared.context,
    "/rungeKutta4/k2"
  );
  const k3 = derivativeAtStage(
    addScaledVector(
      prepared.state.positionMeters,
      k2.position,
      halfDeltaSeconds,
      "/rungeKutta4/k3/position"
    ),
    addScaledVector(
      prepared.state.velocityMetersPerSecond,
      k2.velocity,
      halfDeltaSeconds,
      "/rungeKutta4/k3/velocity"
    ),
    prepared.midpointTick,
    prepared.context,
    "/rungeKutta4/k3"
  );
  const k4 = derivativeAtStage(
    addScaledVector(
      prepared.state.positionMeters,
      k3.position,
      prepared.deltaSeconds,
      "/rungeKutta4/k4/position"
    ),
    addScaledVector(
      prepared.state.velocityMetersPerSecond,
      k3.velocity,
      prepared.deltaSeconds,
      "/rungeKutta4/k4/velocity"
    ),
    prepared.endTick,
    prepared.context,
    "/rungeKutta4/k4"
  );

  const position = addScaledVector(
    prepared.state.positionMeters,
    rk4WeightedDerivative(k1.position, k2.position, k3.position, k4.position, "/rungeKutta4/positionWeight"),
    prepared.deltaSeconds,
    "/rungeKutta4/position"
  );
  const velocity = addScaledVector(
    prepared.state.velocityMetersPerSecond,
    rk4WeightedDerivative(k1.velocity, k2.velocity, k3.velocity, k4.velocity, "/rungeKutta4/velocityWeight"),
    prepared.deltaSeconds,
    "/rungeKutta4/velocity"
  );
  return createEndState(prepared, position, velocity);
};

export const integrateTrajectoryStep = (
  integrator: TrajectoryIntegrator,
  state: TrajectoryState,
  stepTicks: number,
  context: TrajectoryIntegrationContext
): TrajectoryState => {
  switch (integrator) {
    case "SemiImplicitEuler":
      return integrateSemiImplicitEulerStep(state, stepTicks, context);
    case "VelocityVerlet":
      return integrateVelocityVerletStep(state, stepTicks, context);
    case "RungeKutta4":
      return integrateRungeKutta4Step(state, stepTicks, context);
    default:
      return fail(
        "InvalidPropagationInput",
        "/integrator",
        "Trajectory integrator policy must explicitly select a supported integrator."
      );
  }
};
