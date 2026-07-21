import { describe, expect, it } from "vitest";
import {
  createHestiaAccelerationImpulseTrajectoryRequest,
  createHestiaCircularTrajectoryRequest,
  HESTIA_TRAJECTORY_GRAVITATIONAL_PARAMETER_MU,
  predictTrajectory
} from "../../src/trajectory";
import type { TrajectoryState } from "../../src/trajectory";

const ticksPerSecond = 120;

const independentOrbitalMetrics = (
  state: TrajectoryState,
  sourcePositionAtEpoch: { readonly x: number; readonly y: number; readonly z: number },
  sourceVelocity: { readonly x: number; readonly y: number; readonly z: number },
  gravitationalParameterMu: number
) => {
  const relativePosition = {
    x: state.positionMeters.x - sourcePositionAtEpoch.x,
    y: state.positionMeters.y - sourcePositionAtEpoch.y,
    z: state.positionMeters.z - sourcePositionAtEpoch.z
  };
  const relativeVelocity = {
    x: state.velocityMetersPerSecond.x - sourceVelocity.x,
    y: state.velocityMetersPerSecond.y - sourceVelocity.y,
    z: state.velocityMetersPerSecond.z - sourceVelocity.z
  };
  const radiusMeters = Math.hypot(relativePosition.x, relativePosition.y, relativePosition.z);
  const speedMetersPerSecond = Math.hypot(relativeVelocity.x, relativeVelocity.y, relativeVelocity.z);
  const angularMomentum = {
    x: relativePosition.y * relativeVelocity.z - relativePosition.z * relativeVelocity.y,
    y: relativePosition.z * relativeVelocity.x - relativePosition.x * relativeVelocity.z,
    z: relativePosition.x * relativeVelocity.y - relativePosition.y * relativeVelocity.x
  };
  return {
    energy: speedMetersPerSecond ** 2 / 2 - gravitationalParameterMu / radiusMeters,
    angularMomentum: Math.hypot(angularMomentum.x, angularMomentum.y, angularMomentum.z)
  };
};

const relativeDrift = (initial: number, final: number, denominatorFloor: number): number =>
  Math.abs(final - initial) / Math.max(Math.abs(initial), denominatorFloor);

const expectRelativeClose = (actual: number, expected: number): void => {
  expect(Math.abs(actual - expected) / Math.max(1, Math.abs(expected))).toBeLessThan(1e-12);
};

const collectNumbers = (value: unknown, output: number[] = [], seen = new WeakSet<object>()): number[] => {
  if (typeof value === "number") {
    output.push(value);
    return output;
  }
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return output;
  }
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && "value" in descriptor) {
      collectNumbers(descriptor.value, output, seen);
    }
  }
  return output;
};

describe("trajectory metrics", () => {
  it("reports finite metrics and internally consistent counts", () => {
    const request = createHestiaAccelerationImpulseTrajectoryRequest();

    const result = predictTrajectory(request);

    expect(result.status).toBe("Completed");
    if (result.status !== "Completed") {
      throw new Error(`Metrics fixture rejected: ${result.issues[0]?.message ?? "unknown"}`);
    }
    expect(result.metrics.totalIntegrationSteps).toBe(100);
    expect(result.metrics.totalSamples).toBe(result.samples.length);
    expect(result.metrics.maximumStepTicks).toBe(request.stepTicks);
    expect(result.metrics.maximumStepSeconds).toBe(request.stepTicks / 120);
    expect(result.metrics.circularClosure).toBeNull();
    expect(collectNumbers(result).every(Number.isFinite)).toBe(true);
  });

  it("matches independent source-relative energy and angular-momentum oracles", () => {
    const base = createHestiaCircularTrajectoryRequest();
    const sourceVelocity = { x: 5, y: -2, z: 0.25 };
    const request = {
      ...base,
      initialState: {
        ...base.initialState,
        velocityMetersPerSecond: {
          x: base.initialState.velocityMetersPerSecond.x + sourceVelocity.x,
          y: base.initialState.velocityMetersPerSecond.y + sourceVelocity.y,
          z: base.initialState.velocityMetersPerSecond.z + sourceVelocity.z
        }
      },
      gravitySource: {
        ...base.gravitySource,
        velocityMetersPerSecond: sourceVelocity
      }
    };

    const result = predictTrajectory(request);

    expect(result.status).toBe("Completed");
    if (result.status !== "Completed") {
      throw new Error(`Moving-source metric request rejected: ${result.issues[0]?.message ?? "unknown"}`);
    }
    const coast = result.segmentResults[0];
    if (coast?.kind !== "GravityCoast") {
      throw new Error("Expected moving-source coast segment result.");
    }
    const sourcePositionAt = (epochTick: number) => ({
      x: request.gravitySource.positionMeters.x + sourceVelocity.x * epochTick / ticksPerSecond,
      y: request.gravitySource.positionMeters.y + sourceVelocity.y * epochTick / ticksPerSecond,
      z: request.gravitySource.positionMeters.z + sourceVelocity.z * epochTick / ticksPerSecond
    });
    const initialOracle = independentOrbitalMetrics(
      request.initialState,
      sourcePositionAt(request.initialState.epochTick),
      sourceVelocity,
      HESTIA_TRAJECTORY_GRAVITATIONAL_PARAMETER_MU
    );
    const finalOracle = independentOrbitalMetrics(
      coast.finalState,
      sourcePositionAt(coast.finalState.epochTick),
      sourceVelocity,
      HESTIA_TRAJECTORY_GRAVITATIONAL_PARAMETER_MU
    );
    const energyDriftOracle = relativeDrift(
      initialOracle.energy,
      finalOracle.energy,
      request.toleranceProfile.relativeDenominatorFloor
    );
    const angularMomentumDriftOracle = relativeDrift(
      initialOracle.angularMomentum,
      finalOracle.angularMomentum,
      request.toleranceProfile.relativeDenominatorFloor
    );

    expectRelativeClose(result.metrics.initialSpecificOrbitalEnergyJoulesPerKilogram, initialOracle.energy);
    expectRelativeClose(result.metrics.finalSpecificOrbitalEnergyJoulesPerKilogram, finalOracle.energy);
    expectRelativeClose(
      result.metrics.initialSpecificAngularMomentumMetersSquaredPerSecond,
      initialOracle.angularMomentum
    );
    expectRelativeClose(
      result.metrics.finalSpecificAngularMomentumMetersSquaredPerSecond,
      finalOracle.angularMomentum
    );
    expectRelativeClose(result.metrics.relativeEnergyDrift, energyDriftOracle);
    expectRelativeClose(result.metrics.relativeAngularMomentumDrift, angularMomentumDriftOracle);
    expect(result.metrics.relativeEnergyDrift).toBeLessThanOrEqual(request.toleranceProfile.relativeEnergyTolerance);
    expect(result.metrics.relativeAngularMomentumDrift).toBeLessThanOrEqual(
      request.toleranceProfile.relativeAngularMomentumTolerance
    );
  });
});
