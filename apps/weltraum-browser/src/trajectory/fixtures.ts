import { STARTER_BODY_IDS, STARTER_CELESTIAL_CATALOG } from "../celestial/starterSystem";
import { createSimulationTick, UNIVERSE_TICKS_PER_SECOND } from "../persistence/time";
import { createBodyInertialFrameId } from "../spatial/ids";
import { createTrajectoryHazardId, createTrajectoryPredictionId, createTrajectorySegmentId } from "./ids";
import { createDefaultTrajectoryIntegratorPolicy } from "./types";
import type {
  SphericalTrajectoryHazard,
  TrajectoryPredictionRequest,
  TrajectoryToleranceProfile
} from "./types";

const HESTIA_STARTER_BODY = STARTER_CELESTIAL_CATALOG.indexes.bodyById[STARTER_BODY_IDS.hestia];
if (HESTIA_STARTER_BODY === undefined) {
  throw new Error("The starter celestial catalog must contain Hestia.");
}

export const HESTIA_TRAJECTORY_GRAVITATIONAL_PARAMETER_MU = HESTIA_STARTER_BODY.gravity.gravitationalParameterMu;
export const HESTIA_TRAJECTORY_RADIUS_METERS = HESTIA_STARTER_BODY.radiusMeters;
export const HESTIA_TRAJECTORY_FRAME_ID = createBodyInertialFrameId(STARTER_BODY_IDS.hestia);

export const createHestiaTrajectoryToleranceProfile = (): TrajectoryToleranceProfile => Object.freeze({
  relativeEnergyTolerance: 1e-5,
  relativeAngularMomentumTolerance: 1e-5,
  circularityTolerance: 1e-10,
  closureDistanceToleranceMeters: 10_000,
  hazardGeometryEpsilonMeters: 1e-6,
  minimumGravityDistanceMeters: 1,
  relativeDenominatorFloor: 1e-12
});

const greatestDivisorAtMost = (value: number, maximum: number): number => {
  for (let candidate = Math.min(value, maximum); candidate >= 1; candidate -= 1) {
    if (value % candidate === 0) {
      return candidate;
    }
  }
  return 1;
};

export interface HestiaCircularTrajectoryFixtureOptions {
  readonly predictionId?: string;
  readonly altitudeMeters?: number;
  readonly massKilograms?: number;
  readonly maximumStepTicks?: number;
  readonly sampleEverySteps?: number;
}

export const createHestiaCircularTrajectoryRequest = (
  options: HestiaCircularTrajectoryFixtureOptions = {}
): TrajectoryPredictionRequest => {
  const orbitalRadius = HESTIA_TRAJECTORY_RADIUS_METERS + (options.altitudeMeters ?? 400_000);
  const periodSeconds = 2 * Math.PI * orbitalRadius *
    Math.sqrt(orbitalRadius / HESTIA_TRAJECTORY_GRAVITATIONAL_PARAMETER_MU);
  const roundedPeriodTicks = Math.floor(periodSeconds * UNIVERSE_TICKS_PER_SECOND + 0.5);
  const stepTicks = greatestDivisorAtMost(
    roundedPeriodTicks,
    options.maximumStepTicks ?? UNIVERSE_TICKS_PER_SECOND
  );
  const circularSpeed = Math.sqrt(HESTIA_TRAJECTORY_GRAVITATIONAL_PARAMETER_MU / orbitalRadius);
  return Object.freeze({
    predictionId: createTrajectoryPredictionId(options.predictionId ?? "trajectory:hestia.circular.v1"),
    initialState: Object.freeze({
      frameId: HESTIA_TRAJECTORY_FRAME_ID,
      epochTick: createSimulationTick(0),
      positionMeters: Object.freeze({ x: orbitalRadius, y: 0, z: 0 }),
      velocityMetersPerSecond: Object.freeze({ x: 0, y: circularSpeed, z: 0 }),
      massKilograms: options.massKilograms ?? 1_000
    }),
    gravitySource: Object.freeze({
      frameId: HESTIA_TRAJECTORY_FRAME_ID,
      epochTick: createSimulationTick(0),
      positionMeters: Object.freeze({ x: 0, y: 0, z: 0 }),
      velocityMetersPerSecond: Object.freeze({ x: 0, y: 0, z: 0 }),
      gravitationalParameterMu: HESTIA_TRAJECTORY_GRAVITATIONAL_PARAMETER_MU
    }),
    segments: Object.freeze([Object.freeze({
      kind: "GravityCoast" as const,
      segmentId: createTrajectorySegmentId("segment:hestia.circular.coast"),
      frameId: HESTIA_TRAJECTORY_FRAME_ID,
      startTick: createSimulationTick(0),
      endTick: createSimulationTick(roundedPeriodTicks)
    })]),
    integratorPolicy: createDefaultTrajectoryIntegratorPolicy(),
    stepTicks,
    sampleEverySteps: options.sampleEverySteps ?? 60,
    hazards: Object.freeze([]),
    toleranceProfile: createHestiaTrajectoryToleranceProfile()
  });
};

