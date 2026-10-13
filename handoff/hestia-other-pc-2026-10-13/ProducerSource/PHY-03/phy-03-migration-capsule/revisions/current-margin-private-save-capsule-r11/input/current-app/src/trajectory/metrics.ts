import type { Vec3 } from "../core/vector";
import { UNIVERSE_TICKS_PER_SECOND } from "../persistence/time";
import { propagateLinearGravitySourcePosition, TrajectoryPropagationError } from "./integrators";
import type { TrajectoryPropagationResult } from "./propagation";
import type { TrajectoryMetrics, TrajectoryPredictionRequest, TrajectoryState } from "./types";

interface RelativeInvariants {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly radiusMeters: number;
  readonly speedMetersPerSecond: number;
  readonly specificEnergy: number;
  readonly angularMomentumMagnitude: number;
}

const fail = (path: string, message: string): never => {
  throw new TrajectoryPropagationError("NonFiniteValue", path, message);
};

const finite = (value: number, path: string): number => {
  if (!Number.isFinite(value)) {
    return fail(path, "Trajectory metric arithmetic produced a nonfinite value.");
  }
  return Object.is(value, -0) ? 0 : value;
};

const subtract = (left: Vec3, right: Vec3, path: string): Vec3 => Object.freeze({
  x: finite(left.x - right.x, `${path}/x`),
  y: finite(left.y - right.y, `${path}/y`),
  z: finite(left.z - right.z, `${path}/z`)
});

const dot = (left: Vec3, right: Vec3, path: string): number =>
  finite(left.x * right.x + left.y * right.y + left.z * right.z, path);

const magnitude = (value: Vec3, path: string): number =>
  finite(Math.hypot(value.x, value.y, value.z), path);

const invariants = (
  request: TrajectoryPredictionRequest,
  state: TrajectoryState,
  path: string
): RelativeInvariants => {
  const sourcePosition = propagateLinearGravitySourcePosition(request.gravitySource, state.epochTick);
  const relativePosition = subtract(state.positionMeters, sourcePosition, `${path}/relativePosition`);
  const relativeVelocity = subtract(
    state.velocityMetersPerSecond,
    request.gravitySource.velocityMetersPerSecond,
    `${path}/relativeVelocity`
  );
  const radius = magnitude(relativePosition, `${path}/radiusMeters`);
  if (radius <= request.toleranceProfile.minimumGravityDistanceMeters) {
    throw new TrajectoryPropagationError(
      "MinimumGravityDistance",
      `${path}/radiusMeters`,
      "Trajectory metrics are undefined at or below the explicit minimum gravity distance."
    );
  }
  const speed = magnitude(relativeVelocity, `${path}/speedMetersPerSecond`);
  const speedSquared = dot(relativeVelocity, relativeVelocity, `${path}/speedSquared`);
  const specificEnergy = finite(
    0.5 * speedSquared - request.gravitySource.gravitationalParameterMu / radius,
    `${path}/specificOrbitalEnergy`
  );
  const cross = Object.freeze({
    x: finite(relativePosition.y * relativeVelocity.z - relativePosition.z * relativeVelocity.y, `${path}/angularMomentum/x`),
    y: finite(relativePosition.z * relativeVelocity.x - relativePosition.x * relativeVelocity.z, `${path}/angularMomentum/y`),
    z: finite(relativePosition.x * relativeVelocity.y - relativePosition.y * relativeVelocity.x, `${path}/angularMomentum/z`)
  });
  return Object.freeze({
    position: relativePosition,
    velocity: relativeVelocity,
    radiusMeters: radius,
    speedMetersPerSecond: speed,
    specificEnergy,
    angularMomentumMagnitude: magnitude(cross, `${path}/angularMomentumMagnitude`)
  });
};

const relativeDrift = (initial: number, final: number, floor: number, path: string): number =>
  finite(Math.abs(final - initial) / Math.max(Math.abs(initial), floor), path);

