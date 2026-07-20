import type { Vec3 } from "../core/vector";
import type { SimulationTick } from "../persistence/time";
import type { FrameId } from "../spatial/ids";
import type {
  TrajectoryCanonicalSignature,
  TrajectoryHazardId,
  TrajectoryPredictionId,
  TrajectorySegmentId
} from "./ids";

export const TRAJECTORY_V1_MAX_SEGMENTS = 4_096;
export const TRAJECTORY_V1_MAX_HAZARDS = 4_096;
export const TRAJECTORY_V1_MAX_INTEGRATION_STEPS = 250_000;
export const TRAJECTORY_V1_MAX_SAMPLES = 50_000;

export const TRAJECTORY_V1_BUDGETS = Object.freeze({
  maxSegments: TRAJECTORY_V1_MAX_SEGMENTS,
  maxHazards: TRAJECTORY_V1_MAX_HAZARDS,
  maxIntegrationSteps: TRAJECTORY_V1_MAX_INTEGRATION_STEPS,
  maxSamples: TRAJECTORY_V1_MAX_SAMPLES
} as const);

export type TrajectoryIntegrator = "SemiImplicitEuler" | "VelocityVerlet" | "RungeKutta4";

export interface TrajectoryIntegratorPolicy {
  readonly gravityCoast: TrajectoryIntegrator;
  readonly constantInertialAcceleration: TrajectoryIntegrator;
}

export const createDefaultTrajectoryIntegratorPolicy = (): TrajectoryIntegratorPolicy =>
  Object.freeze({
    gravityCoast: "VelocityVerlet",
    constantInertialAcceleration: "RungeKutta4"
  });

export interface TrajectoryState {
  readonly frameId: FrameId;
  readonly epochTick: SimulationTick;
  readonly positionMeters: Vec3;
  readonly velocityMetersPerSecond: Vec3;
  readonly massKilograms: number;
}

export interface LinearPointMassGravitySource {
  readonly frameId: FrameId;
  readonly epochTick: SimulationTick;
  readonly positionMeters: Vec3;
  readonly velocityMetersPerSecond: Vec3;
  readonly gravitationalParameterMu: number;
}

interface TrajectoryContinuousSegmentBase {
  readonly segmentId: TrajectorySegmentId;
  readonly frameId: FrameId;
  readonly startTick: SimulationTick;
  readonly endTick: SimulationTick;
}

export interface GravityCoastSegment extends TrajectoryContinuousSegmentBase {
  readonly kind: "GravityCoast";
}

export interface ConstantInertialAccelerationSegment extends TrajectoryContinuousSegmentBase {
  readonly kind: "ConstantInertialAcceleration";
  readonly accelerationMetersPerSecondSquared: Vec3;
}

export interface ImpulseDeltaVSegment {
  readonly kind: "ImpulseDeltaV";
  readonly segmentId: TrajectorySegmentId;
  readonly frameId: FrameId;
  readonly tick: SimulationTick;
  readonly deltaVelocityMetersPerSecond: Vec3;
}

export type TrajectorySegment = GravityCoastSegment | ConstantInertialAccelerationSegment | ImpulseDeltaVSegment;
export type TrajectoryContinuousSegment = GravityCoastSegment | ConstantInertialAccelerationSegment;

export interface SphericalTrajectoryHazard {
  readonly hazardId: TrajectoryHazardId;
  readonly frameId: FrameId;
  readonly centerMeters: Vec3;
  readonly radiusMeters: number;
  readonly safetyMarginMeters: number;
}

export interface TrajectoryToleranceProfile {
  readonly relativeEnergyTolerance: number;
  readonly relativeAngularMomentumTolerance: number;
  readonly circularityTolerance: number;
  readonly closureDistanceToleranceMeters: number;
  readonly hazardGeometryEpsilonMeters: number;
  readonly minimumGravityDistanceMeters: number;
  readonly relativeDenominatorFloor: number;
}

