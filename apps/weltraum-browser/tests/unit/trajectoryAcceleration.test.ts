import { describe, expect, it } from "vitest";
import {
  HESTIA_TRAJECTORY_FRAME_ID,
  createHestiaAccelerationImpulseTrajectoryRequest,
  createTrajectorySegmentId,
  integrateRungeKutta4Step,
  predictTrajectory,
  type TrajectoryIntegrationContext,
  type TrajectoryState
} from "../../src/trajectory";
import { createSimulationTick } from "../../src/persistence/time";

describe("constant inertial acceleration", () => {
  it("matches the analytic constant-acceleration solution", () => {
    const initial: TrajectoryState = {
      frameId: HESTIA_TRAJECTORY_FRAME_ID,
      epochTick: createSimulationTick(0),
      positionMeters: { x: 100, y: 200, z: 300 },
      velocityMetersPerSecond: { x: 2, y: -3, z: 4 },
      massKilograms: 50
    };
    const acceleration = { x: 0.5, y: -1, z: 2 };
    const context: TrajectoryIntegrationContext = {
      gravitySource: {
        frameId: HESTIA_TRAJECTORY_FRAME_ID,
        epochTick: createSimulationTick(0),
        positionMeters: { x: 0, y: 0, z: 0 },
        velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
        gravitationalParameterMu: Number.MIN_VALUE
      },
      minimumGravityDistanceMeters: 1,
      inertialAccelerationMetersPerSecondSquared: acceleration
    };
    const durationSeconds = 2;

    const result = integrateRungeKutta4Step(initial, 240, context);

    expect(result.positionMeters.x).toBeCloseTo(100 + 2 * durationSeconds + 0.5 * acceleration.x * durationSeconds ** 2, 12);
    expect(result.positionMeters.y).toBeCloseTo(200 - 3 * durationSeconds + 0.5 * acceleration.y * durationSeconds ** 2, 12);
    expect(result.positionMeters.z).toBeCloseTo(300 + 4 * durationSeconds + 0.5 * acceleration.z * durationSeconds ** 2, 12);
    expect(result.velocityMetersPerSecond.x).toBeCloseTo(2 + acceleration.x * durationSeconds, 12);
    expect(result.velocityMetersPerSecond.y).toBeCloseTo(-3 + acceleration.y * durationSeconds, 12);
    expect(result.velocityMetersPerSecond.z).toBeCloseTo(4 + acceleration.z * durationSeconds, 12);
    expect(result.massKilograms).toBe(initial.massKilograms);
  });

  it("publishes the analytic acceleration state through predictTrajectory", () => {
    const base = createHestiaAccelerationImpulseTrajectoryRequest();
    const durationSeconds = 2;
    const durationTicks = durationSeconds * 120;
    const stepTicks = 120;
    const initialPosition = { x: 100, y: 200, z: 300 };
    const initialVelocity = { x: 2, y: -3, z: 4 };
    const acceleration = { x: 0.5, y: -1, z: 2 };
    const request = {
      ...base,
      initialState: {
        ...base.initialState,
        positionMeters: initialPosition,
        velocityMetersPerSecond: initialVelocity
      },
      gravitySource: {
        ...base.gravitySource,
        gravitationalParameterMu: Number.MIN_VALUE
      },
      segments: [{
        kind: "ConstantInertialAcceleration" as const,
        segmentId: createTrajectorySegmentId("segment:public-analytic-acceleration"),
        frameId: base.initialState.frameId,
        startTick: createSimulationTick(0),
        endTick: createSimulationTick(durationTicks),
        accelerationMetersPerSecondSquared: acceleration
      }],
      stepTicks,
      sampleEverySteps: 1,
      hazards: []
    };

    const result = predictTrajectory(request);

    expect(result.status).toBe("Completed");
    if (result.status !== "Completed") {
      throw new Error(`Public acceleration request rejected: ${result.issues[0]?.message ?? "unknown"}`);
    }
    const segmentResult = result.segmentResults[0];
    expect(segmentResult?.kind).toBe("ConstantInertialAcceleration");
    if (segmentResult?.kind !== "ConstantInertialAcceleration") {
      throw new Error("Expected public acceleration segment result.");
    }
    const expectedPosition = {
      x: initialPosition.x + initialVelocity.x * durationSeconds + 0.5 * acceleration.x * durationSeconds ** 2,
      y: initialPosition.y + initialVelocity.y * durationSeconds + 0.5 * acceleration.y * durationSeconds ** 2,
      z: initialPosition.z + initialVelocity.z * durationSeconds + 0.5 * acceleration.z * durationSeconds ** 2
    };
    const expectedVelocity = {
      x: initialVelocity.x + acceleration.x * durationSeconds,
      y: initialVelocity.y + acceleration.y * durationSeconds,
      z: initialVelocity.z + acceleration.z * durationSeconds
    };
    expect(segmentResult.finalState.positionMeters.x).toBeCloseTo(expectedPosition.x, 12);
    expect(segmentResult.finalState.positionMeters.y).toBeCloseTo(expectedPosition.y, 12);
    expect(segmentResult.finalState.positionMeters.z).toBeCloseTo(expectedPosition.z, 12);
    expect(segmentResult.finalState.velocityMetersPerSecond.x).toBeCloseTo(expectedVelocity.x, 12);
    expect(segmentResult.finalState.velocityMetersPerSecond.y).toBeCloseTo(expectedVelocity.y, 12);
    expect(segmentResult.finalState.velocityMetersPerSecond.z).toBeCloseTo(expectedVelocity.z, 12);
    expect(result.samples.at(-1)?.state).toEqual(segmentResult.finalState);
  });
});
