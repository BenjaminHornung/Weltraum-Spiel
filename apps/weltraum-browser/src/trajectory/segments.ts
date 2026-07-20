import type { Vec3 } from "../core/vector";
import { createSimulationTick, type SimulationTick } from "../persistence/time";
import { readPlainObject } from "../persistence/validation";
import { parseFrameId, type FrameId } from "../spatial/ids";
import {
  createTrajectoryHazardId,
  createTrajectoryPredictionId,
  createTrajectorySegmentId
} from "./ids";
import type {
  ConstantInertialAccelerationSegment,
  GravityCoastSegment,
  ImpulseDeltaVSegment,
  LinearPointMassGravitySource,
  SphericalTrajectoryHazard,
  TrajectoryBudgetEstimate,
  TrajectoryContinuousSegment,
  TrajectoryIntegrator,
  TrajectoryIntegratorPolicy,
  TrajectoryIssue,
  TrajectoryIssueCode,
  TrajectoryPredictionRequest,
  TrajectoryRequestValidationResult,
  TrajectorySegment,
  TrajectoryState,
  TrajectoryToleranceProfile,
  TrajectoryValidationRejectionStatus
} from "./types";
import {
  TRAJECTORY_V1_MAX_HAZARDS,
  TRAJECTORY_V1_MAX_INTEGRATION_STEPS,
  TRAJECTORY_V1_MAX_SAMPLES,
  TRAJECTORY_V1_MAX_SEGMENTS
} from "./types";

type UnknownRecord = Readonly<Record<string, unknown>>;

class TrajectoryValidationFailure extends Error {
  public constructor(
    public readonly status: TrajectoryValidationRejectionStatus,
    public readonly issue: TrajectoryIssue,
    public readonly budgetEstimate: TrajectoryBudgetEstimate | null = null
  ) {
    super(issue.message);
    this.name = "TrajectoryValidationFailure";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const issue = (code: TrajectoryIssueCode, path: string, message: string): TrajectoryIssue =>
  Object.freeze({ code, path, message });

const fail = (
  status: TrajectoryValidationRejectionStatus,
  code: TrajectoryIssueCode,
  path: string,
  message: string,
  budgetEstimate: TrajectoryBudgetEstimate | null = null
): never => {
  throw new TrajectoryValidationFailure(status, issue(code, path, message), budgetEstimate);
};

const record = (value: unknown, path: string): UnknownRecord => {
  let source: Readonly<Record<string, unknown>>;
  try {
    source = readPlainObject(value, path);
  } catch {
    return fail("RejectedInvalidRequest", "InvalidRequest", path, "Expected an object.");
  }

  const snapshot = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(source)) {
    if (typeof key !== "string") {
      return fail("RejectedInvalidRequest", "InvalidRequest", path, "Object fields must use string keys.");
    }
    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      return fail(
        "RejectedInvalidRequest",
        "InvalidRequest",
        `${path}/${key}`,
        "Object fields must be enumerable data properties."
      );
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
};

const denseArray = (
  value: unknown,
  path: string,
  maximumLength: number,
  budgetMessage: string
): readonly unknown[] => {
  if (!Array.isArray(value)) {
    return fail("RejectedInvalidRequest", "InvalidRequest", path, "Expected an array.");
  }
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    return fail("RejectedInvalidRequest", "InvalidRequest", path, "Expected a plain Array instance.");
  }

  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.enumerable !== false ||
    lengthDescriptor.configurable !== false ||
    typeof lengthDescriptor.value !== "number" ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    return fail("RejectedInvalidRequest", "InvalidRequest", path, "Array length must be a normal safe integer property.");
  }
  const length = lengthDescriptor.value;
  if (length > maximumLength) {
    return fail("RejectedBudgetExceeded", "BudgetExceeded", path, budgetMessage);
  }