export type ToleranceProfile = TrajectoryToleranceProfile;

export interface TrajectoryPredictionRequest {
  readonly predictionId: TrajectoryPredictionId;
  readonly initialState: TrajectoryState;
  readonly gravitySource: LinearPointMassGravitySource;
  readonly segments: readonly TrajectorySegment[];
  readonly integratorPolicy: TrajectoryIntegratorPolicy;
  readonly stepTicks: number;
  readonly sampleEverySteps: number;
  readonly hazards: readonly SphericalTrajectoryHazard[];
  readonly toleranceProfile: TrajectoryToleranceProfile;
}

export type TrajectorySamplePhase = "Initial" | "StepEnd" | "SegmentBoundary" | "ImpulsePostState" | "Final";

export interface TrajectorySample {
  readonly tick: SimulationTick;
  readonly phase: TrajectorySamplePhase;
  readonly globalStepOrdinal: number;
  readonly stableOrdinal: number;
  readonly state: TrajectoryState;
  readonly reasons: readonly TrajectorySamplePhase[];
}

interface ContinuousTrajectorySegmentResultBase {
  readonly segmentId: TrajectorySegmentId;
  readonly frameId: FrameId;
  readonly startTick: SimulationTick;
  readonly endTick: SimulationTick;
  readonly resolvedIntegrator: TrajectoryIntegrator;
  readonly integrationSteps: number;
  readonly initialState: TrajectoryState;
  readonly finalState: TrajectoryState;
}

export interface GravityCoastSegmentResult extends ContinuousTrajectorySegmentResultBase {
  readonly kind: "GravityCoast";
}

export interface ConstantInertialAccelerationSegmentResult extends ContinuousTrajectorySegmentResultBase {
  readonly kind: "ConstantInertialAcceleration";
}

export interface ImpulseTrajectorySegmentResult {
  readonly kind: "ImpulseDeltaV";
  readonly segmentId: TrajectorySegmentId;
  readonly frameId: FrameId;
  readonly tick: SimulationTick;
  readonly preImpulseState: TrajectoryState;
  readonly postImpulseState: TrajectoryState;
}

export type TrajectorySegmentResult =
  | GravityCoastSegmentResult
  | ConstantInertialAccelerationSegmentResult
  | ImpulseTrajectorySegmentResult;

export interface TrajectoryHazardEventLocation {
  readonly stepStartTick: SimulationTick;
  readonly stepEndTick: SimulationTick;
  readonly fraction: number;
  readonly positionMeters: Vec3;
}

export interface TrajectoryHazardEvent {
  readonly hazardId: TrajectoryHazardId;
  readonly entry: TrajectoryHazardEventLocation;
  readonly exit: TrajectoryHazardEventLocation | null;
  readonly minimum: TrajectoryHazardEventLocation;
  readonly minimumCenterDistanceMeters: number;
  readonly minimumClearanceMeters: number;
  readonly startedInside: boolean;
  readonly tangent: boolean;
}

export interface TrajectoryClosestApproach {
  readonly hazardId: TrajectoryHazardId;
  readonly location: TrajectoryHazardEventLocation;
  readonly centerDistanceMeters: number;
  readonly clearanceMeters: number;
}

export interface CircularClosureMetrics {
  readonly roundedPeriodTicks: number;
  readonly positionClosureDistanceMeters: number;
  readonly withinTolerance: boolean;
}

export interface TrajectoryMetrics {
  readonly initialSpecificOrbitalEnergyJoulesPerKilogram: number;
  readonly finalSpecificOrbitalEnergyJoulesPerKilogram: number;
  readonly initialSpecificAngularMomentumMetersSquaredPerSecond: number;
  readonly finalSpecificAngularMomentumMetersSquaredPerSecond: number;
  readonly relativeEnergyDrift: number;
  readonly relativeAngularMomentumDrift: number;
  readonly maximumStepTicks: number;
  readonly maximumStepSeconds: number;
  readonly totalIntegrationSteps: number;
  readonly totalSamples: number;
  readonly circularClosure: CircularClosureMetrics | null;
}

