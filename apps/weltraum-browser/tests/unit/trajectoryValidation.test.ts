import { describe, expect, it } from "vitest";
import {
  TRAJECTORY_V1_MAX_HAZARDS,
  TRAJECTORY_V1_MAX_INTEGRATION_STEPS,
  TRAJECTORY_V1_MAX_SEGMENTS,
  createHestiaAccelerationImpulseTrajectoryRequest,
  createHestiaCircularTrajectoryRequest,
  createHestiaTrajectoryHazard,
  createTrajectorySegmentId,
  predictTrajectory,
  validateTrajectoryPredictionRequest
} from "../../src/trajectory";

describe("trajectory request validation", () => {
  const requestValueCases = [
    { label: "zero step", replacement: { stepTicks: 0 }, code: "InvalidStepTicks", path: "/stepTicks" },
    { label: "negative step", replacement: { stepTicks: -1 }, code: "InvalidStepTicks", path: "/stepTicks" },
    { label: "fractional step", replacement: { stepTicks: 1.5 }, code: "InvalidStepTicks", path: "/stepTicks" },
    { label: "nonfinite step", replacement: { stepTicks: Number.POSITIVE_INFINITY }, code: "InvalidStepTicks", path: "/stepTicks" },
    { label: "unsafe step", replacement: { stepTicks: Number.MAX_SAFE_INTEGER + 1 }, code: "InvalidStepTicks", path: "/stepTicks" },
    { label: "zero sample cadence", replacement: { sampleEverySteps: 0 }, code: "InvalidSampleCadence", path: "/sampleEverySteps" },
    { label: "negative sample cadence", replacement: { sampleEverySteps: -1 }, code: "InvalidSampleCadence", path: "/sampleEverySteps" },
    { label: "fractional sample cadence", replacement: { sampleEverySteps: 1.5 }, code: "InvalidSampleCadence", path: "/sampleEverySteps" },
    { label: "nonfinite sample cadence", replacement: { sampleEverySteps: Number.NaN }, code: "InvalidSampleCadence", path: "/sampleEverySteps" },
    { label: "unsafe sample cadence", replacement: { sampleEverySteps: Number.MAX_SAFE_INTEGER + 1 }, code: "InvalidSampleCadence", path: "/sampleEverySteps" }
  ] as const;

  it.each(requestValueCases)("rejects $label with the exact issue", ({ replacement, code, path }) => {
    const request = { ...createHestiaAccelerationImpulseTrajectoryRequest(), ...replacement };

    const result = predictTrajectory(request);

    expect(result.status).toBe("RejectedInvalidRequest");
    if (result.status !== "RejectedInvalidRequest") {
      throw new Error("Expected invalid trajectory request rejection.");
    }
    expect(result.issues[0]).toMatchObject({ code, path });
  });

  it("rejects overlapping segments instead of sorting or replanning them", () => {
    const base = createHestiaAccelerationImpulseTrajectoryRequest();
    const overlapping = {
      kind: "GravityCoast" as const,
      segmentId: createTrajectorySegmentId("segment:hestia.overlap"),
      frameId: base.initialState.frameId,
      startTick: 600,
      endTick: 1_200
    };
    const request = { ...base, segments: [base.segments[0], overlapping] };

    const result = predictTrajectory(request);

    expect(result.status).toBe("RejectedSegmentOverlap");
    if (result.status !== "RejectedSegmentOverlap") {
      throw new Error("Expected overlapping trajectory rejection.");
    }
    expect(result.issues[0]?.code).toBe("SegmentOverlap");
    expect(result.issues[0]?.path).toBe("/segments/1/startTick");
  });

  it("rejects frame mismatches", () => {
    const base = createHestiaCircularTrajectoryRequest({ maximumStepTicks: 1_200 });
    const request = {
      ...base,
      gravitySource: { ...base.gravitySource, frameId: "frame:body-inertial.other" }
    };

    const result = predictTrajectory(request);

    expect(result.status).toBe("RejectedFrameMismatch");
    if (result.status !== "RejectedFrameMismatch") {
      throw new Error("Expected trajectory frame mismatch rejection.");
    }
    expect(result.issues[0]?.code).toBe("FrameMismatch");
    expect(result.issues[0]?.path).toBe("/gravitySource/frameId");
  });

  it("accepts only the positive inertial-frame allowlist", () => {
    const base = createHestiaCircularTrajectoryRequest({ maximumStepTicks: 1_200 });
    const withFrame = (frameId: string) => ({
      ...base,
      initialState: { ...base.initialState, frameId },
      gravitySource: { ...base.gravitySource, frameId },
      segments: base.segments.map((segment) => ({ ...segment, frameId })),
      hazards: []
    });

    expect(validateTrajectoryPredictionRequest(withFrame("frame:system")).valid).toBe(true);
    expect(validateTrajectoryPredictionRequest(withFrame("frame:body-inertial.test-body")).valid).toBe(true);
    expect(validateTrajectoryPredictionRequest(withFrame("frame:aurelia")).valid).toBe(false);
    expect(validateTrajectoryPredictionRequest(withFrame("frame:body-fixed.test-body")).valid).toBe(false);
  });

  it("rejects gaps, duplicate IDs, off-grid boundaries and nonfinite values", () => {
    const base = createHestiaAccelerationImpulseTrajectoryRequest();
    const acceleration = base.segments[0];
    const impulse = base.segments[1];
    if (acceleration?.kind !== "ConstantInertialAcceleration" || impulse?.kind !== "ImpulseDeltaV") {
      throw new Error("Acceleration/impulse fixture shape changed.");
    }
    const cases = [
      {
        label: "timeline gap",
        request: { ...base, segments: [acceleration, { ...impulse, tick: 1_212 }] },
        status: "RejectedInvalidRequest",
        code: "SegmentGap",
        path: "/segments/1/tick"
      },
      {
        label: "duplicate segment ID",
        request: { ...base, segments: [acceleration, { ...impulse, segmentId: acceleration.segmentId }] },
        status: "RejectedInvalidRequest",
        code: "DuplicateSegmentId",
        path: "/segments/1/segmentId"
      },
      {
        label: "duplicate impulse tick",
        request: {
          ...base,
          segments: [
            acceleration,
            impulse,
            { ...impulse, segmentId: createTrajectorySegmentId("segment:hestia.second-impulse") }
          ]
        },
        status: "RejectedInvalidRequest",
        code: "DuplicateImpulseTick",
        path: "/segments/2/tick"
      },
      {
        label: "off-grid continuous boundary",
        request: { ...base, segments: [{ ...acceleration, endTick: 1_201 }] },
        status: "RejectedStepMismatch",
        code: "StepMismatch",
        path: "/segments/0"
      },
      {
        label: "nonfinite initial-state vector",
        request: {
          ...base,
          initialState: {
            ...base.initialState,
            velocityMetersPerSecond: { ...base.initialState.velocityMetersPerSecond, x: Number.NaN }
          }
        },
        status: "RejectedInvalidRequest",
        code: "InvalidNumber",
        path: "/initialState/velocityMetersPerSecond/x"
      },
      {
        label: "nonfinite gravity-source vector",
        request: {
          ...base,
          gravitySource: {
            ...base.gravitySource,
            positionMeters: { ...base.gravitySource.positionMeters, y: Number.POSITIVE_INFINITY }
          }
        },
        status: "RejectedInvalidRequest",
        code: "InvalidNumber",
        path: "/gravitySource/positionMeters/y"
      },
      {
        label: "nonfinite acceleration vector",
        request: {
          ...base,
          segments: [{
            ...acceleration,
            accelerationMetersPerSecondSquared: {
              ...acceleration.accelerationMetersPerSecondSquared,
              z: Number.NEGATIVE_INFINITY
            }
          }]
        },
        status: "RejectedInvalidRequest",
        code: "InvalidNumber",
        path: "/segments/0/accelerationMetersPerSecondSquared/z"
      },
      {
        label: "segment frame mismatch",
        request: { ...base, segments: [{ ...acceleration, frameId: "frame:body-inertial.other" }] },
        status: "RejectedFrameMismatch",
        code: "FrameMismatch",
        path: "/segments/0/frameId"
      }
    ] as const;

    for (const testCase of cases) {
      const result = validateTrajectoryPredictionRequest(testCase.request);
      expect(result.valid, testCase.label).toBe(false);
      if (result.valid) {
        throw new Error(`${testCase.label} should reject.`);
      }
      expect(result.status, testCase.label).toBe(testCase.status);
      expect(result.issues[0], testCase.label).toMatchObject({ code: testCase.code, path: testCase.path });
    }
  });

  it("rejects unsorted segments and malformed policy, hazard and tolerance values", () => {
    const base = createHestiaAccelerationImpulseTrajectoryRequest();
    const firstHazard = createHestiaTrajectoryHazard("hazard:duplicate");
    const cases = [
      {
        label: "out-of-order timeline",
        request: { ...base, segments: [...base.segments].reverse() },
        status: "RejectedInvalidRequest",
        code: "SegmentGap",
        path: "/segments/0/tick"
      },
      {
        label: "unsupported integrator",
        request: {
          ...base,
          integratorPolicy: { ...base.integratorPolicy, gravityCoast: "AdaptiveIntegrator" }
        },
        status: "RejectedInvalidRequest",
        code: "InvalidIntegratorPolicy",
        path: "/integratorPolicy/gravityCoast"
      },
      {
        label: "duplicate hazard ID",
        request: { ...base, hazards: [firstHazard, firstHazard] },
        status: "RejectedHazardPolicy",
        code: "DuplicateHazardId",
        path: "/hazards/1/hazardId"
      },
      {
        label: "nonfinite hazard radius",
        request: { ...base, hazards: [{ ...firstHazard, radiusMeters: Number.POSITIVE_INFINITY }] },
        status: "RejectedHazardPolicy",
        code: "InvalidHazard",
        path: "/hazards/0/radiusMeters"
      },
      {
        label: "hazard frame mismatch",
        request: { ...base, hazards: [{ ...firstHazard, frameId: "frame:body-inertial.other" }] },
        status: "RejectedFrameMismatch",
        code: "FrameMismatch",
        path: "/hazards/0/frameId"
      },
      {
        label: "nonfinite tolerance",
        request: {
          ...base,
          toleranceProfile: { ...base.toleranceProfile, relativeEnergyTolerance: Number.NaN }
        },
        status: "RejectedInvalidRequest",
        code: "InvalidNumber",
        path: "/toleranceProfile/relativeEnergyTolerance"
      }
    ] as const;

    for (const testCase of cases) {
      const result = validateTrajectoryPredictionRequest(testCase.request);
      expect(result.valid, testCase.label).toBe(false);
      if (result.valid) {
        throw new Error(`${testCase.label} should reject.`);
      }
      expect(result.status, testCase.label).toBe(testCase.status);
      expect(result.issues[0], testCase.label).toMatchObject({ code: testCase.code, path: testCase.path });
    }
  });

  const tickCases = [
    { label: "negative initial epoch", field: "initialState", value: -1, path: "/initialState/epochTick" },
    { label: "nonfinite initial epoch", field: "initialState", value: Number.POSITIVE_INFINITY, path: "/initialState/epochTick" },
    { label: "unsafe initial epoch", field: "initialState", value: Number.MAX_SAFE_INTEGER + 1, path: "/initialState/epochTick" },
    { label: "negative source epoch", field: "gravitySource", value: -1, path: "/gravitySource/epochTick" },
    { label: "nonfinite source epoch", field: "gravitySource", value: Number.NaN, path: "/gravitySource/epochTick" },
    { label: "unsafe source epoch", field: "gravitySource", value: Number.MAX_SAFE_INTEGER + 1, path: "/gravitySource/epochTick" }
  ] as const;

  it.each(tickCases)("rejects $label with an exact tick issue", ({ field, value, path }) => {
    const base = createHestiaAccelerationImpulseTrajectoryRequest();
    const request = field === "initialState"
      ? { ...base, initialState: { ...base.initialState, epochTick: value } }
      : { ...base, gravitySource: { ...base.gravitySource, epochTick: value } };

    const result = validateTrajectoryPredictionRequest(request);

    expect(result.valid).toBe(false);
    if (result.valid) {
      throw new Error("Invalid request-level epoch should reject.");
    }
    expect(result.status).toBe("RejectedInvalidRequest");
    expect(result.issues[0]).toMatchObject({ code: "InvalidTick", path });
  });

  it("pre-scans segment and hazard array budgets without reading entries", () => {
    const base = createHestiaCircularTrajectoryRequest({ maximumStepTicks: 1_200 });
    let reads = 0;
    const oversizedSegments = new Array(TRAJECTORY_V1_MAX_SEGMENTS + 1);
    const oversizedHazards = new Array(TRAJECTORY_V1_MAX_HAZARDS + 1);
    Object.defineProperty(oversizedSegments, "0", { enumerable: true, get: () => { reads += 1; return base.segments[0]; } });
    Object.defineProperty(oversizedHazards, "0", { enumerable: true, get: () => { reads += 1; return null; } });

    const segmentResult = validateTrajectoryPredictionRequest({ ...base, segments: oversizedSegments });
    const hazardResult = validateTrajectoryPredictionRequest({ ...base, hazards: oversizedHazards });

    expect(segmentResult.valid).toBe(false);
    expect(hazardResult.valid).toBe(false);
    if (segmentResult.valid || hazardResult.valid) {
      throw new Error("Expected prospective collection budget rejection.");
    }
    expect(segmentResult.status).toBe("RejectedBudgetExceeded");
    expect(hazardResult.status).toBe("RejectedBudgetExceeded");
    expect(reads).toBe(0);
  });

  it("accepts exactly 250000 steps and rejects one more during preflight", () => {
    const base = createHestiaCircularTrajectoryRequest({ maximumStepTicks: 1_200 });
    const segment = base.segments[0];
    if (segment?.kind !== "GravityCoast") {
      throw new Error("Circular fixture shape changed.");
    }
    const atLimit = {
      ...base,
      stepTicks: 1,
      sampleEverySteps: TRAJECTORY_V1_MAX_INTEGRATION_STEPS,
      segments: [{ ...segment, endTick: TRAJECTORY_V1_MAX_INTEGRATION_STEPS }]
    };
    const overLimit = {
      ...atLimit,
      sampleEverySteps: TRAJECTORY_V1_MAX_INTEGRATION_STEPS + 1,
      segments: [{ ...segment, endTick: TRAJECTORY_V1_MAX_INTEGRATION_STEPS + 1 }]
    };

    const accepted = validateTrajectoryPredictionRequest(atLimit);
    const rejected = validateTrajectoryPredictionRequest(overLimit);

    expect(accepted.valid).toBe(true);
    if (!accepted.valid) {
      throw new Error("Exact integration-step budget should validate.");
    }
    expect(accepted.budgetEstimate.integrationStepCount).toBe(TRAJECTORY_V1_MAX_INTEGRATION_STEPS);
    expect(rejected.valid).toBe(false);
    if (rejected.valid) {
      throw new Error("Over-budget request should reject before propagation.");
    }
    expect(rejected.status).toBe("RejectedBudgetExceeded");
    expect(rejected.issues[0]?.code).toBe("BudgetExceeded");
  });

  it("rejects an excessive prospective sample horizon before allocation", () => {
    const base = createHestiaCircularTrajectoryRequest({ maximumStepTicks: 1_200 });
    const segment = base.segments[0];
    if (segment?.kind !== "GravityCoast") {
      throw new Error("Circular fixture shape changed.");
    }
    const request = {
      ...base,
      stepTicks: 1,
      sampleEverySteps: 1,
      segments: [{ ...segment, endTick: 50_000 }]
    };

    const result = validateTrajectoryPredictionRequest(request);

    expect(result.valid).toBe(false);
    if (result.valid) {
      throw new Error("Excessive sample horizon should reject during validation.");
    }
    expect(result.status).toBe("RejectedBudgetExceeded");
    expect(result.budgetEstimate?.sampleCount).toBe(50_001);
  });

  it("rejects accessor-backed input without invoking the getter", () => {
    const base = createHestiaCircularTrajectoryRequest({ maximumStepTicks: 1_200 });
    let getterCalls = 0;
    const position = { y: base.initialState.positionMeters.y, z: base.initialState.positionMeters.z };
    Object.defineProperty(position, "x", {
      enumerable: true,
      get: () => {
        getterCalls += 1;
        return base.initialState.positionMeters.x;
      }
    });
    const request = { ...base, initialState: { ...base.initialState, positionMeters: position } };

    const result = predictTrajectory(request);

    expect(result.status).toBe("RejectedInvalidRequest");
    expect(getterCalls).toBe(0);
  });

  it("fails closed through the public predictor at the minimum gravity distance", () => {
    const base = createHestiaCircularTrajectoryRequest({ maximumStepTicks: 1_200 });
    const request = {
      ...base,
      initialState: {
        ...base.initialState,
        positionMeters: { x: base.toleranceProfile.minimumGravityDistanceMeters, y: 0, z: 0 }
      }
    };

    const result = predictTrajectory(request);

    expect(result.status).toBe("RejectedNumericalFailure");
    if (result.status !== "RejectedNumericalFailure") {
      throw new Error("Gravity singularity must not produce a completed payload.");
    }
    expect(result.issues[0]).toMatchObject({
      code: "NumericalFailure",
      path: "/velocityVerlet/startAcceleration/distanceMeters"
    });
    expect(result.budgetEstimate).not.toBeNull();
    expect("samples" in result).toBe(false);
    expect("metrics" in result).toBe(false);
    expect(result.canonicalSignature).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
  });
});