export const createHestiaTrajectoryHazard = (
  hazardId = "hazard:hestia.fixture",
  centerMeters = Object.freeze({ x: HESTIA_TRAJECTORY_RADIUS_METERS + 400_000, y: 1_000, z: 0 }),
  radiusMeters = 250,
  safetyMarginMeters = 25
): SphericalTrajectoryHazard => Object.freeze({
  hazardId: createTrajectoryHazardId(hazardId),
  frameId: HESTIA_TRAJECTORY_FRAME_ID,
  centerMeters: Object.freeze({ x: centerMeters.x, y: centerMeters.y, z: centerMeters.z }),
  radiusMeters,
  safetyMarginMeters
});

export const createHestiaAccelerationImpulseTrajectoryRequest = (): TrajectoryPredictionRequest => Object.freeze({
  predictionId: createTrajectoryPredictionId("trajectory:hestia.acceleration-impulse.v1"),
  initialState: Object.freeze({
    frameId: HESTIA_TRAJECTORY_FRAME_ID,
    epochTick: createSimulationTick(0),
    positionMeters: Object.freeze({ x: HESTIA_TRAJECTORY_RADIUS_METERS + 400_000, y: 0, z: 0 }),
    velocityMetersPerSecond: Object.freeze({ x: 0, y: 10_000, z: 0 }),
    massKilograms: 1_000
  }),
  gravitySource: Object.freeze({
    frameId: HESTIA_TRAJECTORY_FRAME_ID,
    epochTick: createSimulationTick(0),
    positionMeters: Object.freeze({ x: 0, y: 0, z: 0 }),
    velocityMetersPerSecond: Object.freeze({ x: 0, y: 0, z: 0 }),
    gravitationalParameterMu: HESTIA_TRAJECTORY_GRAVITATIONAL_PARAMETER_MU
  }),
  segments: Object.freeze([
    Object.freeze({
      kind: "ConstantInertialAcceleration" as const,
      segmentId: createTrajectorySegmentId("segment:hestia.acceleration"),
      frameId: HESTIA_TRAJECTORY_FRAME_ID,
      startTick: createSimulationTick(0),
      endTick: createSimulationTick(1_200),
      accelerationMetersPerSecondSquared: Object.freeze({ x: 0, y: 0.1, z: 0 })
    }),
    Object.freeze({
      kind: "ImpulseDeltaV" as const,
      segmentId: createTrajectorySegmentId("segment:hestia.impulse"),
      frameId: HESTIA_TRAJECTORY_FRAME_ID,
      tick: createSimulationTick(1_200),
      deltaVelocityMetersPerSecond: Object.freeze({ x: 0, y: 10, z: 0 })
    })
  ]),
  integratorPolicy: createDefaultTrajectoryIntegratorPolicy(),
  stepTicks: 12,
  sampleEverySteps: 10,
  hazards: Object.freeze([]),
  toleranceProfile: createHestiaTrajectoryToleranceProfile()
});