export interface TrajectorySourceApproximation {
  readonly model: "InertialLinearPointMass";
  readonly sourceEpochTick: SimulationTick;
  readonly ticksPerSecond: 120;
}

export type TrajectoryPredictionStatus =
  | "Completed"
  | "RejectedInvalidRequest"
  | "RejectedFrameMismatch"
  | "RejectedSegmentOverlap"
  | "RejectedStepMismatch"
  | "RejectedNumericalFailure"
  | "RejectedHazardPolicy"
  | "RejectedBudgetExceeded";

export type TrajectoryRejectionStatus = Exclude<TrajectoryPredictionStatus, "Completed">;
export type TrajectoryValidationRejectionStatus = Exclude<TrajectoryRejectionStatus, "RejectedNumericalFailure">;

export type TrajectoryIssueCode =
  | "InvalidRequest"
  | "InvalidPredictionId"
  | "InvalidNumber"
  | "InvalidTick"
  | "InvalidStepTicks"
  | "InvalidSampleCadence"
  | "InvalidIntegratorPolicy"
  | "InvalidSegment"
  | "DuplicateSegmentId"
  | "SegmentOrder"
  | "SegmentGap"
  | "SegmentOverlap"
  | "DuplicateImpulseTick"
  | "StepMismatch"
  | "FrameMismatch"
  | "InvalidHazard"
  | "DuplicateHazardId"
  | "InvalidToleranceProfile"
  | "BudgetExceeded"
  | "UnsafeArithmetic"
  | "NumericalFailure";

export interface TrajectoryIssue {
  readonly code: TrajectoryIssueCode;
  readonly path: string;
  readonly message: string;
}

export interface TrajectoryBudgetEstimate {
  readonly segmentCount: number;
  readonly hazardCount: number;
  readonly integrationStepCount: number;
  readonly sampleCount: number;
}

export interface CompletedTrajectoryPredictionResult {
  readonly status: "Completed";
  readonly predictionId: TrajectoryPredictionId;
  readonly frameId: FrameId;
  readonly startTick: SimulationTick;
  readonly endTick: SimulationTick;
  readonly sourceApproximation: TrajectorySourceApproximation;
  readonly integratorPolicy: TrajectoryIntegratorPolicy;
  readonly toleranceProfile: TrajectoryToleranceProfile;
  readonly segmentResults: readonly TrajectorySegmentResult[];
  readonly samples: readonly TrajectorySample[];
  readonly hazardEvents: readonly TrajectoryHazardEvent[];
  readonly closestApproaches: readonly TrajectoryClosestApproach[];
  readonly metrics: TrajectoryMetrics;
  readonly canonicalSignature: TrajectoryCanonicalSignature;
}

export interface RejectedTrajectoryPredictionResult {
  readonly status: TrajectoryRejectionStatus;
  readonly predictionId: TrajectoryPredictionId | null;
  readonly issues: readonly TrajectoryIssue[];
  readonly budgetEstimate: TrajectoryBudgetEstimate | null;
  readonly canonicalSignature: TrajectoryCanonicalSignature;
}

export type TrajectoryPredictionResult = CompletedTrajectoryPredictionResult | RejectedTrajectoryPredictionResult;

export interface ValidTrajectoryRequest {
  readonly valid: true;
  readonly request: TrajectoryPredictionRequest;
  readonly budgetEstimate: TrajectoryBudgetEstimate;
}

export interface InvalidTrajectoryRequest {
  readonly valid: false;
  readonly status: TrajectoryValidationRejectionStatus;
  readonly issues: readonly TrajectoryIssue[];
  readonly budgetEstimate: TrajectoryBudgetEstimate | null;
}

export type TrajectoryRequestValidationResult = ValidTrajectoryRequest | InvalidTrajectoryRequest;
