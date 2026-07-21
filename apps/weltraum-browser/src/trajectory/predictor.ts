import { UNIVERSE_TICKS_PER_SECOND } from "../persistence/time";
import { createTrajectoryPredictionId, type TrajectoryPredictionId } from "./ids";
import { createCompletedTrajectoryPredictionResult, createRejectedTrajectoryPredictionResult } from "./canonical";
import { createTrajectoryClosestApproaches } from "./closestApproach";
import { analyzeSweptTrajectoryHazards, createTrajectoryHazardEvents } from "./hazards";
import { TrajectoryPropagationError } from "./integrators";
import { calculateTrajectoryMetrics } from "./metrics";
import { propagateTrajectoryRequest, type TrajectoryPropagationResult } from "./propagation";
import { validateTrajectoryPredictionRequest } from "./segments";
import type {
  RejectedTrajectoryPredictionResult,
  TrajectoryIssue,
  TrajectoryPredictionResult,
  TrajectorySample,
  TrajectorySamplePhase,
  TrajectoryState,
  ValidTrajectoryRequest
} from "./types";

const SAMPLE_REASON_ORDER: readonly TrajectorySamplePhase[] = Object.freeze([
  "Initial",
  "StepEnd",
  "SegmentBoundary",
  "ImpulsePostState",
  "Final"
]);

interface MutableSample {
  readonly tick: TrajectorySample["tick"];
  readonly globalStepOrdinal: number;
  readonly state: TrajectoryState;
  readonly reasons: TrajectorySamplePhase[];
}

const sameState = (left: TrajectoryState, right: TrajectoryState): boolean =>
  left.frameId === right.frameId &&
  left.epochTick === right.epochTick &&
  left.massKilograms === right.massKilograms &&
  left.positionMeters.x === right.positionMeters.x &&
  left.positionMeters.y === right.positionMeters.y &&
  left.positionMeters.z === right.positionMeters.z &&
  left.velocityMetersPerSecond.x === right.velocityMetersPerSecond.x &&
  left.velocityMetersPerSecond.y === right.velocityMetersPerSecond.y &&
  left.velocityMetersPerSecond.z === right.velocityMetersPerSecond.z;

const addReason = (sample: MutableSample, reason: TrajectorySamplePhase): void => {
  if (!sample.reasons.includes(reason)) {
    sample.reasons.push(reason);
    sample.reasons.sort((left, right) => SAMPLE_REASON_ORDER.indexOf(left) - SAMPLE_REASON_ORDER.indexOf(right));
  }
};

const buildSamples = (
  validated: ValidTrajectoryRequest,
  propagation: TrajectoryPropagationResult
): readonly TrajectorySample[] => {
  const request = validated.request;
  const samples: MutableSample[] = [{
    tick: propagation.initialState.epochTick,
    globalStepOrdinal: 0,
    state: propagation.initialState,
    reasons: ["Initial"]
  }];
  let globalStepOrdinal = 0;
  let stepIndex = 0;

  const append = (state: TrajectoryState, reason: TrajectorySamplePhase, collapseWithLast: boolean): void => {
    const previous = samples[samples.length - 1];
    if (collapseWithLast && previous !== undefined && sameState(previous.state, state)) {
      addReason(previous, reason);
      return;
    }
    samples.push({ tick: state.epochTick, globalStepOrdinal, state, reasons: [reason] });
  };

  for (let segmentIndex = 0; segmentIndex < request.segments.length; segmentIndex += 1) {
    const segment = request.segments[segmentIndex];
    const result = propagation.segmentResults[segmentIndex];
    if (segment === undefined || result === undefined || segment.kind !== result.kind) {
      throw new TrajectoryPropagationError(
        "NonFiniteValue",
        "/samples/segmentResults",
        "Observed segment results drifted from the validated request."
      );
    }
    if (segment.kind === "ImpulseDeltaV") {
      if (result.kind !== "ImpulseDeltaV") {
        throw new TrajectoryPropagationError("NonFiniteValue", "/samples/impulse", "Impulse result is missing.");
      }
      append(result.postImpulseState, "ImpulsePostState", false);
      continue;
    }
    if (result.kind === "ImpulseDeltaV") {
      throw new TrajectoryPropagationError("NonFiniteValue", "/samples/continuous", "Continuous result is missing.");
    }
    for (let ordinal = 0; ordinal < result.integrationSteps; ordinal += 1) {
      const step = propagation.steps[stepIndex];
      if (step === undefined || step.segmentId !== segment.segmentId) {
        throw new TrajectoryPropagationError(
          "NonFiniteValue",
          "/samples/steps",
          "Observed integration steps drifted from the validated request."
        );
      }
      stepIndex += 1;
      globalStepOrdinal += 1;
      if (globalStepOrdinal % request.sampleEverySteps === 0) {
        append(step.endState, "StepEnd", false);
      }
    }
    append(result.finalState, "SegmentBoundary", true);
  }
  append(propagation.finalState, "Final", true);

  if (stepIndex !== propagation.steps.length || samples.length !== validated.budgetEstimate.sampleCount) {
    throw new TrajectoryPropagationError(
      "NonFiniteValue",
      "/samples",
      "Observed emitted sample count drifted from the validated budget estimate."
    );
  }
  return Object.freeze(samples.map((sample, stableOrdinal) => {
    const phase = sample.reasons[sample.reasons.length - 1];
    if (phase === undefined) {
      throw new TrajectoryPropagationError("NonFiniteValue", "/samples/reasons", "Trajectory sample has no reason.");
    }
    return Object.freeze({
      tick: sample.tick,
      phase,
      globalStepOrdinal: sample.globalStepOrdinal,
      stableOrdinal,
      state: sample.state,
      reasons: Object.freeze([...sample.reasons])
    });
  }));
};

