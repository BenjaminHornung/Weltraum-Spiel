import { describe, expect, it } from "vitest";
import {
  HESTIA_TRAJECTORY_FRAME_ID,
  TrajectoryPropagationError,
  createHestiaCircularTrajectoryRequest,
  evaluateTrajectoryAcceleration,
  integrateRungeKutta4Step,
  integrateSemiImplicitEulerStep,
  propagateTrajectoryRequest,
  validateTrajectoryPredictionRequest,
  type TrajectoryIntegrationContext,
  type TrajectoryState
} from "../../src/trajectory";
import { createSimulationTick } from "../../src/persistence/time";
import { createTrajectorySegmentId } from "../../src/trajectory/ids";

const state = (epochTick = 0): TrajectoryState => ({
  frameId: HESTIA_TRAJECTORY_FRAME_ID,
  epochTick: createSimulationTick(epochTick),
  positionMeters: { x: 1, y: 0, z: 0 },
  velocityMetersPerSecond: { x: 0, y: 1, z: 0 },
  massKilograms: 1
});

const unitCircularContext: TrajectoryIntegrationContext = {
  gravitySource: {
    frameId: HESTIA_TRAJECTORY_FRAME_ID,
    epochTick: createSimulationTick(0),
    positionMeters: { x: 0, y: 0, z: 0 },
    velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
    gravitationalParameterMu: 1
  },
  minimumGravityDistanceMeters: 1e-6,
  inertialAccelerationMetersPerSecondSquared: { x: 0, y: 0, z: 0 }
};