  const ownKeys = Reflect.ownKeys(value);
  for (const key of ownKeys) {
    if (
      typeof key !== "string" ||
      (key !== "length" && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length))
    ) {
      return fail("RejectedInvalidRequest", "InvalidRequest", path, "Arrays cannot contain extra properties.");
    }
  }

  const snapshot: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined) {
      return fail("RejectedInvalidRequest", "InvalidRequest", `${path}/${index}`, "Sparse arrays are not supported.");
    }
    if (!("value" in descriptor) || descriptor.enumerable !== true) {
      return fail(
        "RejectedInvalidRequest",
        "InvalidRequest",
        `${path}/${index}`,
        "Array entries must be enumerable data properties."
      );
    }
    snapshot.push(descriptor.value);
  }
  return Object.freeze(snapshot);
};

const finite = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail("RejectedInvalidRequest", "InvalidNumber", path, "Expected a finite SI value.");
  }
  return Object.is(value, -0) ? 0 : value;
};

const finitePositive = (value: unknown, path: string): number => {
  const parsed = finite(value, path);
  if (parsed <= 0) {
    return fail("RejectedInvalidRequest", "InvalidNumber", path, "Expected a positive finite SI value.");
  }
  return parsed;
};

const finiteNonnegative = (value: unknown, path: string, code: TrajectoryIssueCode): number => {
  const parsed = finite(value, path);
  if (parsed < 0) {
    return fail(
      code === "InvalidHazard" ? "RejectedHazardPolicy" : "RejectedInvalidRequest",
      code,
      path,
      "Expected a nonnegative finite value."
    );
  }
  return parsed;
};

const tick = (value: unknown, path: string): SimulationTick => {
  try {
    return createSimulationTick(value, path);
  } catch {
    return fail("RejectedInvalidRequest", "InvalidTick", path, "Expected a nonnegative safe integer tick.");
  }
};

const positiveSafeInteger = (value: unknown, path: string, code: TrajectoryIssueCode): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    return fail("RejectedInvalidRequest", code, path, "Expected a positive safe integer.");
  }
  return value;
};

const vector = (value: unknown, path: string): Vec3 => {
  const source = record(value, path);
  return Object.freeze({
    x: finite(source.x, `${path}/x`),
    y: finite(source.y, `${path}/y`),
    z: finite(source.z, `${path}/z`)
  });
};

const BODY_INERTIAL_FRAME_PREFIX = "frame:body-inertial.";

const frame = (value: unknown, path: string): FrameId => {
  try {
    const parsed = parseFrameId(value, path);
    const frameIdText: string = parsed;
    if (
      frameIdText === "frame:system" ||
      (frameIdText.startsWith(BODY_INERTIAL_FRAME_PREFIX) && frameIdText.length > BODY_INERTIAL_FRAME_PREFIX.length)
    ) {
      return parsed;
    }
    return fail("RejectedInvalidRequest", "InvalidRequest", path, "Expected a valid inertial frame ID.");
  } catch {
    return fail("RejectedInvalidRequest", "InvalidRequest", path, "Expected a valid inertial frame ID.");
  }
};

const assertSameFrame = (actual: FrameId, expected: FrameId, path: string): void => {
  if (actual !== expected) {
    fail("RejectedFrameMismatch", "FrameMismatch", path, "All trajectory values must use the initial inertial frame.");
  }
};

const state = (value: unknown, path: string): TrajectoryState => {
  const source = record(value, path);
  return Object.freeze({
    frameId: frame(source.frameId, `${path}/frameId`),
    epochTick: tick(source.epochTick, `${path}/epochTick`),
    positionMeters: vector(source.positionMeters, `${path}/positionMeters`),
    velocityMetersPerSecond: vector(source.velocityMetersPerSecond, `${path}/velocityMetersPerSecond`),
    massKilograms: finitePositive(source.massKilograms, `${path}/massKilograms`)
  });
};

const gravitySource = (value: unknown, path: string): LinearPointMassGravitySource => {
  const source = record(value, path);
  return Object.freeze({
    frameId: frame(source.frameId, `${path}/frameId`),
    epochTick: tick(source.epochTick, `${path}/epochTick`),
    positionMeters: vector(source.positionMeters, `${path}/positionMeters`),
    velocityMetersPerSecond: vector(source.velocityMetersPerSecond, `${path}/velocityMetersPerSecond`),
    gravitationalParameterMu: finitePositive(source.gravitationalParameterMu, `${path}/gravitationalParameterMu`)
  });
};