const tryPredictionId = (value: unknown): TrajectoryPredictionId | null => {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, "predictionId");
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      return null;
    }
    return createTrajectoryPredictionId(descriptor.value);
  } catch {
    return null;
  }
};

const numericalRejection = (
  predictionId: TrajectoryPredictionId,
  budgetEstimate: ValidTrajectoryRequest["budgetEstimate"],
  error: unknown
): RejectedTrajectoryPredictionResult => {
  const issue: TrajectoryIssue = error instanceof TrajectoryPropagationError
    ? Object.freeze({
        code: error.code === "UnsafeTickArithmetic" ? "UnsafeArithmetic" : "NumericalFailure",
        path: error.path,
        message: error.message
      })
    : Object.freeze({
        code: "NumericalFailure",
        path: "",
        message: "Trajectory prediction could not produce a finite canonical result."
      });
  return createRejectedTrajectoryPredictionResult({
    status: "RejectedNumericalFailure",
    predictionId,
    issues: Object.freeze([issue]),
    budgetEstimate
  });
};

export const predictTrajectory = (value: unknown): TrajectoryPredictionResult => {
  const validation = validateTrajectoryPredictionRequest(value);
  if (!validation.valid) {
    return createRejectedTrajectoryPredictionResult({
      status: validation.status,
      predictionId: tryPredictionId(value),
      issues: validation.issues,
      budgetEstimate: validation.budgetEstimate
    });
  }

  try {
    const request = validation.request;
    const propagation = propagateTrajectoryRequest(validation);
    const samples = buildSamples(validation, propagation);
    const analyses = analyzeSweptTrajectoryHazards(
      propagation.steps,
      request.hazards,
      request.toleranceProfile.hazardGeometryEpsilonMeters
    );
    const hazardEvents = createTrajectoryHazardEvents(analyses);
    const closestApproaches = createTrajectoryClosestApproaches(analyses);
    const metrics = calculateTrajectoryMetrics(request, propagation, samples.length);
    return createCompletedTrajectoryPredictionResult(request, {
      status: "Completed",
      predictionId: request.predictionId,
      frameId: request.initialState.frameId,
      startTick: request.initialState.epochTick,
      endTick: propagation.finalState.epochTick,
      sourceApproximation: Object.freeze({
        model: "InertialLinearPointMass",
        sourceEpochTick: request.gravitySource.epochTick,
        ticksPerSecond: UNIVERSE_TICKS_PER_SECOND
      }),
      integratorPolicy: request.integratorPolicy,
      toleranceProfile: request.toleranceProfile,
      segmentResults: propagation.segmentResults,
      samples,
      hazardEvents,
      closestApproaches,
      metrics
    });
  } catch (error) {
    return numericalRejection(validation.request.predictionId, validation.budgetEstimate, error);
  }
};

export const predictTrajectoryRequest = predictTrajectory;
