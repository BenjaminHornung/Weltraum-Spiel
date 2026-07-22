import { describe, expect, it } from "vitest";
import {
  HESTIA_TRAJECTORY_FRAME_ID,
  applyImpulseDeltaV,
  createHestiaAccelerationImpulseTrajectoryRequest,
  createTrajectorySegmentId,
  predictTrajectory,
  validateTrajectoryPredictionRequest,
  type TrajectoryState
} from "../../src/trajectory";
import { createSimulationTick } from "../../src/persistence/time";

describe("trajectory impulse", () => {
  it("changes only velocity while preserving tick, position and mass", () => {
    const initial: TrajectoryState = {
      frameId: HESTIA_TRAJECTORY_FRAME_ID,
      epochTick: createSimulationTick(42),
      positionMeters: { x: 10, y: 20, z: 30 },
      velocityMetersPerSecond: { x: 1, y: -2, z: 3 },
      massKilograms: 500
    };

    const execution = applyImpulseDeltaV(initial, {
      kind: "ImpulseDeltaV",
      segmentId: createTrajectorySegmentId("segment:exact-impulse"),
      frameId: HESTIA_TRAJECTORY_FRAME_ID,
      tick: createSimulationTick(42),
      deltaVelocityMetersPerSecond: { x: -0.5, y: 4, z: 7 }
    });

    expect(execution.steps).toEqual([]);
    expect(execution.result.kind).toBe("ImpulseDeltaV");
    if (execution.result.kind !== "ImpulseDeltaV") {
      throw new Error("Expected impulse result.");
    }
    expect(execution.result.preImpulseState).toEqual(initial);
    expect(execution.result.postImpulseState.positionMeters).toEqual(initial.positionMeters);
    expect(execution.result.postImpulseState.epochTick).toBe(initial.epochTick);
    expect(execution.result.postImpulseState.massKilograms).toBe(initial.massKilograms);
    expect(execution.result.postImpulseState.velocityMetersPerSecond).toEqual({ x: 0.5, y: 2, z: 10 });
  });

  it("publishes an exact boundary impulse in segment and sample output", () => {
    const request = createHestiaAccelerationImpulseTrajectoryRequest();
    const impulseRequest = request.segments[1];
    if (impulseRequest?.kind !== "ImpulseDeltaV") {
      throw new Error("Acceleration/impulse fixture shape changed.");
    }

    const result = predictTrajectory(request);

    expect(result.status).toBe("Completed");
    if (result.status !== "Completed") {
      throw new Error(`Public impulse request rejected: ${result.issues[0]?.message ?? "unknown"}`);
    }
    const impulseResult = result.segmentResults[1];
    expect(impulseResult?.kind).toBe("ImpulseDeltaV");
    if (impulseResult?.kind !== "ImpulseDeltaV") {
      throw new Error("Expected public impulse segment result.");
    }
    expect(impulseResult.tick).toBe(impulseRequest.tick);
    expect(impulseResult.postImpulseState.positionMeters).toEqual(impulseResult.preImpulseState.positionMeters);
    expect(impulseResult.postImpulseState.massKilograms).toBe(impulseResult.preImpulseState.massKilograms);
    expect(impulseResult.postImpulseState.epochTick).toBe(impulseResult.preImpulseState.epochTick);
    expect(impulseResult.postImpulseState.velocityMetersPerSecond).toEqual({
      x: impulseResult.preImpulseState.velocityMetersPerSecond.x + impulseRequest.deltaVelocityMetersPerSecond.x,
      y: impulseResult.preImpulseState.velocityMetersPerSecond.y + impulseRequest.deltaVelocityMetersPerSecond.y,
      z: impulseResult.preImpulseState.velocityMetersPerSecond.z + impulseRequest.deltaVelocityMetersPerSecond.z
    });
    const impulseSamples = result.samples.filter((sample) => sample.reasons.includes("ImpulsePostState"));
    expect(impulseSamples).toHaveLength(1);
    expect(impulseSamples[0]?.tick).toBe(impulseRequest.tick);
    expect(impulseSamples[0]?.state).toEqual(impulseResult.postImpulseState);
    expect(impulseSamples[0]?.reasons).toContain("Final");
  });

  it("keeps a zero-delta aligned-boundary impulse as a distinct semantic sample", () => {
    const base = createHestiaAccelerationImpulseTrajectoryRequest();
    const continuousSegment = base.segments[0];
    const impulseSegment = base.segments[1];
    if (continuousSegment?.kind !== "ConstantInertialAcceleration" || impulseSegment?.kind !== "ImpulseDeltaV") {
      throw new Error("Acceleration/impulse fixture shape changed.");
    }
    const request = {
      ...base,
      segments: [
        continuousSegment,
        {
          ...impulseSegment,
          deltaVelocityMetersPerSecond: { x: 0, y: 0, z: 0 }
        }
      ]
    };

    const validation = validateTrajectoryPredictionRequest(request);
    expect(validation.valid).toBe(true);
    if (!validation.valid) {
      throw new Error(`Zero-delta impulse request rejected: ${validation.issues[0]?.message ?? "unknown"}`);
    }

    const result = predictTrajectory(request);
    expect(result.status).toBe("Completed");
    if (result.status !== "Completed") {
      throw new Error(`Zero-delta impulse prediction rejected: ${result.issues[0]?.message ?? "unknown"}`);
    }

    const sameTickSamples = result.samples.filter((sample) => sample.tick === impulseSegment.tick);
    expect(sameTickSamples).toHaveLength(2);
    const [boundarySample, postImpulseSample] = sameTickSamples;
    if (boundarySample === undefined || postImpulseSample === undefined) {
      throw new Error("Expected boundary and post-impulse samples at the impulse tick.");
    }
    expect(boundarySample.state).toEqual(postImpulseSample.state);
    expect(boundarySample.reasons).toEqual(["StepEnd", "SegmentBoundary"]);
    expect(postImpulseSample.reasons).toEqual(["ImpulsePostState", "Final"]);
    expect(boundarySample.stableOrdinal).not.toBe(postImpulseSample.stableOrdinal);
    expect(postImpulseSample.stableOrdinal).toBe(boundarySample.stableOrdinal + 1);
    expect(result.samples).toHaveLength(12);
    expect(validation.budgetEstimate.sampleCount).toBe(result.samples.length);
    expect(result.metrics.totalSamples).toBe(result.samples.length);
  });

  it("keeps a nonzero numerically ineffective impulse canonically distinct", () => {
    const base = createHestiaAccelerationImpulseTrajectoryRequest();
    const continuousSegment = base.segments[0];
    const impulseSegment = base.segments[1];
    if (continuousSegment?.kind !== "ConstantInertialAcceleration" || impulseSegment?.kind !== "ImpulseDeltaV") {
      throw new Error("Acceleration/impulse fixture shape changed.");
    }
    // The public default RK4 fixture keeps gravity below the rounding threshold at this magnitude; make the IEEE-754 anchor explicit.
    const storedVelocity = 2 ** 53;
    const ineffectiveDelta = { x: 1, y: 0, z: 0 };
    expect(ineffectiveDelta.x).not.toBe(0);
    expect((2 ** 53) + 1).toBe(2 ** 53);

    const request = {
      ...base,
      initialState: {
        ...base.initialState,
        velocityMetersPerSecond: { x: storedVelocity, y: 0, z: 0 }
      },
      segments: [
        continuousSegment,
        {
          ...impulseSegment,
          deltaVelocityMetersPerSecond: ineffectiveDelta
        }
      ]
    };
    const zeroDeltaRequest = {
      ...request,
      segments: [
        continuousSegment,
        {
          ...impulseSegment,
          deltaVelocityMetersPerSecond: { x: 0, y: 0, z: 0 }
        }
      ]
    };

    const validation = validateTrajectoryPredictionRequest(request);
    expect(validation.valid).toBe(true);
    if (!validation.valid) {
      throw new Error(`Numerically ineffective impulse request rejected: ${validation.issues[0]?.message ?? "unknown"}`);
    }

    const first = predictTrajectory(request);
    const second = predictTrajectory(request);
    const zeroDeltaResult = predictTrajectory(zeroDeltaRequest);
    expect(first.status).toBe("Completed");
    expect(second.status).toBe("Completed");
    expect(zeroDeltaResult.status).toBe("Completed");
    if (first.status !== "Completed" || second.status !== "Completed" || zeroDeltaResult.status !== "Completed") {
      throw new Error("Numerically ineffective and exact-zero impulse predictions must complete before comparison.");
    }

    const impulseResult = first.segmentResults[1];
    expect(impulseResult?.kind).toBe("ImpulseDeltaV");
    if (impulseResult?.kind !== "ImpulseDeltaV") {
      throw new Error("Expected public impulse segment result.");
    }
    expect(impulseResult.preImpulseState.velocityMetersPerSecond.x).toBe(storedVelocity);
    expect(impulseResult.postImpulseState.velocityMetersPerSecond).toEqual(
      impulseResult.preImpulseState.velocityMetersPerSecond
    );
    expect(impulseResult.postImpulseState.positionMeters).toEqual(impulseResult.preImpulseState.positionMeters);
    expect(impulseResult.postImpulseState.massKilograms).toBe(impulseResult.preImpulseState.massKilograms);
    expect(impulseResult.postImpulseState.frameId).toBe(impulseResult.preImpulseState.frameId);
    expect(impulseResult.postImpulseState.epochTick).toBe(impulseResult.preImpulseState.epochTick);

    const sameTickSamples = first.samples.filter((sample) => sample.tick === impulseSegment.tick);
    expect(sameTickSamples).toHaveLength(2);
    const [boundarySample, postImpulseSample] = sameTickSamples;
    if (boundarySample === undefined || postImpulseSample === undefined) {
      throw new Error("Expected boundary and post-impulse samples at the impulse tick.");
    }
    expect(boundarySample).not.toBe(postImpulseSample);
    expect(boundarySample.state).toEqual(impulseResult.preImpulseState);
    expect(postImpulseSample.state).toEqual(impulseResult.postImpulseState);
    expect(boundarySample.reasons).toEqual(["StepEnd", "SegmentBoundary"]);
    // These ordinals and the 12-sample count pin this fixture's shape, not a generic ordinal contract.
    expect(boundarySample.stableOrdinal).toBe(10);
    expect(postImpulseSample.stableOrdinal).toBe(11);
    expect(boundarySample.stableOrdinal).toBeLessThan(postImpulseSample.stableOrdinal);
    expect(postImpulseSample.stableOrdinal).toBe(boundarySample.stableOrdinal + 1);
    expect(postImpulseSample.reasons).toEqual(["ImpulsePostState", "Final"]);

    expect(first.samples).toHaveLength(12);
    expect(validation.budgetEstimate.sampleCount).toBe(first.samples.length);
    expect(first.samples.length).toBe(first.metrics.totalSamples);
    expect(first).toEqual(second);
    expect(first.canonicalSignature).toBe(second.canonicalSignature);
    expect(first.canonicalSignature).not.toBe(zeroDeltaResult.canonicalSignature);
  });
});