const integratorNames = Object.freeze([
  "SemiImplicitEuler",
  "VelocityVerlet",
  "RungeKutta4"
] as const satisfies readonly TrajectoryIntegrator[]);

const integrator = (value: unknown, path: string): TrajectoryIntegrator => {
  if (typeof value !== "string" || !(integratorNames as readonly string[]).includes(value)) {
    return fail(
      "RejectedInvalidRequest",
      "InvalidIntegratorPolicy",
      path,
      "Integrator must explicitly be SemiImplicitEuler, VelocityVerlet or RungeKutta4."
    );
  }
  return value as TrajectoryIntegrator;
};

const integratorPolicy = (value: unknown, path: string): TrajectoryIntegratorPolicy => {
  const source = record(value, path);
  return Object.freeze({
    gravityCoast: integrator(source.gravityCoast, `${path}/gravityCoast`),
    constantInertialAcceleration: integrator(
      source.constantInertialAcceleration,
      `${path}/constantInertialAcceleration`
    )
  });
};

const toleranceProfile = (value: unknown, path: string): TrajectoryToleranceProfile => {
  const source = record(value, path);
  return Object.freeze({
    relativeEnergyTolerance: finiteNonnegative(
      source.relativeEnergyTolerance,
      `${path}/relativeEnergyTolerance`,
      "InvalidToleranceProfile"
    ),
    relativeAngularMomentumTolerance: finiteNonnegative(
      source.relativeAngularMomentumTolerance,
      `${path}/relativeAngularMomentumTolerance`,
      "InvalidToleranceProfile"
    ),
    circularityTolerance: finiteNonnegative(
      source.circularityTolerance,
      `${path}/circularityTolerance`,
      "InvalidToleranceProfile"
    ),
    closureDistanceToleranceMeters: finiteNonnegative(
      source.closureDistanceToleranceMeters,
      `${path}/closureDistanceToleranceMeters`,
      "InvalidToleranceProfile"
    ),
    hazardGeometryEpsilonMeters: finiteNonnegative(
      source.hazardGeometryEpsilonMeters,
      `${path}/hazardGeometryEpsilonMeters`,
      "InvalidToleranceProfile"
    ),
    minimumGravityDistanceMeters: finitePositive(
      source.minimumGravityDistanceMeters,
      `${path}/minimumGravityDistanceMeters`
    ),
    relativeDenominatorFloor: finitePositive(source.relativeDenominatorFloor, `${path}/relativeDenominatorFloor`)
  });
};

interface TimelineValidation {
  readonly segments: readonly TrajectorySegment[];
  readonly integrationStepCount: number;
}

const aligned = (value: number, epochTick: number, stepTicks: number): boolean =>
  Number.isSafeInteger(value - epochTick) && (value - epochTick) % stepTicks === 0;

const segmentId = (
  value: unknown,
  path: string
): ReturnType<typeof createTrajectorySegmentId> => {
  try {
    return createTrajectorySegmentId(value, path);
  } catch {
    return fail("RejectedInvalidRequest", "InvalidSegment", path, "Segment ID is invalid.");
  }
};

const continuousSegment = (
  source: UnknownRecord,
  kind: TrajectoryContinuousSegment["kind"],
  path: string
): TrajectoryContinuousSegment => {
  const parsedSegmentId = segmentId(source.segmentId, `${path}/segmentId`);
  const frameId = frame(source.frameId, `${path}/frameId`);
  const startTick = tick(source.startTick, `${path}/startTick`);
  const endTick = tick(source.endTick, `${path}/endTick`);
  if (kind === "GravityCoast") {
    return Object.freeze({
      kind: "GravityCoast",
      segmentId: parsedSegmentId,
      frameId,
      startTick,
      endTick
    } satisfies GravityCoastSegment);
  }
  return Object.freeze({
    kind: "ConstantInertialAcceleration",
    segmentId: parsedSegmentId,
    frameId,
    startTick,
    endTick,
    accelerationMetersPerSecondSquared: vector(
      source.accelerationMetersPerSecondSquared,
      `${path}/accelerationMetersPerSecondSquared`
    )
  } satisfies ConstantInertialAccelerationSegment);
};