describe("trajectory integrators", () => {
  it("matches the analytic unit-circle fixture with high-accuracy RK4", () => {
    const result = integrateRungeKutta4Step(state(), 1, unitCircularContext);
    const seconds = 1 / 120;

    expect(result.positionMeters.x).toBeCloseTo(Math.cos(seconds), 10);
    expect(result.positionMeters.y).toBeCloseTo(Math.sin(seconds), 10);
    expect(result.velocityMetersPerSecond.x).toBeCloseTo(-Math.sin(seconds), 10);
    expect(result.velocityMetersPerSecond.y).toBeCloseTo(Math.cos(seconds), 10);
    expect(result.positionMeters.z).toBe(0);
    expect(result.velocityMetersPerSecond.z).toBe(0);
  });

  it("produces the exact deterministic SemiImplicitEuler update", () => {
    const first = integrateSemiImplicitEulerStep(state(), 1, unitCircularContext);
    const second = integrateSemiImplicitEulerStep(state(), 1, unitCircularContext);
    const seconds = 1 / 120;

    expect(first).toEqual(second);
    expect(first.velocityMetersPerSecond).toEqual({ x: -seconds, y: 1, z: 0 });
    expect(first.positionMeters).toEqual({ x: 1 - seconds * seconds, y: seconds, z: 0 });
  });

  it("keeps extreme representable inverse-square gravity finite", () => {
    const acceleration = evaluateTrajectoryAcceleration(
      { x: 1e150, y: 0, z: 0 },
      0,
      {
        ...unitCircularContext,
        gravitySource: { ...unitCircularContext.gravitySource, gravitationalParameterMu: 1e308 },
        minimumGravityDistanceMeters: 1
      }
    );

    expect(acceleration.x).toBeCloseTo(-1e8, 0);
    expect(acceleration.y).toBe(0);
    expect(acceleration.z).toBe(0);
    expect(Object.values(acceleration).every(Number.isFinite)).toBe(true);
  });

  it("evaluates a moving gravity source at the independent RK4 stage ticks", () => {
    const stepTicks = 1;
    const deltaSeconds = stepTicks / 120;
    const initialPosition = 10;
    const initialVelocity = 0;
    const sourceVelocity = 120;
    const gravitationalParameterMu = 100;
    const scalarAcceleration = (objectPosition: number, sourcePosition: number): number => {
      const displacement = sourcePosition - objectPosition;
      return gravitationalParameterMu * displacement / Math.abs(displacement) ** 3;
    };
    const independentRk4Reference = (referenceSourceVelocity: number) => {
      const sourceAt = (seconds: number): number => referenceSourceVelocity * seconds;
      const k1Position = initialVelocity;
      const k1Velocity = scalarAcceleration(initialPosition, sourceAt(0));
      const k2Position = initialVelocity + k1Velocity * deltaSeconds / 2;
      const k2Velocity = scalarAcceleration(
        initialPosition + k1Position * deltaSeconds / 2,
        sourceAt(deltaSeconds / 2)
      );
      const k3Position = initialVelocity + k2Velocity * deltaSeconds / 2;
      const k3Velocity = scalarAcceleration(
        initialPosition + k2Position * deltaSeconds / 2,
        sourceAt(deltaSeconds / 2)
      );
      const k4Position = initialVelocity + k3Velocity * deltaSeconds;
      const k4Velocity = scalarAcceleration(
        initialPosition + k3Position * deltaSeconds,
        sourceAt(deltaSeconds)
      );
      return {
        position: initialPosition + deltaSeconds * (k1Position + 2 * k2Position + 2 * k3Position + k4Position) / 6,
        velocity: initialVelocity + deltaSeconds * (k1Velocity + 2 * k2Velocity + 2 * k3Velocity + k4Velocity) / 6
      };
    };
    const movingReference = independentRk4Reference(sourceVelocity);
    const stationaryReference = independentRk4Reference(0);
    const result = integrateRungeKutta4Step(
      {
        ...state(),
        positionMeters: { x: initialPosition, y: 0, z: 0 },
        velocityMetersPerSecond: { x: initialVelocity, y: 0, z: 0 }
      },
      stepTicks,
      {
        gravitySource: {
          ...unitCircularContext.gravitySource,
          velocityMetersPerSecond: { x: sourceVelocity, y: 0, z: 0 },
          gravitationalParameterMu
        },
        minimumGravityDistanceMeters: 0.1,
        inertialAccelerationMetersPerSecondSquared: { x: 0, y: 0, z: 0 }
      }
    );

    expect(result.positionMeters.x).toBeCloseTo(movingReference.position, 12);
    expect(result.velocityMetersPerSecond.x).toBeCloseTo(movingReference.velocity, 12);
    expect(Math.abs(result.velocityMetersPerSecond.x - stationaryReference.velocity)).toBeGreaterThan(1e-5);
  });

  it("rejects an unsafe midpoint tick even when the end tick is safe", () => {
    expect(() => integrateRungeKutta4Step(state(Number.MAX_SAFE_INTEGER - 2), 1, unitCircularContext)).toThrowError(
      expect.objectContaining<Partial<TrajectoryPropagationError>>({
        code: "UnsafeTickArithmetic",
        path: "/midpointTick"
      })
    );
  });

  it("accumulates a former variadic-spread-sized step horizon without variadic append", () => {
    const stepCount = 130_000;
    const base = createHestiaCircularTrajectoryRequest({ maximumStepTicks: 1_200 });
    const request = {
      ...base,
      initialState: {
        ...base.initialState,
        positionMeters: { x: 0, y: 0, z: 0 },
        velocityMetersPerSecond: { x: 1, y: 0, z: 0 }
      },
      gravitySource: {
        ...base.gravitySource,
        positionMeters: { x: 1e150, y: 0, z: 0 },
        gravitationalParameterMu: Number.MIN_VALUE
      },
      segments: [{
        kind: "GravityCoast",
        segmentId: createTrajectorySegmentId("segment:high-step-accumulation"),
        frameId: HESTIA_TRAJECTORY_FRAME_ID,
        startTick: createSimulationTick(0),
        endTick: createSimulationTick(stepCount)
      }],
      integratorPolicy: {
        gravityCoast: "SemiImplicitEuler" as const,
        constantInertialAcceleration: "RungeKutta4" as const
      },
      stepTicks: 1,
      sampleEverySteps: stepCount,
      hazards: []
    };
    const validation = validateTrajectoryPredictionRequest(request);
    expect(validation.valid).toBe(true);
    if (!validation.valid) {
      throw new Error(`High-step request rejected: ${validation.issues[0]?.message ?? "unknown"}`);
    }

    const execution = propagateTrajectoryRequest(validation);

    expect(execution.steps).toHaveLength(stepCount);
    expect(execution.segmentResults).toHaveLength(1);
    expect(execution.steps.every((currentStep, index) =>
      currentStep.stepOrdinal === index + 1 &&
      currentStep.startTick === index &&
      currentStep.endTick === index + 1
    )).toBe(true);
    expect(execution.finalState.epochTick).toBe(stepCount);
    expect(execution.segmentResults[0]?.kind).toBe("GravityCoast");
  });
});