const circularClosure = (
  request: TrajectoryPredictionRequest,
  initial: RelativeInvariants,
  final: RelativeInvariants,
  endTick: number
): TrajectoryMetrics["circularClosure"] => {
  if (request.segments.some((segment) => segment.kind !== "GravityCoast")) {
    return null;
  }
  const circularSpeed = finite(
    Math.sqrt(request.gravitySource.gravitationalParameterMu / initial.radiusMeters),
    "/metrics/circularClosure/circularSpeed"
  );
  const radialSpeed = finite(
    dot(initial.position, initial.velocity, "/metrics/circularClosure/radialDot") / initial.radiusMeters,
    "/metrics/circularClosure/radialSpeed"
  );
  const radialRatio = finite(
    Math.abs(radialSpeed) / Math.max(circularSpeed, request.toleranceProfile.relativeDenominatorFloor),
    "/metrics/circularClosure/radialRatio"
  );
  const speedError = finite(
    Math.abs(initial.speedMetersPerSecond - circularSpeed) /
      Math.max(circularSpeed, request.toleranceProfile.relativeDenominatorFloor),
    "/metrics/circularClosure/speedError"
  );
  if (
    radialRatio > request.toleranceProfile.circularityTolerance ||
    speedError > request.toleranceProfile.circularityTolerance
  ) {
    return null;
  }
  const periodSeconds = finite(
    2 * Math.PI * initial.radiusMeters *
      Math.sqrt(initial.radiusMeters / request.gravitySource.gravitationalParameterMu),
    "/metrics/circularClosure/periodSeconds"
  );
  const unroundedTicks = finite(
    periodSeconds * UNIVERSE_TICKS_PER_SECOND,
    "/metrics/circularClosure/unroundedPeriodTicks"
  );
  if (unroundedTicks > Number.MAX_SAFE_INTEGER) {
    return fail("/metrics/circularClosure/roundedPeriodTicks", "Circular period exceeds the safe tick range.");
  }
  const roundedPeriodTicks = Math.floor(unroundedTicks + 0.5);
  if (endTick - request.initialState.epochTick !== roundedPeriodTicks) {
    return null;
  }
  const closureDistance = magnitude(
    subtract(final.position, initial.position, "/metrics/circularClosure/relativePositionDifference"),
    "/metrics/circularClosure/positionClosureDistanceMeters"
  );
  return Object.freeze({
    roundedPeriodTicks,
    positionClosureDistanceMeters: closureDistance,
    withinTolerance: closureDistance <= request.toleranceProfile.closureDistanceToleranceMeters
  });
};

export const calculateTrajectoryMetrics = (
  request: TrajectoryPredictionRequest,
  propagation: TrajectoryPropagationResult,
  totalSamples: number
): TrajectoryMetrics => {
  const initial = invariants(request, propagation.initialState, "/metrics/initial");
  const final = invariants(request, propagation.finalState, "/metrics/final");
  let maximumStepTicks = 0;
  for (const step of propagation.steps) {
    maximumStepTicks = Math.max(maximumStepTicks, step.endTick - step.startTick);
  }
  return Object.freeze({
    initialSpecificOrbitalEnergyJoulesPerKilogram: initial.specificEnergy,
    finalSpecificOrbitalEnergyJoulesPerKilogram: final.specificEnergy,
    initialSpecificAngularMomentumMetersSquaredPerSecond: initial.angularMomentumMagnitude,
    finalSpecificAngularMomentumMetersSquaredPerSecond: final.angularMomentumMagnitude,
    relativeEnergyDrift: relativeDrift(
      initial.specificEnergy,
      final.specificEnergy,
      request.toleranceProfile.relativeDenominatorFloor,
      "/metrics/relativeEnergyDrift"
    ),
    relativeAngularMomentumDrift: relativeDrift(
      initial.angularMomentumMagnitude,
      final.angularMomentumMagnitude,
      request.toleranceProfile.relativeDenominatorFloor,
      "/metrics/relativeAngularMomentumDrift"
    ),
    maximumStepTicks,
    maximumStepSeconds: finite(maximumStepTicks / UNIVERSE_TICKS_PER_SECOND, "/metrics/maximumStepSeconds"),
    totalIntegrationSteps: propagation.steps.length,
    totalSamples,
    circularClosure: circularClosure(request, initial, final, propagation.finalState.epochTick)
  });
};