const impulseSegment = (source: UnknownRecord, path: string): ImpulseDeltaVSegment => {
  return Object.freeze({
    kind: "ImpulseDeltaV",
    segmentId: segmentId(source.segmentId, `${path}/segmentId`),
    frameId: frame(source.frameId, `${path}/frameId`),
    tick: tick(source.tick, `${path}/tick`),
    deltaVelocityMetersPerSecond: vector(
      source.deltaVelocityMetersPerSecond,
      `${path}/deltaVelocityMetersPerSecond`
    )
  });
};

const trajectorySegment = (source: UnknownRecord, path: string): TrajectorySegment => {
  switch (source.kind) {
    case "GravityCoast":
    case "ConstantInertialAcceleration":
      return continuousSegment(source, source.kind, path);
    case "ImpulseDeltaV":
      return impulseSegment(source, path);
    default:
      return fail("RejectedInvalidRequest", "InvalidSegment", `${path}/kind`, "Unsupported trajectory segment kind.");
  }
};

const validateTimeline = (
  value: unknown,
  initialEpochTick: SimulationTick,
  initialFrameId: FrameId,
  stepTicks: number
): TimelineValidation => {
  const source = denseArray(
    value,
    "/segments",
    TRAJECTORY_V1_MAX_SEGMENTS,
    "Trajectory segment budget exceeded."
  );

  const parsed: TrajectorySegment[] = [];
  const segmentIds = new Set<string>();
  const impulseTicks = new Set<number>();
  let cursor = initialEpochTick as number;
  let integrationStepCount = 0;
  let previousOrderTick = -1;
  let previousOrderPhase = -1;
  let previousOrderId = "";

  for (let index = 0; index < source.length; index += 1) {
    const path = `/segments/${index}`;
    const candidate = record(source[index], path);
    const segment = trajectorySegment(candidate, path);

    if (segmentIds.has(segment.segmentId)) {
      fail("RejectedInvalidRequest", "DuplicateSegmentId", `${path}/segmentId`, "Segment IDs must be unique.");
    }
    segmentIds.add(segment.segmentId);
    assertSameFrame(segment.frameId, initialFrameId, `${path}/frameId`);

    if (segment.kind === "ImpulseDeltaV") {
      if (!aligned(segment.tick, initialEpochTick, stepTicks)) {
        fail("RejectedStepMismatch", "StepMismatch", `${path}/tick`, "Impulse tick must align exactly to stepTicks.");
      }
      if (impulseTicks.has(segment.tick)) {
        fail(
          "RejectedInvalidRequest",
          "DuplicateImpulseTick",
          `${path}/tick`,
          "Duplicate impulse ticks are ambiguous in trajectory v1."
        );
      }
      impulseTicks.add(segment.tick);
      if (segment.tick < cursor) {
        fail("RejectedSegmentOverlap", "SegmentOverlap", `${path}/tick`, "Impulse overlaps an occupied interval.");
      }
      if (segment.tick > cursor) {
        fail("RejectedInvalidRequest", "SegmentGap", `${path}/tick`, "Timeline contains a gap; implicit coast is forbidden.");
      }
    } else {
      if (segment.endTick <= segment.startTick) {
        fail("RejectedInvalidRequest", "InvalidSegment", `${path}/endTick`, "Continuous segments must have positive duration.");
      }
      if (
        !aligned(segment.startTick, initialEpochTick, stepTicks) ||
        !aligned(segment.endTick, initialEpochTick, stepTicks)
      ) {
        fail(
          "RejectedStepMismatch",
          "StepMismatch",
          path,
          "Every continuous boundary must align exactly to stepTicks."
        );
      }
      if (segment.startTick < cursor) {
        fail("RejectedSegmentOverlap", "SegmentOverlap", `${path}/startTick`, "Continuous segments overlap.");
      }
      if (segment.startTick > cursor) {
        fail(
          "RejectedInvalidRequest",
          "SegmentGap",
          `${path}/startTick`,
          "Continuous timeline contains a gap; implicit coast is forbidden."
        );
      }
      const segmentSteps = (segment.endTick - segment.startTick) / stepTicks;
      if (!Number.isSafeInteger(segmentSteps) || !Number.isSafeInteger(integrationStepCount + segmentSteps)) {
        fail("RejectedBudgetExceeded", "UnsafeArithmetic", path, "Prospective integration step arithmetic is unsafe.");
      }
      integrationStepCount += segmentSteps;
      if (integrationStepCount > TRAJECTORY_V1_MAX_INTEGRATION_STEPS) {
        fail("RejectedBudgetExceeded", "BudgetExceeded", path, "Trajectory integration step budget exceeded.");
      }
      cursor = segment.endTick;
    }

    const orderTick = segment.kind === "ImpulseDeltaV" ? segment.tick : segment.startTick;
    const orderPhase = segment.kind === "ImpulseDeltaV" ? 0 : 1;
    if (
      orderTick < previousOrderTick ||
      (orderTick === previousOrderTick && orderPhase < previousOrderPhase) ||
      (orderTick === previousOrderTick && orderPhase === previousOrderPhase && segment.segmentId <= previousOrderId)
    ) {
      fail(
        "RejectedInvalidRequest",
        "SegmentOrder",
        path,
        "Segments must already be ordered by start tick, boundary phase and lexical segment ID."
      );
    }
    previousOrderTick = orderTick;
    previousOrderPhase = orderPhase;
    previousOrderId = segment.segmentId;
    parsed.push(segment);
  }

  return Object.freeze({
    segments: Object.freeze(parsed),
    integrationStepCount
  });
};

const calculateSampleCount = (
  segments: readonly TrajectorySegment[],
  integrationStepCount: number,
  stepTicks: number,
  sampleEverySteps: number
): number => {
  let completedSteps = 0;
  let boundarySamplesOutsideCadence = 0;
  let impulseSamples = 0;
  for (const segment of segments) {
    if (segment.kind === "ImpulseDeltaV") {
      impulseSamples += 1;
    } else {
      completedSteps += (segment.endTick - segment.startTick) / stepTicks;
      if (completedSteps % sampleEverySteps !== 0) {
        boundarySamplesOutsideCadence += 1;
      }
    }
  }
  const cadenceSamples = Math.floor(integrationStepCount / sampleEverySteps);
  const sampleCount = 1 + cadenceSamples + boundarySamplesOutsideCadence + impulseSamples;
  if (!Number.isSafeInteger(sampleCount)) {
    fail("RejectedBudgetExceeded", "UnsafeArithmetic", "/sampleEverySteps", "Prospective sample arithmetic is unsafe.");
  }
  return sampleCount;
};

const hazards = (value: unknown, expectedFrameId: FrameId): readonly SphericalTrajectoryHazard[] => {
  const source = denseArray(value, "/hazards", TRAJECTORY_V1_MAX_HAZARDS, "Trajectory hazard budget exceeded.");
  const parsed: SphericalTrajectoryHazard[] = [];
  const hazardIds = new Set<string>();
  for (let index = 0; index < source.length; index += 1) {
    const path = `/hazards/${index}`;
    try {
      const candidate = record(source[index], path);
      const parsedHazardId = (() => {
        try {
          return createTrajectoryHazardId(candidate.hazardId, `${path}/hazardId`);
        } catch {
          return fail("RejectedHazardPolicy", "InvalidHazard", `${path}/hazardId`, "Hazard ID is invalid.");
        }
      })();
      if (hazardIds.has(parsedHazardId)) {
        fail("RejectedHazardPolicy", "DuplicateHazardId", `${path}/hazardId`, "Hazard IDs must be unique.");
      }
      hazardIds.add(parsedHazardId);
      const hazardFrameId = frame(candidate.frameId, `${path}/frameId`);
      assertSameFrame(hazardFrameId, expectedFrameId, `${path}/frameId`);
      const radiusMeters = finitePositive(candidate.radiusMeters, `${path}/radiusMeters`);
      const safetyMarginMeters = finiteNonnegative(
        candidate.safetyMarginMeters,
        `${path}/safetyMarginMeters`,
        "InvalidHazard"
      );
      if (!Number.isFinite(radiusMeters + safetyMarginMeters)) {
        fail("RejectedHazardPolicy", "InvalidHazard", path, "Hazard effective radius must remain finite.");
      }
      parsed.push(
        Object.freeze({
          hazardId: parsedHazardId,
          frameId: hazardFrameId,
          centerMeters: vector(candidate.centerMeters, `${path}/centerMeters`),
          radiusMeters,
          safetyMarginMeters
        })
      );
    } catch (error) {
      if (error instanceof TrajectoryValidationFailure) {
        if (error.status === "RejectedFrameMismatch" || error.status === "RejectedHazardPolicy") {
          throw error;
        }
        fail("RejectedHazardPolicy", "InvalidHazard", error.issue.path, error.issue.message);
      }
      fail("RejectedHazardPolicy", "InvalidHazard", path, "Hazard could not be validated.");
    }
  }
  parsed.sort((left, right) => (left.hazardId < right.hazardId ? -1 : left.hazardId > right.hazardId ? 1 : 0));
  return Object.freeze(parsed);
};

export const validateTrajectoryPredictionRequest = (value: unknown): TrajectoryRequestValidationResult => {
  try {
    const source = record(value, "");
    const predictionId = (() => {
      try {
        return createTrajectoryPredictionId(source.predictionId, "/predictionId");
      } catch {
        return fail("RejectedInvalidRequest", "InvalidPredictionId", "/predictionId", "Prediction ID is invalid.");
      }
    })();
    const initialState = state(source.initialState, "/initialState");
    const parsedGravitySource = gravitySource(source.gravitySource, "/gravitySource");
    assertSameFrame(parsedGravitySource.frameId, initialState.frameId, "/gravitySource/frameId");
    const stepTicks = positiveSafeInteger(source.stepTicks, "/stepTicks", "InvalidStepTicks");
    const sampleEverySteps = positiveSafeInteger(
      source.sampleEverySteps,
      "/sampleEverySteps",
      "InvalidSampleCadence"
    );
    const policy = integratorPolicy(source.integratorPolicy, "/integratorPolicy");
    const tolerance = toleranceProfile(source.toleranceProfile, "/toleranceProfile");
    const timeline = validateTimeline(source.segments, initialState.epochTick, initialState.frameId, stepTicks);
    const parsedHazards = hazards(source.hazards, initialState.frameId);
    const sampleCount = calculateSampleCount(
      timeline.segments,
      timeline.integrationStepCount,
      stepTicks,
      sampleEverySteps
    );
    const budgetEstimate = Object.freeze({
      segmentCount: timeline.segments.length,
      hazardCount: parsedHazards.length,
      integrationStepCount: timeline.integrationStepCount,
      sampleCount
    });
    if (sampleCount > TRAJECTORY_V1_MAX_SAMPLES) {
      fail(
        "RejectedBudgetExceeded",
        "BudgetExceeded",
        "/sampleEverySteps",
        "Trajectory emitted sample budget exceeded.",
        budgetEstimate
      );
    }
    const request: TrajectoryPredictionRequest = Object.freeze({
      predictionId,
      initialState,
      gravitySource: parsedGravitySource,
      segments: timeline.segments,
      integratorPolicy: policy,
      stepTicks,
      sampleEverySteps,
      hazards: parsedHazards,
      toleranceProfile: tolerance
    });
    return Object.freeze({ valid: true, request, budgetEstimate });
  } catch (error) {
    if (error instanceof TrajectoryValidationFailure) {
      return Object.freeze({
        valid: false,
        status: error.status,
        issues: Object.freeze([error.issue]),
        budgetEstimate: error.budgetEstimate
      });
    }
    return Object.freeze({
      valid: false,
      status: "RejectedInvalidRequest",
      issues: Object.freeze([
        issue("InvalidRequest", "", "Trajectory request could not be validated without invoking caller behavior.")
      ]),
      budgetEstimate: null
    });
  }
};
